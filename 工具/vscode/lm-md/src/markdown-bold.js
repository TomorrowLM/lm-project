function lineOffsets(source) {
  const offsets = [0];
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] === "\n") offsets.push(index + 1);
  }
  return offsets;
}

function getLineRange(source, offsets, startLine, endLine) {
  if (!Number.isInteger(startLine) || !Number.isInteger(endLine) ||
      startLine < 1 || endLine < startLine || endLine > offsets.length) {
    throw new Error("加粗选区无效");
  }

  const startOffset = offsets[startLine - 1];
  let endOffset = offsets[endLine] ?? source.length;
  if (endOffset > startOffset && source[endOffset - 1] === "\n") endOffset -= 1;
  if (endOffset > startOffset && source[endOffset - 1] === "\r") endOffset -= 1;
  return { startOffset, endOffset };
}

function findUniqueOccurrence(source, segment, offsets) {
  const text = String(segment?.text || "").trim();
  if (!text) throw new Error("加粗选区无效");

  const { startLine, endLine } = segment;
  const { startOffset, endOffset } = getLineRange(source, offsets, startLine, endLine);
  const sourceText = source.includes("\r\n")
    ? text.replace(/\r?\n/g, "\r\n")
    : text.replace(/\r\n/g, "\n");

  const first = source.indexOf(sourceText, startOffset);
  if (first < 0 || first + sourceText.length > endOffset) {
    throw new Error("无法在对应源码范围内唯一定位所选文字");
  }
  const next = source.indexOf(sourceText, first + 1);
  if (next >= 0 && next + sourceText.length <= endOffset) {
    throw new Error("无法在对应源码范围内唯一定位所选文字");
  }

  const end = first + sourceText.length;
  for (const marker of ["**", "__"]) {
    const opening = source.lastIndexOf(marker, first - 1);
    const closing = source.indexOf(marker, end);
    if (opening >= startOffset && opening + marker.length <= first &&
        closing >= end && closing + marker.length <= endOffset &&
        !source.slice(opening + marker.length, first).includes(marker) &&
        !source.slice(end, closing).includes(marker)) {
      throw new Error("所选文字已经加粗");
    }
  }

  return {
    startOffset: first,
    endOffset: end,
  };
}

function createMarkdownBoldEdits(markdown, segments) {
  const source = String(markdown ?? "");
  if (!Array.isArray(segments) || segments.length === 0) {
    throw new Error("加粗选区无效");
  }

  const offsets = lineOffsets(source);
  const edits = segments.map((segment) => findUniqueOccurrence(source, segment, offsets))
    .sort((left, right) => left.startOffset - right.startOffset || left.endOffset - right.endOffset);

  for (let index = 1; index < edits.length; index += 1) {
    if (edits[index].startOffset < edits[index - 1].endOffset) {
      throw new Error("加粗选区重叠");
    }
  }
  return edits;
}

async function applyMarkdownBold(vscode, documentUri, segments) {
  const document = await vscode.workspace.openTextDocument(documentUri);
  const spans = createMarkdownBoldEdits(document.getText(), segments);
  const edit = new vscode.WorkspaceEdit();

  for (const span of spans) {
    edit.insert(document.uri, document.positionAt(span.endOffset), "**");
    edit.insert(document.uri, document.positionAt(span.startOffset), "**");
  }

  const applied = await vscode.workspace.applyEdit(edit);
  if (!applied) throw new Error("VS Code 未能应用加粗修改");
}

module.exports = { applyMarkdownBold, createMarkdownBoldEdits };
