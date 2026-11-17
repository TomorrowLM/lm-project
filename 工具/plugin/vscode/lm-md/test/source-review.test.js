const test = require("node:test");
const assert = require("node:assert/strict");
const { openSourceReview } = require("../src/source-review");

test("opens the native text editor beside the preview at the changed line range", async () => {
  const uri = { toString: () => "file:///docs/guide.md" };
  const document = {
    lineCount: 8,
    lineAt(line) {
      return { text: [`# title`, "", "before", "changed one", "changed two", "after", "", "end"][line] };
    },
  };
  const calls = {};
  class Position {
    constructor(line, character) { this.line = line; this.character = character; }
  }
  class Range {
    constructor(start, end) { this.start = start; this.end = end; }
  }
  const editor = {
    revealRange(range, revealType) {
      calls.reveal = { range, revealType };
    },
  };
  const vscode = {
    workspace: {
      async openTextDocument(target) {
        calls.uri = target;
        return document;
      },
    },
    window: {
      async showTextDocument(targetDocument, options) {
        calls.document = targetDocument;
        calls.options = options;
        return editor;
      },
    },
    Position,
    Range,
    ViewColumn: { Beside: 2 },
    TextEditorRevealType: { InCenterIfOutsideViewport: 3 },
  };

  await openSourceReview(vscode, uri, { startLine: 4, endLine: 5 });

  assert.equal(calls.uri, uri);
  assert.equal(calls.document, document);
  assert.equal(calls.options.viewColumn, vscode.ViewColumn.Beside);
  assert.equal(calls.options.preview, false);
  assert.equal(calls.options.selection.start.line, 3);
  assert.equal(calls.options.selection.end.line, 4);
  assert.equal(calls.options.selection.end.character, "changed two".length);
  assert.equal(calls.reveal.revealType, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
});
