const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const {
  syncSelectionToCopilot,
  toEditorRange,
} = require("../src/copilot-selection");

function mockUri(path, query = "") {
  return {
    fsPath: path,
    query,
    with(changes) {
      return mockUri(path, changes.query ?? query);
    },
    toString() {
      return `file:///${path.replace(/\\/g, "/")}${this.query ? `?${this.query}` : ""}`;
    },
  };
}

test("converts one-based preview lines to zero-based editor lines", () => {
  assert.deepEqual(
    toEditorRange(
      { startLine: 3, endLine: 5 },
      ["a", "b", "c", "d", "e", "f"],
    ),
    {
      start: { line: 2, character: 0 },
      end: { line: 4, character: 1 },
    },
  );
});

test("clamps a range to the document", () => {
  assert.deepEqual(
    toEditorRange({ startLine: 4, endLine: 99 }, ["a", "b", "c", "d"]),
    {
      start: { line: 3, character: 0 },
      end: { line: 3, character: 1 },
    },
  );
});

test("attaches only the Markdown range citation to Chat", async () => {
  const calls = [];
  const vscode = {
    workspace: {
      openTextDocument: async () => ({ getText: () => "one\ntwo\nthree" }),
    },
    commands: {
      getCommands: async () => [
        "workbench.action.chat.open",
        "workbench.action.chat.openInSidebar",
        "workbench.action.chat.newChat",
        "workbench.action.chat.focusInput",
        "workbench.panel.chat.view.copilot.focus",
      ],
      executeCommand: async (...args) => calls.push(args),
    },
  };
  const uri = mockUri("D:/notes/example.md");

  await syncSelectionToCopilot(vscode, uri, { startLine: 2, endLine: 2 });

  assert.equal(calls[0][0], "workbench.panel.chat.view.copilot.focus");
  assert.equal(calls[1][0], "workbench.action.chat.focusInput");
  assert.equal(calls[2][0], "workbench.panel.chat.view.copilot.focus");
  assert.equal(calls[3][0], "workbench.action.chat.focusInput");
  assert.equal(calls[4][0], "workbench.action.chat.open");
  assert.equal(calls[4][1].attachFiles.length, 1);
  assert.equal(calls[4][1].query, undefined);
  assert.equal(calls[4][1].isPartialQuery, undefined);
  assert.equal(calls[4][1].preserveInput, undefined);
  assert.equal(calls[4][1].attachFiles[0].uri.fsPath, uri.fsPath);
  assert.equal(calls[4][1].attachFiles[0].uri.query, "lmMdRange=2-2");
  assert.deepEqual(calls[4][1].attachFiles[0].range, {
    startLineNumber: 2,
    startColumn: 1,
    endLineNumber: 2,
    endColumn: 4,
  });
  assert.equal(calls[5][0], "workbench.action.chat.focusInput");
});

test("attaches multiple disjoint ranges from the same Markdown file", async () => {
  const calls = [];
  const vscode = {
    workspace: {
      openTextDocument: async () => ({
        getText: () => "one\ntwo\nthree\nfour\nfive\nsix\nseven\neight\nnine",
      }),
    },
    commands: {
      getCommands: async () => [
        "workbench.action.chat.open",
        "workbench.action.chat.newChat",
        "workbench.action.chat.focusInput",
      ],
      executeCommand: async (...args) => calls.push(args),
    },
  };
  const uri = mockUri("D:/notes/example.md");

  await syncSelectionToCopilot(vscode, uri, {
    ranges: [
      { startLine: 7, endLine: 8 },
      { startLine: 2, endLine: 3 },
    ],
  });

  const attachCall = calls.find((call) => call[0] === "workbench.action.chat.open");
  const attachments = attachCall[1].attachFiles;
  assert.equal(attachments.length, 2);
  assert.deepEqual(
    attachments.map((attachment) => ({
      startLineNumber: attachment.range.startLineNumber,
      endLineNumber: attachment.range.endLineNumber,
    })),
    [
      { startLineNumber: 2, endLineNumber: 3 },
      { startLineNumber: 7, endLineNumber: 8 },
    ],
  );
  assert.deepEqual(attachments.map((attachment) => attachment.uri.fsPath), [
    uri.fsPath,
    uri.fsPath,
  ]);
  assert.deepEqual(attachments.map((attachment) => attachment.uri.query), [
    "lmMdRange=2-3",
    "lmMdRange=7-8",
  ]);
  assert.notEqual(attachments[0].uri.toString(), attachments[1].uri.toString());
});

