const vscode = acquireVsCodeApi();

let selected = null;
let syncing = false;
let formattingBold = false;
let contextMenu = null;
let selectedChangeIndex = -1;
let lastToolbarToggleAt = 0;
let previewScrollPersistenceTimer = null;
let previewScrollResizeTimer = null;
let previewScrollRestoreSequence = 0;
let previewScrollRestoreLocked = false;
let mermaidRenderPromise = Promise.resolve();
let changeHelpDocumentHandlersBound = false;
let previewSettings = { theme: "auto", fontSize: 16, lineHeight: 1.75, contentWidth: "standard" };
let previewSettingsSaveTimer = null;
let previewActionSequence = 0;
const pendingPreviewActions = new Map();
let nativeThemeIsLight = null;

function elementForNode(node) {
  if (!node) return null;
  if (node.nodeType === Node.ELEMENT_NODE) return node;
  return node.parentElement;
}

function mappedBlock(node) {
  return elementForNode(node)?.closest?.(
    "[data-md-start-line][data-md-end-line]",
  ) || null;
}

function currentPreviewSelection() {
  const selection = window.getSelection();
  const article = document.querySelector("article");
  if (!selection || selection.rangeCount === 0 || !article) return null;

  const ranges = [];
  const selectedTexts = [];
  const segments = [];
  for (let index = 0; index < selection.rangeCount; index += 1) {
    const range = selection.getRangeAt(index);
    const text = range.toString().trim();
    if (range.collapsed || !text) continue;

    const startBlock = mappedBlock(range.startContainer);
    const endBlock = mappedBlock(range.endContainer);
    if (!startBlock || !endBlock || !article.contains(startBlock) || !article.contains(endBlock)) {
      continue;
    }

    const startLine = Math.min(
      Number(startBlock.dataset.mdStartLine),
      Number(endBlock.dataset.mdStartLine),
    );
    const endLine = Math.max(
      Number(startBlock.dataset.mdEndLine),
      Number(endBlock.dataset.mdEndLine),
    );
    if (!Number.isInteger(startLine) || !Number.isInteger(endLine) || startLine < 1 || endLine < startLine) {
      continue;
    }
    ranges.push({ startLine, endLine });
    selectedTexts.push(text);
    segments.push({ text, startLine, endLine });
  }
  if (ranges.length === 0) return null;

  return {
    type: "previewSelection",
    text: selectedTexts.join("\n"),
    ranges,
    segments,
    startLine: Math.min(...ranges.map((range) => range.startLine)),
    endLine: Math.max(...ranges.map((range) => range.endLine)),
  };
}

function describeSelectionRanges(selection) {
  const ranges = Array.isArray(selection?.ranges) && selection.ranges.length > 0
    ? selection.ranges
    : [{ startLine: selection?.startLine, endLine: selection?.endLine }];
  const labels = ranges.map(({ startLine, endLine }) =>
    startLine === endLine ? `第 ${startLine} 行` : `第 ${startLine}-${endLine} 行`,
  );
  return `${labels.join("、")}${ranges.length > 1 ? `（${ranges.length} 段）` : ""}`;
}

function normalizeSelectionRanges(ranges) {
  const sorted = (Array.isArray(ranges) ? ranges : [])
    .filter((range) => Number.isInteger(range?.startLine) && Number.isInteger(range?.endLine))
    .filter((range) => range.startLine > 0 && range.endLine >= range.startLine)
    .map(({ startLine, endLine }) => ({ startLine, endLine }))
    .sort((left, right) => left.startLine - right.startLine || left.endLine - right.endLine);
  const normalized = [];
  for (const range of sorted) {
    const previous = normalized.at(-1);
    if (previous && range.startLine <= previous.endLine) {
      previous.endLine = Math.max(previous.endLine, range.endLine);
    } else {
      normalized.push(range);
    }
  }
  return normalized;
}

function combinedSelection() {
  if (!selected) return null;
  const ranges = normalizeSelectionRanges(selected.ranges || [{
    startLine: selected.startLine,
    endLine: selected.endLine,
  }]);
  if (!ranges.length) return null;
  return {
    ...selected,
    ranges,
    startLine: ranges[0].startLine,
    endLine: ranges.at(-1).endLine,
  };
}

function updateSelectionControls() {
  const status = document.getElementById("lm-md-status");
  const clear = document.getElementById("lm-md-clear-selection");
  const sync = document.getElementById("lm-md-sync");
  selected = combinedSelection();
  if (sync) sync.disabled = !selected || syncing;
  if (clear) clear.hidden = !selected;
  if (!status) return;

  if (selected) {
    status.textContent = `当前选中${describeSelectionRanges(selected)}；同步会在 Copilot 新增引用`;
  } else {
    status.textContent = "在预览中选择文字后同步到 Copilot";
  }
}

function clearCurrentSelection() {
  selected = null;
  window.getSelection()?.removeAllRanges();
  updateSelectionControls();
}

let mermaidRenderId = 0;
let configuredMermaidTheme = "";

function configureMermaid() {
  if (!window.mermaid?.initialize) return false;
  const theme = document.body.classList.contains("lm-md-light") ? "default" : "dark";
  if (configuredMermaidTheme !== theme) {
    window.mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme });
    configuredMermaidTheme = theme;
  }
  return true;
}

async function renderMermaidDiagram(host) {
  const source = host.dataset.mermaidSource || "";
  if (!source || !configureMermaid()) return;

  try {
    const id = `lm-md-mermaid-${++mermaidRenderId}`;
    const result = await window.mermaid.render(id, source);
    const svgTemplate = document.createElement("template");
    svgTemplate.innerHTML = result.svg;
    const styleNonce = document.querySelector("style[nonce]")?.nonce;
    if (styleNonce) {
      for (const style of svgTemplate.content.querySelectorAll("style")) {
        style.setAttribute("nonce", styleNonce);
      }
    }
    const svg = svgTemplate.content.querySelector("svg");
    if (!svg) throw new Error("Mermaid SVG is empty");
    const toolbar = document.createElement("div");
    toolbar.className = "lm-md-mermaid-tools";
    const label = document.createElement("span");
    label.className = "lm-md-mermaid-title";
    label.textContent = "Mermaid";
    const zoomLabel = document.createElement("span");
    zoomLabel.className = "lm-md-mermaid-zoom-label";
    const makeTool = (text, title, action) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = text;
      button.title = title;
      button.dataset.mermaidAction = action;
      return button;
    };
    toolbar.append(
      label,
      makeTool("−", "缩小图表", "zoom-out"),
      zoomLabel,
      makeTool("+", "放大图表", "zoom-in"),
      makeTool("适应", "适应容器宽度", "fit"),
      makeTool("重置", "重置缩放", "reset"),
    );
    const viewport = document.createElement("div");
    viewport.className = "lm-md-mermaid-viewport";
    const canvas = document.createElement("div");
    canvas.className = "lm-md-mermaid-canvas";
    canvas.append(svg);
    viewport.append(canvas);
    host.replaceChildren(toolbar, viewport);
    const viewBox = svg.viewBox?.baseVal;
    const rect = svg.getBoundingClientRect();
    const baseWidth = Number(viewBox?.width) || Number.parseFloat(svg.getAttribute("width")) || rect.width || 600;
    const baseHeight = Number(viewBox?.height) || Number.parseFloat(svg.getAttribute("height")) || rect.height || 300;
    svg.style.width = `${baseWidth}px`;
    svg.style.height = `${baseHeight}px`;
    svg.style.transformOrigin = "0 0";
    canvas.dataset.baseWidth = String(baseWidth);
    canvas.dataset.baseHeight = String(baseHeight);
    const fitScale = Math.min(1, Math.max(0.1, (viewport.clientWidth || baseWidth) / baseWidth));
    host.dataset.zoom = String(fitScale);
    updateMermaidZoom(host, fitScale);
    result.bindFunctions?.(host);
    host.removeAttribute("data-mermaid-error");
  } catch {
    const notice = document.createElement("p");
    notice.className = "lm-md-mermaid-error";
    notice.textContent = "Mermaid 图表无法渲染，已显示原始代码。";
    const pre = document.createElement("pre");
    const code = document.createElement("code");
    code.className = "language-mermaid";
    code.textContent = source;
    pre.append(code);
    host.replaceChildren(notice, pre);
    host.dataset.mermaidError = "true";
  }
}

function updateMermaidZoom(host, value) {
  const canvas = host.querySelector(".lm-md-mermaid-canvas");
  const svg = canvas?.querySelector("svg");
  const viewport = host.querySelector(".lm-md-mermaid-viewport");
  if (!canvas || !svg || !viewport) return;
  const scale = Math.min(3, Math.max(0.25, Number(value) || 1));
  host.dataset.zoom = String(scale);
  const width = Number(canvas.dataset.baseWidth) || 600;
  const height = Number(canvas.dataset.baseHeight) || 300;
  canvas.style.width = `${width * scale}px`;
  canvas.style.height = `${height * scale}px`;
  svg.style.transform = `scale(${scale})`;
  const label = host.querySelector(".lm-md-mermaid-zoom-label");
  if (label) label.textContent = `${Math.round(scale * 100)}%`;
}

