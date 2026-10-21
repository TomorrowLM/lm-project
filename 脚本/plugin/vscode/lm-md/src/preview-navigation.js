const { getDocumentUriKey, normalizeDocumentUri } = require("./document-uri");

function isMarkdownDocument(document) {
  return document?.languageId === "markdown" || /\.md$/i.test(document?.uri?.fsPath || document?.uri?.path || "");
}

function getPreviewLineTarget(editor, selections) {
  const document = editor?.document;
  if (!isMarkdownDocument(document)) return null;

  const selection = Array.isArray(selections)
    ? selections[0]
    : selections || editor.selection;
  const zeroBasedLine = Number(selection?.start?.line ?? selection?.active?.line);
  if (!Number.isInteger(zeroBasedLine) || zeroBasedLine < 0) return null;

  return { uri: document.uri, line: zeroBasedLine + 1 };
}

function isActiveTextDiffDocument(vscode, editor) {
  const TextDiffInput = vscode.TabInputTextDiff;
  const uri = editor?.document?.uri;
  const tabGroup = vscode.window?.tabGroups?.activeTabGroup;
  if (!TextDiffInput || !uri || !tabGroup) return false;
  if (editor.viewColumn !== undefined && tabGroup.viewColumn !== editor.viewColumn) return false;

  const input = tabGroup.activeTab?.input;
  if (!(input instanceof TextDiffInput)) return false;

  const documentKey = getDocumentUriKey(uri);
  return [input.original, input.modified].some(
    (diffUri) => getDocumentUriKey(diffUri) === documentKey,
  );
}

function createPreviewNavigationController(vscode, revealPreviewLine) {
  const suppressedSelections = new Map();
  const openedCitationTabs = new Map();
  const commandKind = vscode.TextEditorSelectionChangeKind?.Command;

  function getTextTabUri(tab) {
    const TextTabInput = vscode.TabInputText;
    return TextTabInput && tab?.input instanceof TextTabInput ? tab.input.uri : null;
  }

  function takeOpenedCitationTab(uri) {
    const key = getDocumentUriKey(uri);
    const pending = openedCitationTabs.get(key);
    if (!pending) return null;
    openedCitationTabs.delete(key);
    return pending.expiresAt >= Date.now() ? pending.tab : null;
  }

  async function routeNewCitationEditor(editor) {
    const target = getPreviewLineTarget(editor);
    if (!target) return false;
    const openedCitationTab = takeOpenedCitationTab(target.uri);
    if (!openedCitationTab) return false;
    return revealPreviewLine(target.uri, target.line, { openedCitationTab });
  }

  return {
    handleTabsChange(event) {
      for (const tab of event?.closed || []) {
        const uri = getTextTabUri(tab);
        if (!uri) continue;
        const key = getDocumentUriKey(uri);
        if (openedCitationTabs.get(key)?.tab === tab) openedCitationTabs.delete(key);
      }

      for (const tab of event?.opened || []) {
        const uri = getTextTabUri(tab);
        if (!uri || !isMarkdownDocument({ uri })) continue;
        if (findOpenTextEditorColumn(vscode, uri, { excludeTab: tab }) === undefined) continue;
        // TODO(review): VS Code does not expose the opener for a tab; URI duplication is best-effort citation detection.
        const key = getDocumentUriKey(uri);
        openedCitationTabs.set(key, { tab, expiresAt: Date.now() + 5000 });
      }
    },

    async handleActiveTextEditorChange(editor) {
      if (isActiveTextDiffDocument(vscode, editor)) return false;
      return routeNewCitationEditor(editor);
    },

    async handleSelectionChange(event) {
      if (isActiveTextDiffDocument(vscode, event?.textEditor)) return false;
      const target = getPreviewLineTarget(event.textEditor, event.selections);
      if (!target) return false;

      const openedCitationTab = takeOpenedCitationTab(target.uri);
      if (openedCitationTab) {
        return revealPreviewLine(target.uri, target.line, { openedCitationTab });
      }
      // TODO(review): Some native jumps omit kind; keep this fallback until VS Code exposes a narrower origin signal.
      if (commandKind !== undefined && event?.kind !== undefined && event.kind !== commandKind) {
        return false;
      }

      const key = getDocumentUriKey(target.uri);
      const suppressed = suppressedSelections.get(key);
      if (suppressed) {
        suppressedSelections.delete(key);
        if (suppressed.line === target.line && suppressed.expiresAt >= Date.now()) {
          return false;
        }
      }

      return revealPreviewLine(target.uri, target.line);
    },

    async revealActiveSelection() {
      const target = getPreviewLineTarget(vscode.window?.activeTextEditor);
      if (!target) return false;
      return revealPreviewLine(target.uri, target.line);
    },

    suppressNextSelectionChange(uri, line) {
      if (!Number.isInteger(line) || line < 1) return;
      const key = getDocumentUriKey(uri);
      suppressedSelections.set(key, { line, expiresAt: Date.now() + 2000 });
    },
  };
}