test("sends only the currently selected citation in each sync request", async () => {
  const calls = [];
  const vscode = {
    workspace: {
      openTextDocument: async () => ({ getText: () => "one\ntwo\nthree\nfour" }),
    },
    commands: {
      getCommands: async () => [
        "workbench.action.chat.open",
        "workbench.action.chat.openInSidebar",
        "workbench.action.chat.newChat",
        "workbench.action.chat.focusInput",
        "workbench.panel.chat.view.copilot.focus",
      ],
      executeCommand: async (...args) => calls.push(args),
    },
  };
  const uri = mockUri("D:/notes/example.md");

  await syncSelectionToCopilot(vscode, uri, { startLine: 1, endLine: 1 });
  await syncSelectionToCopilot(vscode, uri, { startLine: 3, endLine: 3 });

  assert.deepEqual(
    calls.map((call) => call[0]),
    [
      "workbench.panel.chat.view.copilot.focus",
      "workbench.action.chat.focusInput",
      "workbench.panel.chat.view.copilot.focus",
      "workbench.action.chat.focusInput",
      "workbench.action.chat.open",
      "workbench.action.chat.focusInput",
      "workbench.panel.chat.view.copilot.focus",
      "workbench.action.chat.focusInput",
      "workbench.panel.chat.view.copilot.focus",
      "workbench.action.chat.focusInput",
      "workbench.action.chat.open",
      "workbench.action.chat.focusInput",
    ],
  );
  assert.equal(calls[4][1].attachFiles.length, 1);
  assert.equal(calls[10][1].attachFiles.length, 1);
  assert.equal(calls[4][1].attachFiles[0].range.startLineNumber, 1);
  assert.equal(calls[10][1].attachFiles[0].range.startLineNumber, 3);
  assert.equal(calls.filter(([command]) => command === "workbench.action.chat.newChat").length, 0);
  assert.deepEqual(
    calls[10][1].attachFiles.map((item) => item.range.startLineNumber),
    [3],
  );
});

test("uses a distinct attachment URI when adding another range from the same file", async () => {
  const calls = [];
  const vscode = {
    workspace: {
      openTextDocument: async () => ({ getText: () => "one\ntwo\nthree\nfour" }),
    },
    commands: {
      getCommands: async () => ["workbench.action.chat.open"],
      executeCommand: async (...args) => calls.push(args),
    },
  };
  const uri = mockUri("D:/notes/example.md");

  await syncSelectionToCopilot(vscode, uri, { startLine: 1, endLine: 1 });
  await syncSelectionToCopilot(vscode, uri, { startLine: 3, endLine: 3 });

  const attachments = calls.map(([, options]) => options.attachFiles[0]);
  assert.deepEqual(attachments.map(({ uri: attachmentUri }) => attachmentUri.query), [
    "lmMdRange=1-1",
    "lmMdRange=3-3",
  ]);
  assert.notEqual(attachments[0].uri.toString(), attachments[1].uri.toString());
  assert.deepEqual(attachments.map(({ range: attachmentRange }) => attachmentRange.startLineNumber), [1, 3]);
});

test("adds each new citation to the current Copilot composer without starting a new chat", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "lm-md-chat-"));
  try {
    const sessionDirectory = path.join(root, "Code", "User", "workspaceStorage", "workspace", "chatSessions");
    await fs.mkdir(sessionDirectory, { recursive: true });
    const sessionId = "session-for-sync";
    await fs.writeFile(
      path.join(sessionDirectory, `${sessionId}.jsonl`),
      `${JSON.stringify({ kind: 0, v: { sessionId } })}\nD:/notes/example.md\n`,
      "utf8",
    );
    const calls = [];
    const vscode = {
      env: { appData: root },
      workspace: {
        openTextDocument: async () => ({ getText: () => "one\ntwo\nthree" }),
      },
      commands: {
        getCommands: async () => [
          "workbench.action.chat.open",
          "workbench.action.chat.newChat",
          "workbench.action.chat.focusInput",
          "workbench.panel.chat.view.copilot.focus",
        ],
        executeCommand: async (...args) => calls.push(args),
      },
    };
    const uri = mockUri("D:/notes/example.md");

    await syncSelectionToCopilot(vscode, uri, { startLine: 2, endLine: 2 });
    await syncSelectionToCopilot(vscode, uri, { startLine: 3, endLine: 3 });

    const openCalls = calls.filter(([command]) => command === "workbench.action.chat.open");
    assert.equal(calls.filter(([command]) => command === "workbench.action.chat.newChat").length, 0);
    assert.equal(openCalls.length, 2);
    assert.deepEqual(
      openCalls.map(([, args]) => args.attachFiles.map(({ range }) => range.startLineNumber)),
      [[2], [3]],
    );
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
