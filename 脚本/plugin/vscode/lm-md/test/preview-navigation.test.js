const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const modulePath = path.join(__dirname, "..", "src", "preview-navigation.js");
const navigation = fs.existsSync(modulePath) ? require(modulePath) : {};

function markdownEditor(uri, zeroBasedLine) {
  const position = { line: zeroBasedLine, character: 0 };
  return {
    document: { languageId: "markdown", uri },
    selection: { start: position, active: position },
  };
}

test("maps a Markdown editor selection to a one-based source line", () => {
  const uri = { toString: () => "file:///docs/agent.md" };
  assert.equal(typeof navigation.getPreviewLineTarget, "function");
  assert.deepEqual(navigation.getPreviewLineTarget(markdownEditor(uri, 1130)), {
    uri,
    line: 1131,
  });
});

test("automatically routes command-driven Markdown line selections", async () => {
  const uri = { toString: () => "file:///docs/agent.md" };
  const routed = [];
  const vscode = { TextEditorSelectionChangeKind: { Command: 3 } };
  const controller = navigation.createPreviewNavigationController(
    vscode,
    async (targetUri, line) => routed.push({ uri: targetUri, line }),
  );

  await controller.handleSelectionChange({
    kind: 3,
    textEditor: markdownEditor(uri, 1130),
    selections: [markdownEditor(uri, 1130).selection],
  });

  assert.deepEqual(routed, [{ uri, line: 1131 }]);
});

test("does not route selections from either side of an active native Markdown diff", async () => {
  const originalUri = {
    scheme: "git",
    path: "/docs/agent.md",
    toString: () => "git:/docs/agent.md?ref=HEAD",
  };
  const modifiedUri = {
    scheme: "file",
    path: "/docs/agent.md",
    fsPath: "D:\\Docs\\agent.md",
    toString: () => "file:///D:/Docs/agent.md",
  };
  class TabInputTextDiff {
    constructor(original, modified) {
      this.original = original;
      this.modified = modified;
    }
  }
  const activeDiffGroup = {
    isActive: true,
    viewColumn: 2,
    activeTab: { input: new TabInputTextDiff(originalUri, modifiedUri) },
  };
  const routed = [];
  const vscode = {
    TabInputTextDiff,
    TextEditorSelectionChangeKind: { Command: 3 },
    window: { tabGroups: { all: [activeDiffGroup], activeTabGroup: activeDiffGroup } },
  };
  const controller = navigation.createPreviewNavigationController(
    vscode,
    async (...args) => routed.push(args),
  );

  for (const uri of [originalUri, modifiedUri]) {
    const editor = markdownEditor(uri, 36);
    editor.viewColumn = 2;
    await controller.handleSelectionChange({
      kind: 3,
      textEditor: editor,
      selections: [editor.selection],
    });
  }

  assert.deepEqual(routed, []);
});

test("does not consume a pending citation navigation while a Markdown diff is active", async () => {
  const uri = {
    scheme: "file",
    path: "/docs/agent.md",
    fsPath: "D:\\Docs\\agent.md",
    toString: () => "file:///D:/Docs/agent.md",
  };
  class TabInputText {
    constructor(tabUri) { this.uri = tabUri; }
  }
  class TabInputTextDiff {
    constructor(original, modified) {
      this.original = original;
      this.modified = modified;
    }
  }
  const existingSourceTab = { input: new TabInputText(uri) };
  const openedCitationTab = { input: new TabInputText(uri) };
  const sourceGroup = {
    isActive: false,
    viewColumn: 1,
    activeTab: existingSourceTab,
    tabs: [existingSourceTab, openedCitationTab],
  };
  const diffGroup = {
    isActive: true,
    viewColumn: 2,
    activeTab: {
      input: new TabInputTextDiff(
        { toString: () => "git:/docs/agent.md?ref=HEAD" },
        uri,
      ),
    },
    tabs: [],
  };
  const routed = [];
  const vscode = {
    TabInputText,
    TabInputTextDiff,
    window: {
      tabGroups: {
        all: [sourceGroup, diffGroup],
        activeTabGroup: diffGroup,
      },
    },
  };
  const controller = navigation.createPreviewNavigationController(
    vscode,
    async (...args) => routed.push(args),
  );

  controller.handleTabsChange({ opened: [openedCitationTab], closed: [] });
  const diffEditor = markdownEditor(uri, 41);
  diffEditor.viewColumn = 2;

  assert.equal(await controller.handleActiveTextEditorChange(diffEditor), false);
  assert.deepEqual(routed, []);

  vscode.window.tabGroups.activeTabGroup = sourceGroup;
  const citationEditor = markdownEditor(uri, 41);
  citationEditor.viewColumn = 1;
  await controller.handleActiveTextEditorChange(citationEditor);

  assert.deepEqual(routed, [[uri, 42, { openedCitationTab }]]);
});