async function resolveManualPreviewTarget(vscode) {
  const activeTarget = getPreviewLineTarget(vscode.window?.activeTextEditor);
  if (activeTarget) return activeTarget;

  const markdownDocuments = (vscode.workspace.textDocuments || []).filter(isMarkdownDocument);
  let candidates = markdownDocuments.map((document) => document.uri);
  if (candidates.length === 0 && typeof vscode.workspace.findFiles === "function") {
    candidates = await vscode.workspace.findFiles(
      "**/*.md",
      "**/{node_modules,.git}/**",
    );
  }

  const uniqueCandidates = Array.from(
    new Map(candidates.map((uri) => [getDocumentUriKey(uri), uri])).values(),
  );
  if (uniqueCandidates.length === 0) return null;

  let uri = uniqueCandidates[0];
  if (uniqueCandidates.length > 1) {
    const picks = uniqueCandidates.map((candidate) => ({
      label: vscode.workspace.asRelativePath(candidate),
      description: candidate.fsPath || candidate.path || "",
      uri: candidate,
    }));
    const picked = await vscode.window.showQuickPick(picks, {
      placeHolder: "选择要定位的 Markdown 文件",
      matchOnDescription: true,
    });
    if (!picked) return null;
    uri = picked.uri;
  }

  const rawLine = await vscode.window.showInputBox({
    prompt: `输入 ${vscode.workspace.asRelativePath(uri)} 的行号`,
    placeHolder: "例如 1131",
    validateInput(value) {
      return Number.isInteger(Number(value)) && Number(value) > 0
        ? undefined
        : "请输入大于 0 的整数行号";
    },
  });
  if (rawLine === undefined) return null;
  const line = Number(rawLine);
  if (!Number.isInteger(line) || line < 1) return null;
  return { uri, line };
}

async function revealPreviewLocation(
  vscode,
  uri,
  line,
  customEditorProvider,
  previewManager,
  options = {},
) {
  if (!uri || !Number.isInteger(line) || line < 1) return false;
  const documentUri = normalizeDocumentUri(uri);
  const openedCitationTab = options.openedCitationTab;

  if (await customEditorProvider?.revealSourceLine?.(documentUri, line)) {
    await closeOpenedCitationTab(vscode, openedCitationTab);
    return true;
  }
  if (await previewManager?.revealSourceLine?.(documentUri, line)) {
    await closeOpenedCitationTab(vscode, openedCitationTab);
    return true;
  }

  const document = await vscode.workspace.openTextDocument(documentUri);
  if (options.reuseOpenSourceEditor === true) {
    const viewColumn = findOpenTextEditorColumn(vscode, uri, {
      excludeTab: openedCitationTab,
    });
    if (viewColumn !== undefined && typeof vscode.window?.showTextDocument === "function") {
      const selection = new vscode.Range(line - 1, 0, line - 1, 0);
      options.suppressNextSelectionChange?.(documentUri, line);
      await vscode.window.showTextDocument(document, {
        viewColumn,
        preserveFocus: false,
        selection,
      });
      await closeOpenedCitationTab(vscode, openedCitationTab);
      return true;
    }
  }

  if (openedCitationTab) return false;

  const preview = previewManager?.open(document);
  if (typeof preview?.revealSourceLine !== "function") return false;
  await preview.revealSourceLine(line);
  return true;
}

function findOpenTextEditorColumn(vscode, uri, options = {}) {
  const key = getDocumentUriKey(uri);
  const window = vscode.window;
  const TextTabInput = vscode.TabInputText;
  if (options.excludeTab && TextTabInput) {
    for (const group of window?.tabGroups?.all || []) {
      for (const tab of group.tabs || []) {
        if (
          tab !== options.excludeTab
          && tab.input instanceof TextTabInput
          && getDocumentUriKey(tab.input.uri) === key
        ) {
          return group.viewColumn;
        }
      }
    }
    return undefined;
  }

  const visibleEditors = window?.visibleTextEditors || [];
  const matchingEditor = [window?.activeTextEditor, ...visibleEditors].find(
    (editor) => editor?.document && getDocumentUriKey(editor.document.uri) === key,
  );
  if (matchingEditor) {
    return matchingEditor.viewColumn
      ?? window?.tabGroups?.activeTabGroup?.viewColumn
      ?? vscode.ViewColumn?.Active;
  }

  if (!TextTabInput) return undefined;
  for (const group of window?.tabGroups?.all || []) {
    for (const tab of group.tabs || []) {
      if (
        tab.input instanceof TextTabInput
        && getDocumentUriKey(tab.input.uri) === key
      ) {
        return group.viewColumn;
      }
    }
  }
  return undefined;
}

async function closeOpenedCitationTab(vscode, tab) {
  if (!tab || tab.isDirty || typeof vscode.window?.tabGroups?.close !== "function") return;
  await vscode.window.tabGroups.close(tab, true);
}

module.exports = {
  createPreviewNavigationController,
  findOpenTextEditorColumn,
  getPreviewLineTarget,
  resolveManualPreviewTarget,
  revealPreviewLocation,
};