function initializeMermaidControls(root = document) {
  for (const host of root.querySelectorAll(".lm-md-mermaid")) {
    if (host.dataset.controlsBound === "true") continue;
    host.dataset.controlsBound = "true";
    host.addEventListener("click", (event) => {
      const button = elementForNode(event.target)?.closest?.("[data-mermaid-action]");
      if (!button) return;
      event.preventDefault();
      event.stopPropagation();
      const action = button.dataset.mermaidAction;
      const current = Number(host.dataset.zoom) || 1;
      if (action === "zoom-in") updateMermaidZoom(host, current * 1.2);
      else if (action === "zoom-out") updateMermaidZoom(host, current / 1.2);
      else {
        const canvas = host.querySelector(".lm-md-mermaid-canvas");
        const viewport = host.querySelector(".lm-md-mermaid-viewport");
        const width = Number(canvas?.dataset.baseWidth) || 600;
        const fit = Math.min(1, Math.max(0.1, (viewport?.clientWidth || width) / width));
        updateMermaidZoom(host, action === "fit" ? fit : 1);
        if (viewport) { viewport.scrollLeft = 0; viewport.scrollTop = 0; }
      }
    });
  }
}

async function renderMermaidDiagrams(root = document.querySelector("article")) {
  if (!root || !window.mermaid) return;

  const hosts = Array.from(root.querySelectorAll(".lm-md-mermaid[data-mermaid-source]"));
  for (const code of root.querySelectorAll("pre > code.language-mermaid")) {
    const pre = code.parentElement;
    if (!pre) continue;
    const host = document.createElement("div");
    host.className = "lm-md-mermaid";
    host.dataset.mermaidSource = code.textContent || "";
    for (const attribute of ["data-md-start-line", "data-md-end-line"]) {
      if (pre.hasAttribute(attribute)) host.setAttribute(attribute, pre.getAttribute(attribute));
    }
    pre.replaceWith(host);
    hosts.push(host);
  }
  mermaidRenderPromise = Promise.all(hosts.map(renderMermaidDiagram));
  await mermaidRenderPromise;
  initializeMermaidControls(root);
}

function publishSelection() {
  const next = currentPreviewSelection();
  if (!next) return;
  selected = next;
  updateSelectionControls();
}

function renderSelectionAvailable(selection) {
  selected = selection;
  updateSelectionControls();
}

function setStatus(text, isError = false) {
  const status = document.getElementById("lm-md-status");
  if (!status) return;
  status.textContent = text;
  status.style.color = isError
    ? "var(--vscode-errorForeground)"
    : "var(--vscode-descriptionForeground)";
}

function hideContextMenu() {
  contextMenu?.remove();
  contextMenu = null;
}

function sectionNodes(heading) {
  const level = Number(heading.tagName.slice(1)) || 1;
  const nodes = [];
  let sibling = heading.nextElementSibling;
  while (sibling) {
    if (/^H[1-6]$/.test(sibling.tagName)) {
      const siblingLevel = Number(sibling.tagName.slice(1)) || 1;
      if (siblingLevel <= level) break;
    }
    nodes.push(sibling);
    sibling = sibling.nextElementSibling;
  }
  return nodes;
}

function setSectionCollapsed(heading, collapsed) {
  for (const node of sectionNodes(heading)) node.hidden = collapsed;
  const button = heading.querySelector(".lm-md-collapse");
  if (button) {
    button.textContent = collapsed ? "▸" : "▾";
    button.setAttribute("aria-expanded", String(!collapsed));
    button.title = collapsed ? "展开章节" : "折叠章节";
  }
  heading.classList.toggle("lm-md-collapsed", collapsed);
}

function allHeadings() {
  return Array.from(
    document.querySelectorAll(
      "article h1, article h2, article h3, article h4, article h5, article h6",
    ),
  );
}

function collectPreviewState() {
  const toc = document.getElementById("lm-md-toc");
  const tocSummary = document.getElementById("lm-md-toc-summary");
  const tocSearch = document.getElementById("lm-md-toc-search");
  const contentSearch = document.getElementById("lm-md-content-search");
  const collapsedTocIds = [];
  for (const item of document.querySelectorAll(".lm-md-toc-item")) {
    const children = directTocChildren(item);
    const link = item.querySelector(":scope > .lm-md-toc-row > .lm-md-toc-link");
    if (children?.dataset.tocCollapsed === "true" && link?.dataset.tocTarget) {
      collapsedTocIds.push(link.dataset.tocTarget);
    }
  }
  return {
    collapsedHeadingIds: allHeadings()
      .filter((heading) => heading.classList.contains("lm-md-collapsed"))
      .map((heading) => heading.id)
      .filter(Boolean),
    collapsedTocIds,
    tocHidden: Boolean(toc?.classList.contains("lm-md-toc-hidden")),
    tocDetailsOpen: tocSummary?.getAttribute("aria-expanded") !== "false",
    changePanelCollapsed: Boolean(
      document.getElementById("lm-md-change-history")?.classList.contains("lm-md-change-collapsed"),
    ),
    changePanelHidden: Boolean(document.getElementById("lm-md-change-history")?.hidden),
    tocSearch: tocSearch?.value || "",
    contentSearch: contentSearch?.value || "",
    toolbarHidden: Boolean(
      document.querySelector(".lm-md-toolbar")?.classList.contains("lm-md-toolbar-hidden"),
    ),
    ...collectScrollState(),
    previewScrollUpdatedAt: nextPreviewScrollUpdatedAt(),
  };
}

