const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  buildHeadingTree,
  buildPreviewHtml,
  createPreviewMessageHandler,
  createMarkdownImageResolver,
  getMarkdownPreviewResourceRoots,
  renderTableOfContents,
  renderChangeHistory,
  normalizeSourceReview,
  renderPreviewDocument,
  readSavedDocumentText,
} = require("../src/preview-panel");

test("builds a directory and Copilot sync controls into the preview", () => {
  const rendered = renderPreviewDocument("# 需求\n\n正文\n## 任务\n\n内容");
  const html = buildPreviewHtml(
    rendered.html,
    "vscode-resource:",
    "preview.js",
    rendered.headings,
  );

  assert.match(html, /目录/);
  assert.match(html, /data-toc-target="需求"/);
  assert.match(html, /data-toc-target="任务"/);
  assert.match(html, /id="lm-md-sync"/);
  assert.doesNotMatch(html, /id="lm-md-add-selection"/);
  assert.match(html, /id="lm-md-clear-selection"/);
  assert.match(html, /lm-md-toolbar-hidden/);
  assert.match(html, /lm-md-collapse/);
  assert.match(html, /id="lm-md-collapse-all"/);
  assert.match(html, /id="lm-md-expand-all"/);
  assert.match(html, /id="lm-md-toc-toggle"/);
  assert.match(html, /id="lm-md-toc-search"/);
  assert.match(html, /id="lm-md-content-search"/);
  assert.match(html, /class="lm-md-content-search-toolbar"/);
  assert.match(html, /id="lm-md-content-search-prev"/);
  assert.match(html, /id="lm-md-content-search-next"/);
  assert.match(html, /id="lm-md-theme-toggle"/);
  assert.match(html, /id="lm-md-change-history"/);
  assert.match(html, /id="lm-md-change-prev"/);
  assert.match(html, /id="lm-md-change-next"/);
  assert.match(html, /id="lm-md-change-refresh"/);
  assert.match(html, /id="lm-md-change-toggle"/);
  assert.match(html, /title="收起改动详情"/);
  assert.match(html, /\.lm-md-change-history\[hidden\] \{ display: none; \}/);
  assert.match(html, /id="lm-md-change-body"/);
  assert.match(html, /\.lm-md-toc-link\.lm-md-toc-active/);
  assert.match(html, /\.lm-md-change-history \{ position: sticky; top: calc\(var\(--lm-md-toolbar-height, 0px\) \+ 8px\)/);
  assert.match(html, /\.lm-md-change-list-scroll \{[^}]*overflow-y: auto/);
  assert.match(html, /body\.lm-md-light/);
  assert.match(html, /lm-md-toc-collapse/);
  assert.match(html, /\.lm-md-toc-collapse, \.lm-md-toc-collapse-placeholder/);
  assert.match(html, /lm-md-toc-row/);
  assert.match(html, /\.lm-md-toc-link \{[^}]*white-space: normal;[^}]*overflow-wrap: anywhere;/);
  assert.match(html, /lm-md-toc-children/);
  assert.match(html, /max-width: none/);
  assert.match(html, /padding: 24px 0 56px 32px/);
  assert.match(html, /flex: 0 0 clamp\(260px, 24vw, 360px\)/);
  assert.match(html, /\.lm-md-toc-panel \{[^}]*display: grid;[^}]*grid-template-rows: auto minmax\(0, 1fr\);[^}]*height: 100%;/);
  assert.match(html, /\.lm-md-toc-content \{[^}]*display: grid;[^}]*grid-template-rows: auto minmax\(0, 1fr\);[^}]*min-height: 0;/);
  assert.match(html, /\.lm-md-toc-scroll \{[^}]*min-height: 0;[^}]*overflow-y: auto/);
  assert.match(html, /overflow-x: hidden/);
  assert.match(html, /overflow-y: auto/);
  assert.match(html, /box-shadow: 0 4px 16px/);
  assert.match(html, /height: calc\(100vh - 36px\)/);
  assert.match(html, /id="lm-md-toc-panel" class="lm-md-toc-panel"/);
  assert.match(html, /id="lm-md-toc-content" class="lm-md-toc-content"/);
  assert.doesNotMatch(html, /::details-content/);
  assert.match(html, /article > \* \{ content-visibility: auto; contain-intrinsic-size: auto 56px; \}/);
  assert.doesNotMatch(html, /backdrop-filter: blur/);
  assert.match(html, /flex-basis: 260px; width: 260px/);
  assert.match(html, /class="lm-md-toc-scroll"/);
  assert.match(html, /img-src vscode-resource: https: http: data:/);
  assert.match(html, /article img \{ max-width: 100%; height: auto; \}/);
});

