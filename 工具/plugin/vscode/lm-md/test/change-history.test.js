const test = require("node:test");
const assert = require("node:assert/strict");
const {
  MarkdownChangeHistory,
  countChangedLines,
  createChangeRecord,
  createNetChangeRecord,
  lineNumberAt,
} = require("../src/change-history");

function changeEvent(uri, previousText, nextText, contentChanges) {
  let currentText = nextText;
  const document = {
    uri: { toString: () => uri },
    languageId: "markdown",
    getText: () => currentText,
  };
  return { document, contentChanges, previousText };
}

test("counts changed lines without counting a trailing newline", () => {
  assert.equal(countChangedLines(""), 0);
  assert.equal(countChangedLines("one"), 1);
  assert.equal(countChangedLines("one\ntwo\n"), 2);
});

test("maps one replacement to the new document line and records before/after", () => {
  const before = "# Title\n\nold paragraph\nkeep\n";
  const after = "# Title\n\nnew paragraph\nkeep\n";
  const offset = before.indexOf("old paragraph");
  const record = createChangeRecord(before, after, [{
    rangeOffset: offset,
    rangeLength: "old paragraph".length,
    text: "new paragraph",
    range: { start: { line: 2 }, end: { line: 2 } },
  }], 123);

  assert.equal(record.timestamp, 123);
  assert.equal(record.hunks[0].startLine, 3);
  assert.equal(record.hunks[0].endLine, 3);
  assert.equal(record.hunks[0].addedLines, 1);
  assert.equal(record.hunks[0].removedLines, 1);
  assert.equal(record.hunks[0].before, "old paragraph");
  assert.equal(record.hunks[0].after, "new paragraph");
});

test("maps multiple content changes with preceding offset deltas", () => {
  const before = "first\nkeep\nlast\n";
  const after = "FIRST\nkeep\nlast added\n";
  const record = createChangeRecord(before, after, [
    {
      rangeOffset: 0,
      rangeLength: 5,
      text: "FIRST",
      range: { start: { line: 0 }, end: { line: 0 } },
    },
    {
      rangeOffset: before.indexOf("last"),
      rangeLength: 4,
      text: "last added",
      range: { start: { line: 2 }, end: { line: 2 } },
    },
  ], 456);

  assert.equal(record.hunks.length, 2);
  assert.equal(record.hunks[0].startLine, 1);
  assert.equal(record.hunks[1].startLine, 3);
  assert.equal(record.hunks[1].after, "last added");
  assert.equal(record.addedLines, 2);
  assert.equal(record.removedLines, 2);
});

test("keeps one current net-change record per Markdown document", () => {
  const uri = "file:///docs/readme.md";
  const history = new MarkdownChangeHistory([{
    uri: { toString: () => uri },
    getText: () => "before\n",
  }]);
  const before = "before\n";
  const after = "after\n";
  const event = changeEvent(uri, before, after, [{
    rangeOffset: 0,
    rangeLength: 6,
    text: "after",
    range: { start: { line: 0 }, end: { line: 0 } },
  }]);

  const record = history.record(event);
  assert.ok(record);
  assert.equal(history.get(uri).length, 1);
  assert.equal(history.get(uri)[0].hunks[0].before, "before");
  assert.equal(history.getEvents(uri).length, 1);
  assert.deepEqual(history.get("file:///other.md"), []);

  event.document.getText = () => "after!\n";
  history.record({
    ...event,
    contentChanges: [{
      rangeOffset: 5,
      rangeLength: 0,
      text: "!",
      range: { start: { line: 0 }, end: { line: 0 } },
    }],
  });
  assert.equal(history.get(uri).length, 1);
  assert.equal(history.get(uri)[0].hunks[0].before, "before");
  assert.equal(history.get(uri)[0].hunks[0].after, "after!");
  assert.equal(history.getEvents(uri).length, 2);
  history.dispose();
  assert.deepEqual(history.get(uri), []);
});

test("uses the exact VS Code changed range for the latest event snapshot", () => {
  const uri = "file:///docs/tools.md";
  const before = "## 工具\n\n## 工具\n";
  const after = "## 工具\n\n### 工具 (Tool)\n";
  let text = before;
  const document = {
    uri: { toString: () => uri },
    languageId: "markdown",
    getText: () => text,
  };
  const history = new MarkdownChangeHistory([document]);
  const rangeOffset = before.lastIndexOf("## 工具");
  text = after;
  history.record({
    document,
    contentChanges: [{
      rangeOffset,
      rangeLength: "## 工具".length,
      text: "### 工具 (Tool)",
      range: { start: { line: 2, character: 0 }, end: { line: 2, character: 5 } },
    }],
  });

  const [hunk] = history.getEvents(uri)[0].hunks;
  assert.equal(hunk.startLine, 3);
  assert.equal(hunk.before, "## 工具");
  assert.equal(hunk.after, "### 工具 (Tool)");
});

