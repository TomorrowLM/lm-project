const { normalizeSourceRanges } = require("./selection-range");
const { createCoalescedTask } = require("./coalesced-task");

function normalizePreviewSelection(message) {
  if (!message || message.type !== "previewSelection") return null;
  const text = String(message.text || "").trim();
  const ranges = normalizeSourceRanges(
    Array.isArray(message.ranges) && message.ranges.length > 0
      ? message.ranges.map((range) => ({
          startLine: Number(range?.startLine),
          endLine: Number(range?.endLine),
        }))
      : [{
          startLine: Number(message.startLine),
          endLine: Number(message.endLine),
        }],
  );

  if (!text || ranges.length === 0) return null;

  return {
    text,
    ranges,
    startLine: ranges[0].startLine,
    endLine: ranges.at(-1).endLine,
  };
}

function normalizeSyncSelection(message) {
  if (!message || message.type !== "syncPreviewSelection") return null;
  return normalizePreviewSelection({
    type: "previewSelection",
    text: message.text,
    ranges: message.ranges,
    startLine: message.startLine,
    endLine: message.endLine,
  });
}

function normalizeBoldSegments(message) {
  if (message?.type !== "formatSelectionBold" || !Array.isArray(message.segments)) {
    return null;
  }
  const segments = [];
  for (const segment of message.segments) {
    const text = String(segment?.text || "").trim();
    const startLine = Number(segment?.startLine);
    const endLine = Number(segment?.endLine);
    if (!text || !Number.isInteger(startLine) || !Number.isInteger(endLine) ||
        startLine < 1 || endLine < startLine) {
      return null;
    }
    segments.push({ text, startLine, endLine });
  }
  return segments.length > 0 ? segments : null;
}

function normalizeSourceReview(message) {
  if (!message || message.type !== "openSourceReview") return null;
  const startLine = Number(message.startLine);
  const endLine = Number(message.endLine);
  if (!Number.isInteger(startLine) || !Number.isInteger(endLine)) return null;
  if (startLine < 1 || endLine < startLine) return null;
  return { startLine, endLine };
}

