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
  previewActions,
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
      if (previewActions?.getSettings) {
        try {
          await webview.postMessage({
            type: "previewSettings",
            settings: await previewActions.getSettings(),
          });
        } catch (error) {
          await webview.postMessage({
            type: "previewActionResult",
            action: "loadSettings",
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
      return;
    }

    if (["getPreviewSettings", "savePreviewSettings", "setImageSize", "uploadImageToCos"].includes(message?.type)) {
      const action = message.type;
      const requestId = message.requestId;
      try {
        let result;
        if (action === "getPreviewSettings") {
          result = await previewActions?.getSettings?.();
          await webview.postMessage({ type: "previewSettings", requestId, settings: result });
          return;
        }
        if (action === "savePreviewSettings") {
          result = await previewActions?.saveSettings?.(message.settings);
          await webview.postMessage({ type: "previewSettings", requestId, settings: result });
          return;
        }
        if (action === "setImageSize") {
          result = await previewActions?.setImageSize?.(documentUri, message.image);
        } else {
          result = await previewActions?.uploadImage?.(documentUri, message.image);
        }
        await webview.postMessage({ type: "previewActionResult", action, requestId, result });
      } catch (error) {
        await webview.postMessage({
          type: "previewActionResult",
          action,
          requestId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
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
  outlineView,
  previewActions,
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
    outlineView,
    previewActions,
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
    outlineView,
    previewActions,
  ) {
    this.vscode = vscode;
    this.extensionUri = extensionUri;
    this.document = document;
    this.onSelection = onSelection;
    this.onSourceReview = onSourceReview;
    this.previewStateStore = previewStateStore;
    this.changeHistoryStore = changeHistoryStore;
    this.onFormatBold = onFormatBold;
    this.outlineView = outlineView;
    this.previewActions = previewActions;
    this.outlineKey = `standalone:${document.uri.toString()}`;
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
      this.outlineView?.activatePreview(this.outlineKey);
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
        (uri, state) => {
          this.previewStateStore?.set(uri, state);
          this.outlineView?.updateActiveLine(
            this.outlineKey,
            Number(state?.previewAnchorStartLine) || 0,
          );
        },
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
        this.previewActions,
      ),
      null,
      context.subscriptions,
    );

    this.panel.onDidDispose(() => {
      this.disposed = true;
      this.outlineView?.removePreview(this.outlineKey);
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
    this.outlineView?.updatePreview(
      this.outlineKey,
      document.uri,
      fileName,
      rendered.headings,
      (line) => this.revealSourceLine(line),
      Number(this.previewStateStore?.get(document.uri)?.previewAnchorStartLine) || 0,
    );
    if (this.panel.visible && this.panel.active) {
      this.outlineView?.activatePreview(this.outlineKey);
    }
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
          externalOutline: true,
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
    :root {
      color-scheme: light dark;
      --lm-hl-foreground: #d4d4d4;
      --lm-hl-comment: #6a9955;
      --lm-hl-keyword: #569cd6;
      --lm-hl-string: #ce9178;
      --lm-hl-number: #b5cea8;
      --lm-hl-title: #dcdcaa;
      --lm-hl-attribute: #9cdcfe;
      --lm-hl-built-in: #4ec9b0;
      --lm-hl-meta: #c586c0;
      --lm-hl-symbol: #d7ba7d;
      --lm-hl-muted: #808080;
    }
    body.lm-md-light {
      color-scheme: light;
      --lm-hl-foreground: #1f2328;
      --lm-hl-comment: #008000;
      --lm-hl-keyword: #0000ff;
      --lm-hl-string: #a31515;
      --lm-hl-number: #098658;
      --lm-hl-title: #795e26;
      --lm-hl-attribute: #ff0000;
      --lm-hl-built-in: #267f99;
      --lm-hl-meta: #af00db;
      --lm-hl-symbol: #811f3f;
      --lm-hl-muted: #6a737d;
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
      --vscode-editorWidget-border: #d0d7de;
      --vscode-editorWidget-background: #f8f8f8;
      --vscode-editorWidget-foreground: #1f2328;
      --vscode-gitDecoration-addedResourceForeground: #1a7f37;
      --vscode-gitDecoration-modifiedResourceForeground: #9a6700;
      --vscode-gitDecoration-deletedResourceForeground: #cf222e;
      --vscode-errorForeground: #cf222e;
    }
    body.lm-md-dark {
      color-scheme: dark;
      --lm-hl-foreground: #d4d4d4;
      --lm-hl-comment: #6a9955;
      --lm-hl-keyword: #569cd6;
      --lm-hl-string: #ce9178;
      --lm-hl-number: #b5cea8;
      --lm-hl-title: #dcdcaa;
      --lm-hl-attribute: #9cdcfe;
      --lm-hl-built-in: #4ec9b0;
      --lm-hl-meta: #c586c0;
      --lm-hl-symbol: #d7ba7d;
      --lm-hl-muted: #808080;
      --vscode-editor-background: #1f1f1f;
      --vscode-editor-foreground: #d4d4d4;
      --vscode-panel-border: #454545;
      --vscode-descriptionForeground: #9d9d9d;
      --vscode-button-foreground: #ffffff;
      --vscode-button-background: #0e639c;
      --vscode-button-secondaryForeground: #cccccc;
      --vscode-button-secondaryBackground: #3a3d41;
      --vscode-button-border: #454545;
      --vscode-input-foreground: #cccccc;
      --vscode-input-background: #3c3c3c;
      --vscode-input-border: #454545;
      --vscode-tree-indentGuidesStroke: #585858;
      --vscode-textLink-foreground: #3794ff;
      --vscode-textLink-activeForeground: #75beff;
      --vscode-list-activeSelectionBackground: #094771;
      --vscode-list-hoverBackground: #2a2d2e;
      --vscode-toolbar-hoverBackground: #2a2d2e;
      --vscode-focusBorder: #007fd4;
      --vscode-editor-selectionBackground: #264f78;
      --vscode-textCodeBlock-background: #1e1e1e;
      --vscode-textBlockQuote-border: #007acc;
      --vscode-textBlockQuote-foreground: #cccccc;
      --vscode-menu-border: #454545;
      --vscode-menu-background: #252526;
      --vscode-menu-foreground: #cccccc;
      --vscode-menu-selectionBackground: #094771;
      --vscode-menu-selectionForeground: #ffffff;
      --vscode-editorWidget-border: #454545;
      --vscode-editorWidget-background: #252526;
      --vscode-editorWidget-foreground: #cccccc;
      --vscode-gitDecoration-addedResourceForeground: #73c991;
      --vscode-gitDecoration-modifiedResourceForeground: #e2c08d;
      --vscode-gitDecoration-deletedResourceForeground: #f14c4c;
      --vscode-errorForeground: #f48771;
    }
    body { margin: 0; overflow-x: hidden; color: var(--vscode-editor-foreground); background: var(--vscode-editor-background); font-family: var(--vscode-font-family); line-height: var(--lm-md-line-height, 1.75); }
    .lm-md-main article { width: min(100%, var(--lm-md-content-width, 88ch)); margin: 0 auto; font-size: var(--lm-md-body-font-size, 16px); line-height: var(--lm-md-line-height, 1.75); overflow-wrap: anywhere; }
    .lm-md-main article h1, .lm-md-main article h2, .lm-md-main article h3, .lm-md-main article h4, .lm-md-main article h5, .lm-md-main article h6 { line-height: 1.35; font-weight: 700; letter-spacing: .01em; }
    .lm-md-main article h1 { margin: 0 0 18px; padding: 0 0 12px; border-bottom: 1px solid var(--vscode-panel-border); font-size: 2.125em; }
    .lm-md-main article h2 { margin: 32px 0 13px; padding-left: 12px; border-left: 3px solid var(--vscode-focusBorder); font-size: 1.8125em; }
    .lm-md-main article h3 { margin: 26px 0 10px; font-size: 1.5625em; }
    .lm-md-main article h4 { margin: 22px 0 9px; font-size: 1.375em; }
    .lm-md-main article h5 { margin: 19px 0 8px; font-size: 1.1875em; }
    .lm-md-main article h6 { margin: 17px 0 8px; color: var(--vscode-descriptionForeground); font-size: 1.0625em; }
    .lm-md-main article p, .lm-md-main article li, .lm-md-main article blockquote { max-width: none; }
    .lm-md-main article p { margin: 0 0 14px; }
    .lm-md-main article ul, .lm-md-main article ol { padding-left: 1.55em; }
    .lm-md-main article li { padding: 2px 0; }
    .lm-md-layout { display: flex; align-items: flex-start; gap: 16px; width: 100%; max-width: none; box-sizing: border-box; margin: 0; padding: 24px 0 56px 32px; }
    .lm-md-main { min-width: 0; flex: 1 1 auto; max-width: none; }
    .lm-md-toc { position: sticky; top: 18px; align-self: flex-start; flex: 0 0 clamp(260px, 24vw, 360px); width: clamp(260px, 24vw, 360px); min-width: 0; height: calc(100vh - 36px); max-height: calc(100vh - 36px); min-height: 0; overflow: hidden; order: 2; }
    .lm-md-toc.lm-md-toc-hidden { display: none !important; }
    .lm-md-toc-panel { display: grid; grid-template-rows: auto minmax(0, 1fr); width: 100%; height: 100%; min-height: 0; box-sizing: border-box; padding: 8px 10px; overflow: hidden; border: 1px solid var(--vscode-panel-border); border-radius: 6px; background: color-mix(in srgb, var(--vscode-editor-background) 94%, var(--vscode-editor-foreground)); }
    .lm-md-toc-panel.lm-md-toc-collapsed { height: auto; }
    .lm-md-toc-header { display: flex; min-width: 0; align-items: center; gap: 4px; }
    .lm-md-toc-summary { display: flex; min-width: 0; flex: 1 1 auto; align-items: center; gap: 6px; padding: 0 0 5px; text-align: left; font-weight: 600; color: var(--vscode-editor-foreground); background: transparent; border: 0; cursor: pointer; }
    .lm-md-toc-summary:hover { background: var(--vscode-toolbar-hoverBackground); }
    .lm-md-toc-locate { display: inline-flex; flex: 0 0 26px; width: 26px; height: 24px; align-items: center; justify-content: center; padding: 3px; color: var(--vscode-icon-foreground, var(--vscode-descriptionForeground)); background: transparent; border: 1px solid transparent; border-radius: 4px; }
    .lm-md-toc-locate:hover { color: var(--vscode-editor-foreground); background: var(--vscode-toolbar-hoverBackground); }
    .lm-md-toc-locate:focus-visible { outline: 1px solid var(--vscode-focusBorder); outline-offset: -1px; }
    .lm-md-toc-locate svg { width: 16px; height: 16px; }
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
    .lm-md-toolbar { position: sticky; top: 0; z-index: 4; display: grid; grid-template-columns: minmax(0, 1fr) auto auto auto auto; grid-template-areas: "status toc settings search sync"; align-items: center; gap: 12px; min-height: 32px; padding: 8px 0; margin-bottom: 18px; background: color-mix(in srgb, var(--vscode-editor-background) 92%, transparent); border-bottom: 1px solid var(--vscode-panel-border); }
    .lm-md-toolbar.lm-md-toolbar-hidden { display: none !important; }
    .lm-md-selection-group { grid-area: status; display: flex; min-width: 0; align-items: center; gap: 6px; }
    .lm-md-status { min-width: 0; flex: 1 1 auto; overflow: hidden; color: var(--vscode-descriptionForeground); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
    .lm-md-selection-group button { flex: 0 0 auto; padding: 4px 8px; font-size: 11px; color: var(--vscode-button-secondaryForeground, var(--vscode-button-foreground)); background: var(--vscode-button-secondaryBackground, var(--vscode-button-background)); white-space: nowrap; }
    .lm-md-toc-toggle { grid-area: toc; color: var(--vscode-button-secondaryForeground, var(--vscode-button-foreground)); background: var(--vscode-button-secondaryBackground, var(--vscode-button-background)); white-space: nowrap; }
    .lm-md-settings-holder { position: relative; grid-area: settings; }
    .lm-md-settings-toggle { min-width: 34px; color: var(--vscode-button-secondaryForeground, var(--vscode-button-foreground)); background: var(--vscode-button-secondaryBackground, var(--vscode-button-background)); }
    .lm-md-settings-popover { position: absolute; top: calc(100% + 8px); right: 0; z-index: 15; width: min(390px, calc(100vw - 36px)); max-height: min(76vh, 720px); overflow: auto; padding: 13px; border: 1px solid var(--vscode-editorWidget-border, var(--vscode-panel-border)); border-radius: 6px; background: var(--vscode-editorWidget-background, var(--vscode-editor-background)); color: var(--vscode-editorWidget-foreground, var(--vscode-editor-foreground)); box-shadow: 0 8px 28px color-mix(in srgb, black 38%, transparent); }
    .lm-md-settings-popover[hidden] { display: none; }
    .lm-md-settings-heading { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; font-size: 14px; font-weight: 700; }
    .lm-md-settings-close { min-width: 28px; padding: 2px 7px; }
    .lm-md-settings-section { padding: 10px 0; border-bottom: 1px solid var(--vscode-panel-border); }
    .lm-md-settings-section:last-of-type { border-bottom: 0; }
    .lm-md-settings-label { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px; font-size: 12px; font-weight: 600; }
    .lm-md-settings-hint { color: var(--vscode-descriptionForeground); font-size: 10px; font-weight: 400; }
    .lm-md-settings-options { display: flex; gap: 5px; }
    .lm-md-settings-options button { flex: 1 1 0; min-width: 0; padding: 5px 6px; color: var(--vscode-button-secondaryForeground, var(--vscode-button-foreground)); background: var(--vscode-button-secondaryBackground, var(--vscode-button-background)); font-size: 11px; }
    .lm-md-settings-options button[aria-pressed="true"] { outline: 1px solid var(--vscode-focusBorder); }
    .lm-md-font-stepper { display: flex; align-items: center; gap: 8px; }
    .lm-md-font-stepper output { min-width: 52px; text-align: center; }
    .lm-md-font-stepper button { min-width: 32px; }
    .lm-md-settings-input { display: block; width: 100%; box-sizing: border-box; margin: 5px 0; padding: 6px 8px; color: var(--vscode-input-foreground); background: var(--vscode-input-background); border: 1px solid var(--vscode-input-border, var(--vscode-panel-border)); border-radius: 4px; }
    .lm-md-settings-status { min-height: 16px; margin-top: 6px; color: var(--vscode-descriptionForeground); font-size: 11px; }
    .lm-md-settings-actions { display: flex; gap: 6px; margin-top: 8px; }
    .lm-md-settings-actions button { flex: 1 1 auto; }
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
    .lm-md-main article pre { max-width: 100%; margin: 14px 0; overflow: auto; padding: 13px 15px; border: 1px solid var(--vscode-panel-border); border-radius: 5px; background: var(--vscode-textCodeBlock-background); font-size: .86em; line-height: 1.6; }
    .lm-md-main article code { padding: 1px 4px; border-radius: 3px; background: color-mix(in srgb, var(--vscode-textCodeBlock-background) 78%, var(--vscode-editor-foreground)); font-size: .9em; }
    .lm-md-main article pre > code { display: block; padding: 0; border-radius: 0; background: transparent; font-size: inherit; }
    .lm-md-main article pre > code.hljs { color: var(--lm-hl-foreground); }
    .lm-md-main article pre > code .hljs-comment, .lm-md-main article pre > code .hljs-quote, .lm-md-main article pre > code .hljs-doctag { color: var(--lm-hl-comment); font-style: italic; }
    .lm-md-main article pre > code .hljs-keyword, .lm-md-main article pre > code .hljs-selector-tag, .lm-md-main article pre > code .hljs-literal, .lm-md-main article pre > code .hljs-section { color: var(--lm-hl-keyword); }
    .lm-md-main article pre > code .hljs-string, .lm-md-main article pre > code .hljs-regexp, .lm-md-main article pre > code .hljs-template-tag, .lm-md-main article pre > code .hljs-template-variable { color: var(--lm-hl-string); }
    .lm-md-main article pre > code .hljs-number, .lm-md-main article pre > code .hljs-variable { color: var(--lm-hl-number); }
    .lm-md-main article pre > code .hljs-title, .lm-md-main article pre > code .hljs-title.function_, .lm-md-main article pre > code .hljs-title.class_, .lm-md-main article pre > code .hljs-function .hljs-title, .lm-md-main article pre > code .hljs-section { color: var(--lm-hl-title); }
    .lm-md-main article pre > code .hljs-attr, .lm-md-main article pre > code .hljs-attribute, .lm-md-main article pre > code .hljs-property, .lm-md-main article pre > code .hljs-attribute { color: var(--lm-hl-attribute); }
    .lm-md-main article pre > code .hljs-built_in, .lm-md-main article pre > code .hljs-builtin-name, .lm-md-main article pre > code .hljs-type, .lm-md-main article pre > code .hljs-params { color: var(--lm-hl-built-in); }
    .lm-md-main article pre > code .hljs-meta, .lm-md-main article pre > code .hljs-meta .hljs-keyword, .lm-md-main article pre > code .hljs-tag .hljs-name { color: var(--lm-hl-meta); }
    .lm-md-main article pre > code .hljs-bullet, .lm-md-main article pre > code .hljs-link, .lm-md-main article pre > code .hljs-selector-id, .lm-md-main article pre > code .hljs-selector-class { color: var(--lm-hl-symbol); }
    .lm-md-main article pre > code .hljs-punctuation, .lm-md-main article pre > code .hljs-operator { color: var(--lm-hl-muted); }
    .lm-md-main article pre > code .hljs-addition { color: var(--lm-hl-built-in); }
    .lm-md-main article pre > code .hljs-deletion { color: var(--vscode-gitDecoration-deletedResourceForeground); }
    .lm-md-mermaid { max-width: 100%; margin: 18px 0; overflow: hidden; border: 1px solid var(--vscode-panel-border); border-radius: 5px; background: color-mix(in srgb, var(--vscode-editor-background) 96%, var(--vscode-editor-foreground)); }
    .lm-md-mermaid-tools { display: flex; align-items: center; gap: 5px; padding: 5px 8px; border-bottom: 1px solid var(--vscode-panel-border); color: var(--vscode-descriptionForeground); font-size: 11px; }
    .lm-md-mermaid-tools .lm-md-mermaid-title { flex: 1 1 auto; }
    .lm-md-mermaid-tools button { min-width: 28px; padding: 2px 6px; font-size: 11px; }
    .lm-md-mermaid-zoom-label { min-width: 38px; text-align: center; }
    .lm-md-mermaid-viewport { max-width: 100%; max-height: 72vh; overflow: auto; padding: 12px; overscroll-behavior: contain; }
    .lm-md-mermaid-canvas { position: relative; }
    .lm-md-mermaid-viewport svg { display: block; max-width: none !important; height: auto; }
    .lm-md-mermaid-error { color: var(--vscode-errorForeground); font-size: 12px; }
    article img { max-width: 100%; height: auto; border-radius: 3px; }
    article > * { content-visibility: auto; contain-intrinsic-size: auto 56px; }
    code { font-family: var(--vscode-editor-font-family); }
    article blockquote { margin: 14px 0; padding: 9px 14px; border-left: 3px solid var(--vscode-textBlockQuote-border); color: var(--vscode-textBlockQuote-foreground); background: color-mix(in srgb, var(--vscode-textBlockQuote-border) 7%, transparent); }
    article a { color: var(--vscode-textLink-foreground); text-underline-offset: 2px; }
    article table { display: block; width: fit-content; max-width: 100%; overflow: auto; border-collapse: collapse; font-size: .9em; line-height: 1.55; }
    article th, article td { min-width: 72px; padding: 7px 10px; border: 1px solid var(--vscode-panel-border); text-align: left; vertical-align: top; }
    article th { position: sticky; top: 0; background: color-mix(in srgb, var(--vscode-editor-background) 88%, var(--vscode-editor-foreground)); font-weight: 700; }
    article tr:nth-child(even) td { background: color-mix(in srgb, var(--vscode-editor-background) 94%, var(--vscode-editor-foreground)); }
    article hr { margin: 26px 0; border: 0; border-top: 1px solid var(--vscode-panel-border); }
    .lm-md-context-menu { position: fixed; z-index: 20; min-width: 150px; padding: 4px; border: 1px solid var(--vscode-menu-border, var(--vscode-panel-border)); border-radius: 4px; background: var(--vscode-menu-background, var(--vscode-editor-background)); box-shadow: 0 4px 14px color-mix(in srgb, black 35%, transparent); }
    .lm-md-context-menu button { display: block; width: 100%; text-align: left; color: var(--vscode-menu-foreground, var(--vscode-editor-foreground)); background: transparent; border: 0; }
    .lm-md-context-menu button:hover { background: var(--vscode-menu-selectionBackground, var(--vscode-list-hoverBackground)); color: var(--vscode-menu-selectionForeground, var(--vscode-editor-foreground)); }
    .lm-md-context-separator { height: 1px; margin: 4px 3px; background: var(--vscode-menu-border, var(--vscode-panel-border)); }
    .lm-md-image-custom-size { display: flex; align-items: center; gap: 5px; padding: 5px; color: var(--vscode-menu-foreground, var(--vscode-editor-foreground)); font-size: 12px; }
    .lm-md-image-custom-size input { min-width: 0; width: 74px; padding: 4px 5px; color: var(--vscode-input-foreground); background: var(--vscode-input-background); border: 1px solid var(--vscode-input-border, var(--vscode-panel-border)); border-radius: 3px; }
    .lm-md-image-custom-size button { width: auto; padding: 4px 8px; }
    @media (max-width: 1100px) { .lm-md-toolbar { grid-template-columns: minmax(0, 1fr) auto; grid-template-areas: "status sync" "toc settings" "search search"; row-gap: 8px; } .lm-md-content-search-toolbar { justify-self: stretch; } }
    @media (max-width: 900px) { .lm-md-layout { gap: 12px; padding: 18px 0 40px 20px; } .lm-md-toc { flex-basis: 260px; width: 260px; } }
    @media (max-width: 700px) { .lm-md-toolbar { grid-template-columns: 1fr; grid-template-areas: "status" "toc" "settings" "search" "sync"; } .lm-md-selection-group { flex-wrap: wrap; } .lm-md-toc-toggle, .lm-md-settings-holder, #lm-md-sync, .lm-md-content-search-toolbar { justify-self: stretch; } .lm-md-settings-toggle { width: 100%; } .lm-md-settings-popover { right: auto; left: 0; } .lm-md-content-search-toolbar input { flex: 1 1 auto; width: auto; } }
    ${options.externalOutline ? `
    body.lm-md-external-outline .lm-md-layout { display: block; padding: 20px clamp(16px, 3vw, 48px) 56px; }
    body.lm-md-external-outline .lm-md-toc, body.lm-md-external-outline .lm-md-toc-toggle { display: none !important; }
    body.lm-md-external-outline .lm-md-main { width: 100%; min-width: 0; max-width: none; }
    body.lm-md-external-outline .lm-md-main article { width: min(100%, var(--lm-md-content-width, 88ch)); min-width: 0; }
    body.lm-md-external-outline .lm-md-toolbar { grid-template-columns: minmax(0, 1fr) auto auto auto auto; grid-template-areas: "status toc settings search sync"; }
    body.lm-md-external-outline .lm-md-mermaid { max-width: 100%; overflow: auto; }
    body.lm-md-external-outline .lm-md-mermaid-viewport svg { max-width: none !important; height: auto; }
    @media (max-width: 900px) { body.lm-md-external-outline .lm-md-toolbar { grid-template-columns: minmax(0, 1fr) auto; grid-template-areas: "status sync" "toc settings" "search search"; } }
    @media (max-width: 700px) { body.lm-md-external-outline .lm-md-toolbar { grid-template-columns: 1fr; grid-template-areas: "status" "toc" "settings" "search" "sync"; } }
    ` : ""}
  </style>
</head>
<body class="${options.externalOutline ? "lm-md-external-outline" : ""}">
  <div class="lm-md-layout">
    <aside id="lm-md-toc" class="lm-md-toc" aria-label="Markdown 目录">
      <div id="lm-md-toc-panel" class="lm-md-toc-panel">
        <div class="lm-md-toc-header">
          <button id="lm-md-toc-summary" class="lm-md-toc-summary" type="button" aria-expanded="true" aria-controls="lm-md-toc-content">
            <span id="lm-md-toc-disclosure" aria-hidden="true">▾</span><span>目录</span>
          </button>
          <button id="lm-md-toc-locate" class="lm-md-toc-locate" type="button" aria-label="定位当前阅读章节" title="定位当前阅读章节">
            <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round">
              <circle cx="12" cy="12" r="5"></circle>
              <path d="M12 2v3m0 14v3M2 12h3m14 0h3"></path>
            </svg>
          </button>
        </div>
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
        <div class="lm-md-settings-holder">
          <button id="lm-md-settings-toggle" class="lm-md-settings-toggle" type="button" aria-expanded="false" aria-controls="lm-md-settings-popover" title="预览设置">⚙ 设置</button>
          <section id="lm-md-settings-popover" class="lm-md-settings-popover" aria-label="预览设置" hidden>
            <div class="lm-md-settings-heading"><span>预览设置</span><button id="lm-md-settings-close" class="lm-md-settings-close" type="button" aria-label="关闭设置">×</button></div>
            <div class="lm-md-settings-section">
              <div class="lm-md-settings-label"><span>主题</span><span class="lm-md-settings-hint">自动保存</span></div>
              <div class="lm-md-settings-options" role="group" aria-label="预览主题">
                <button type="button" data-preview-theme="auto" aria-pressed="true">跟随 VS Code</button>
                <button type="button" data-preview-theme="dark" aria-pressed="false">深色</button>
                <button type="button" data-preview-theme="light" aria-pressed="false">浅色</button>
              </div>
            </div>
            <div class="lm-md-settings-section">
              <div class="lm-md-settings-label"><span>正文大小</span><span class="lm-md-settings-hint">标题按比例调整</span></div>
              <div class="lm-md-font-stepper"><button id="lm-md-font-decrease" type="button" aria-label="减小正文">A−</button><output id="lm-md-font-size">16 px</output><button id="lm-md-font-increase" type="button" aria-label="增大正文">A+</button><button id="lm-md-font-reset" type="button">重置</button></div>
            </div>
            <div class="lm-md-settings-section">
              <div class="lm-md-settings-label">行距</div>
              <div class="lm-md-settings-options" role="group" aria-label="正文行距">
                <button type="button" data-preview-line-height="1.5" aria-pressed="false">紧凑</button>
                <button type="button" data-preview-line-height="1.75" aria-pressed="true">舒适</button>
                <button type="button" data-preview-line-height="2" aria-pressed="false">宽松</button>
              </div>
            </div>
            <div class="lm-md-settings-section">
              <div class="lm-md-settings-label">正文宽度</div>
              <div class="lm-md-settings-options" role="group" aria-label="正文宽度">
                <button type="button" data-preview-content-width="narrow" aria-pressed="false">窄</button>
                <button type="button" data-preview-content-width="standard" aria-pressed="true">标准</button>
                <button type="button" data-preview-content-width="wide" aria-pressed="false">宽</button>
              </div>
            </div>
            <div class="lm-md-settings-section">
              <div class="lm-md-settings-label"><span>图片上传 · 腾讯 COS</span><span id="lm-md-cos-credential-state" class="lm-md-settings-hint">尚未配置</span></div>
              <input id="lm-md-cos-secret-id" class="lm-md-settings-input" type="password" autocomplete="new-password" placeholder="SecretId（留空保留已保存值）" aria-label="腾讯 COS SecretId">
              <input id="lm-md-cos-secret-key" class="lm-md-settings-input" type="password" autocomplete="new-password" placeholder="SecretKey（留空保留已保存值）" aria-label="腾讯 COS SecretKey">
              <input id="lm-md-cos-bucket" class="lm-md-settings-input" type="text" autocomplete="off" placeholder="Bucket-AppID" aria-label="腾讯 COS Bucket">
              <input id="lm-md-cos-region" class="lm-md-settings-input" type="text" autocomplete="off" placeholder="Region，例如 ap-shanghai" aria-label="腾讯 COS Region">
              <input id="lm-md-cos-prefix" class="lm-md-settings-input" type="text" autocomplete="off" placeholder="上传目录前缀，例如 images" aria-label="腾讯 COS 上传目录">
              <div class="lm-md-settings-hint">密钥使用 VS Code SecretStorage；不会写入普通设置、文档或日志。Bucket 需有公开读取权限，才能在 Markdown 中直接显示链接。</div>
              <div class="lm-md-settings-actions"><button id="lm-md-cos-save" type="button">保存 COS 设置</button><button id="lm-md-cos-clear" type="button">清除密钥</button></div>
              <div id="lm-md-settings-status" class="lm-md-settings-status" role="status" aria-live="polite"></div>
            </div>
          </section>
        </div>
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
          return `<li><span>第 ${range} 行 · +${hunk.addedLines} −${hunk.removedLines} · ${time}</span><details><summary>前后内容</summary><div class="lm-md-change-diff"><div class="lm-md-change-before"><strong>之前</strong><pre>${escapeHtml(hunk.before)}</pre></div><div class="lm-md-change-after"><strong>之后</strong><pre>${escapeHtml(hunk.after)}</pre></div></div></details><button class="lm-md-change-source" type="button" data-event-source-review data-start-line="${hunk.startLine}" data-end-line="${hunk.endLine}">在源码中审阅</button></li>`;
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
