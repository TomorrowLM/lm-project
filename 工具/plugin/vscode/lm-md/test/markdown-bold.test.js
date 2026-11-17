const test = require("node:test");
const assert = require("node:assert/strict");
const { applyMarkdownBold, createMarkdownBoldEdits } = require("../src/markdown-bold");

test("maps one selected preview phrase to a unique Markdown source span", () => {
  const source = "# Guide\r\n\r\nA selected phrase here.\r\n";
  const startOffset = source.indexOf("selected phrase");

  assert.deepEqual(
    createMarkdownBoldEdits(source, [{
      text: "selected phrase",
      startLine: 3,
      endLine: 3,
    }]),
    [{ startOffset, endOffset: startOffset + "selected phrase".length }],
  );
});

test("maps multiple selections independently and returns source-order spans", () => {
  const source = "First phrase.\n\nSecond phrase.\n";
  const firstOffset = source.indexOf("First");
  const secondOffset = source.indexOf("Second");

  assert.deepEqual(
    createMarkdownBoldEdits(source, [
      { text: "Second", startLine: 3, endLine: 3 },
      { text: "First", startLine: 1, endLine: 1 },
    ]),
    [
      { startOffset: firstOffset, endOffset: firstOffset + 5 },
      { startOffset: secondOffset, endOffset: secondOffset + 6 },
    ],
  );
});

test("refuses to modify a phrase that is missing or ambiguous in its source lines", () => {
  const source = "repeat repeat\nunique\n";

  assert.throws(
    () => createMarkdownBoldEdits(source, [{ text: "missing", startLine: 1, endLine: 1 }]),
    /无法在对应源码范围内唯一定位所选文字/,
  );
  assert.throws(
    () => createMarkdownBoldEdits(source, [{ text: "repeat", startLine: 1, endLine: 1 }]),
    /无法在对应源码范围内唯一定位所选文字/,
  );
});

test("refuses invalid and overlapping source spans", () => {
  const source = "same phrase\n";

  assert.throws(
    () => createMarkdownBoldEdits(source, [{ text: "same", startLine: 0, endLine: 1 }]),
    /加粗选区无效/,
  );
  assert.throws(
    () => createMarkdownBoldEdits(source, [
      { text: "same phrase", startLine: 1, endLine: 1 },
      { text: "phrase", startLine: 1, endLine: 1 },
    ]),
    /加粗选区重叠/,
  );
});

test("does not wrap a phrase already surrounded by Markdown bold markers", () => {
  const source = "**already bold**\n";

  assert.throws(
    () => createMarkdownBoldEdits(source, [{ text: "already bold", startLine: 1, endLine: 1 }]),
    /所选文字已经加粗/,
  );
  assert.throws(
    () => createMarkdownBoldEdits(source, [{ text: "bold", startLine: 1, endLine: 1 }]),
    /所选文字已经加粗/,
  );
});

test("applies the Markdown delimiters as one VS Code workspace edit", async () => {
  const source = "A phrase to format.";
  const insertions = [];
  let appliedEdit;
  class WorkspaceEdit {
    insert(uri, position, text) {
      insertions.push({ uri, offset: position.offset, text });
    }
  }
  const document = {
    uri: "file:///docs/guide.md",
    getText: () => source,
    positionAt: (offset) => ({ offset }),
  };
  const fakeVscode = {
    WorkspaceEdit,
    workspace: {
      openTextDocument: async () => document,
      applyEdit: async (edit) => {
        appliedEdit = edit;
        return true;
      },
    },
  };

  await applyMarkdownBold(fakeVscode, document.uri, [{
    text: "phrase to format",
    startLine: 1,
    endLine: 1,
  }]);

  assert.ok(appliedEdit instanceof WorkspaceEdit);
  assert.deepEqual(insertions, [
    { uri: document.uri, offset: source.indexOf("phrase to format") + 16, text: "**" },
    { uri: document.uri, offset: source.indexOf("phrase to format"), text: "**" },
  ]);
});

test("does not apply an edit when the preview text cannot be mapped safely", async () => {
  let applied = false;
  class WorkspaceEdit {
    insert() {}
  }
  const document = {
    uri: "file:///docs/guide.md",
    getText: () => "duplicate duplicate",
    positionAt: (offset) => offset,
  };
  const fakeVscode = {
    WorkspaceEdit,
    workspace: {
      openTextDocument: async () => document,
      applyEdit: async () => {
        applied = true;
        return true;
      },
    },
  };

  await assert.rejects(
    applyMarkdownBold(fakeVscode, document.uri, [{
      text: "duplicate",
      startLine: 1,
      endLine: 1,
    }]),
    /无法在对应源码范围内唯一定位所选文字/,
  );
  assert.equal(applied, false);
});