test("reads the disk baseline for unsaved-change refreshes and strips a UTF-8 BOM", async () => {
  const result = await readSavedDocumentText({
    workspace: {
      fs: {
        readFile: async () => Buffer.from("\uFEFF# 标题\r\n", "utf8"),
      },
    },
  }, { scheme: "file", path: "/docs/guide.md" });

  assert.equal(result, "# 标题\r\n");
});

test("decodes UTF-16 Markdown disk baselines", async () => {
  const bytes = Buffer.concat([
    Buffer.from([0xff, 0xfe]),
    Buffer.from("# 标题\n", "utf16le"),
  ]);
  const result = await readSavedDocumentText({
    workspace: { fs: { readFile: async () => bytes } },
  }, { scheme: "file", path: "/docs/guide.md" });

  assert.equal(result, "# 标题\n");
});

test("falls back to the tracked baseline when the document cannot be read from disk", async () => {
  const result = await readSavedDocumentText({
    workspace: { fs: { readFile: async () => { throw new Error("unavailable"); } } },
  }, { scheme: "untitled", path: "/docs/new.md" });

  assert.equal(result, undefined);
});

test("keeps TOC labels aligned when only some headings can collapse", () => {
  const toc = renderTableOfContents([
    { id: "parent", level: 1, text: "Parent" },
    { id: "child", level: 2, text: "Child" },
    { id: "leaf", level: 1, text: "Leaf" },
  ]);

  assert.match(toc, /lm-md-toc-collapse-placeholder/);
  assert.match(toc, /<span class="lm-md-toc-collapse-placeholder" aria-hidden="true"><\/span>/);
});