function normalizeScrollOffset(value) {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function nextPreviewScrollUpdatedAt() {
  const previousUpdatedAt = normalizeScrollOffset(
    vscode.getState()?.previewState?.previewScrollUpdatedAt,
  );
  return Math.max(Date.now(), previousUpdatedAt + 1);
}

function capturePreviewAnchor() {
  const article = document.querySelector("article");
  if (!article) return {};

  const viewportY = Math.min(80, Math.max(0, Math.round(window.innerHeight * 0.12)));
  let best = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  let bestLineSpan = Number.POSITIVE_INFINITY;
  let bestHeight = Number.POSITIVE_INFINITY;

  for (const block of article.querySelectorAll("[data-md-start-line][data-md-end-line]")) {
    const startLine = Number(block.dataset.mdStartLine);
    const endLine = Number(block.dataset.mdEndLine);
    if (!Number.isInteger(startLine) || !Number.isInteger(endLine) || startLine < 1 || endLine < startLine) {
      continue;
    }

    const rect = block.getBoundingClientRect();
    if (rect.height <= 0 || rect.bottom <= 0 || rect.top >= window.innerHeight) continue;
    const distance = rect.top <= viewportY && rect.bottom >= viewportY
      ? 0
      : rect.top > viewportY
        ? rect.top - viewportY
        : viewportY - rect.bottom;
    const lineSpan = endLine - startLine;
    if (distance > bestDistance ||
        (distance === bestDistance && lineSpan > bestLineSpan) ||
        (distance === bestDistance && lineSpan === bestLineSpan && rect.height >= bestHeight)) {
      continue;
    }

    best = { startLine, endLine, rect };
    bestDistance = distance;
    bestLineSpan = lineSpan;
    bestHeight = rect.height;
  }

  if (!best) return {};
  return {
    previewAnchorStartLine: best.startLine,
    previewAnchorEndLine: best.endLine,
    previewAnchorProgress: Math.max(0, Math.min(1, (viewportY - best.rect.top) / best.rect.height)),
    previewAnchorViewportY: viewportY,
  };
}

function collectScrollState() {
  const toc = document.getElementById("lm-md-toc-list");
  const changeList = document.getElementById("lm-md-change-list-scroll");
  return {
    previewScrollTop: Math.max(0, Math.round(window.scrollY || 0)),
    tocScrollTop: Math.max(0, Math.round(toc?.scrollTop || 0)),
    changeListScrollTop: Math.max(0, Math.round(changeList?.scrollTop || 0)),
    ...capturePreviewAnchor(),
  };
}

function findPreviewAnchor(previewState) {
  const article = document.querySelector("article");
  const startLine = normalizeScrollOffset(previewState?.previewAnchorStartLine);
  const endLine = Math.max(startLine, normalizeScrollOffset(previewState?.previewAnchorEndLine));
  if (!article || startLine < 1) return null;

  let best = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  let bestLineSpan = Number.POSITIVE_INFINITY;
  let bestHeight = Number.POSITIVE_INFINITY;
  for (const block of article.querySelectorAll("[data-md-start-line][data-md-end-line]")) {
    const blockStart = Number(block.dataset.mdStartLine);
    const blockEnd = Number(block.dataset.mdEndLine);
    if (!Number.isInteger(blockStart) || !Number.isInteger(blockEnd) || blockStart < 1 || blockEnd < blockStart) {
      continue;
    }
    const rect = block.getBoundingClientRect();
    if (rect.height <= 0) continue;
    const distance = blockEnd < startLine
      ? startLine - blockEnd
      : blockStart > endLine
        ? blockStart - endLine
        : 0;
    const lineSpan = blockEnd - blockStart;
    if (distance > bestDistance ||
        (distance === bestDistance && lineSpan > bestLineSpan) ||
        (distance === bestDistance && lineSpan === bestLineSpan && rect.height >= bestHeight)) {
      continue;
    }
    best = { block, rect };
    bestDistance = distance;
    bestLineSpan = lineSpan;
    bestHeight = rect.height;
  }
  return best;
}

function applyPreviewScrollState(scrollState) {
  const anchor = findPreviewAnchor(scrollState);
  if (anchor) {
    const progress = Number.isFinite(scrollState.previewAnchorProgress)
      ? Math.max(0, Math.min(1, scrollState.previewAnchorProgress))
      : 0;
    const viewportY = normalizeScrollOffset(scrollState.previewAnchorViewportY);
    const anchorY = anchor.rect.top + anchor.rect.height * progress;
    window.scrollTo(0, Math.max(0, window.scrollY + anchorY - viewportY));
  } else {
    window.scrollTo(0, scrollState.previewScrollTop);
  }

  const toc = document.getElementById("lm-md-toc-list");
  if (toc) toc.scrollTop = scrollState.tocScrollTop;
  const changeList = document.getElementById("lm-md-change-list-scroll");
  if (changeList) changeList.scrollTop = scrollState.changeListScrollTop;
}

async function restorePreviewScrollState(previewState) {
  const scrollState = {
    previewScrollTop: normalizeScrollOffset(previewState?.previewScrollTop),
    tocScrollTop: normalizeScrollOffset(previewState?.tocScrollTop),
    changeListScrollTop: normalizeScrollOffset(previewState?.changeListScrollTop),
    previewAnchorStartLine: normalizeScrollOffset(previewState?.previewAnchorStartLine),
    previewAnchorEndLine: normalizeScrollOffset(previewState?.previewAnchorEndLine),
    previewAnchorProgress: Number.isFinite(previewState?.previewAnchorProgress)
      ? Math.max(0, Math.min(1, previewState.previewAnchorProgress))
      : 0,
    previewAnchorViewportY: normalizeScrollOffset(previewState?.previewAnchorViewportY),
    previewScrollUpdatedAt: normalizeScrollOffset(previewState?.previewScrollUpdatedAt),
  };
  const sequence = ++previewScrollRestoreSequence;
  previewScrollRestoreLocked = true;

  try {
    await mermaidRenderPromise;
  } catch {
    // A failed diagram must not prevent restoring the reading position.
  }
  try {
    await document.fonts?.ready;
  } catch {
    // Continue with the currently available font metrics.
  }

  const nextFrame = () => new Promise((resolve) => window.requestAnimationFrame(resolve));
  await nextFrame();
  for (let pass = 0; pass < 2; pass += 1) {
    if (sequence !== previewScrollRestoreSequence) return;
    applyPreviewScrollState(scrollState);
    await nextFrame();
  }
  if (sequence === previewScrollRestoreSequence && scrollState.previewAnchorStartLine < 1) {
    const migratedScrollState = collectScrollState();
    if (migratedScrollState.previewAnchorStartLine > 0) {
      const previousState = vscode.getState() || {};
      const previewState = {
        ...(previousState.previewState || {}),
        ...migratedScrollState,
        previewScrollUpdatedAt: nextPreviewScrollUpdatedAt(),
      };
      vscode.setState({ ...previousState, previewState });
      vscode.postMessage({ type: "previewStateChanged", previewState });
    }
  }
}

function persistPreviewState() {
  if (previewScrollPersistenceTimer !== null) {
    window.clearTimeout(previewScrollPersistenceTimer);
    previewScrollPersistenceTimer = null;
  }
  const previewState = collectPreviewState();
  const previousState = vscode.getState() || {};
  if (previewScrollRestoreLocked && previousState.previewState) {
    Object.assign(previewState, pickPreviewScrollState(previousState.previewState));
  } else {
    previewState.previewScrollUpdatedAt = nextPreviewScrollUpdatedAt();
  }
  vscode.setState({ ...previousState, previewState });
  vscode.postMessage({ type: "previewStateChanged", previewState });
}

function pickPreviewScrollState(previewState) {
  return {
    previewScrollTop: normalizeScrollOffset(previewState?.previewScrollTop),
    tocScrollTop: normalizeScrollOffset(previewState?.tocScrollTop),
    changeListScrollTop: normalizeScrollOffset(previewState?.changeListScrollTop),
    previewAnchorStartLine: normalizeScrollOffset(previewState?.previewAnchorStartLine),
    previewAnchorEndLine: normalizeScrollOffset(previewState?.previewAnchorEndLine),
    previewAnchorProgress: Number.isFinite(previewState?.previewAnchorProgress)
      ? Math.max(0, Math.min(1, previewState.previewAnchorProgress))
      : 0,
    previewAnchorViewportY: normalizeScrollOffset(previewState?.previewAnchorViewportY),
    previewScrollUpdatedAt: normalizeScrollOffset(previewState?.previewScrollUpdatedAt),
  };
}

function mergePreviewScrollState(incomingState) {
  const localState = vscode.getState()?.previewState;
  const externalState = incomingState && typeof incomingState === "object"
    ? incomingState
    : null;
  if (!localState && !externalState) return null;

  const localUpdatedAt = normalizeScrollOffset(localState?.previewScrollUpdatedAt);
  const externalUpdatedAt = normalizeScrollOffset(externalState?.previewScrollUpdatedAt);
  const scrollSource = localUpdatedAt > 0 && localUpdatedAt >= externalUpdatedAt
    ? localState
    : externalState || localState;
  return {
    ...(externalState || localState),
    ...pickPreviewScrollState(scrollSource),
    previewScrollUpdatedAt: Math.max(localUpdatedAt, externalUpdatedAt),
  };
}

function persistPreviewScrollState() {
  previewScrollPersistenceTimer = null;
  if (previewScrollRestoreLocked) return;
  const previousState = vscode.getState() || {};
  const previousPreviewState = previousState.previewState || collectPreviewState();
  const previewState = {
    ...previousPreviewState,
    ...collectScrollState(),
    previewScrollUpdatedAt: nextPreviewScrollUpdatedAt(),
  };
  vscode.setState({ ...previousState, previewState });
  vscode.postMessage({ type: "previewStateChanged", previewState });
}

function schedulePreviewScrollStatePersistence() {
  if (previewScrollRestoreLocked) return;
  if (previewScrollPersistenceTimer !== null) {
    window.clearTimeout(previewScrollPersistenceTimer);
  }
  previewScrollPersistenceTimer = window.setTimeout(persistPreviewScrollState, 180);
}

function flushPreviewScrollState() {
  if (previewScrollPersistenceTimer === null) return;
  window.clearTimeout(previewScrollPersistenceTimer);
  persistPreviewScrollState();
}

function unlockPreviewScrollPersistence(event) {
  const target = elementForNode(event?.target);
  if (target?.closest?.("input, textarea, select, [contenteditable='true']")) return;
  previewScrollRestoreLocked = false;
}

function schedulePreviewPositionRestore() {
  if (previewScrollResizeTimer !== null) {
    window.clearTimeout(previewScrollResizeTimer);
  }
  previewScrollResizeTimer = window.setTimeout(() => {
    previewScrollResizeTimer = null;
    const previewState = vscode.getState()?.previewState;
    if (previewState) void restorePreviewScrollState(previewState);
  }, 120);
}

function initializePreviewScrollPersistence() {
  window.addEventListener("scroll", schedulePreviewScrollStatePersistence, { passive: true });
  document.addEventListener("scroll", (event) => {
    const target = event.target;
    if (target?.id === "lm-md-toc-list" || target?.id === "lm-md-change-list-scroll") {
      schedulePreviewScrollStatePersistence();
    }
  }, { capture: true, passive: true });
  window.addEventListener("blur", flushPreviewScrollState);
  window.addEventListener("pagehide", flushPreviewScrollState);
  window.addEventListener("resize", schedulePreviewPositionRestore, { passive: true });
  window.addEventListener("wheel", unlockPreviewScrollPersistence, { passive: true });
  window.addEventListener("touchstart", unlockPreviewScrollPersistence, { passive: true });
  window.addEventListener("pointerdown", unlockPreviewScrollPersistence, { passive: true });
  window.addEventListener("keydown", (event) => {
    if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "].includes(event.key)) {
      unlockPreviewScrollPersistence(event);
    }
  }, true);
  document.addEventListener("load", (event) => {
    if (event.target?.tagName === "IMG" && document.querySelector("article")?.contains(event.target)) {
      schedulePreviewPositionRestore();
    }
  }, true);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushPreviewScrollState();
    else schedulePreviewPositionRestore();
  });
}

function restorePreviewState(previewState, options = {}) {
  if (!previewState || typeof previewState !== "object") return;
  previewState = mergePreviewScrollState(previewState);
  const collapsedHeadingIds = new Set(
    Array.isArray(previewState.collapsedHeadingIds)
      ? previewState.collapsedHeadingIds
      : [],
  );
  const collapsedTocIds = new Set(
    Array.isArray(previewState.collapsedTocIds)
      ? previewState.collapsedTocIds
      : [],
  );
  for (const heading of allHeadings()) {
    setSectionCollapsed(heading, collapsedHeadingIds.has(heading.id));
  }
  for (const item of document.querySelectorAll(".lm-md-toc-item")) {
    const children = directTocChildren(item);
    const link = item.querySelector(":scope > .lm-md-toc-row > .lm-md-toc-link");
    if (children && link?.dataset.tocTarget) {
      setTocItemCollapsed(item, collapsedTocIds.has(link.dataset.tocTarget));
    }
  }
  const toc = document.getElementById("lm-md-toc");
  if (typeof previewState.tocHidden === "boolean") {
    toc?.classList.toggle("lm-md-toc-hidden", previewState.tocHidden);
    if (toc) toc.hidden = previewState.tocHidden;
    const toggle = document.getElementById("lm-md-toc-toggle");
    if (toggle) {
      toggle.setAttribute("aria-expanded", String(!previewState.tocHidden));
      toggle.textContent = previewState.tocHidden ? "显示目录" : "隐藏目录";
    }
  }
  if (typeof previewState.tocDetailsOpen === "boolean") {
    setTocPanelOpen(previewState.tocDetailsOpen);
  }
  const tocSearch = document.getElementById("lm-md-toc-search");
  if (tocSearch && typeof previewState.tocSearch === "string") {
    tocSearch.value = previewState.tocSearch;
  }
  const contentSearch = document.getElementById("lm-md-content-search");
  if (contentSearch && typeof previewState.contentSearch === "string") {
    contentSearch.value = previewState.contentSearch;
  }
  const toolbar = document.querySelector(".lm-md-toolbar");
  if (toolbar && typeof previewState.toolbarHidden === "boolean") {
    toolbar.classList.toggle("lm-md-toolbar-hidden", previewState.toolbarHidden);
  }
  applyChangePanelCollapsed(Boolean(previewState.changePanelCollapsed));
  applyChangePanelHidden(Boolean(previewState.changePanelHidden));
  initializeStickyLayout();
  const previousState = vscode.getState() || {};
  const nextPreviewState = collectPreviewState();
  if (previewState && typeof previewState === "object") {
    Object.assign(nextPreviewState, pickPreviewScrollState(previewState));
    if (options.restoreScroll !== false) void restorePreviewScrollState(nextPreviewState);
  }
  vscode.setState({ ...previousState, previewState: nextPreviewState });
}

