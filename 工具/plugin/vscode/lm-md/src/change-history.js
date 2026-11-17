const MAX_FILES = 40;
const MAX_RECORDS_PER_FILE = 30;
const MAX_SNIPPET_LENGTH = 360;
const MAX_DIFF_DISTANCE = 256;

function lineNumberAt(text, offset) {
  const boundedOffset = Math.max(0, Math.min(String(text).length, Number(offset) || 0));
  let line = 1;
  for (let index = 0; index < boundedOffset; index += 1) {
    if (text[index] === "\n") line += 1;
  }
  return line;
}

function countChangedLines(text) {
  const value = String(text || "");
  if (!value) return 0;
  const lines = value.split("\n");
  return lines.length - (value.endsWith("\n") ? 1 : 0);
}

function makeSnippet(text) {
  const value = String(text || "").replace(/\r\n/g, "\n");
  if (!value) return "（空）";
  if (value.length <= MAX_SNIPPET_LENGTH) return value;
  return `${value.slice(0, MAX_SNIPPET_LENGTH)}…`;
}

function rebaseRecords(records, previousText, contentChanges) {
  const changes = (contentChanges || []).map((change) => {
    const offset = Number.isInteger(change.rangeOffset) ? change.rangeOffset : 0;
    const length = Number.isInteger(change.rangeLength) ? change.rangeLength : 0;
    const oldText = previousText.slice(offset, offset + length);
    return {
      startLine: change.range?.start?.line + 1 || lineNumberAt(previousText, offset),
      endLine: change.range?.end?.line + 1 || lineNumberAt(previousText, offset + length),
      startCharacter: change.range?.start?.character || 0,
      length,
      delta: (String(change.text || "").match(/\n/g) || []).length - (oldText.match(/\n/g) || []).length,
    };
  }).sort((left, right) => left.startLine - right.startLine);

  for (const record of records || []) {
    for (const hunk of record.hunks || []) {
      let shift = 0;
      for (const change of changes) {
        if (!change.delta) continue;
        const start = change.startLine + shift;
        const end = change.endLine + shift;
        if (change.length === 0 && start === end) {
          if (hunk.startLine > start || (hunk.startLine === start && change.startCharacter === 0)) {
            hunk.startLine += change.delta;
            hunk.endLine += change.delta;
          } else if (hunk.endLine >= start) {
            hunk.endLine = Math.max(hunk.startLine, hunk.endLine + change.delta);
          }
        } else if (hunk.endLine < start) {
          // This edit is below the recorded hunk.
        } else if (hunk.startLine > end) {
          hunk.startLine += change.delta;
          hunk.endLine += change.delta;
        } else if (hunk.startLine >= start) {
          hunk.startLine = start;
          hunk.endLine = Math.max(start, hunk.endLine + change.delta);
        } else {
          hunk.endLine = Math.max(hunk.startLine, hunk.endLine + change.delta);
        }
        shift += change.delta;
      }
    }
  }
}