test("recalculates line positions across later edits above the original change", () => {
  const uri = "file:///docs/rebase.md";
  let text = "# Title\n\nold paragraph\nend\n";
  const document = {
    uri: { toString: () => uri },
    languageId: "markdown",
    getText: () => text,
  };
  const history = new MarkdownChangeHistory([document]);
  const oldOffset = text.indexOf("old paragraph");
  const previous = text;
  text = text.replace("old paragraph", "new paragraph");
  history.record({
    document,
    contentChanges: [{
      rangeOffset: oldOffset,
      rangeLength: "old paragraph".length,
      text: "new paragraph",
      range: { start: { line: 2, character: 0 }, end: { line: 2, character: 13 } },
    }],
  });
  assert.equal(previous.split("\n").length, 5);
  assert.equal(history.get(uri)[0].hunks[0].startLine, 3);

  const beforeInsert = text;
  text = `# Added\n${text}`;
  history.record({
    document,
    contentChanges: [{
      rangeOffset: 0,
      rangeLength: 0,
      text: "# Added\n",
      range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
    }],
  });

  assert.equal(beforeInsert.indexOf("new paragraph") > 0, true);
  assert.deepEqual(history.get(uri)[0].hunks.map((hunk) => hunk.startLine), [1, 4]);
});

test("normalizes a whole-document replacement to its actual changed line", () => {
  const uri = "file:///docs/large.md";
  const before = `${Array.from({ length: 3665 }, (_, index) => `line ${index + 1}`).join("\n")}\n`;
  const after = before.replace("line 3256", "updated line 3256");
  let text = before;
  const document = {
    uri: { toString: () => uri },
    languageId: "markdown",
    getText: () => text,
  };
  const history = new MarkdownChangeHistory([document]);
  text = after;
  history.record({
    document,
    contentChanges: [{ rangeOffset: 0, rangeLength: before.length, text: after }],
  });

  const records = history.get(uri);
  assert.equal(records.length, 1);
  assert.equal(records[0].hunks.length, 1);
  assert.equal(records[0].hunks[0].startLine, 3256);
  assert.equal(records[0].addedLines, 1);
  assert.equal(records[0].removedLines, 1);
  assert.equal(history.getEvents(uri)[0].hunks.length, 1);
  assert.equal(history.getEvents(uri)[0].hunks[0].startLine, 3256);
  assert.equal(history.getEvents(uri)[0].hunks[0].before, "line 3256");
  assert.equal(history.getEvents(uri)[0].hunks[0].after, "updated line 3256");

  text = before;
  history.refresh(document);
  assert.deepEqual(history.get(uri), []);

  // Refresh can use the current disk text as its baseline, even if the
  // extension's in-memory baseline was seeded after an unsaved edit existed.
  text = after;
  history.refresh(document, before);
  assert.equal(history.get(uri)[0].hunks[0].startLine, 3256);
  assert.equal(history.get(uri)[0].hunks[0].after, "updated line 3256");
  history.dispose();
});

test("finds separated net-change hunks", () => {
  const record = createNetChangeRecord(
    "one\ntwo\nthree\nfour\nfive\n",
    "ONE\ntwo\nthree\nfour\nFIVE\n",
    789,
  );
  assert.equal(record.hunks.length, 2);
  assert.deepEqual(record.hunks.map(({ startLine, before, after }) => ({ startLine, before, after })), [
    { startLine: 1, before: "one", after: "ONE" },
    { startLine: 5, before: "five", after: "FIVE" },
  ]);
});

test("resets only the net-diff baseline on save and retains session events", () => {
  const uri = "file:///docs/saved.md";
  let text = "before\n";
  const document = {
    uri: { toString: () => uri },
    languageId: "markdown",
    getText: () => text,
  };
  const history = new MarkdownChangeHistory([document]);
  text = "first edit\n";
  history.record({ document, contentChanges: [] });
  history.markSaved(document);
  assert.deepEqual(history.get(uri), []);
  assert.equal(history.getEvents(uri).length, 1);

  text = "second edit\n";
  history.record({ document, contentChanges: [] });
  assert.equal(history.get(uri)[0].hunks[0].before, "first edit");
  assert.equal(history.get(uri)[0].hunks[0].after, "second edit");
  assert.equal(history.getEvents(uri).length, 2);
});

test("line number lookup uses one-based source coordinates", () => {
  assert.equal(lineNumberAt("first\nsecond\n", 0), 1);
  assert.equal(lineNumberAt("first\nsecond\n", 6), 2);
});
