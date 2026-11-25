const test = require("node:test");
const assert = require("node:assert/strict");
const { MarkdownCustomEditorProvider } = require("../src/custom-editor");

test("reveals an existing custom preview and queues the requested source line", async () => {
  const uri = { toString: () => "file:///docs/agent.md" };
  const calls = [];
  const record = {
    panel: {
      viewColumn: 2,
      reveal(...args) { calls.push(["reveal", ...args]); },
    },
    webview: {
      async postMessage(message) { calls.push(["message", message]); return true; },
    },
    ready: false,
    pendingLine: null,
  };
  const provider = Object.create(MarkdownCustomEditorProvider.prototype);
  provider.previewPanels = new Map([[uri.toString(), record]]);

  assert.equal(await provider.revealSourceLine(uri, 1131), true);
  assert.equal(record.pendingLine, 1131);
  assert.deepEqual(calls, [["reveal", 2, false]]);
});

test("sends a requested line to a ready custom preview", async () => {
  const uri = { toString: () => "file:///docs/agent.md" };
  const messages = [];
  const record = {
    panel: { viewColumn: 2, reveal() {} },
    webview: {
      async postMessage(message) { messages.push(message); return true; },
    },
    ready: true,
    pendingLine: null,
  };
  const provider = Object.create(MarkdownCustomEditorProvider.prototype);
  provider.previewPanels = new Map([[uri.toString(), record]]);

  assert.equal(await provider.revealSourceLine(uri, 1131), true);
  assert.deepEqual(messages, [{ type: "revealPreviewLine", line: 1131 }]);
  assert.equal(record.pendingLine, null);
});