function toggleToolbarVisibility() {
  const toolbar = document.querySelector(".lm-md-toolbar");
  if (!toolbar) return;
  const now = Date.now();
  if (now - lastToolbarToggleAt < 120) return;
  lastToolbarToggleAt = now;
  toolbar.classList.toggle("lm-md-toolbar-hidden");
  initializeStickyLayout();
  persistPreviewState();
}

function setAllSectionsCollapsed(collapsed) {
  for (const heading of allHeadings()) {
    setSectionCollapsed(heading, collapsed);
  }
}

function initializeCollapsibleHeadings() {
  for (const heading of allHeadings()) {
    if (heading.querySelector(".lm-md-collapse")) continue;
    const button = document.createElement("button");
    button.className = "lm-md-collapse";
    button.type = "button";
    button.textContent = "▾";
    button.title = "折叠章节";
    button.setAttribute("aria-expanded", "true");
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const collapsed = heading.classList.contains("lm-md-collapsed");
      setSectionCollapsed(heading, !collapsed);
      persistPreviewState();
    });
    heading.prepend(button);
  }
}

function directTocChildren(item) {
  return Array.from(item.children).find((child) =>
    child.classList.contains("lm-md-toc-children"),
  ) || null;
}

function directTocCollapseButton(item) {
  const row = Array.from(item.children).find((child) =>
    child.classList.contains("lm-md-toc-row"),
  );
  return row?.querySelector(".lm-md-toc-collapse") || null;
}

function setTocItemCollapsed(item, collapsed) {
  const children = directTocChildren(item);
  if (!children) return;
  children.hidden = collapsed;
  children.dataset.tocCollapsed = String(collapsed);
  const button = directTocCollapseButton(item);
  if (button) {
    button.textContent = collapsed ? "▸" : "▾";
    button.setAttribute("aria-expanded", String(!collapsed));
    button.title = collapsed ? "展开目录子项" : "折叠目录子项";
  }
}

function setAllTocCollapsed(collapsed) {
  for (const item of document.querySelectorAll(".lm-md-toc-item")) {
    setTocItemCollapsed(item, collapsed);
  }
}

function initializeTocCollapsing() {
  for (const item of document.querySelectorAll(".lm-md-toc-item")) {
    const children = directTocChildren(item);
    const button = directTocCollapseButton(item);
    if (!children || !button || button.dataset.bound === "true") continue;
    button.dataset.bound = "true";
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      setTocItemCollapsed(item, !children.hidden);
      persistPreviewState();
    });
    if (children.dataset.tocCollapsed !== "true" && children.dataset.tocCollapsed !== "false") {
      setTocItemCollapsed(item, false);
    }
  }
}

function initializeSectionControls() {
  const collapseAll = document.getElementById("lm-md-collapse-all");
  const expandAll = document.getElementById("lm-md-expand-all");
  if (collapseAll) {
    collapseAll.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      setAllTocCollapsed(true);
      persistPreviewState();
    });
  }
  if (expandAll) {
    expandAll.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      setAllTocCollapsed(false);
      persistPreviewState();
    });
  }
}

function filterTocTree(list, query) {
  let matches = 0;
  for (const item of Array.from(list.children)) {
    if (!item.classList.contains("lm-md-toc-item")) continue;

    const row = item.querySelector(":scope > .lm-md-toc-row");
    const link = row?.querySelector(":scope > .lm-md-toc-link");
    const children = item.querySelector(":scope > .lm-md-toc-children");
    const label = String(link?.textContent || "").toLocaleLowerCase();
    const ownMatch = !query || label.includes(query);
    const childMatches = children ? filterTocTree(children, query) : 0;
    const visible = !query || ownMatch || childMatches > 0;

    item.hidden = !visible;
    link?.classList.toggle("lm-md-search-match", Boolean(query && ownMatch));
    if (children) {
      children.hidden = query
        ? Boolean(!ownMatch && childMatches === 0)
        : children.dataset.tocCollapsed === "true";
    }
    if (query && ownMatch) matches += 1;
    matches += childMatches;
  }
  return matches;
}

function initializeTableOfContentsSearch() {
  const input = document.getElementById("lm-md-toc-search");
  const clear = document.getElementById("lm-md-toc-search-clear");
  const result = document.getElementById("lm-md-toc-result");
  const nav = document.getElementById("lm-md-toc-list");
  if (!input || !clear || !result || !nav) return;

  const apply = () => {
    const query = input.value.trim().toLocaleLowerCase();
    const list = nav.querySelector(":scope > .lm-md-toc-list") || nav;
    const matches = filterTocTree(list, query);
    clear.disabled = !input.value;
    const total = list.querySelectorAll(".lm-md-toc-link").length;
    result.textContent = query ? `匹配 ${matches} 个标题` : `共 ${total} 个标题`;
  };

  if (input.dataset.bound === "true") {
    input.dispatchEvent(new Event("lm-md-refresh"));
    return;
  }
  input.dataset.bound = "true";
  input.addEventListener("input", apply);
  input.addEventListener("lm-md-refresh", apply);
  clear.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      input.value = "";
      apply();
      input.focus();
  });
  apply();
}

function initializeContentSearch() {
  const input = document.getElementById("lm-md-content-search");
  const clear = document.getElementById("lm-md-content-search-clear");
  const previous = document.getElementById("lm-md-content-search-prev");
  const next = document.getElementById("lm-md-content-search-next");
  const result = document.getElementById("lm-md-content-result");
  const article = document.querySelector("article");
  if (!input || !clear || !previous || !next || !result || !article) return;
  if (input.dataset.bound === "true") {
    input.dispatchEvent(new Event("lm-md-refresh"));
    return;
  }

  let matches = [];
  let currentIndex = -1;

  const updateVisuals = (shouldScroll) => {
    for (const block of article.querySelectorAll("[data-md-start-line][data-md-end-line]")) {
      block.classList.remove("lm-md-content-match", "lm-md-content-current");
    }
    matches.forEach((block, index) => {
      block.classList.add("lm-md-content-match");
      if (index === currentIndex) block.classList.add("lm-md-content-current");
    });
    clear.disabled = !input.value;
    previous.disabled = matches.length === 0;
    next.disabled = matches.length === 0;
    result.textContent = input.value.trim()
      ? (matches.length ? `${currentIndex + 1}/${matches.length}` : "0/0")
      : "";
    if (shouldScroll && currentIndex >= 0) {
      matches[currentIndex].scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const apply = (shouldScroll = true) => {
    const query = input.value.trim().toLocaleLowerCase();
    const blocks = Array.from(
      article.querySelectorAll("[data-md-start-line][data-md-end-line]"),
    );
    matches = query
      ? blocks.filter((block) =>
          String(block.textContent || "").toLocaleLowerCase().includes(query),
        )
      : [];
    currentIndex = matches.length ? 0 : -1;
    updateVisuals(shouldScroll);
  };

  const selectMatch = (index) => {
    if (!matches.length) return;
    currentIndex = (index + matches.length) % matches.length;
    updateVisuals(true);
  };

  input.dataset.bound = "true";
  input.addEventListener("input", () => apply(true));
  input.addEventListener("lm-md-refresh", () => apply(false));
  previous.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    selectMatch(currentIndex - 1);
  });
  next.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    selectMatch(currentIndex + 1);
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "ArrowUp") {
      event.preventDefault();
      selectMatch(currentIndex - 1);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      selectMatch(currentIndex + 1);
    }
  });
  clear.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    input.value = "";
    apply();
    input.focus();
  });
  apply();
}

function initializeTableOfContents() {
  for (const link of document.querySelectorAll("[data-toc-target]")) {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      const target = document.getElementById(link.dataset.tocTarget);
      if (!target) return;
      setActiveTocLink(link);
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }
}

function initializeTableOfContentsToggle() {
  const aside = document.getElementById("lm-md-toc");
  const button = document.getElementById("lm-md-toc-toggle");
  if (!aside || !button) return;

  const apply = (hidden) => {
    aside.classList.toggle("lm-md-toc-hidden", hidden);
    aside.hidden = hidden;
    button.setAttribute("aria-expanded", String(!hidden));
    button.textContent = hidden ? "显示目录" : "隐藏目录";
  };

  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    apply(!aside.classList.contains("lm-md-toc-hidden"));
    persistPreviewState();
  });
}