function createPreviewMessageHandler(
  webview,
  documentUri,
  onSelection,
  onSourceReview,
  onReady,
  onPreviewStateChanged,
  onRefreshChangeHistory,
  onFormatBold,
) {
  return async (message) => {
    if (message?.type === "previewStateChanged") {
      await onPreviewStateChanged?.(documentUri, message.previewState);
      return;
    }

    if (message?.type === "refreshChangeHistory") {
      await onRefreshChangeHistory?.(documentUri);
      return;
    }

    if (message?.type === "previewReady") {
      await onReady?.();
      return;
    }

    const boldSegments = normalizeBoldSegments(message);
    if (boldSegments) {
      try {
        if (typeof onFormatBold !== "function") {
          throw new Error("加粗操作不可用");
        }
        await onFormatBold(documentUri, boldSegments);
        await webview.postMessage({ type: "boldFormatCompleted" });
      } catch (error) {
        await webview.postMessage({
          type: "boldFormatFailed",
          message: error instanceof Error ? error.message : String(error),
        });
      }
      return;
    }

    const sourceReview = normalizeSourceReview(message);
    if (sourceReview) {
      try {
        await onSourceReview?.(documentUri, sourceReview);
        await webview.postMessage({ type: "sourceReviewCompleted", sourceReview });
      } catch (error) {
        await webview.postMessage({
          type: "sourceReviewFailed",
          message: error instanceof Error ? error.message : String(error),
        });
      }
      return;
    }

    if (message && message.type === "previewSelection") {
      const selection = normalizePreviewSelection(message);
      if (selection) {
        await webview.postMessage({
          type: "selectionAvailable",
          selection,
        });
      }
      return;
    }

    const selection = normalizeSyncSelection(message);
    if (!selection) return;

    try {
      await webview.postMessage({
        type: "syncStarted",
        selection,
      });
      await onSelection(documentUri, selection);
      await webview.postMessage({
        type: "syncCompleted",
        selection,
      });
    } catch (error) {
      await webview.postMessage({
        type: "syncFailed",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };
}

function createMarkdownPreviewPanel(
  context,
  extensionUri,
  document,
  onSelection,
  changeRecords = [],
  onSourceReview,
  previewStateStore,
  changeHistoryStore,
  onFormatBold,
) {
  const vscode = require("vscode");
  return new MarkdownPreviewPanel(
    vscode,
    context,
    extensionUri,
    document,
    onSelection,
    changeRecords,
    onSourceReview,
    previewStateStore,
    changeHistoryStore,
    onFormatBold,
  );
}

function getMarkdownPreviewResourceRoots(vscode, extensionUri, documentUri) {
  const roots = [
    vscode.Uri.joinPath(extensionUri, "media"),
  ];
  const workspaceFolder = vscode.workspace?.getWorkspaceFolder?.(documentUri);
  if (workspaceFolder?.uri) {
    roots.push(workspaceFolder.uri);
  } else if (["file", "vscode-remote"].includes(documentUri?.scheme)) {
    roots.push(vscode.Uri.joinPath(documentUri, ".."));
  }
  return roots;
}

async function readSavedDocumentText(vscode, documentUri) {
  try {
    const bytes = Buffer.from(await vscode.workspace.fs.readFile(documentUri));
    if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
      return bytes.subarray(2).toString("utf16le");
    }
    if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
      const bigEndianText = Buffer.from(bytes.subarray(2));
      for (let index = 0; index + 1 < bigEndianText.length; index += 2) {
        [bigEndianText[index], bigEndianText[index + 1]] = [
          bigEndianText[index + 1],
          bigEndianText[index],
        ];
      }
      return bigEndianText.toString("utf16le");
    }
    const utf8Bytes = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf
      ? bytes.subarray(3)
      : bytes;
    return utf8Bytes.toString("utf8").replace(/^\uFEFF/u, "");
  } catch {
    // Untitled documents and unavailable remote files still use the tracked
    // in-memory baseline in MarkdownChangeHistory.refresh().
    return undefined;
  }
}

function createMarkdownImageResolver(vscode, documentUri, webview) {
  return (source) => {
    const value = String(source || "").trim();
    if (!value) return value;
    if (/^(?:https?:|data:|blob:|vscode-resource:|vscode-webview:|\/\/)/i.test(value)) {
      return value;
    }

    let imageUri;
    if (/^file:/i.test(value)) {
      imageUri = vscode.Uri.parse(value);
    } else if (/^[a-z]:[\\/]/i.test(value) || /^\\\\/.test(value) || value.startsWith("/")) {
      imageUri = vscode.Uri.file(value);
    } else if (/^[a-z][a-z\d+.-]*:/i.test(value)) {
      return value;
    } else {
      const parsed = vscode.Uri.parse(value);
      const relativePath = String(parsed.path || "").replace(/^\/+/, "");
      imageUri = vscode.Uri.joinPath(documentUri, "..", relativePath);
      if (parsed.query || parsed.fragment) {
        imageUri = imageUri.with({ query: parsed.query, fragment: parsed.fragment });
      }
    }

    return webview.asWebviewUri(imageUri).toString();
  };
}

class MarkdownPreviewPanel {
  constructor(
    vscode,
    context,
    extensionUri,
    document,
    onSelection,
    changeRecords,
    onSourceReview,
    previewStateStore,
    changeHistoryStore,
    onFormatBold,
  ) {
    this.vscode = vscode;
    this.extensionUri = extensionUri;
    this.document = document;
    this.onSelection = onSelection;
    this.onSourceReview = onSourceReview;
    this.previewStateStore = previewStateStore;
    this.changeHistoryStore = changeHistoryStore;
    this.onFormatBold = onFormatBold;
    this.changeRecords = changeRecords;
    this.initialHtmlSet = false;
    this.webviewReady = false;
    this.pendingUpdate = null;
    this.restoreScrollWhenVisible = false;
    this.pendingRevealLine = null;
    this.refreshTask = createCoalescedTask(() => this.render(), 150);
    this.panel = vscode.window.createWebviewPanel(
      "lmMdPreview",
      `Preview: ${vscode.workspace.asRelativePath(document.uri)}`,
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: getMarkdownPreviewResourceRoots(
          vscode,
          extensionUri,
          document.uri,
        ),
      },
    );
    const restoreScrollOnActivation = async () => {
      const previewState = this.previewStateStore?.has(this.document.uri)
        ? this.previewStateStore.get(this.document.uri)
        : null;
      const sent = await this.panel.webview.postMessage({
        type: "restorePreviewScroll",
        previewState,
      });
      if (!sent) this.restoreScrollWhenVisible = true;
    };
    this.viewStateSubscription = this.panel.onDidChangeViewState((event) => {
      if (!event.webviewPanel.visible || !event.webviewPanel.active) return;
      if (this.pendingRevealLine !== null) {
        this.restoreScrollWhenVisible = false;
        return;
      }
      if (!this.webviewReady) {
        this.restoreScrollWhenVisible = true;
        return;
      }
      void restoreScrollOnActivation();
    });

    this.panel.webview.onDidReceiveMessage(
      createPreviewMessageHandler(
        this.panel.webview,
        document.uri,
        async (uri, selection) => {
          this.lastSelection = selection;
          return this.onSelection(uri, selection);
        },
        this.onSourceReview,
        async () => {
          this.webviewReady = true;
          await this.panel.webview.postMessage({
            type: "restorePreviewState",
            previewState: this.previewStateStore?.has(this.document.uri)
              ? this.previewStateStore.get(this.document.uri)
              : null,
          });
          if (this.pendingUpdate) {
            const update = this.pendingUpdate;
            this.pendingUpdate = null;
            const sent = await this.panel.webview.postMessage({ type: "updatePreviewContent", ...update });
            if (!sent) {
              this.webviewReady = false;
              this.pendingUpdate = update;
            }
          }
          const hadPendingReveal = this.pendingRevealLine !== null;
          await this.flushPendingRevealLine();
          if (hadPendingReveal) this.restoreScrollWhenVisible = false;
          if (this.restoreScrollWhenVisible && this.panel.visible && this.panel.active) {
            this.restoreScrollWhenVisible = false;
            await restoreScrollOnActivation();
          }
        },
        (uri, state) => this.previewStateStore?.set(uri, state),
        async (uri) => {
          const fileName = this.vscode.workspace.asRelativePath(uri);
          const savedText = await readSavedDocumentText(this.vscode, uri);
          this.changeHistoryStore?.refresh(this.document, savedText);
          await this.panel.webview.postMessage({
            type: "updateChangeHistory",
            changeHistoryHtml: renderChangeHistory(
              this.changeHistoryStore?.get(uri) || this.changeRecords || [],
              fileName,
              this.changeHistoryStore?.getEvents(uri) || [],
            ),
          });
        },
        this.onFormatBold,
      ),
      null,
      context.subscriptions,
    );

    this.panel.onDidDispose(() => {
      this.disposed = true;
      this.refreshTask.dispose();
      this.viewStateSubscription.dispose();
    }, null, context.subscriptions);

    this.update(document);
  }

  update(document, changeRecords = this.changeRecords, { immediate = false } = {}) {
    if (this.disposed) return;
    this.document = document;
    this.changeRecords = changeRecords;
    if (this.initialHtmlSet) {
      this.refreshTask.schedule();
      if (immediate) this.refreshTask.flush();
      return;
    }
    this.render();
  }

  render() {
    if (this.disposed) return;
    const document = this.document;
    const changeRecords = this.changeRecords;
    const rendered = renderPreviewDocument(document.getText(), {
      resolveImageSource: createMarkdownImageResolver(
        this.vscode,
        document.uri,
        this.panel.webview,
      ),
    });
    const scriptUri = this.panel.webview.asWebviewUri(
      this.vscode.Uri.joinPath(this.extensionUri, "media", "preview.js"),
    );
    const mermaidScriptUri = this.panel.webview.asWebviewUri(
      this.vscode.Uri.joinPath(
        this.extensionUri,
        "media",
        "mermaid.bundle.js",
      ),
    );
    const fileName = this.vscode.workspace.asRelativePath(document.uri);
    const payload = {
      bodyHtml: rendered.html,
      tocHtml: renderTableOfContents(rendered.headings),
      changeHistoryHtml: renderChangeHistory(
        changeRecords || [],
        fileName,
        this.changeHistoryStore?.getEvents(document.uri) || [],
      ),
      headings: rendered.headings,
      fileName,
    };
    if (!this.initialHtmlSet) {
      this.panel.webview.html = buildPreviewHtml(
        payload.bodyHtml,
        this.panel.webview.cspSource,
        scriptUri,
        payload.headings,
        {
          changeRecords,
          changeEvents: this.changeHistoryStore?.getEvents(document.uri) || [],
          fileName,
          mermaidScriptUri: mermaidScriptUri.toString(),
        },
      );
      this.initialHtmlSet = true;
      return;
    }
    if (!this.webviewReady) {
      this.pendingUpdate = payload;
      return;
    }
    void this.panel.webview.postMessage({ type: "updatePreviewContent", ...payload }).then((sent) => {
      if (!sent) {
        this.webviewReady = false;
        this.pendingUpdate = payload;
      }
    });
  }

  async revealSourceLine(line) {
    if (!Number.isInteger(line) || line < 1 || this.disposed) return false;
    this.panel.reveal(this.panel.viewColumn, false);
    this.pendingRevealLine = line;
    await this.flushPendingRevealLine();
    return true;
  }

  async flushPendingRevealLine() {
    if (!this.webviewReady || this.pendingRevealLine === null || this.disposed) return;
    const line = this.pendingRevealLine;
    const sent = await this.panel.webview.postMessage({ type: "revealPreviewLine", line });
    if (sent) this.pendingRevealLine = null;
    else this.webviewReady = false;
  }

  setExtensionUri(extensionUri) {
    this.extensionUri = extensionUri;
    this.update(this.document);
  }
}