test("keeps Markdown preview navigation active when a diff tab is in another editor group", async () => {
  const uri = { toString: () => "file:///docs/agent.md" };
  class TabInputTextDiff {
    constructor(original, modified) {
      this.original = original;
      this.modified = modified;
    }
  }
  const regularGroup = {
    isActive: true,
    viewColumn: 1,
    activeTab: { input: { uri } },
  };
  const diffGroup = {
    isActive: false,
    viewColumn: 2,
    activeTab: {
      input: new TabInputTextDiff(
        { toString: () => "git:/docs/other.md?ref=HEAD" },
        { toString: () => "file:///docs/other.md" },
      ),
    },
  };
  const routed = [];
  const vscode = {
    TabInputTextDiff,
    TextEditorSelectionChangeKind: { Command: 3 },
    window: {
      tabGroups: {
        all: [regularGroup, diffGroup],
        activeTabGroup: regularGroup,
      },
    },
  };
  const controller = navigation.createPreviewNavigationController(
    vscode,
    async (...args) => routed.push(args),
  );
  const editor = markdownEditor(uri, 20);
  editor.viewColumn = 1;

  await controller.handleSelectionChange({
    kind: 3,
    textEditor: editor,
    selections: [editor.selection],
  });

  assert.deepEqual(routed, [[uri, 21]]);
});

test("does not auto-navigate for ordinary cursor movement or non-Markdown files", async () => {
  const routed = [];
  const uri = { toString: () => "file:///docs/agent.py" };
  const vscode = { TextEditorSelectionChangeKind: { Command: 3 } };
  const controller = navigation.createPreviewNavigationController(
    vscode,
    async (...args) => routed.push(args),
  );

  await controller.handleSelectionChange({
    kind: 2,
    textEditor: markdownEditor(uri, 8),
    selections: [markdownEditor(uri, 8).selection],
  });
  await controller.handleSelectionChange({
    kind: 3,
    textEditor: {
      document: { languageId: "python", uri },
      selection: { start: { line: 8, character: 0 } },
    },
    selections: [{ start: { line: 8, character: 0 } }],
  });

  assert.deepEqual(routed, []);
});

test("routes Markdown selection changes when VS Code omits the event kind", async () => {
  const routed = [];
  const uri = { toString: () => "file:///docs/agent.md" };
  const vscode = { TextEditorSelectionChangeKind: { Command: 3 } };
  const controller = navigation.createPreviewNavigationController(
    vscode,
    async (...args) => routed.push(args),
  );

  await controller.handleSelectionChange({
    textEditor: markdownEditor(uri, 20),
    selections: [markdownEditor(uri, 20).selection],
  });

  assert.deepEqual(routed, [[uri, 21]]);
});

test("routes a citation tab opened by Copilot even when no selection event is emitted", async () => {
  const uri = { path: "/docs/agent.md", toString: () => "file:///docs/agent.md" };
  class TabInputText {
    constructor(tabUri) { this.uri = tabUri; }
  }
  const existingSourceTab = { input: new TabInputText(uri), isDirty: false };
  const openedCitationTab = { input: new TabInputText(uri), isDirty: false };
  const vscode = {
    TabInputText,
    window: {
      tabGroups: {
        all: [
          { viewColumn: 1, tabs: [existingSourceTab] },
          { viewColumn: 2, tabs: [openedCitationTab] },
        ],
      },
    },
  };
  const routed = [];
  const controller = navigation.createPreviewNavigationController(
    vscode,
    async (...args) => routed.push(args),
  );

  controller.handleTabsChange({ opened: [openedCitationTab], closed: [] });
  await controller.handleActiveTextEditorChange(markdownEditor(uri, 1130));

  assert.deepEqual(routed, [[uri, 1131, { openedCitationTab }]]);
});