function setTocPanelOpen(open) {
  const panel = document.getElementById("lm-md-toc-panel");
  const content = document.getElementById("lm-md-toc-content");
  const button = document.getElementById("lm-md-toc-summary");
  const disclosure = document.getElementById("lm-md-toc-disclosure");
  const expanded = Boolean(open);
  if (content) content.hidden = !expanded;
  panel?.classList.toggle("lm-md-toc-collapsed", !expanded);
  button?.setAttribute("aria-expanded", String(expanded));
  if (disclosure) disclosure.textContent = expanded ? "▾" : "▸";
}

function initializeTocPanelToggle() {
  const button = document.getElementById("lm-md-toc-summary");
  if (!button) return;
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    setTocPanelOpen(button.getAttribute("aria-expanded") !== "true");
    persistPreviewState();
  });
}

function initializeTocLocate() {
  const button = document.getElementById("lm-md-toc-locate");
  if (!button || button.dataset.bound === "true") return;
  button.dataset.bound = "true";
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const line = capturePreviewAnchor().previewAnchorStartLine;
    if (Number.isInteger(line) && line > 0) activateTocForLine(line);
  });
}

function detectedLightTheme() {
  if (nativeThemeIsLight !== null) return nativeThemeIsLight;
    const color = getComputedStyle(document.body).backgroundColor;
    const channels = color.match(/\d+(?:\.\d+)?/g)?.map(Number) || [];
  nativeThemeIsLight = channels.length >= 3 &&
      (channels[0] * 299 + channels[1] * 587 + channels[2] * 114) / 1000 > 160;
  return nativeThemeIsLight;
}

function applyPreviewSettings(nextSettings, { renderDiagrams = false } = {}) {
  if (!nextSettings || typeof nextSettings !== "object") return;
  const previousTheme = previewSettings.theme;
  previewSettings = {
    ...previewSettings,
    ...nextSettings,
  };
  const { theme, fontSize, lineHeight, contentWidth } = previewSettings;
  document.documentElement.style.setProperty("--lm-md-body-font-size", `${fontSize}px`);
  document.documentElement.style.setProperty("--lm-md-line-height", String(lineHeight));
  const widths = { narrow: "68ch", standard: "88ch", wide: "112ch" };
  document.documentElement.style.setProperty("--lm-md-content-width", widths[contentWidth] || widths.standard);
  document.body.classList.toggle("lm-md-light", theme === "light" || (theme === "auto" && detectedLightTheme()));
  document.body.classList.toggle("lm-md-dark", theme === "dark");

  for (const button of document.querySelectorAll("[data-preview-theme]")) {
    button.setAttribute("aria-pressed", String(button.dataset.previewTheme === theme));
  }
  for (const button of document.querySelectorAll("[data-preview-line-height]")) {
    button.setAttribute("aria-pressed", String(Number(button.dataset.previewLineHeight) === Number(lineHeight)));
  }
  for (const button of document.querySelectorAll("[data-preview-content-width]")) {
    button.setAttribute("aria-pressed", String(button.dataset.previewContentWidth === contentWidth));
  }
  const size = document.getElementById("lm-md-font-size");
  if (size) size.textContent = `${fontSize} px`;
  const bucket = document.getElementById("lm-md-cos-bucket");
  const region = document.getElementById("lm-md-cos-region");
  const prefix = document.getElementById("lm-md-cos-prefix");
  if (bucket && document.activeElement !== bucket) bucket.value = nextSettings.cosBucket ?? bucket.value;
  if (region && document.activeElement !== region) region.value = nextSettings.cosRegion ?? region.value;
  if (prefix && document.activeElement !== prefix) prefix.value = nextSettings.cosPathPrefix ?? prefix.value;
  const credentialState = document.getElementById("lm-md-cos-credential-state");
  if (credentialState && typeof nextSettings.cosCredentialsConfigured === "boolean") {
    credentialState.textContent = nextSettings.cosCredentialsConfigured ? "密钥已安全保存" : "尚未配置";
  }

  if (renderDiagrams && previousTheme !== theme) {
    const scrollState = collectScrollState();
    void renderMermaidDiagrams().then(() => restorePreviewScrollState(scrollState));
  }
}

function sendPreviewSettings(settings, action = "visual") {
  const requestId = `settings-${++previewActionSequence}`;
  pendingPreviewActions.set(requestId, action);
  vscode.postMessage({ type: "savePreviewSettings", requestId, settings });
}

function schedulePreviewSettingsSave() {
  clearTimeout(previewSettingsSaveTimer);
  previewSettingsSaveTimer = setTimeout(() => sendPreviewSettings({
    theme: previewSettings.theme,
    fontSize: previewSettings.fontSize,
    lineHeight: previewSettings.lineHeight,
    contentWidth: previewSettings.contentWidth,
  }), 250);
}

function initializePreviewSettings() {
  const holder = document.querySelector(".lm-md-settings-holder");
  const toggle = document.getElementById("lm-md-settings-toggle");
  const popover = document.getElementById("lm-md-settings-popover");
  const close = document.getElementById("lm-md-settings-close");
  if (!holder || !toggle || !popover) return;

  const setOpen = (open) => {
    popover.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
  };
  toggle.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    setOpen(popover.hidden);
  });
  close?.addEventListener("click", () => setOpen(false));
  document.addEventListener("click", (event) => {
    if (!popover.hidden && !holder.contains(elementForNode(event.target))) setOpen(false);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !popover.hidden) setOpen(false);
  });

  for (const button of document.querySelectorAll("[data-preview-theme], [data-preview-line-height], [data-preview-content-width]")) {
    button.addEventListener("click", () => {
      if (button.dataset.previewTheme) previewSettings.theme = button.dataset.previewTheme;
      if (button.dataset.previewLineHeight) previewSettings.lineHeight = Number(button.dataset.previewLineHeight);
      if (button.dataset.previewContentWidth) previewSettings.contentWidth = button.dataset.previewContentWidth;
      const scrollState = collectScrollState();
      applyPreviewSettings(previewSettings, { renderDiagrams: true });
      schedulePreviewSettingsSave();
      void restorePreviewScrollState(scrollState);
    });
  }

  const changeFontSize = (delta) => {
    previewSettings.fontSize = Math.max(12, Math.min(24, Math.round((previewSettings.fontSize + delta) * 2) / 2));
    applyPreviewSettings(previewSettings);
    schedulePreviewSettingsSave();
  };
  document.getElementById("lm-md-font-decrease")?.addEventListener("click", () => changeFontSize(-0.5));
  document.getElementById("lm-md-font-increase")?.addEventListener("click", () => changeFontSize(0.5));
  document.getElementById("lm-md-font-reset")?.addEventListener("click", () => {
    previewSettings.fontSize = 16;
    applyPreviewSettings(previewSettings);
    schedulePreviewSettingsSave();
  });

  const saveCos = document.getElementById("lm-md-cos-save");
  saveCos?.addEventListener("click", () => {
    const values = {
      theme: previewSettings.theme,
      fontSize: previewSettings.fontSize,
      lineHeight: previewSettings.lineHeight,
      contentWidth: previewSettings.contentWidth,
      cosBucket: document.getElementById("lm-md-cos-bucket")?.value || "",
      cosRegion: document.getElementById("lm-md-cos-region")?.value || "",
      cosPathPrefix: document.getElementById("lm-md-cos-prefix")?.value || "",
      cosSecretId: document.getElementById("lm-md-cos-secret-id")?.value || "",
      cosSecretKey: document.getElementById("lm-md-cos-secret-key")?.value || "",
    };
    sendPreviewSettings(values, "cos-save");
    setPreviewSettingsStatus("正在安全保存 COS 设置…");
  });
  document.getElementById("lm-md-cos-clear")?.addEventListener("click", () => {
    sendPreviewSettings({
      cosBucket: document.getElementById("lm-md-cos-bucket")?.value || "",
      cosRegion: document.getElementById("lm-md-cos-region")?.value || "",
      cosPathPrefix: document.getElementById("lm-md-cos-prefix")?.value || "",
      clearCosCredentials: true,
    }, "cos-clear");
    setPreviewSettingsStatus("正在清除已保存的密钥…");
  });
  applyPreviewSettings(previewSettings);
  setPreviewSettingsStatus("");
}

function setPreviewSettingsStatus(message, isError = false) {
  const status = document.getElementById("lm-md-settings-status");
  if (!status) return;
  status.textContent = message;
  status.style.color = isError ? "var(--vscode-errorForeground)" : "var(--vscode-descriptionForeground)";
}

function initializeStickyLayout() {
  const toolbar = document.querySelector(".lm-md-toolbar");
  if (!toolbar) return;

  const updateHeight = () => {
    document.documentElement.style.setProperty(
      "--lm-md-toolbar-height",
      `${Math.ceil(toolbar.getBoundingClientRect().height)}px`,
    );
  };
  updateHeight();
  if (toolbar.dataset.resizeObserved === "true") return;
  toolbar.dataset.resizeObserved = "true";
  if (typeof ResizeObserver === "function") {
    const observer = new ResizeObserver(updateHeight);
    observer.observe(toolbar);
  } else {
    window.addEventListener("resize", updateHeight, { passive: true });
  }
}

function changeEntries() {
  return Array.from(document.querySelectorAll(".lm-md-change-entry"));
}

function setActiveTocLink(activeLink) {
  for (const link of document.querySelectorAll(".lm-md-toc-link.lm-md-toc-active")) {
    link.classList.remove("lm-md-toc-active");
    link.removeAttribute("aria-current");
  }
  if (!activeLink) return;
  activeLink.classList.add("lm-md-toc-active");
  activeLink.setAttribute("aria-current", "location");
}

