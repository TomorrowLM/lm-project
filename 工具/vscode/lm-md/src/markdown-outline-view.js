const { renderTableOfContents } = require("./preview-panel");

function createNonce() {
  return Math.random().toString(36).slice(2, 14);
}

function activeHeadingId(headings, sourceLine) {
  if (!Number.isInteger(sourceLine) || sourceLine < 1) return "";
  let activeId = "";
  let activeLine = 0;
  for (const heading of headings) {
    if (heading.startLine <= sourceLine && heading.startLine > activeLine) {
      activeId = heading.id;
      activeLine = heading.startLine;
    }
  }
  return activeId;
}

class MarkdownOutlineViewProvider {
  constructor(vscode, extensionUri) {
    this.vscode = vscode;
    this.extensionUri = extensionUri;
    this.previews = new Map();
    this.activePreviewKey = null;
    this.activationSequence = 0;
    this.view = null;
    this.viewReady = false;
    this.disposables = new Set();
  }

  resolveWebviewView(view) {
    this.view = view;
    this.viewReady = false;
    view.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        this.vscode.Uri.joinPath(this.extensionUri, "media"),
      ],
    };
    const scriptUri = view.webview.asWebviewUri(
      this.vscode.Uri.joinPath(this.extensionUri, "media", "outline-view.js"),
    );
    view.webview.html = this.buildHtml(view.webview.cspSource, scriptUri);

    const messageSubscription = view.webview.onDidReceiveMessage((message) => {
      void this.handleMessage(message);
    });
    this.disposables.add(messageSubscription);
    const visibilitySubscription = view.onDidChangeVisibility(() => {
      if (view.visible) void this.renderActivePreview();
    });
    this.disposables.add(visibilitySubscription);
  }

  updatePreview(previewKey, uri, fileName, headings, revealSourceLine, activeLine = 0) {
    const previous = this.previews.get(previewKey);
    const normalizedHeadings = Array.isArray(headings) ? headings : [];
    const documentKey = typeof uri === "string" ? uri : uri?.toString?.() || "";
    const line = Number.isInteger(activeLine) && activeLine > 0 ? activeLine : 0;
    const normalizedFileName = String(fileName || "Markdown 文档");
    const signature = normalizedHeadings
      .map((heading) => `${heading.id}:${heading.level}:${heading.startLine}:${heading.text}`)
      .join("\u001f");
    const nextActiveHeadingId = activeHeadingId(normalizedHeadings, line);
    this.previews.set(previewKey, {
      previewKey,
      documentKey,
      fileName: normalizedFileName,
      headings: normalizedHeadings,
      signature,
      revealSourceLine,
      activeLine: line,
      activeHeadingId: nextActiveHeadingId,
      activationOrder: previous?.activationOrder || 0,
    });

    if (!this.activePreviewKey || this.activePreviewKey === previewKey) {
      this.activePreviewKey = previewKey;
      const headingsChanged = !previous || previous.signature !== signature ||
        previous.fileName !== normalizedFileName || previous.documentKey !== documentKey;
      if (headingsChanged) void this.renderActivePreview();
      else if (previous.activeHeadingId !== nextActiveHeadingId) {
        void this.setActiveHeading(nextActiveHeadingId);
      }
    }
  }

  activatePreview(previewKey) {
    const preview = this.previews.get(previewKey);
    if (!preview) return;
    preview.activationOrder = ++this.activationSequence;
    if (this.activePreviewKey === previewKey) return;
    this.activePreviewKey = previewKey;
    void this.renderActivePreview();
  }

  updateActiveLine(previewKey, sourceLine) {
    const preview = this.previews.get(previewKey);
    if (!preview) return;
    const line = Number.isInteger(sourceLine) && sourceLine > 0 ? sourceLine : 0;
    const nextHeadingId = activeHeadingId(preview.headings, line);
    if (preview.activeLine === line && preview.activeHeadingId === nextHeadingId) return;
    preview.activeLine = line;
    preview.activeHeadingId = nextHeadingId;
    if (this.activePreviewKey === previewKey) void this.setActiveHeading(nextHeadingId);
  }

  removePreview(previewKey) {
    this.previews.delete(previewKey);
    if (this.activePreviewKey !== previewKey) return;
    const next = [...this.previews.values()]
      .sort((left, right) => right.activationOrder - left.activationOrder)[0];
    this.activePreviewKey = next?.previewKey || null;
    void this.renderActivePreview();
  }

  async handleMessage(message) {
    if (message?.type === "outlineReady") {
      this.viewReady = true;
      await this.renderActivePreview();
      return;
    }
    if (message?.type !== "revealOutlineHeading") return;
    const line = Number(message.startLine);
    if (!Number.isInteger(line) || line < 1) return;
    const preview = this.previews.get(message.previewKey) ||
      this.previews.get(message.documentKey) ||
      this.previews.get(this.activePreviewKey);
    if (typeof preview?.revealSourceLine !== "function") return;
    try {
      await preview.revealSourceLine(line);
      this.updateActiveLine(preview.previewKey, line);
    } catch (error) {
      this.vscode.window.showErrorMessage(
        `无法定位到预览章节：${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async setActiveHeading(headingId) {
    if (!this.view || !this.viewReady) return;
    const sent = await this.view.webview.postMessage({
      type: "setActiveHeading",
      headingId: headingId || "",
    });
    if (!sent) this.viewReady = false;
  }

  async renderActivePreview() {
    if (!this.view || !this.viewReady) return;
    const preview = this.previews.get(this.activePreviewKey);
    const message = preview
      ? {
          type: "renderOutline",
          documentKey: preview.documentKey,
          fileName: preview.fileName,
          previewKey: preview.previewKey,
          headings: preview.headings,
          tocHtml: renderTableOfContents(preview.headings),
          activeHeadingId: preview.activeHeadingId,
        }
      : { type: "clearOutline" };
    const sent = await this.view.webview.postMessage(message);
    if (!sent) this.viewReady = false;
  }

  buildHtml(cspSource, scriptUri) {
    const nonce = createNonce();
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'nonce-${nonce}'; script-src ${cspSource};">
  <style nonce="${nonce}">
    :root { color-scheme: light dark; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 8px 8px 0; color: var(--vscode-sideBar-foreground, var(--vscode-foreground)); background: var(--vscode-sideBar-background, var(--vscode-editor-background)); font-family: var(--vscode-font-family); font-size: 12px; }
    .lm-md-outline-header { display: flex; min-width: 0; align-items: center; gap: 5px; margin: 0 2px 8px; }
    .lm-md-outline-title { flex: 1 1 auto; min-width: 0; overflow: hidden; color: var(--vscode-sideBarTitle-foreground, var(--vscode-foreground)); font-size: 11px; font-weight: 700; text-overflow: ellipsis; white-space: nowrap; }
    .lm-md-outline-locate { display: grid; width: 25px; height: 24px; flex: 0 0 25px; place-items: center; padding: 2px; border: 1px solid transparent; border-radius: 3px; color: var(--vscode-icon-foreground, var(--vscode-descriptionForeground)); background: transparent; cursor: pointer; }
    .lm-md-outline-locate svg { width: 16px; height: 16px; }
    .lm-md-outline-locate:hover { color: var(--vscode-foreground); background: var(--vscode-toolbar-hoverBackground); }
    .lm-md-outline-file { min-width: 0; margin: 0 2px 8px; overflow: hidden; color: var(--vscode-descriptionForeground); text-overflow: ellipsis; white-space: nowrap; }
    .lm-md-outline-actions, .lm-md-outline-search { display: flex; min-width: 0; gap: 5px; margin: 0 2px 8px; }
    button, input { font: inherit; }
    .lm-md-outline-actions button, .lm-md-outline-search button { min-width: 0; padding: 4px 6px; border: 1px solid var(--vscode-button-border, var(--vscode-panel-border)); border-radius: 3px; color: var(--vscode-button-secondaryForeground, var(--vscode-foreground)); background: var(--vscode-button-secondaryBackground, var(--vscode-sideBar-background)); cursor: pointer; }
    .lm-md-outline-actions button { flex: 1 1 0; }
    .lm-md-outline-search input { min-width: 0; flex: 1 1 auto; padding: 5px 7px; border: 1px solid var(--vscode-input-border, var(--vscode-panel-border)); border-radius: 3px; color: var(--vscode-input-foreground, var(--vscode-foreground)); background: var(--vscode-input-background, var(--vscode-sideBar-background)); outline-color: var(--vscode-focusBorder); }
    .lm-md-outline-count { margin: 0 4px 5px; color: var(--vscode-descriptionForeground); font-size: 11px; }
    .lm-md-outline-view { display: flex; height: calc(100vh - 8px); min-height: 0; flex-direction: column; }
    .lm-md-outline-scroll { min-height: 0; flex: 1 1 auto; overflow: auto; overscroll-behavior: contain; scrollbar-gutter: stable; }
    .lm-md-toc-list, .lm-md-toc-children { list-style: none; margin: 0; padding: 0; }
    .lm-md-toc-children { margin: 1px 0 3px 8px; padding-left: 9px; border-left: 1px solid var(--vscode-tree-indentGuidesStroke, var(--vscode-panel-border)); }
    .lm-md-toc-row { display: flex; min-width: 0; align-items: flex-start; }
    .lm-md-toc-collapse, .lm-md-toc-collapse-placeholder { width: 18px; height: 22px; flex: 0 0 18px; margin-right: 1px; }
    .lm-md-toc-collapse { padding: 0; border: 0; color: var(--vscode-descriptionForeground); background: transparent; cursor: pointer; font-size: 11px; }
    .lm-md-toc-collapse:hover { background: var(--vscode-toolbar-hoverBackground); }
    .lm-md-toc-link { display: block; min-width: 0; flex: 1 1 auto; padding: 4px 6px; border-left: 2px solid transparent; color: var(--vscode-textLink-foreground, var(--vscode-foreground)); text-decoration: none; white-space: normal; overflow-wrap: anywhere; line-height: 1.35; }
    .lm-md-toc-link[data-md-level="1"] { font-weight: 700; }
    .lm-md-toc-link[data-md-level="2"] { font-weight: 600; }
    .lm-md-toc-link[data-md-level="3"], .lm-md-toc-link[data-md-level="4"], .lm-md-toc-link[data-md-level="5"], .lm-md-toc-link[data-md-level="6"] { color: var(--vscode-descriptionForeground); }
    .lm-md-toc-link:hover { background: var(--vscode-list-hoverBackground); }
    .lm-md-toc-link.lm-md-outline-search-match { color: var(--vscode-textLink-activeForeground, var(--vscode-textLink-foreground)); background: var(--vscode-list-activeSelectionBackground); }
    .lm-md-toc-link.lm-md-toc-active { border-left-color: var(--vscode-focusBorder); color: var(--vscode-list-activeSelectionForeground, var(--vscode-foreground)); background: var(--vscode-list-activeSelectionBackground); font-weight: 700; }
    .lm-md-outline-empty { padding: 10px 6px; color: var(--vscode-descriptionForeground); line-height: 1.5; }
    .lm-md-outline-footer { margin-top: 8px; padding: 7px 4px; border-top: 1px solid var(--vscode-sideBarSectionHeader-border, var(--vscode-panel-border)); color: var(--vscode-descriptionForeground); font-size: 10px; }
    [hidden] { display: none !important; }
  </style>
</head>
<body>
  <div id="lm-md-outline-empty" class="lm-md-outline-empty">在 Markdown 预览中打开文档后，这里会显示章节目录。</div>
  <section id="lm-md-outline-view" class="lm-md-outline-view" hidden>
    <header class="lm-md-outline-header">
      <span class="lm-md-outline-title">MARKDOWN 目录</span>
      <button id="lm-md-outline-locate" class="lm-md-outline-locate" type="button" title="定位当前阅读章节" aria-label="定位当前阅读章节">
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="12" r="5"></circle><path d="M12 2v3m0 14v3M2 12h3m14 0h3"></path></svg>
      </button>
    </header>
    <div id="lm-md-outline-file" class="lm-md-outline-file"></div>
    <div class="lm-md-outline-actions">
      <button id="lm-md-outline-collapse" type="button">全部折叠</button>
      <button id="lm-md-outline-expand" type="button">全部展开</button>
    </div>
    <div class="lm-md-outline-search">
      <input id="lm-md-outline-search" type="search" placeholder="搜索标题" aria-label="搜索标题" autocomplete="off">
      <button id="lm-md-outline-clear" type="button" title="清除搜索">清除</button>
    </div>
    <div id="lm-md-outline-count" class="lm-md-outline-count" aria-live="polite"></div>
    <nav id="lm-md-outline-scroll" class="lm-md-outline-scroll" aria-label="Markdown 目录"></nav>
    <footer class="lm-md-outline-footer">跟随当前 Markdown 预览</footer>
  </section>
  <script src="${scriptUri}"></script>
</body>
</html>`;
  }

  dispose() {
    for (const disposable of this.disposables) disposable.dispose();
    this.disposables.clear();
    this.previews.clear();
    this.view = null;
    this.viewReady = false;
  }
}

module.exports = { MarkdownOutlineViewProvider, activeHeadingId };