test("does not hijack an ordinary newly opened Markdown tab without an existing duplicate", async () => {
  const uri = { path: "/docs/new.md", toString: () => "file:///docs/new.md" };
  class TabInputText {
    constructor(tabUri) { this.uri = tabUri; }
  }
  const openedTab = { input: new TabInputText(uri), isDirty: false };
  const vscode = {
    TabInputText,
    window: { tabGroups: { all: [{ viewColumn: 1, tabs: [openedTab] }] } },
  };
  const routed = [];
  const controller = navigation.createPreviewNavigationController(
    vscode,
    async (...args) => routed.push(args),
  );

  controller.handleTabsChange({ opened: [openedTab], closed: [] });
  assert.equal(await controller.handleActiveTextEditorChange(markdownEditor(uri, 30)), false);
  assert.deepEqual(routed, []);
});

test("allows a mouse selection only when it belongs to a newly opened citation tab", async () => {
  const uri = { path: "/docs/agent.md", toString: () => "file:///docs/agent.md" };
  class TabInputText {
    constructor(tabUri) { this.uri = tabUri; }
  }
  const existingSourceTab = { input: new TabInputText(uri), isDirty: false };
  const openedCitationTab = { input: new TabInputText(uri), isDirty: false };
  const vscode = {
    TabInputText,
    TextEditorSelectionChangeKind: { Command: 3 },
    window: {
      tabGroups: {
        all: [
          { viewColumn: 1, tabs: [existingSourceTab] },
          { viewColumn: 2, tabs: [openedCitationTab] },
        ],
      },
    },
  };
  const routed = [];
  const controller = navigation.createPreviewNavigationController(
    vscode,
    async (...args) => routed.push(args),
  );
  const editor = markdownEditor(uri, 1130);

  controller.handleTabsChange({ opened: [openedCitationTab], closed: [] });
  await controller.handleSelectionChange({
    kind: 2,
    textEditor: editor,
    selections: [editor.selection],
  });

  assert.deepEqual(routed, [[uri, 1131, { openedCitationTab }]]);
});

test("suppresses the selection event generated by source review", async () => {
  const uri = { toString: () => "file:///docs/agent.md" };
  const routed = [];
  const vscode = { TextEditorSelectionChangeKind: { Command: 3 } };
  const controller = navigation.createPreviewNavigationController(
    vscode,
    async (...args) => routed.push(args),
  );
  controller.suppressNextSelectionChange(uri, 4);

  await controller.handleSelectionChange({
    kind: 3,
    textEditor: markdownEditor(uri, 3),
    selections: [markdownEditor(uri, 3).selection],
  });

  assert.deepEqual(routed, []);
});

test("the fallback command uses the active Markdown editor line", async () => {
  const uri = { toString: () => "file:///docs/agent.md" };
  const vscode = { window: { activeTextEditor: markdownEditor(uri, 1130) } };

  assert.deepEqual(await navigation.resolveManualPreviewTarget(vscode), {
    uri,
    line: 1131,
  });
});

test("the fallback command prompts for a line when no source editor is active", async () => {
  const uri = { toString: () => "file:///docs/agent.md" };
  const document = { languageId: "markdown", uri };
  const vscode = {
    window: {
      activeTextEditor: undefined,
      async showInputBox() { return "1131"; },
    },
    workspace: {
      textDocuments: [document],
      asRelativePath() { return "docs/agent.md"; },
    },
  };

  assert.deepEqual(await navigation.resolveManualPreviewTarget(vscode), {
    uri,
    line: 1131,
  });
});