function activateTocForLine(line) {
  const links = Array.from(document.querySelectorAll(".lm-md-toc-link[data-md-start-line]"));
  let activeLink = null;
  let bestLine = -1;
  for (const link of links) {
    const headingLine = Number(link.dataset.mdStartLine);
    if (headingLine <= line && headingLine > bestLine) {
      bestLine = headingLine;
      activeLink = link;
    }
  }
  if (!activeLink) return;

  const aside = document.getElementById("lm-md-toc");
  const tocToggle = document.getElementById("lm-md-toc-toggle");
  if (aside?.hidden || aside?.classList.contains("lm-md-toc-hidden")) {
    aside.hidden = false;
    aside.classList.remove("lm-md-toc-hidden");
    tocToggle?.setAttribute("aria-expanded", "true");
    if (tocToggle) tocToggle.textContent = "隐藏目录";
  }
  setTocPanelOpen(true);

  const search = document.getElementById("lm-md-toc-search");
  if (search?.value) {
    search.value = "";
    search.dispatchEvent(new Event("input"));
  }

  let parentItem = activeLink.closest(".lm-md-toc-item")?.parentElement?.closest(".lm-md-toc-item");
  while (parentItem) {
    const children = directTocChildren(parentItem);
    if (children?.hidden) setTocItemCollapsed(parentItem, false);
    parentItem = parentItem.parentElement?.closest(".lm-md-toc-item");
  }

  setActiveTocLink(activeLink);
  const scroll = document.querySelector(".lm-md-toc-scroll");
  if (scroll) {
    const scrollRect = scroll.getBoundingClientRect();
    const linkRect = activeLink.getBoundingClientRect();
    const delta = linkRect.top < scrollRect.top
      ? linkRect.top - scrollRect.top
      : linkRect.bottom > scrollRect.bottom
        ? linkRect.bottom - scrollRect.bottom
        : 0;
    if (delta) scroll.scrollTo({ top: scroll.scrollTop + delta, behavior: "smooth" });
  }
  persistPreviewState();
}

function blocksForChange(entry) {
  const startLine = Number(entry.dataset.startLine);
  const endLine = Number(entry.dataset.endLine);
  const blocks = Array.from(
    document.querySelectorAll("article [data-md-start-line][data-md-end-line]"),
  );
  const matching = blocks.filter((block) =>
    Number(block.dataset.mdEndLine) >= startLine &&
    Number(block.dataset.mdStartLine) <= endLine,
  );
  if (matching.length) return matching;

  let nearest = null;
  let distance = Number.POSITIVE_INFINITY;
  for (const block of blocks) {
    const blockStart = Number(block.dataset.mdStartLine);
    const blockEnd = Number(block.dataset.mdEndLine);
    const currentDistance = startLine < blockStart
      ? blockStart - startLine
      : startLine > blockEnd
        ? startLine - blockEnd
        : 0;
    if (currentDistance < distance) {
      nearest = block;
      distance = currentDistance;
    }
  }
  return nearest ? [nearest] : [];
}

function applyNetChangeHighlights() {
  const article = document.querySelector("article");
  if (!article) return;

  const classes = [
    "lm-md-net-change",
    "lm-md-net-change-added",
    "lm-md-net-change-modified",
    "lm-md-net-change-removed",
  ];
  for (const block of article.querySelectorAll(classes.map((name) => `.${name}`).join(","))) {
    block.classList.remove(...classes);
  }

  for (const entry of changeEntries()) {
    const addedLines = Number(entry.dataset.addedLines) || 0;
    const removedLines = Number(entry.dataset.removedLines) || 0;
    const kind = addedLines && removedLines
      ? "modified"
      : addedLines
        ? "added"
        : "removed";
    for (const block of blocksForChange(entry)) {
      block.classList.add("lm-md-net-change", `lm-md-net-change-${kind}`);
    }
  }
}

function revealPreviewLine(line) {
  const sourceLine = Number(line);
  if (!Number.isInteger(sourceLine) || sourceLine < 1) return false;

  const blocks = Array.from(
    document.querySelectorAll("article [data-md-start-line][data-md-end-line]"),
  );
  const matches = blocks.filter((block) =>
    Number(block.dataset.mdEndLine) >= sourceLine &&
    Number(block.dataset.mdStartLine) <= sourceLine,
  );
  let targets = matches;
  if (!targets.length) {
    let nearest = null;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const block of blocks) {
      const start = Number(block.dataset.mdStartLine);
      const end = Number(block.dataset.mdEndLine);
      const distance = sourceLine < start ? start - sourceLine : sourceLine > end ? sourceLine - end : 0;
      if (distance < nearestDistance) {
        nearest = block;
        nearestDistance = distance;
      }
    }
    targets = nearest ? [nearest] : [];
  }

  for (const block of document.querySelectorAll("article .lm-md-reference-current")) {
    block.classList.remove("lm-md-reference-current");
  }
  if (!targets.length) return false;

  activateTocForLine(sourceLine);
  for (const block of targets) block.classList.add("lm-md-reference-current");
  targets[0].scrollIntoView({ behavior: "smooth", block: "center" });
  previewScrollRestoreLocked = false;
  window.setTimeout(schedulePreviewScrollStatePersistence, 400);
  window.setTimeout(() => {
    for (const block of targets) block.classList.remove("lm-md-reference-current");
  }, 3200);
  return true;
}

function locateChange(index, shouldScroll = true, syncToc = true) {
  const entries = changeEntries();
  if (!entries.length) return;
  selectedChangeIndex = (index + entries.length) % entries.length;
  for (const block of document.querySelectorAll("article .lm-md-change-mark, article .lm-md-change-current")) {
    block.classList.remove("lm-md-change-mark", "lm-md-change-current");
  }
  entries.forEach((entry, entryIndex) => {
    entry.classList.toggle("lm-md-change-selected", entryIndex === selectedChangeIndex);
  });
  if (syncToc) activateTocForLine(Number(entries[selectedChangeIndex].dataset.startLine));
  const targets = blocksForChange(entries[selectedChangeIndex]);
  targets.forEach((target) => target.classList.add("lm-md-change-mark"));
  const current = targets[0];
  current?.classList.add("lm-md-change-current");
  if (shouldScroll && current) {
    current.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

function initializeChangeHistory() {
  const list = document.getElementById("lm-md-change-list");
  const refresh = document.getElementById("lm-md-change-refresh");
  const previous = document.getElementById("lm-md-change-prev");
  const next = document.getElementById("lm-md-change-next");
  const sourceReview = document.getElementById("lm-md-change-source-current");
  const eventList = document.querySelector(".lm-md-change-event-list");
  const toggle = document.getElementById("lm-md-change-toggle");
  initializeChangeHistoryHelp();
  applyChangePanelCollapsed(false);
  if (toggle && toggle.dataset.bound !== "true") {
    toggle.dataset.bound = "true";
    toggle.addEventListener("click", (event) => {
      event.preventDefault();
      toggleChangePanelVisibility();
    });
  }
  if (list && list.dataset.bound !== "true") {
    list.dataset.bound = "true";
    list.addEventListener("click", (event) => {
      const target = elementForNode(event.target);
      const locateButton = target?.closest?.("[data-change-locate]");
      if (locateButton) {
        locateChange(Number(locateButton.dataset.changeLocate));
        return;
      }
      const sourceButton = target?.closest?.("[data-source-review]");
      if (sourceButton) {
        locateChange(Number(sourceButton.dataset.sourceReview), false);
        const entry = changeEntries()[selectedChangeIndex];
        if (entry) {
          vscode.postMessage({
            type: "openSourceReview",
            startLine: Number(entry.dataset.startLine),
            endLine: Number(entry.dataset.endLine),
          });
        }
      }
    });
  }
  if (eventList && eventList.dataset.bound !== "true") {
    eventList.dataset.bound = "true";
    eventList.addEventListener("click", (event) => {
      const target = elementForNode(event.target);
      const sourceButton = target?.closest?.("[data-event-source-review]");
      if (!sourceButton) return;
      vscode.postMessage({
        type: "openSourceReview",
        startLine: Number(sourceButton.dataset.startLine),
        endLine: Number(sourceButton.dataset.endLine),
      });
    });
  }
  if (refresh && refresh.dataset.bound !== "true") {
    refresh.dataset.bound = "true";
    refresh.addEventListener("click", () => {
      vscode.postMessage({ type: "refreshChangeHistory" });
    });
  }
  if (previous && previous.dataset.bound !== "true") {
    previous.dataset.bound = "true";
    previous.addEventListener("click", () => locateChange(selectedChangeIndex - 1));
  }
  if (next && next.dataset.bound !== "true") {
    next.dataset.bound = "true";
    next.addEventListener("click", () => locateChange(selectedChangeIndex + 1));
  }
  if (sourceReview && sourceReview.dataset.bound !== "true") {
    sourceReview.dataset.bound = "true";
    sourceReview.addEventListener("click", () => {
      const entry = changeEntries()[selectedChangeIndex];
      if (!entry) return;
      vscode.postMessage({
        type: "openSourceReview",
        startLine: Number(entry.dataset.startLine),
        endLine: Number(entry.dataset.endLine),
      });
    });
  }
  const entries = changeEntries();
  if (!entries.length) {
    selectedChangeIndex = -1;
    return;
  }
  if (selectedChangeIndex < 0) {
    selectedChangeIndex = entries.length - 1;
    entries[selectedChangeIndex].classList.add("lm-md-change-selected");
  } else {
    selectedChangeIndex = Math.min(selectedChangeIndex, entries.length - 1);
    entries[selectedChangeIndex].classList.add("lm-md-change-selected");
  }
}

function initializeChangeHistoryHelp() {
  const help = document.getElementById("lm-md-change-help");
  const button = document.getElementById("lm-md-change-help-button");
  if (help && button && help.dataset.bound !== "true") {
    help.dataset.bound = "true";
    help.addEventListener("pointerenter", () => {
      help.dataset.dismissed = "false";
      setChangeHistoryHelpOpen(help, true);
    });
    help.addEventListener("pointerleave", () => {
      if (help.dataset.pinned === "true" || help.matches(":focus-within")) return;
      setChangeHistoryHelpOpen(help, false);
    });
    help.addEventListener("focusin", () => {
      if (help.dataset.dismissed !== "true") setChangeHistoryHelpOpen(help, true);
    });
    help.addEventListener("focusout", () => {
      if (help.dataset.pinned === "true" || help.matches(":hover")) return;
      help.dataset.dismissed = "false";
      setChangeHistoryHelpOpen(help, false);
    });
    button.addEventListener("click", (event) => {
      event.preventDefault();
      if (help.dataset.pinned === "true") {
        closeChangeHistoryHelp(help, true);
      } else {
        help.dataset.dismissed = "false";
        help.dataset.pinned = "true";
        setChangeHistoryHelpOpen(help, true);
      }
    });
  }

  if (!changeHelpDocumentHandlersBound) {
    changeHelpDocumentHandlersBound = true;
    document.addEventListener("click", (event) => {
      const openHelp = document.querySelector("#lm-md-change-help.is-open");
      if (openHelp && !openHelp.contains(event.target)) {
        closeChangeHistoryHelp(openHelp, true);
      }
    });
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      const openHelp = document.querySelector("#lm-md-change-help.is-open");
      if (!openHelp) return;
      closeChangeHistoryHelp(openHelp, true);
      document.getElementById("lm-md-change-help-button")?.focus();
    });
  }
}