function createChangeRecord(previousText, nextText, contentChanges, timestamp = Date.now()) {
  if (!Array.isArray(contentChanges) || contentChanges.length === 0) return null;

  const changes = contentChanges
    .map((change) => ({
      offset: Number.isInteger(change.rangeOffset)
        ? change.rangeOffset
        : 0,
      length: Number.isInteger(change.rangeLength)
        ? change.rangeLength
        : 0,
      text: String(change.text || ""),
      range: change.range,
    }))
    .sort((left, right) => left.offset - right.offset);

  let precedingDelta = 0;
  const hunks = changes.map((change) => {
    const oldText = previousText.slice(change.offset, change.offset + change.length);
    const newOffset = Math.max(0, change.offset + precedingDelta);
    const newEndOffset = newOffset + change.text.length;
    const startLine = lineNumberAt(nextText, newOffset);
    const endOffsetForLine = change.text.endsWith("\n") && change.text.length
      ? Math.max(newOffset, newEndOffset - 1)
      : newEndOffset;
    const endLine = Math.max(startLine, lineNumberAt(nextText, endOffsetForLine));
    precedingDelta += change.text.length - change.length;

    return {
      startLine,
      endLine,
      oldStartLine: change.range?.start?.line + 1 || lineNumberAt(previousText, change.offset),
      oldEndLine: change.range?.end?.line + 1 || lineNumberAt(previousText, change.offset + change.length),
      addedLines: countChangedLines(change.text),
      removedLines: countChangedLines(oldText),
      before: makeSnippet(oldText),
      after: makeSnippet(change.text),
    };
  });

  if (previousText === nextText) return null;
  // Chat/Copilot sometimes applies an edit as one replacement spanning the
  // entire TextDocument. Preserve the event, but derive its visible hunk from
  // the actual line diff so one changed heading does not appear as a whole-file
  // change in the preview.
  if (
    changes.length === 1 &&
    changes[0].offset === 0 &&
    changes[0].length === previousText.length &&
    changes[0].text === nextText
  ) {
    return createNetChangeRecord(previousText, nextText, timestamp);
  }

  return {
    id: `${timestamp}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp,
    hunks,
    addedLines: hunks.reduce((total, hunk) => total + hunk.addedLines, 0),
    removedLines: hunks.reduce((total, hunk) => total + hunk.removedLines, 0),
  };
}

function splitLines(text) {
  const normalized = String(text || "").replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  if (normalized.endsWith("\n")) lines.pop();
  return lines;
}

function diffOperations(oldLines, newLines) {
  const oldLength = oldLines.length;
  const newLength = newLines.length;
  const maxDistance = oldLength + newLength;
  let frontier = new Map([[1, 0]]);
  const trace = [];

  const broadFallback = () => {
    let prefixLength = 0;
    while (
      prefixLength < oldLength &&
      prefixLength < newLength &&
      oldLines[prefixLength] === newLines[prefixLength]
    ) prefixLength += 1;
    let suffixLength = 0;
    while (
      suffixLength < oldLength - prefixLength &&
      suffixLength < newLength - prefixLength &&
      oldLines[oldLength - suffixLength - 1] === newLines[newLength - suffixLength - 1]
    ) suffixLength += 1;
    return [
      ...oldLines.slice(0, prefixLength).map((text) => ({ type: "equal", text })),
      ...oldLines.slice(prefixLength, oldLength - suffixLength).map((text) => ({ type: "delete", text })),
      ...newLines.slice(prefixLength, newLength - suffixLength).map((text) => ({ type: "insert", text })),
      ...oldLines.slice(oldLength - suffixLength).map((text) => ({ type: "equal", text })),
    ];
  };

  for (let distance = 0; distance <= maxDistance; distance += 1) {
    if (distance > MAX_DIFF_DISTANCE) return broadFallback();
    trace.push(new Map(frontier));
    for (let diagonal = -distance; diagonal <= distance; diagonal += 2) {
      let oldIndex;
      if (
        diagonal === -distance ||
        (diagonal !== distance && (frontier.get(diagonal - 1) ?? -1) < (frontier.get(diagonal + 1) ?? -1))
      ) {
        oldIndex = frontier.get(diagonal + 1) ?? 0;
      } else {
        oldIndex = (frontier.get(diagonal - 1) ?? 0) + 1;
      }
      let newIndex = oldIndex - diagonal;
      while (
        oldIndex < oldLength &&
        newIndex < newLength &&
        oldLines[oldIndex] === newLines[newIndex]
      ) {
        oldIndex += 1;
        newIndex += 1;
      }
      frontier.set(diagonal, oldIndex);

      if (oldIndex >= oldLength && newIndex >= newLength) {
        return backtrackDiff(trace, oldLines, newLines, distance);
      }
    }
  }

  return [];
}

function backtrackDiff(trace, oldLines, newLines, distance) {
  let oldIndex = oldLines.length;
  let newIndex = newLines.length;
  const operations = [];

  for (let currentDistance = distance; currentDistance > 0; currentDistance -= 1) {
    const frontier = trace[currentDistance];
    const diagonal = oldIndex - newIndex;
    const previousDiagonal =
      diagonal === -currentDistance ||
      (diagonal !== currentDistance &&
        (frontier.get(diagonal - 1) ?? -1) < (frontier.get(diagonal + 1) ?? -1))
        ? diagonal + 1
        : diagonal - 1;
    const previousOldIndex = frontier.get(previousDiagonal) ?? 0;
    const previousNewIndex = previousOldIndex - previousDiagonal;

    while (oldIndex > previousOldIndex && newIndex > previousNewIndex) {
      operations.push({ type: "equal", text: oldLines[oldIndex - 1] });
      oldIndex -= 1;
      newIndex -= 1;
    }
    if (oldIndex === previousOldIndex) {
      operations.push({ type: "insert", text: newLines[newIndex - 1] });
      newIndex -= 1;
    } else {
      operations.push({ type: "delete", text: oldLines[oldIndex - 1] });
      oldIndex -= 1;
    }
  }

  while (oldIndex > 0 && newIndex > 0) {
    operations.push({ type: "equal", text: oldLines[oldIndex - 1] });
    oldIndex -= 1;
    newIndex -= 1;
  }
  while (oldIndex > 0) {
    operations.push({ type: "delete", text: oldLines[--oldIndex] });
  }
  while (newIndex > 0) {
    operations.push({ type: "insert", text: newLines[--newIndex] });
  }

  return operations.reverse();
}

function createNetChangeRecord(previousText, nextText, timestamp = Date.now()) {
  if (previousText === nextText) return null;
  const oldLines = splitLines(previousText);
  const newLines = splitLines(nextText);
  const operations = diffOperations(oldLines, newLines);
  const hunks = [];
  let oldLine = 1;
  let newLine = 1;
  let current = null;

  const finishHunk = () => {
    if (!current) return;
    current.before = makeSnippet(current.beforeLines.join("\n"));
    current.after = makeSnippet(current.afterLines.join("\n"));
    delete current.beforeLines;
    delete current.afterLines;
    hunks.push(current);
    current = null;
  };

  for (const operation of operations) {
    if (operation.type === "equal") {
      finishHunk();
      oldLine += 1;
      newLine += 1;
      continue;
    }
    if (!current) {
      current = {
        startLine: newLine,
        endLine: newLine,
        oldStartLine: oldLine,
        oldEndLine: oldLine,
        addedLines: 0,
        removedLines: 0,
        beforeLines: [],
        afterLines: [],
      };
    }
    if (operation.type === "delete") {
      current.beforeLines.push(operation.text);
      current.removedLines += 1;
      current.oldEndLine = oldLine;
      oldLine += 1;
    } else {
      current.afterLines.push(operation.text);
      current.addedLines += 1;
      current.endLine = newLine;
      newLine += 1;
    }
  }
  finishHunk();

  if (!hunks.length) return null;
  return {
    id: `${timestamp}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp,
    hunks,
    addedLines: hunks.reduce((total, hunk) => total + hunk.addedLines, 0),
    removedLines: hunks.reduce((total, hunk) => total + hunk.removedLines, 0),
  };
}