test("routes to an open preview first, otherwise opens the Markdown preview", async () => {
  const uri = { toString: () => "file:///docs/agent.md" };
  const document = { uri };
  const calls = [];
  const vscode = {
    workspace: {
      async openTextDocument(target) {
        calls.push(["openDocument", target]);
        return document;
      },
    },
  };
  const customEditorProvider = {
    revealSourceLine(target, line) {
      calls.push(["customEditor", target, line]);
      return false;
    },
  };
  const previewManager = {
    revealSourceLine(target, line) {
      calls.push(["existingPreview", target, line]);
      return false;
    },
    open(target) {
      calls.push(["openPreview", target]);
      return {
        revealSourceLine(line) { calls.push(["revealLine", line]); },
      };
    },
  };

  assert.equal(
    await navigation.revealPreviewLocation(
      vscode,
      uri,
      1131,
      customEditorProvider,
      previewManager,
    ),
    true,
  );
  assert.deepEqual(calls.map(([name]) => name), [
    "customEditor",
    "existingPreview",
    "openDocument",
    "openPreview",
    "revealLine",
  ]);
  assert.deepEqual(calls.at(-1), ["revealLine", 1131]);
});

test("reveals in an already-open custom editor without opening another preview", async () => {
  const uri = { toString: () => "file:///docs/agent.md" };
  const calls = [];
  const customEditorProvider = {
    revealSourceLine(target, line) {
      calls.push([target, line]);
      return true;
    },
  };
  const previewManager = {
    open() { assert.fail("should not open a second preview"); },
  };

  assert.equal(
    await navigation.revealPreviewLocation({}, uri, 1131, customEditorProvider, previewManager),
    true,
  );
  assert.deepEqual(calls, [[uri, 1131]]);
});

test("reuses an open plain-text source tab for native navigation instead of opening a preview", async () => {
  const uri = { scheme: "file", fsPath: "D:\\Docs\\agent.md", toString: () => "file:///D:/Docs/agent.md" };
  const document = { uri };
  const calls = [];
  class TabInputText {
    constructor(tabUri) { this.uri = tabUri; }
  }
  class Range {
    constructor(startLine, startCharacter, endLine, endCharacter) {
      this.start = { line: startLine, character: startCharacter };
      this.end = { line: endLine, character: endCharacter };
    }
  }
  const vscode = {
    TabInputText,
    Range,
    window: {
      tabGroups: {
        all: [{ viewColumn: 2, tabs: [{ input: new TabInputText(uri) }] }],
      },
      async showTextDocument(target, options) {
        calls.push(["showSource", target, options]);
      },
    },
    workspace: {
      async openTextDocument(target) {
        calls.push(["openDocument", target]);
        return document;
      },
    },
  };
  const previewManager = {
    open() { assert.fail("must not create a preview when the source tab is already open"); },
  };

  assert.equal(
    await navigation.revealPreviewLocation(vscode, uri, 1131, {}, previewManager, {
      reuseOpenSourceEditor: true,
    }),
    true,
  );
  assert.deepEqual(calls.map(([name]) => name), ["openDocument", "showSource"]);
  assert.equal(calls[1][2].viewColumn, 2);
  assert.deepEqual(calls[1][2].selection, new Range(1130, 0, 1130, 0));
});