function setChangeHistoryHelpOpen(help, open) {
  help.classList.toggle("is-open", open);
  help.querySelector("#lm-md-change-help-button")?.setAttribute("aria-expanded", String(open));
}

function closeChangeHistoryHelp(help, dismiss) {
  help.dataset.pinned = "false";
  if (dismiss) help.dataset.dismissed = "true";
  setChangeHistoryHelpOpen(help, false);
}

function applyChangePanelCollapsed(collapsed) {
  const panel = document.getElementById("lm-md-change-history");
  const body = document.getElementById("lm-md-change-body");
  const toggle = document.getElementById("lm-md-change-toggle");
  if (!panel || !body || !toggle) return;
  panel.classList.toggle("lm-md-change-collapsed", collapsed);
  body.hidden = collapsed;
  toggle.setAttribute("aria-expanded", String(!collapsed));
  toggle.textContent = collapsed ? "展开改动" : "收起改动";
  toggle.title = collapsed ? "展开改动详情" : "收起改动详情";
}

function applyChangePanelHidden(hidden) {
  const panel = document.getElementById("lm-md-change-history");
  if (!panel) return;
  panel.hidden = hidden;
}

function toggleChangePanelVisibility() {
  const panel = document.getElementById("lm-md-change-history");
  if (!panel) return;
  applyChangePanelHidden(!panel.hidden);
  persistPreviewState();
}

function updatePreviewContent(message) {
  const article = document.querySelector("article");
  const toc = document.getElementById("lm-md-toc-list");
  const history = document.getElementById("lm-md-change-history");
  if (!article || !toc || !history) return;
  const previewState = collectPreviewState();

  article.innerHTML = message.bodyHtml;
  selected = null;
  syncing = false;
  updateSelectionControls();
  toc.innerHTML = message.tocHtml;
  history.innerHTML = message.changeHistoryHtml;
  initializeCollapsibleHeadings();
  initializeTocCollapsing();
  restorePreviewState(previewState, { restoreScroll: false });
  initializeTableOfContents();
  initializeTableOfContentsSearch();
  initializeContentSearch();
  initializeChangeHistory();
  applyNetChangeHighlights();
  void renderMermaidDiagrams(article).then(() => {
    applyNetChangeHighlights();
    restorePreviewScrollState(previewState);
  });
}

function updateChangeHistory(message) {
  const history = document.getElementById("lm-md-change-history");
  if (!history) return;
  const previewState = collectPreviewState();
  history.innerHTML = message.changeHistoryHtml;
  initializeChangeHistory();
  applyNetChangeHighlights();
  restorePreviewState(previewState, { restoreScroll: false });
  setStatus("改动列表已刷新");
  void restorePreviewScrollState(previewState);
}

initializeCollapsibleHeadings();
initializeTocCollapsing();
initializeSectionControls();
initializeTableOfContents();
initializeTableOfContentsToggle();
initializeTocPanelToggle();
initializeTocLocate();
initializePreviewSettings();
initializeStickyLayout();
initializePreviewScrollPersistence();
restorePreviewState(vscode.getState()?.previewState);
initializeTableOfContentsSearch();
initializeContentSearch();
initializeChangeHistory();
void renderMermaidDiagrams().then(() => {
  const savedPreviewState = vscode.getState()?.previewState;
  if (savedPreviewState) restorePreviewScrollState(savedPreviewState);
});
vscode.postMessage({ type: "previewReady" });

document.addEventListener("mouseup", (event) => {
  if (elementForNode(event.target)?.closest?.("article")) publishSelection();
});
document.addEventListener("keyup", () => {
  const selection = window.getSelection();
  const article = document.querySelector("article");
  if (
    selection && article &&
    (article.contains(elementForNode(selection.anchorNode)) || article.contains(elementForNode(selection.focusNode)))
  ) publishSelection();
});
document.getElementById("lm-md-clear-selection")?.addEventListener("click", (event) => {
  event.preventDefault();
  clearCurrentSelection();
});

function syncSelected() {
  selected = combinedSelection();
  if (!selected || syncing) return;
  hideContextMenu();
  syncing = true;
  const button = document.getElementById("lm-md-sync");
  if (button) button.disabled = true;
  setStatus("正在打开 Copilot Chat…");
  vscode.postMessage({ ...selected, type: "syncPreviewSelection" });
}

async function copySelected() {
  selected = combinedSelection();
  if (!selected?.text) return;
  const text = selected.text;
  hideContextMenu();
  let copied = false;

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      copied = true;
    }
  } catch {
    copied = false;
  }

  if (!copied) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "true");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.append(textarea);
    textarea.select();
    try {
      copied = document.execCommand("copy");
    } catch {
      copied = false;
    }
    textarea.remove();
  }

  if (copied) {
    setStatus(`已复制${describeSelectionRanges(selected)}`);
  } else {
    setStatus("复制失败，请使用 Ctrl+C", true);
  }
}

function boldSelected() {
  selected = combinedSelection();
  const segments = Array.isArray(selected?.segments)
    ? selected.segments.filter((segment) => segment?.text)
    : [];
  if (!segments.length || formattingBold) return;

  hideContextMenu();
  formattingBold = true;
  setStatus("正在将选中文字加粗…");
  vscode.postMessage({ type: "formatSelectionBold", segments });
}

function locateSelectionInSource() {
  selected = combinedSelection();
  if (!selected) return;

  hideContextMenu();
  vscode.postMessage({
    type: "openSourceReview",
    startLine: selected.startLine,
    endLine: selected.endLine,
  });
}

const syncButton = document.getElementById("lm-md-sync");
syncButton?.addEventListener("click", syncSelected);
syncButton?.addEventListener("pointerdown", syncSelected);
syncButton?.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    syncSelected();
  }
});
// Keep a delegated capture handler as a fallback for webview toolbar events.
// It also survives a future toolbar re-render without relying on a new binding.
document.addEventListener("click", (event) => {
  const target = elementForNode(event.target);
  if (target?.closest?.("#lm-md-sync")) syncSelected();
}, true);

function previewImagePayload(image) {
  return {
    source: image.dataset.mdImageSource || image.getAttribute("src") || "",
    alt: image.getAttribute("alt") || "",
    title: image.getAttribute("title") || "",
    width: image.getAttribute("width") || "",
    height: image.getAttribute("height") || "",
    startLine: Number(image.dataset.mdStartLine),
    endLine: Number(image.dataset.mdEndLine),
    imageIndex: Number(image.dataset.mdImageIndex),
  };
}

function runImageContextAction(event, image, action, width) {
  event.preventDefault();
  event.stopPropagation();
  const requestId = `image-${++previewActionSequence}`;
  const operation = action === "upload" ? "uploadImageToCos" : "setImageSize";
  pendingPreviewActions.set(requestId, operation);
  vscode.postMessage({
    type: operation,
    requestId,
    image: { ...previewImagePayload(image), ...(width ? { width } : {}) },
  });
  hideContextMenu();
  setStatus(action === "upload" ? "正在上传图片到腾讯 COS…" : "正在调整图片大小…");
}