class MarkdownChangeHistory {
  constructor(documents = []) {
    this.snapshots = new Map();
    this.baselines = new Map();
    this.records = new Map();
    this.events = new Map();
    for (const document of documents) this.seed(document);
  }

  seed(document) {
    if (!document?.uri || typeof document.getText !== "function") return;
    const key = document.uri.toString();
    const text = document.getText();
    if (!this.baselines.has(key)) this.baselines.set(key, text);
    this.snapshots.set(key, text);
    while (this.snapshots.size > MAX_FILES) {
      const oldestKey = this.snapshots.keys().next().value;
      this.snapshots.delete(oldestKey);
      this.baselines.delete(oldestKey);
      this.records.delete(oldestKey);
      this.events.delete(oldestKey);
    }
  }

  record(event) {
    const document = event?.document;
    if (!document?.uri || document.languageId !== "markdown") return null;

    const key = document.uri.toString();
    const nextText = document.getText();
    const previousText = this.snapshots.get(key);
    this.snapshots.set(key, nextText);
    if (typeof previousText !== "string") return null;
    if (!this.baselines.has(key)) this.baselines.set(key, previousText);
    // Preserve the exact text ranges reported by VS Code. Re-diffing the whole
    // document can align repeated headings against the wrong occurrence, making
    // the displayed "before" snippet differ from the edit the user just saw.
    const eventRecord = Array.isArray(event.contentChanges) && event.contentChanges.length
      ? createChangeRecord(previousText, nextText, event.contentChanges)
      : createNetChangeRecord(previousText, nextText);
    if (eventRecord) {
      const fileEvents = this.events.get(key) || [];
      fileEvents.push(eventRecord);
      if (fileEvents.length > MAX_RECORDS_PER_FILE) {
        fileEvents.splice(0, fileEvents.length - MAX_RECORDS_PER_FILE);
      }
      this.events.set(key, fileEvents);
    }
    const record = createNetChangeRecord(this.baselines.get(key), nextText);
    this.setRecord(key, record);
    return record;
  }

  refresh(document, savedBaselineText) {
    if (!document?.uri || typeof document.getText !== "function") return [];
    const key = document.uri.toString();
    if (typeof savedBaselineText === "string") {
      this.baselines.set(key, savedBaselineText.replace(/^\uFEFF/u, ""));
    }
    if (!this.baselines.has(key)) this.seed(document);
    const currentText = document.getText();
    this.snapshots.set(key, currentText);
    const record = createNetChangeRecord(this.baselines.get(key), currentText);
    this.setRecord(key, record);
    return this.get(key);
  }

  markSaved(document) {
    if (!document?.uri || typeof document.getText !== "function") return;
    const key = document.uri.toString();
    const currentText = document.getText();
    this.baselines.set(key, currentText);
    this.snapshots.set(key, currentText);
    this.records.delete(key);
  }

  setRecord(key, record) {
    if (record) this.records.set(key, [record]);
    else this.records.delete(key);
  }

  get(uri) {
    const key = typeof uri === "string" ? uri : uri?.toString?.();
    return key ? (this.records.get(key) || []).map((record) => ({
      ...record,
      hunks: record.hunks.map((hunk) => ({ ...hunk })),
    })) : [];
  }

  getEvents(uri) {
    const key = typeof uri === "string" ? uri : uri?.toString?.();
    return key ? (this.events.get(key) || []).map((record) => ({
      ...record,
      hunks: record.hunks.map((hunk) => ({ ...hunk })),
    })) : [];
  }

  dispose() {
    this.snapshots.clear();
    this.baselines.clear();
    this.records.clear();
    this.events.clear();
  }
}

module.exports = {
  MarkdownChangeHistory,
  countChangedLines,
  createNetChangeRecord,
  createChangeRecord,
  lineNumberAt,
  rebaseRecords,
};