function renderPreviewBody(markdown) {
  return renderPreviewDocument(markdown).html;
}

function renderPreviewDocument(markdown, options) {
  const { renderMarkdownDocument } = require("./markdown-renderer");
  return renderMarkdownDocument(markdown, options);
}

function buildPreviewHtml(body, cspSource, scriptUri, headings = [], options = {}) {
  const nonce = createNonce();
  const toc = renderTableOfContents(headings);
  const changeHistory = renderChangeHistory(
    options.changeRecords || [],
    options.fileName || "当前文档",
    options.changeEvents || [],
  );
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta
    http-equiv="Content-Security-Policy"
    content="default-src 'none'; img-src ${cspSource} https: http: data:; style-src ${cspSource} 'nonce-${nonce}'; script-src ${cspSource};"
  >
  <style nonce="${nonce}">
    :root { color-scheme: light dark; }
    body.lm-md-light {
      color-scheme: light;
      --vscode-editor-background: #ffffff;
      --vscode-editor-foreground: #1f2328;
      --vscode-panel-border: #d0d7de;
      --vscode-descriptionForeground: #57606a;
      --vscode-button-foreground: #1f2328;
      --vscode-button-background: #f6f8fa;
      --vscode-button-secondaryForeground: #1f2328;
      --vscode-button-secondaryBackground: #ffffff;
      --vscode-button-border: #8c959f;
      --vscode-input-foreground: #1f2328;
      --vscode-input-background: #ffffff;
      --vscode-input-border: #8c959f;
      --vscode-tree-indentGuidesStroke: #d8dee4;
      --vscode-textLink-foreground: #0969da;
      --vscode-textLink-activeForeground: #0550ae;
      --vscode-list-activeSelectionBackground: #dbeafe;
      --vscode-list-hoverBackground: #f3f4f6;
      --vscode-toolbar-hoverBackground: #eef1f4;
      --vscode-focusBorder: #0969da;
      --vscode-editor-selectionBackground: #b6d7ff;
      --vscode-textCodeBlock-background: #f6f8fa;
      --vscode-textBlockQuote-border: #8c959f;
      --vscode-textBlockQuote-foreground: #57606a;
      --vscode-menu-border: #d0d7de;
      --vscode-menu-background: #ffffff;
      --vscode-menu-foreground: #1f2328;
      --vscode-menu-selectionBackground: #dbeafe;
      --vscode-menu-selectionForeground: #1f2328;
      --vscode-errorForeground: #cf222e;
    }
    body { margin: 0; overflow-x: hidden; color: var(--vscode-editor-foreground); background: var(--vscode-editor-background); font-family: var(--vscode-font-family); line-height: 1.65; }
    .lm-md-layout { display: flex; align-items: flex-start; gap: 16px; width: 100%; max-width: none; box-sizing: border-box; margin: 0; padding: 24px 0 56px 32px; }
    .lm-md-main { min-width: 0; flex: 1 1 auto; max-width: none; }
    .lm-md-toc { position: sticky; top: 18px; align-self: flex-start; flex: 0 0 clamp(260px, 24vw, 360px); width: clamp(260px, 24vw, 360px); min-width: 0; height: calc(100vh - 36px); max-height: calc(100vh - 36px); min-height: 0; overflow: hidden; order: 2; }
    .lm-md-toc.lm-md-toc-hidden { display: none !important; }
    .lm-md-toc-panel { display: grid; grid-template-rows: auto minmax(0, 1fr); width: 100%; height: 100%; min-height: 0; box-sizing: border-box; padding: 8px 10px; overflow: hidden; border: 1px solid var(--vscode-panel-border); border-radius: 6px; background: color-mix(in srgb, var(--vscode-editor-background) 94%, var(--vscode-editor-foreground)); }
    .lm-md-toc-panel.lm-md-toc-collapsed { height: auto; }
    .lm-md-toc-summary { display: flex; width: 100%; align-items: center; gap: 6px; padding: 0 0 5px; text-align: left; font-weight: 600; color: var(--vscode-editor-foreground); background: transparent; border: 0; cursor: pointer; }
    .lm-md-toc-summary:hover { background: var(--vscode-toolbar-hoverBackground); }
    .lm-md-toc-content { display: grid; grid-template-rows: auto minmax(0, 1fr); min-height: 0; overflow: hidden; }
    .lm-md-toc-content[hidden] { display: none; }
    .lm-md-toc-tools { display: grid; gap: 8px; min-height: 0; margin-top: 4px; }
    .lm-md-toc-actions { display: flex; gap: 6px; }
    .lm-md-toc-actions button { flex: 1 1 0; min-width: 0; padding: 3px 6px; font-size: 11px; color: var(--vscode-button-secondaryForeground, var(--vscode-button-foreground)); background: var(--vscode-button-secondaryBackground, var(--vscode-button-background)); }
    .lm-md-toc-search { display: flex; gap: 6px; align-items: center; }
    .lm-md-toc-search input { min-width: 0; flex: 1 1 auto; box-sizing: border-box; padding: 5px 7px; color: var(--vscode-input-foreground); background: var(--vscode-input-background); border: 1px solid var(--vscode-input-border, var(--vscode-panel-border)); border-radius: 4px; }
    .lm-md-toc-search button { flex: 0 0 auto; padding: 5px 7px; color: var(--vscode-button-secondaryForeground, var(--vscode-button-foreground)); background: var(--vscode-button-secondaryBackground, var(--vscode-button-background)); }
    .lm-md-toc-result { min-height: 16px; color: var(--vscode-descriptionForeground); font-size: 11px; }
    .lm-md-toc-scroll { display: block; min-width: 0; min-height: 0; overflow-x: hidden; overflow-y: auto; overscroll-behavior: contain; scrollbar-gutter: stable; }
    .lm-md-toc-list, .lm-md-toc-children { list-style: none; margin: 6px 0 0; padding: 0; }
    .lm-md-toc-children { margin: 1px 0 3px 8px; padding-left: 10px; border-left: 1px solid var(--vscode-tree-indentGuidesStroke); }
    .lm-md-toc-row { display: flex; align-items: flex-start; min-width: 0; }
    .lm-md-toc-collapse, .lm-md-toc-collapse-placeholder { flex: 0 0 18px; width: 18px; height: 22px; margin: 0 1px 0 0; }
    .lm-md-toc-collapse-placeholder { display: inline-block; }
    .lm-md-toc-link { display: block; min-width: 0; flex: 1 1 auto; padding: 4px 7px; border-left: 2px solid transparent; color: var(--vscode-textLink-foreground); text-decoration: none; white-space: normal; overflow-wrap: anywhere; font-size: 12px; line-height: 1.35; }
    .lm-md-toc-link[data-md-level="1"] { font-size: 13px; font-weight: 700; }
    .lm-md-toc-link[data-md-level="2"] { font-weight: 600; }
    .lm-md-toc-link[data-md-level="3"], .lm-md-toc-link[data-md-level="4"], .lm-md-toc-link[data-md-level="5"], .lm-md-toc-link[data-md-level="6"] { color: var(--vscode-descriptionForeground); }
    .lm-md-toc-link.lm-md-search-match { color: var(--vscode-textLink-activeForeground, var(--vscode-textLink-foreground)); background: var(--vscode-list-activeSelectionBackground); }
    .lm-md-toc-link.lm-md-toc-active { border-left-color: var(--vscode-focusBorder); background: color-mix(in srgb, var(--vscode-list-activeSelectionBackground) 72%, transparent); font-weight: 700; }
    .lm-md-toc-collapse { flex: 0 0 18px; width: 18px; height: 22px; margin: 0 1px 0 0; padding: 0; color: var(--vscode-descriptionForeground); background: transparent; border: 0; font-size: 11px; line-height: 20px; vertical-align: middle; }
    .lm-md-toc-collapse:hover { background: var(--vscode-toolbar-hoverBackground); }
    .lm-md-content-match { outline: 2px solid color-mix(in srgb, var(--vscode-focusBorder) 70%, transparent); outline-offset: 3px; border-radius: 2px; }
    .lm-md-toc-link:hover { background: var(--vscode-list-hoverBackground); }
    .lm-md-toc-link:focus-visible { outline: 1px solid var(--vscode-focusBorder); outline-offset: -1px; }
    .lm-md-empty-toc { color: var(--vscode-descriptionForeground); font-size: 12px; }
    .lm-md-toolbar { position: sticky; top: 0; z-index: 2; display: grid; grid-template-columns: minmax(0, 1fr) auto auto auto auto; grid-template-areas: "status toc theme search sync"; align-items: center; gap: 12px; min-height: 32px; padding: 8px 0; margin-bottom: 18px; background: color-mix(in srgb, var(--vscode-editor-background) 92%, transparent); border-bottom: 1px solid var(--vscode-panel-border); }
    .lm-md-toolbar.lm-md-toolbar-hidden { display: none !important; }
    .lm-md-selection-group { grid-area: status; display: flex; min-width: 0; align-items: center; gap: 6px; }
    .lm-md-status { min-width: 0; flex: 1 1 auto; overflow: hidden; color: var(--vscode-descriptionForeground); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
    .lm-md-selection-group button { flex: 0 0 auto; padding: 4px 8px; font-size: 11px; color: var(--vscode-button-secondaryForeground, var(--vscode-button-foreground)); background: var(--vscode-button-secondaryBackground, var(--vscode-button-background)); white-space: nowrap; }
    .lm-md-toc-toggle { grid-area: toc; color: var(--vscode-button-secondaryForeground, var(--vscode-button-foreground)); background: var(--vscode-button-secondaryBackground, var(--vscode-button-background)); white-space: nowrap; }
    .lm-md-theme-toggle { grid-area: theme; color: var(--vscode-button-secondaryForeground, var(--vscode-button-foreground)); background: var(--vscode-button-secondaryBackground, var(--vscode-button-background)); white-space: nowrap; }
    .lm-md-content-search-toolbar { display: flex; grid-area: search; align-items: center; justify-content: flex-end; gap: 4px; min-width: 0; }
    .lm-md-content-search-toolbar input { width: clamp(120px, 14vw, 220px); min-width: 80px; box-sizing: border-box; padding: 5px 7px; color: var(--vscode-input-foreground); background: var(--vscode-input-background); border: 1px solid var(--vscode-input-border, var(--vscode-panel-border)); border-radius: 4px; }
    .lm-md-content-search-toolbar button { min-width: 26px; padding: 4px 7px; color: var(--vscode-button-secondaryForeground, var(--vscode-button-foreground)); background: var(--vscode-button-secondaryBackground, var(--vscode-button-background)); }
    .lm-md-search-result { min-width: 42px; color: var(--vscode-descriptionForeground); font-size: 11px; white-space: nowrap; }
    button { border: 1px solid var(--vscode-button-border, transparent); border-radius: 4px; padding: 5px 10px; color: var(--vscode-button-foreground); background: var(--vscode-button-background); cursor: pointer; }
    .lm-md-toc-collapse { width: 18px; height: 22px; margin: 0 1px 0 0; padding: 0; color: var(--vscode-descriptionForeground); background: transparent; border: 0; line-height: 20px; }
    .lm-md-content-search-toolbar button { padding: 4px 7px; color: var(--vscode-button-secondaryForeground, var(--vscode-button-foreground)); background: var(--vscode-button-secondaryBackground, var(--vscode-button-background)); }
    #lm-md-sync { grid-area: sync; min-width: max-content; white-space: nowrap; }
    button:disabled { opacity: .55; cursor: default; }
    .lm-md-collapse { margin-right: 6px; padding: 0 4px; color: var(--vscode-descriptionForeground); background: transparent; border: 0; font-size: .75em; vertical-align: middle; }
    .lm-md-collapse:hover { background: var(--vscode-toolbar-hoverBackground); }
    .lm-md-content-current { outline: 2px solid var(--vscode-focusBorder); outline-offset: 3px; background: color-mix(in srgb, var(--vscode-editor-selectionBackground) 35%, transparent); }
    .lm-md-change-history { position: sticky; top: calc(var(--lm-md-toolbar-height, 0px) + 8px); z-index: 1; margin: 0 0 14px; padding: 8px 10px; border: 1px solid var(--vscode-panel-border); border-radius: 6px; background: color-mix(in srgb, var(--vscode-editor-background) 97%, var(--vscode-editor-foreground)); box-shadow: 0 4px 16px color-mix(in srgb, black 22%, transparent); }
    .lm-md-change-history[hidden] { display: none; }
    .lm-md-change-header { display: flex; flex-wrap: wrap; align-items: center; gap: 7px; }
    .lm-md-change-title-group { display: inline-flex; flex: 0 0 auto; align-items: center; gap: 6px; }
    .lm-md-change-help { position: relative; display: inline-flex; z-index: 5; }
    .lm-md-change-help-button { display: inline-grid; width: 18px; height: 18px; place-items: center; padding: 0; border: 1px solid var(--vscode-descriptionForeground); border-radius: 50%; color: var(--vscode-descriptionForeground); background: transparent; font-size: 12px; font-weight: 600; line-height: 1; }
    .lm-md-change-help-button:hover { color: var(--vscode-editor-foreground); background: var(--vscode-toolbar-hoverBackground); }
    .lm-md-change-help-popover { position: absolute; top: calc(100% + 7px); left: 0; z-index: 20; display: none; width: min(360px, calc(100vw - 32px)); box-sizing: border-box; padding: 9px 11px; border: 1px solid var(--vscode-editorWidget-border, var(--vscode-panel-border)); border-radius: 5px; color: var(--vscode-editorWidget-foreground, var(--vscode-editor-foreground)); background: var(--vscode-editorWidget-background, var(--vscode-editor-background)); box-shadow: 0 5px 18px color-mix(in srgb, black 35%, transparent); font-size: 12px; line-height: 1.5; white-space: normal; }
    .lm-md-change-help.is-open .lm-md-change-help-popover { display: block; }
    .lm-md-change-file { min-width: 0; flex: 1 1 180px; overflow: hidden; color: var(--vscode-textLink-foreground); text-overflow: ellipsis; white-space: nowrap; }
    .lm-md-change-summary, .lm-md-change-empty { color: var(--vscode-descriptionForeground); font-size: 12px; }
    .lm-md-change-focus-title { margin: 0 0 4px; color: var(--vscode-descriptionForeground); font-size: 11px; font-weight: 600; }
    .lm-md-change-body[hidden] { display: none; }
    .lm-md-change-list-scroll { max-height: min(32vh, 210px); min-height: 0; margin-top: 6px; overflow-x: hidden; overflow-y: auto; overscroll-behavior: contain; scrollbar-gutter: stable; }
    .lm-md-change-list { display: grid; gap: 6px; margin: 0; padding: 0; list-style: none; }
    .lm-md-change-events { margin-top: 8px; padding-top: 6px; border-top: 1px solid var(--vscode-panel-border); color: var(--vscode-descriptionForeground); font-size: 11px; }
    .lm-md-change-event-list { display: grid; gap: 5px; margin: 5px 0 0; padding-left: 18px; }
    .lm-md-change-entry { padding: 6px; border-left: 2px solid transparent; }
    .lm-md-change-entry.lm-md-change-selected { border-left-color: var(--vscode-focusBorder); background: var(--vscode-list-activeSelectionBackground); }
    .lm-md-change-entry.lm-md-net-change-added { border-left-color: var(--vscode-gitDecoration-addedResourceForeground, #73c991); background: color-mix(in srgb, var(--vscode-gitDecoration-addedResourceForeground, #73c991) 10%, transparent); }
    .lm-md-change-entry.lm-md-net-change-modified { border-left-color: var(--vscode-gitDecoration-modifiedResourceForeground, #e2c08d); background: color-mix(in srgb, var(--vscode-gitDecoration-modifiedResourceForeground, #e2c08d) 10%, transparent); }
    .lm-md-change-entry.lm-md-net-change-removed { border-left-color: var(--vscode-gitDecoration-deletedResourceForeground, #f14c4c); background: color-mix(in srgb, var(--vscode-gitDecoration-deletedResourceForeground, #f14c4c) 10%, transparent); }
    .lm-md-change-locate { display: flex; width: 100%; align-items: center; gap: 8px; padding: 3px 5px; text-align: left; color: var(--vscode-editor-foreground); background: transparent; border: 0; }
    .lm-md-change-detail { flex: 0 0 auto; color: var(--vscode-descriptionForeground); font-size: 11px; }
    .lm-md-change-diff { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; margin-top: 5px; }
    .lm-md-change-diff pre { max-height: 100px; margin: 3px 0 0; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; }
    .lm-md-change-before pre { border-left: 3px solid var(--vscode-gitDecoration-deletedResourceForeground, #f14c4c); background: color-mix(in srgb, var(--vscode-gitDecoration-deletedResourceForeground, #f14c4c) 14%, var(--vscode-textCodeBlock-background, #1e1e1e)); }
    .lm-md-change-after pre { border-left: 3px solid var(--vscode-gitDecoration-addedResourceForeground, #73c991); background: color-mix(in srgb, var(--vscode-gitDecoration-addedResourceForeground, #73c991) 14%, var(--vscode-textCodeBlock-background, #1e1e1e)); }
    .lm-md-change-diff strong { color: var(--vscode-descriptionForeground); font-size: 11px; }
    .lm-md-change-source { margin-top: 5px; }
    article .lm-md-net-change { border-radius: 2px; }
    article .lm-md-net-change-added { box-shadow: inset 3px 0 0 var(--vscode-gitDecoration-addedResourceForeground, #73c991); background-color: color-mix(in srgb, var(--vscode-gitDecoration-addedResourceForeground, #73c991) 8%, transparent); }
    article .lm-md-net-change-modified { box-shadow: inset 3px 0 0 var(--vscode-gitDecoration-modifiedResourceForeground, #e2c08d); background-color: color-mix(in srgb, var(--vscode-gitDecoration-modifiedResourceForeground, #e2c08d) 9%, transparent); }
    article .lm-md-net-change-removed { box-shadow: inset 3px 0 0 var(--vscode-gitDecoration-deletedResourceForeground, #f14c4c); background-color: color-mix(in srgb, var(--vscode-gitDecoration-deletedResourceForeground, #f14c4c) 9%, transparent); }
    .lm-md-change-mark { box-shadow: inset 3px 0 0 color-mix(in srgb, var(--vscode-focusBorder) 55%, transparent); }
    .lm-md-change-current { outline: 2px solid var(--vscode-focusBorder); outline-offset: 3px; border-radius: 2px; background: color-mix(in srgb, var(--vscode-editor-selectionBackground) 35%, transparent); }
    .lm-md-reference-current { outline: 2px solid var(--vscode-focusBorder); outline-offset: 4px; border-radius: 3px; background: color-mix(in srgb, var(--vscode-editor-selectionBackground) 28%, transparent); transition: background-color 180ms ease; }
    pre { overflow: auto; padding: 12px 14px; background: var(--vscode-textCodeBlock-background); }
    .lm-md-mermaid { max-width: 100%; margin: 1em 0; overflow: auto; text-align: center; }
    .lm-md-mermaid svg { max-width: 100%; height: auto; }
    .lm-md-mermaid-error { color: var(--vscode-errorForeground); font-size: 12px; }
    article img { max-width: 100%; height: auto; }
    article > * { content-visibility: auto; contain-intrinsic-size: auto 56px; }
    code { font-family: var(--vscode-editor-font-family); }
    blockquote { border-left: 3px solid var(--vscode-textBlockQuote-border); padding-left: 14px; color: var(--vscode-textBlockQuote-foreground); }
    a { color: var(--vscode-textLink-foreground); }
    table { border-collapse: collapse; }
    th, td { border: 1px solid var(--vscode-panel-border); padding: 5px 9px; }
    .lm-md-context-menu { position: fixed; z-index: 20; min-width: 150px; padding: 4px; border: 1px solid var(--vscode-menu-border, var(--vscode-panel-border)); border-radius: 4px; background: var(--vscode-menu-background, var(--vscode-editor-background)); box-shadow: 0 4px 14px color-mix(in srgb, black 35%, transparent); }
    .lm-md-context-menu button { display: block; width: 100%; text-align: left; color: var(--vscode-menu-foreground, var(--vscode-editor-foreground)); background: transparent; border: 0; }
    .lm-md-context-menu button:hover { background: var(--vscode-menu-selectionBackground, var(--vscode-list-hoverBackground)); color: var(--vscode-menu-selectionForeground, var(--vscode-editor-foreground)); }
    @media (max-width: 1100px) { .lm-md-toolbar { grid-template-columns: minmax(0, 1fr) auto; grid-template-areas: "status sync" "toc theme" "search search"; row-gap: 8px; } .lm-md-content-search-toolbar { justify-self: stretch; } }
    @media (max-width: 900px) { .lm-md-layout { gap: 12px; padding: 18px 0 40px 20px; } .lm-md-toc { flex-basis: 260px; width: 260px; } }
    @media (max-width: 700px) { .lm-md-toolbar { grid-template-columns: 1fr; grid-template-areas: "status" "theme" "toc" "search" "sync"; } .lm-md-selection-group { flex-wrap: wrap; } .lm-md-toc-toggle, .lm-md-theme-toggle, #lm-md-sync, .lm-md-content-search-toolbar { justify-self: stretch; } .lm-md-content-search-toolbar input { flex: 1 1 auto; width: auto; } }
  </style>
</head>
<body>
  <div class="lm-md-layout">
    <aside id="lm-md-toc" class="lm-md-toc" aria-label="Markdown 目录">
      <div id="lm-md-toc-panel" class="lm-md-toc-panel">
        <button id="lm-md-toc-summary" class="lm-md-toc-summary" type="button" aria-expanded="true" aria-controls="lm-md-toc-content">
          <span id="lm-md-toc-disclosure" aria-hidden="true">▾</span><span>目录</span>
        </button>
        <div id="lm-md-toc-content" class="lm-md-toc-content">
          <div class="lm-md-toc-tools">
            <div class="lm-md-toc-actions" role="toolbar" aria-label="目录折叠操作">
              <button id="lm-md-collapse-all" type="button" title="折叠所有目录项">全部折叠</button>
              <button id="lm-md-expand-all" type="button" title="展开所有目录项">全部展开</button>
            </div>
            <div class="lm-md-toc-search">
              <input id="lm-md-toc-search" type="search" placeholder="搜索目录" aria-label="搜索目录" autocomplete="off">
              <button id="lm-md-toc-search-clear" type="button" title="清除搜索">清除</button>
            </div>
            <div id="lm-md-toc-result" class="lm-md-toc-result" aria-live="polite"></div>
          </div>
          <nav id="lm-md-toc-list" class="lm-md-toc-scroll">${toc}</nav>
        </div>
      </div>
    </aside>
    <main class="lm-md-main">
      <div class="lm-md-toolbar">
        <div class="lm-md-selection-group">
          <span class="lm-md-status" id="lm-md-status">在预览中选择文字后同步到 Copilot</span>
          <button id="lm-md-clear-selection" type="button" title="清空当前选区" hidden>清空选区</button>
        </div>
        <button id="lm-md-toc-toggle" class="lm-md-toc-toggle" type="button" aria-expanded="true">隐藏目录</button>
        <button id="lm-md-theme-toggle" class="lm-md-theme-toggle" type="button" aria-pressed="false" title="切换为浅色主题">浅色主题</button>
        <div class="lm-md-content-search-toolbar" role="search" aria-label="正文搜索">
          <input id="lm-md-content-search" type="search" placeholder="搜索正文" aria-label="搜索正文" autocomplete="off">
          <button id="lm-md-content-search-prev" type="button" title="上一个匹配" aria-label="上一个匹配">↑</button>
          <button id="lm-md-content-search-next" type="button" title="下一个匹配" aria-label="下一个匹配">↓</button>
          <button id="lm-md-content-search-clear" type="button" title="清除正文搜索">清除</button>
          <span id="lm-md-content-result" class="lm-md-search-result" aria-live="polite"></span>
        </div>
        <button id="lm-md-sync" type="button" disabled>同步到 Copilot</button>
      </div>
      <section id="lm-md-change-history" class="lm-md-change-history" aria-label="当前文件净变化和会话编辑事件">
        ${changeHistory}
      </section>
      <article>${body}</article>
    </main>
  </div>
  ${options.mermaidScriptUri ? `<script src="${escapeHtml(options.mermaidScriptUri)}"></script>` : ""}
  <script src="${escapeHtml(scriptUri)}"></script>
</body>
</html>`;
}

function renderChangeHistory(changeRecords, fileName, changeEvents = []) {
  const netEntries = [];
  for (const record of Array.isArray(changeRecords) ? changeRecords : []) {
    for (const hunk of record.hunks || []) {
      netEntries.push({ record, hunk });
    }
  }

  const addedLines = netEntries.reduce((total, entry) => total + entry.hunk.addedLines, 0);
  const removedLines = netEntries.reduce((total, entry) => total + entry.hunk.removedLines, 0);
  const eventEntries = [];
  const events = Array.isArray(changeEvents) ? changeEvents : [];
  for (const record of events) {
    for (const hunk of record.hunks || []) eventEntries.push({ record, hunk });
  }
  // Keep the visible list aligned with the saved-baseline diff. Session events
  // remain available below, but may include manual edits and are not a source
  // of Copilot attribution.
  const entries = netEntries;
  const eventHistory = eventEntries.length
    ? `<details class="lm-md-change-events"><summary>本会话编辑事件（${eventEntries.length} 处）</summary><ol class="lm-md-change-event-list">${eventEntries
        .map(({ record, hunk }) => {
          const time = new Date(record.timestamp).toLocaleTimeString("zh-CN", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          });
          const range = hunk.startLine === hunk.endLine
            ? hunk.startLine
            : `${hunk.startLine}-${hunk.endLine}`;
          return `<li><span>第 ${range} 行 · +${hunk.addedLines} −${hunk.removedLines} · ${time}</span><details><summary>前后内容</summary><div class="lm-md-change-diff"><div class="lm-md-change-before"><strong>之前</strong><pre>${escapeHtml(hunk.before)}</pre></div><div class="lm-md-change-after"><strong>之后</strong><pre>${escapeHtml(hunk.after)}</pre></div></div></details></li>`;
        })
        .join("")}</ol></details>`
    : "";
  const list = entries.length
    ? `<p class="lm-md-change-focus-title">当前未保存净差异</p><ol id="lm-md-change-list" class="lm-md-change-list">${entries
        .map(({ record, hunk }, index) => {
          const addedLines = Number(hunk.addedLines) || 0;
          const removedLines = Number(hunk.removedLines) || 0;
          const changeKind = addedLines && removedLines
            ? "modified"
            : addedLines
              ? "added"
              : "removed";
          return `<li class="lm-md-change-entry lm-md-net-change-${changeKind}" data-change-index="${index}" data-start-line="${hunk.startLine}" data-end-line="${hunk.endLine}" data-added-lines="${addedLines}" data-removed-lines="${removedLines}">
            <button class="lm-md-change-locate" type="button" data-change-locate="${index}">
              <span class="lm-md-change-detail">第 ${hunk.startLine === hunk.endLine ? hunk.startLine : `${hunk.startLine}-${hunk.endLine}`} 行 · +${hunk.addedLines} −${hunk.removedLines}</span>
            </button>
            <details>
              <summary>查看改动前后内容</summary>
              <div class="lm-md-change-diff">
                <div class="lm-md-change-before"><strong>保存基线</strong><pre>${escapeHtml(hunk.before)}</pre></div>
                <div class="lm-md-change-after"><strong>当前内容</strong><pre>${escapeHtml(hunk.after)}</pre></div>
              </div>
            </details>
            <button class="lm-md-change-source" type="button" data-source-review="${index}">在源码中审阅</button>
          </li>`;
        })
        .join("")}</ol>`
    : '<p class="lm-md-change-empty" id="lm-md-change-empty">当前没有未保存的净变化。</p>';

  return `<div class="lm-md-change-header">
    <div class="lm-md-change-title-group"><strong>当前文件净变化</strong><span id="lm-md-change-help" class="lm-md-change-help"><button id="lm-md-change-help-button" class="lm-md-change-help-button" type="button" aria-label="改动计算说明" aria-controls="lm-md-change-help-popover" aria-expanded="false" title="改动计算说明">?</button><span id="lm-md-change-help-popover" class="lm-md-change-help-popover" role="tooltip">点击“刷新”后，按磁盘保存内容与当前文档重新计算净变化，并同步高亮预览正文。VS Code 不提供可靠的 Copilot 来源标记，因此结果也可能包含手动编辑；本会话已捕获的编辑事件可在下方展开查看。</span></span></div>
    <span class="lm-md-change-file" title="${escapeHtml(fileName)}">${escapeHtml(fileName)}</span>
    <span id="lm-md-change-summary" class="lm-md-change-summary">${netEntries.length} 处 · +${addedLines} −${removedLines}</span>
    <button id="lm-md-change-refresh" type="button" title="刷新改动列表">刷新</button>
    <button id="lm-md-change-prev" type="button" title="上一处改动" ${entries.length ? "" : "disabled"}>上一处</button>
    <button id="lm-md-change-next" type="button" title="下一处改动" ${entries.length ? "" : "disabled"}>下一处</button>
    <button id="lm-md-change-toggle" type="button" aria-expanded="true" title="收起改动详情">收起改动</button>
  </div><div id="lm-md-change-body" class="lm-md-change-body"><div id="lm-md-change-list-scroll" class="lm-md-change-list-scroll">${list}${eventHistory}</div></div>`;
}

function renderTableOfContents(headings) {
  if (!Array.isArray(headings) || headings.length === 0) {
    return '<p class="lm-md-empty-toc">暂无标题</p>';
  }

  return renderTocTree(buildHeadingTree(headings));
}

function buildHeadingTree(headings) {
  const root = [];
  const stack = [{ level: 0, children: root }];

  for (const heading of headings) {
    const node = { heading, children: [] };
    while (stack.length > 1 && stack[stack.length - 1].level >= heading.level) {
      stack.pop();
    }
    stack[stack.length - 1].children.push(node);
    stack.push({ level: heading.level, children: node.children });
  }

  return root;
}

function renderTocTree(nodes) {
  return `<ul class="lm-md-toc-list">${nodes
    .map(
      ({ heading, children }) =>
        `<li class="lm-md-toc-item"><div class="lm-md-toc-row">${children.length ? `<button class="lm-md-toc-collapse" type="button" aria-expanded="true" title="折叠目录子项">▾</button>` : `<span class="lm-md-toc-collapse-placeholder" aria-hidden="true"></span>`}<a class="lm-md-toc-link" data-md-level="${heading.level}" data-md-start-line="${heading.startLine}" href="#${escapeHtml(heading.id)}" data-toc-target="${escapeHtml(heading.id)}">${escapeHtml(heading.text)}</a></div>${children.length ? `<div class="lm-md-toc-children">${renderTocTree(children)}</div>` : ""}</li>`,
    )
    .join("")}</ul>`;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function createNonce() {
  return Math.random().toString(36).slice(2, 14);
}

module.exports = {
  buildHeadingTree,
  buildPreviewHtml,
  createMarkdownImageResolver,
  createMarkdownPreviewPanel,
  createPreviewMessageHandler,
  normalizePreviewSelection,
  normalizeSourceReview,
  renderChangeHistory,
  renderTableOfContents,
  renderPreviewBody,
  renderPreviewDocument,
  getMarkdownPreviewResourceRoots,
  readSavedDocumentText,
};