function showImageContextMenu(event, image) {
  hideContextMenu();
  const contextX = event.clientX;
  const contextY = event.clientY;
  const positionMenu = () => {
    const left = Math.min(contextX, window.innerWidth - contextMenu.offsetWidth - 8);
    const top = Math.min(contextY, window.innerHeight - contextMenu.offsetHeight - 8);
    contextMenu.style.left = `${Math.max(8, left)}px`;
    contextMenu.style.top = `${Math.max(8, top)}px`;
  };
  contextMenu = document.createElement("div");
  contextMenu.className = "lm-md-context-menu";
  contextMenu.setAttribute("role", "menu");
  const addItem = (label, action, width) => {
    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute("role", "menuitem");
    button.textContent = label;
    button.addEventListener("pointerdown", (itemEvent) => {
      itemEvent.preventDefault();
      if (action === "size") {
        runImageContextAction(itemEvent, image, "size", width);
      } else if (action === "custom-size") {
        itemEvent.stopPropagation();
        if (contextMenu.querySelector(".lm-md-image-custom-size")) return;
        const editor = document.createElement("div");
        editor.className = "lm-md-image-custom-size";
        const input = document.createElement("input");
        input.type = "number";
        input.min = "10";
        input.max = "100";
        input.step = "1";
        input.value = "75";
        input.setAttribute("aria-label", "图片宽度百分比");
        input.addEventListener("input", () => input.setCustomValidity(""));
        const apply = document.createElement("button");
        apply.type = "button";
        apply.textContent = "应用";
        apply.addEventListener("click", (applyEvent) => {
          applyEvent.preventDefault();
          const value = Number(input.value);
          if (!Number.isFinite(value) || value < 10 || value > 100) {
            input.setCustomValidity("请输入 10 到 100 之间的数字");
            input.reportValidity();
            return;
          }
          runImageContextAction(applyEvent, image, "size", `${value}%`);
        });
        editor.append(input, document.createTextNode("%"), apply);
        contextMenu.append(editor);
        positionMenu();
        input.focus();
      } else {
        runImageContextAction(itemEvent, image, "upload");
      }
    });
    contextMenu.append(button);
  };
  addItem("图片宽度：25%", "size", "25%");
  addItem("图片宽度：50%", "size", "50%");
  addItem("图片宽度：75%", "size", "75%");
  addItem("图片宽度：100%", "size", "100%");
  addItem("自定义图片宽度…", "custom-size");
  const separator = document.createElement("div");
  separator.className = "lm-md-context-separator";
  contextMenu.append(separator);
  addItem("上传到腾讯 COS…", "upload");
  document.body.append(contextMenu);
  positionMenu();
  contextMenu.querySelector("button")?.focus();
}

document.addEventListener("contextmenu", (event) => {
  const target = elementForNode(event.target);
  if (!target?.closest?.("article")) return;
  const image = target.closest("img[data-md-image-source][data-md-start-line]");
  if (image) {
    showImageContextMenu(event, image);
    return;
  }
  publishSelection();
  if (!selected) return;

  event.preventDefault();
  hideContextMenu();
  contextMenu = document.createElement("div");
  contextMenu.className = "lm-md-context-menu";
  contextMenu.setAttribute("role", "menu");
  const copyItem = document.createElement("button");
  copyItem.type = "button";
  copyItem.dataset.action = "copy";
  copyItem.setAttribute("role", "menuitem");
  copyItem.textContent = "复制";
  const boldItem = document.createElement("button");
  boldItem.type = "button";
  boldItem.dataset.action = "bold";
  boldItem.setAttribute("role", "menuitem");
  boldItem.textContent = "加粗";
  const syncItem = document.createElement("button");
  syncItem.type = "button";
  syncItem.dataset.action = "sync";
  syncItem.setAttribute("role", "menuitem");
  syncItem.textContent = "同步到 Copilot";
  const sourceItem = document.createElement("button");
  sourceItem.type = "button";
  sourceItem.dataset.action = "source";
  sourceItem.setAttribute("role", "menuitem");
  sourceItem.textContent = "源码定位";
  const activateMenuItem = (itemEvent) => {
    const item = elementForNode(itemEvent.target)?.closest?.(
      ".lm-md-context-menu button",
    );
    if (!item) return;
    itemEvent.preventDefault();
    itemEvent.stopPropagation();
    if (item.dataset.action === "copy") {
      void copySelected();
    } else if (item.dataset.action === "bold") {
      boldSelected();
    } else if (item.dataset.action === "source") {
      locateSelectionInSource();
    } else {
      syncSelected();
    }
  };
  contextMenu.addEventListener("pointerdown", activateMenuItem, true);
  contextMenu.addEventListener("keydown", (itemEvent) => {
    if (itemEvent.key === "Enter" || itemEvent.key === " ") {
      activateMenuItem(itemEvent);
    }
  });
  contextMenu.append(boldItem, copyItem, syncItem, sourceItem);
  document.body.append(contextMenu);
  const left = Math.min(event.clientX, window.innerWidth - contextMenu.offsetWidth - 8);
  const top = Math.min(event.clientY, window.innerHeight - contextMenu.offsetHeight - 8);
  contextMenu.style.left = `${Math.max(8, left)}px`;
  contextMenu.style.top = `${Math.max(8, top)}px`;
  boldItem.focus();
});

document.addEventListener("click", (event) => {
  if (contextMenu && !contextMenu.contains(elementForNode(event.target))) {
    hideContextMenu();
  }
});
document.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f" && !event.isComposing) {
    event.preventDefault();
    event.stopPropagation();
    toggleToolbarVisibility();
  }
  const target = elementForNode(event.target);
  const isEditable = target?.closest?.("input, textarea, select, [contenteditable='true']");
  if (event.ctrlKey && !event.altKey && !event.metaKey && !event.shiftKey &&
      event.key.toLowerCase() === "h" && !event.isComposing && !event.repeat && !isEditable) {
    event.preventDefault();
    event.stopPropagation();
    toggleChangePanelVisibility();
  }
  if (event.key === "Escape") hideContextMenu();
});

window.addEventListener("message", (event) => {
  if (event.data?.type === "previewSettings") {
    applyPreviewSettings(event.data.settings, { renderDiagrams: true });
    const action = pendingPreviewActions.get(event.data.requestId);
    if (event.data.requestId) pendingPreviewActions.delete(event.data.requestId);
    if (action === "cos-save") {
      document.getElementById("lm-md-cos-secret-id").value = "";
      document.getElementById("lm-md-cos-secret-key").value = "";
      setPreviewSettingsStatus(event.data.settings?.cosCredentialsConfigured ? "COS 设置已保存，密钥已加密存储。" : "COS 设置已保存。");
    } else if (action === "cos-clear") {
      document.getElementById("lm-md-cos-secret-id").value = "";
      document.getElementById("lm-md-cos-secret-key").value = "";
      setPreviewSettingsStatus("已清除保存的 COS 密钥。");
    } else if (action === "visual") {
      setPreviewSettingsStatus("显示设置已保存。");
    }
  }
  if (event.data?.type === "previewActionResult") {
    const action = pendingPreviewActions.get(event.data.requestId);
    if (event.data.requestId) pendingPreviewActions.delete(event.data.requestId);
    if (event.data.error) {
      if (action === "cos-save" || action === "cos-clear") setPreviewSettingsStatus(event.data.error, true);
      else setStatus(event.data.error, true);
    } else if (event.data.action === "setImageSize") {
      setStatus("图片宽度已更新，可使用 Ctrl+Z 撤销");
    } else if (event.data.action === "uploadImageToCos") {
      setStatus("图片已上传到腾讯 COS，Markdown 地址已替换");
    }
  }
  if (event.data?.type === "toggleToolbar") {
    toggleToolbarVisibility();
  }
  if (event.data?.type === "restorePreviewState") {
    restorePreviewState(event.data.previewState);
    initializeTableOfContentsSearch();
    initializeContentSearch();
  }
  if (event.data?.type === "restorePreviewScroll") {
    const previewState = mergePreviewScrollState(event.data.previewState);
    if (previewState) void restorePreviewScrollState(previewState);
  }
  if (event.data?.type === "updatePreviewContent") {
    updatePreviewContent(event.data);
  }
  if (event.data?.type === "revealPreviewLine") {
    revealPreviewLine(event.data.line);
  }
  if (event.data?.type === "updateChangeHistory") {
    updateChangeHistory(event.data);
  }
  if (event.data?.type === "boldFormatCompleted") {
    formattingBold = false;
    setStatus("已将选中文字加粗");
  }
  if (event.data?.type === "boldFormatFailed") {
    formattingBold = false;
    setStatus(`加粗失败：${event.data.message}`, true);
  }
  if (event.data?.type === "sourceReviewCompleted") {
    setStatus("已在源码编辑器中定位，可使用 Copilot 原生控件审阅");
  }
  if (event.data?.type === "sourceReviewFailed") {
    setStatus(`打开源码审阅失败：${event.data.message}`, true);
  }
  if (event.data?.type === "selectionAvailable") {
    renderSelectionAvailable(event.data.selection);
    syncing = false;
  }
  if (event.data?.type === "syncStarted") {
    syncing = true;
    const button = document.getElementById("lm-md-sync");
    if (button) button.disabled = true;
    setStatus("已收到同步请求，正在打开 Copilot Chat…");
  }
  if (event.data?.type === "syncCompleted") {
    syncing = false;
    const syncedStatus = `已同步${describeSelectionRanges(event.data.selection)}到 Copilot Chat`;
    clearCurrentSelection();
    setStatus(syncedStatus);
  }
  if (event.data?.type === "syncFailed") {
    syncing = false;
    const button = document.getElementById("lm-md-sync");
    if (button) button.disabled = !selected;
    setStatus(`同步失败：${event.data.message}`, true);
  }
});