test("matches a plain-text tab when the citation URI includes a fragment or path casing differs", async () => {
  const sourceUri = {
    scheme: "file",
    fsPath: "D:\\Docs\\agent.md",
    toString: () => "file:///D:/Docs/agent.md",
  };
  const citationUri = {
    scheme: "file",
    fsPath: "d:\\docs\\agent.md",
    toString: () => "file:///d:/docs/agent.md#L1131",
    with({ fragment }) {
      return { toString: () => `file:///d:/docs/agent.md${fragment ? `#${fragment}` : ""}` };
    },
  };
  const document = { uri: citationUri };
  class TabInputText {
    constructor(uri) { this.uri = uri; }
  }
  class Range {
    constructor(startLine, startCharacter, endLine, endCharacter) {
      this.start = { line: startLine, character: startCharacter };
      this.end = { line: endLine, character: endCharacter };
    }
  }
  const calls = [];
  const vscode = {
    TabInputText,
    Range,
    window: {
      tabGroups: { all: [{ viewColumn: 1, tabs: [{ input: new TabInputText(sourceUri) }] }] },
      async showTextDocument(target, options) { calls.push([target, options]); },
    },
    workspace: {
      async openTextDocument(target) {
        calls.push(["opened", target]);
        return document;
      },
    },
  };

  const previewManager = { open() { assert.fail("must not create a preview for an existing source tab"); } };
  assert.equal(
    await navigation.revealPreviewLocation(vscode, citationUri, 1131, {}, previewManager, {
      reuseOpenSourceEditor: true,
    }),
    true,
  );
  assert.equal(calls.length, 2);
  assert.equal(calls[0][1].toString(), "file:///d:/docs/agent.md");
  assert.equal(calls[1][1].viewColumn, 1);
});

test("reuses the existing source tab and closes only the clean citation tab VS Code just opened", async () => {
  const uri = { scheme: "file", fsPath: "D:\\Docs\\agent.md", toString: () => "file:///D:/Docs/agent.md" };
  const document = { uri };
  const calls = [];
  class TabInputText {
    constructor(tabUri) { this.uri = tabUri; }
  }
  class Range {
    constructor(startLine, startCharacter, endLine, endCharacter) {
      this.start = { line: startLine, character: startCharacter };
      this.end = { line: endLine, character: endCharacter };
    }
  }
  const existingTab = { input: new TabInputText(uri), isDirty: false };
  const citationTab = { input: new TabInputText(uri), isDirty: false };
  const vscode = {
    TabInputText,
    Range,
    window: {
      tabGroups: {
        all: [
          { viewColumn: 1, tabs: [existingTab] },
          { viewColumn: 2, tabs: [citationTab] },
        ],
        async close(tab, preserveFocus) { calls.push(["close", tab, preserveFocus]); },
      },
      async showTextDocument(target, options) { calls.push(["showSource", target, options]); },
    },
    workspace: {
      async openTextDocument(target) {
        calls.push(["openDocument", target]);
        return document;
      },
    },
  };

  assert.equal(
    await navigation.revealPreviewLocation(vscode, uri, 1131, {}, {}, {
      reuseOpenSourceEditor: true,
      openedCitationTab: citationTab,
    }),
    true,
  );

  assert.deepEqual(calls.map(([name]) => name), ["openDocument", "showSource", "close"]);
  assert.equal(calls[1][2].viewColumn, 1);
  assert.deepEqual(calls[1][2].selection, new Range(1130, 0, 1130, 0));
  assert.equal(calls[2][1], citationTab);
  assert.equal(calls[2][2], true);
});

test("does not close a dirty citation tab while reusing an existing source tab", async () => {
  const uri = { scheme: "file", fsPath: "D:\\Docs\\agent.md", toString: () => "file:///D:/Docs/agent.md" };
  const document = { uri };
  const calls = [];
  class TabInputText {
    constructor(tabUri) { this.uri = tabUri; }
  }
  const existingTab = { input: new TabInputText(uri), isDirty: false };
  const citationTab = { input: new TabInputText(uri), isDirty: true };
  const vscode = {
    TabInputText,
    Range: class Range { constructor(...values) { this.values = values; } },
    window: {
      tabGroups: {
        all: [
          { viewColumn: 1, tabs: [existingTab] },
          { viewColumn: 2, tabs: [citationTab] },
        ],
        async close(tab) { calls.push(["close", tab]); },
      },
      async showTextDocument(target, options) { calls.push(["showSource", target, options]); },
    },
    workspace: { async openTextDocument() { return document; } },
  };

  assert.equal(
    await navigation.revealPreviewLocation(vscode, uri, 1131, {}, {}, {
      reuseOpenSourceEditor: true,
      openedCitationTab: citationTab,
    }),
    true,
  );
  assert.equal(calls.some(([name]) => name === "close"), false);
});

test("rejects invalid preview line targets", async () => {
  assert.equal(
    await navigation.revealPreviewLocation({}, { toString: () => "file:///x.md" }, 0, {}, {}),
    false,
  );
});

test("preview script scrolls to and highlights the block containing a source line", () => {
  const script = fs.readFileSync(path.join(__dirname, "..", "media", "preview.js"), "utf8");
  assert.match(script, /function revealPreviewLine\(line\)/);
  assert.match(script, /data-md-start-line/);
  assert.match(script, /lm-md-reference-current/);
  assert.match(script, /activateTocForLine\(line\)/);
  assert.match(script, /event\.data\?\.type === "revealPreviewLine"/);
});