test("resolves local Markdown images into webview URIs and grants the document workspace root", () => {
  const makeUri = (value, query = "", fragment = "") => ({
    scheme: "file",
    path: value,
    query,
    fragment,
    with(changes) {
      return makeUri(
        this.path,
        changes.query ?? this.query,
        changes.fragment ?? this.fragment,
      );
    },
    toString() {
      return `file://${this.path}${this.query ? `?${this.query}` : ""}${this.fragment ? `#${this.fragment}` : ""}`;
    },
  });
  const fakeVscode = {
    Uri: {
      parse(value) {
        const match = String(value).match(/^([^?#]*)(?:\?([^#]*))?(?:#(.*))?$/);
        return makeUri(match[1], match[2] || "", match[3] || "");
      },
      file(value) {
        return makeUri(value.replace(/\\/g, "/"));
      },
      joinPath(base, ...segments) {
        const joined = path.posix.normalize(path.posix.join(base.path, ...segments));
        return makeUri(joined);
      },
    },
    workspace: {
      getWorkspaceFolder() {
        return { uri: makeUri("/project") };
      },
    },
  };
  const documentUri = makeUri("/project/docs/guide.md");
  const mapped = [];
  const webview = {
    asWebviewUri(uri) {
      mapped.push(uri);
      return { toString: () => `webview:${uri.path}${uri.query ? `?${uri.query}` : ""}` };
    },
  };
  const resolveImage = createMarkdownImageResolver(fakeVscode, documentUri, webview);

  assert.equal(resolveImage("../assets/diagram.png"), "webview:/project/assets/diagram.png");
  assert.equal(resolveImage("https://example.test/diagram.png"), "https://example.test/diagram.png");
  assert.deepEqual(
    getMarkdownPreviewResourceRoots(fakeVscode, makeUri("/extension"), documentUri)
      .map((uri) => uri.path),
    ["/extension/media", "/project"],
  );
  assert.equal(mapped.length, 1);
});

test("loads Mermaid from the extension bundle before the preview script", () => {
  const html = buildPreviewHtml("<pre>diagram</pre>", "vscode-resource:", "webview:preview.js", [], {
    mermaidScriptUri: "webview:mermaid.bundle.js",
  });

  assert.match(html, /<script src="webview:mermaid\.bundle\.js"><\/script>\s*<script src="webview:preview\.js"><\/script>/);
  assert.match(html, /\.lm-md-mermaid svg \{ max-width: 100%; height: auto; \}/);
});

test("preview script supports section controls and content search", () => {
  const script = fs.readFileSync(
    path.join(__dirname, "..", "media", "preview.js"),
    "utf8",
  );

  assert.match(script, /setAllTocCollapsed/);
  assert.match(script, /initializeTocCollapsing/);
  assert.match(script, /lm-md-collapse-all/);
  assert.match(script, /lm-md-expand-all/);
  assert.match(script, /initializeContentSearch/);
  assert.match(script, /lm-md-content-match/);
  assert.match(script, /lm-md-content-current/);
  assert.match(script, /lm-md-content-search-prev/);
  assert.match(script, /lm-md-content-search-next/);
  assert.match(script, /ArrowUp/);
  assert.match(script, /ArrowDown/);
  assert.match(script, /:scope > \.lm-md-toc-list/);
  assert.match(script, /copySelected/);
  assert.match(script, /boldSelected/);
  assert.match(script, /textContent = "加粗"/);
  assert.match(script, /formatSelectionBold/);
  assert.match(script, /boldFormatFailed/);
  assert.match(script, /changePanelHidden: Boolean\([\s\S]*?\.hidden/);
  assert.match(script, /function applyChangePanelHidden\(hidden\) \{\s*const panel = document\.getElementById\("lm-md-change-history"\);\s*if \(!panel\) return;\s*panel\.hidden = hidden;/);
  assert.match(script, /function toggleChangePanelVisibility\(\) \{\s*const panel = document\.getElementById\("lm-md-change-history"\);\s*if \(!panel\) return;\s*applyChangePanelHidden\(!panel\.hidden\);\s*persistPreviewState\(\);/);
  assert.match(script, /applyChangePanelHidden\(Boolean\(previewState\.changePanelHidden\)\)/);
  assert.match(script, /toggleChangePanelVisibility/);
  assert.match(script, /navigator\.clipboard/);
  assert.match(script, /execCommand\("copy"\)/);
  assert.match(script, /textContent = "复制"/);
  assert.match(script, /initializeThemeToggle/);
  assert.match(script, /lm-md-light/);
  assert.match(script, /data-md-start-line/);
  assert.match(script, /index < selection\.rangeCount/);
  assert.match(script, /selectedTexts\.join\("\\n"\)/);
  assert.match(script, /ranges,\s*segments,\s*startLine: Math\.min\(\.\.\.ranges/);
  assert.match(script, /describeSelectionRanges/);
  assert.doesNotMatch(script, /queuedSelections|selectionCandidate|addCurrentSelection|lm-md-add-selection/);
  assert.match(script, /selected = next;/);
  assert.match(script, /\{ \.\.\.selected, type: "syncPreviewSelection" \}/);
  assert.match(script, /renderMermaidDiagrams/);
  assert.match(script, /data-mermaid-source/);
  assert.match(script, /styleNonce/);
  assert.match(script, /securityLevel: "strict"/);
  assert.match(script, /initializeChangeHistory/);
  assert.match(script, /initializeStickyLayout/);
  assert.match(script, /initializeTocPanelToggle/);
  assert.match(script, /function setTocPanelOpen\(open\)/);
  assert.match(script, /refreshChangeHistory/);
  assert.match(script, /updateChangeHistory/);
  assert.match(script, /updatePreviewContent/);
  assert.match(script, /collectPreviewState/);
  assert.match(script, /restorePreviewState/);
  assert.match(script, /previewStateChanged/);
  assert.match(script, /vscode\.setState/);
  const tocInitializer = script.match(/function initializeTocCollapsing\(\) \{[\s\S]*?\n\}/)?.[0] || "";
  assert.match(tocInitializer, /children\.dataset\.tocCollapsed !== "true"/);
  assert.match(
    tocInitializer,
    /if \(children\.dataset\.tocCollapsed !== "true" && children\.dataset\.tocCollapsed !== "false"\) \{\s*setTocItemCollapsed\(item, false\);\s*\}/,
  );
  assert.match(script, /openSourceReview/);
  assert.match(script, /lm-md-change-current/);
  assert.match(script, /function activateTocForLine\(line\)/);
  assert.match(script, /function applyChangePanelCollapsed\(collapsed\)/);
  assert.match(script, /persistPreviewState\(\)/);
});

test("preview script persists and restores scroll positions across editor recreation", () => {
  const script = fs.readFileSync(
    path.join(__dirname, "..", "media", "preview.js"),
    "utf8",
  );

  assert.match(script, /previewScrollTop: Math\.max\(0, Math\.round\(window\.scrollY/);
  assert.match(script, /tocScrollTop: Math\.max\(0, Math\.round\(toc\?\.scrollTop/);
  assert.match(script, /changeListScrollTop: Math\.max\(0, Math\.round\(changeList\?\.scrollTop/);
  assert.match(script, /function schedulePreviewScrollStatePersistence\(\)/);
  assert.match(script, /function flushPreviewScrollState\(\)/);
  assert.match(script, /window\.addEventListener\("scroll", schedulePreviewScrollStatePersistence/);
  assert.match(script, /window\.addEventListener\("blur", flushPreviewScrollState\)/);
  assert.match(script, /document\.addEventListener\("visibilitychange"/);
  assert.match(script, /window\.scrollTo\(0, scrollState\.previewScrollTop\)/);
  assert.match(script, /toc\.scrollTop = scrollState\.tocScrollTop/);
  assert.match(script, /changeList\.scrollTop = scrollState\.changeListScrollTop/);
  assert.match(script, /initializePreviewScrollPersistence\(\);\s*restorePreviewState/);
  assert.match(script, /renderMermaidDiagrams\(\)\.then\(\(\) => \{\s*const savedPreviewState = vscode\.getState\(\)\?\.previewState;\s*if \(savedPreviewState\) restorePreviewScrollState\(savedPreviewState\);/);
});

test("preview context menu routes selected source lines to split source review", () => {
  const script = fs.readFileSync(
    path.join(__dirname, "..", "media", "preview.js"),
    "utf8",
  );

  assert.match(script, /sourceItem\.textContent = "源码定位"/);
  assert.match(script, /else if \(item\.dataset\.action === "source"\) \{\s*locateSelectionInSource\(\);/);
  assert.match(script, /function locateSelectionInSource\(\) \{\s*selected = combinedSelection\(\);\s*if \(!selected\) return;\s*hideContextMenu\(\);\s*vscode\.postMessage\(\{\s*type: "openSourceReview",\s*startLine: selected\.startLine,\s*endLine: selected\.endLine,\s*\}\);/);
  assert.match(script, /contextMenu\.append\(boldItem, copyItem, syncItem, sourceItem\)/);
});

test("routes refresh and fold-state messages from the preview to the host", async () => {
  const posted = [];
  const changed = [];
  const refreshed = [];
  const handler = createPreviewMessageHandler(
    { postMessage: async (message) => posted.push(message) },
    "file:///docs/guide.md",
    async () => {},
    async () => {},
    async () => {},
    async (uri, state) => changed.push({ uri, state }),
    async (uri) => refreshed.push(uri),
  );

  await handler({
    type: "previewStateChanged",
    previewState: { collapsedTocIds: ["section"], tocHidden: true },
  });
  await handler({ type: "refreshChangeHistory" });

  assert.deepEqual(changed, [{
    uri: "file:///docs/guide.md",
    state: { collapsedTocIds: ["section"], tocHidden: true },
  }]);
  assert.deepEqual(refreshed, ["file:///docs/guide.md"]);
});

test("routes bold-format requests and reports completion to the preview", async () => {
  const posted = [];
  const formatted = [];
  const handler = createPreviewMessageHandler(
    { postMessage: async (message) => posted.push(message) },
    "file:///docs/guide.md",
    async () => {},
    async () => {},
    async () => {},
    async () => {},
    async () => {},
    async (uri, segments) => formatted.push({ uri, segments }),
  );

  const segments = [
    { text: "selected text", startLine: 3, endLine: 3 },
    { text: "another", startLine: 8, endLine: 8 },
  ];
  await handler({ type: "formatSelectionBold", segments });

  assert.deepEqual(formatted, [{ uri: "file:///docs/guide.md", segments }]);
  assert.deepEqual(posted, [{ type: "boldFormatCompleted" }]);
});

test("rejects invalid bold-format segments before calling the host", async () => {
  const posted = [];
  const formatted = [];
  const handler = createPreviewMessageHandler(
    { postMessage: async (message) => posted.push(message) },
    "file:///docs/guide.md",
    async () => {},
    async () => {},
    async () => {},
    async () => {},
    async () => {},
    async (...args) => formatted.push(args),
  );

  await handler({
    type: "formatSelectionBold",
    segments: [{ text: "", startLine: 0, endLine: 1 }],
  });

  assert.deepEqual(formatted, []);
  assert.deepEqual(posted, []);
});

test("returns bold-format errors to the preview", async () => {
  const posted = [];
  const handler = createPreviewMessageHandler(
    { postMessage: async (message) => posted.push(message) },
    "file:///docs/guide.md",
    async () => {},
    async () => {},
    async () => {},
    async () => {},
    async () => {},
    async () => { throw new Error("无法唯一定位"); },
  );

  await handler({
    type: "formatSelectionBold",
    segments: [{ text: "selected", startLine: 3, endLine: 3 }],
  });

  assert.deepEqual(posted, [{
    type: "boldFormatFailed",
    message: "无法唯一定位",
  }]);
});

test("passes every selected range through the preview sync protocol", async () => {
  const posted = [];
  const synchronized = [];
  const handler = createPreviewMessageHandler(
    { postMessage: async (message) => posted.push(message) },
    "file:///docs/guide.md",
    async (uri, selection) => synchronized.push({ uri, selection }),
  );

  await handler({
    type: "syncPreviewSelection",
    text: "first\nsecond",
    ranges: [
      { startLine: 2, endLine: 3 },
      { startLine: 9, endLine: 10 },
    ],
    startLine: 2,
    endLine: 10,
  });

  assert.deepEqual(synchronized, [{
    uri: "file:///docs/guide.md",
    selection: {
      text: "first\nsecond",
      ranges: [
        { startLine: 2, endLine: 3 },
        { startLine: 9, endLine: 10 },
      ],
      startLine: 2,
      endLine: 10,
    },
  }]);
  assert.deepEqual(posted.map((message) => message.type), [
    "syncStarted",
    "syncCompleted",
  ]);
  assert.equal(posted[1].selection.ranges.length, 2);
});

test("renders escaped change details, file and source-review navigation", () => {
  const html = renderChangeHistory([{
    timestamp: 0,
    hunks: [{
      startLine: 4,
      endLine: 5,
      addedLines: 2,
      removedLines: 1,
      before: "<old>",
      after: "<new>",
    }],
  }], "docs/<guide>.md");

  assert.match(html, /docs\/&lt;guide&gt;\.md/);
  assert.match(html, /第 4-5 行/);
  assert.match(html, /\+2 −1/);
  assert.match(html, /&lt;old&gt;/);
  assert.match(html, /&lt;new&gt;/);
  assert.match(html, /data-source-review="0"/);
  assert.match(html, /当前文件净变化/);
  assert.match(html, /lm-md-change-list-scroll/);
  assert.deepEqual(normalizeSourceReview({
    type: "openSourceReview",
    startLine: 4,
    endLine: 5,
  }), { startLine: 4, endLine: 5 });
  assert.equal(normalizeSourceReview({ type: "openSourceReview", startLine: 0, endLine: 5 }), null);
});

test("keeps captured events available separately from the current net diff", () => {
  const html = renderChangeHistory([{
    timestamp: 100,
    hunks: [{
      startLine: 10,
      endLine: 10,
      addedLines: 1,
      removedLines: 1,
      before: "old",
      after: "new",
    }],
  }], "guide.md", [{
    timestamp: 200,
    hunks: [{
      startLine: 10,
      endLine: 10,
      addedLines: 1,
      removedLines: 1,
      before: "the immediate previous heading",
      after: "the latest heading",
    }],
  }]);

  assert.match(html, /本会话编辑事件（1 处）/);
  assert.match(html, /最近一次编辑/);
  assert.match(html, /本次编辑前/);
  assert.match(html, /the immediate previous heading/);
  assert.match(html, /当前文件净变化/);
});

test("continues to show the latest captured edit after net changes are saved", () => {
  const html = renderChangeHistory([], "guide.md", [{
    timestamp: 200,
    hunks: [{
      startLine: 4,
      endLine: 4,
      addedLines: 1,
      removedLines: 1,
      before: "## 工具",
      after: "### 工具 (Tool)",
    }],
  }]);

  assert.match(html, /当前文件净变化[\s\S]*?0 处 · \+0 −0/);
  assert.match(html, /最近一次编辑/);
  assert.match(html, /本次编辑前[\s\S]*?## 工具/);
  assert.match(html, /本次编辑后[\s\S]*?### 工具 \(Tool\)/);
});

test("TOC items carry source line metadata for change navigation", () => {
  const toc = renderTableOfContents([
    { id: "first", level: 1, text: "First", startLine: 2, endLine: 4 },
    { id: "child", level: 2, text: "Child", startLine: 3, endLine: 4 },
  ]);
  assert.match(toc, /data-md-start-line="2"/);
  assert.match(toc, /data-md-start-line="3"/);
});

test("builds a nested heading tree", () => {
  const tree = buildHeadingTree([
    { id: "a", level: 1, text: "A" },
    { id: "b", level: 2, text: "B" },
    { id: "c", level: 3, text: "C" },
    { id: "d", level: 2, text: "D" },
  ]);

  assert.equal(tree.length, 1);
  assert.equal(tree[0].children[0].heading.text, "B");
  assert.equal(tree[0].children[0].children[0].heading.text, "C");
  assert.equal(tree[0].children[1].heading.text, "D");
});
