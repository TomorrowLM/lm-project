(() => {
  const vscode = acquireVsCodeApi();
  const empty = document.getElementById("lm-md-outline-empty");
  const view = document.getElementById("lm-md-outline-view");
  const file = document.getElementById("lm-md-outline-file");
  const scroll = document.getElementById("lm-md-outline-scroll");
  const search = document.getElementById("lm-md-outline-search");
  const count = document.getElementById("lm-md-outline-count");
  const collapsedIds = new Set();
  const saved = vscode.getState() || {};
  let documents = saved.documents && typeof saved.documents === "object"
    ? saved.documents
    : {};
  let activeDocumentKey = "";
  let activePreviewKey = "";
  let activeHeadingId = "";
  let saveTimer = null;

  function items() {
    return Array.from(scroll.querySelectorAll(".lm-md-toc-item"));
  }

  function itemId(item) {
    return item.querySelector(":scope > .lm-md-toc-row > .lm-md-toc-link")
      ?.dataset.tocTarget || "";
  }

  function setCollapsed(item, collapsed) {
    const children = item.querySelector(":scope > .lm-md-toc-children");
    const button = item.querySelector(":scope > .lm-md-toc-row > .lm-md-toc-collapse");
    if (!children || !button) return;
    children.hidden = collapsed;
    children.dataset.tocCollapsed = String(collapsed);
    button.textContent = collapsed ? "▸" : "▾";
    button.setAttribute("aria-expanded", String(!collapsed));
  }

  function syncCollapsedIds() {
    collapsedIds.clear();
    for (const item of items()) {
      const children = item.querySelector(":scope > .lm-md-toc-children");
      const id = itemId(item);
      if (children?.hidden && id) collapsedIds.add(id);
    }
  }

  function restoreCollapseState() {
    for (const item of items()) {
      const id = itemId(item);
      if (id) setCollapsed(item, collapsedIds.has(id));
    }
  }

  function applyFilter() {
    const query = search.value.trim().toLocaleLowerCase();
    const allItems = items();
    const matches = [];
    for (const item of allItems) {
      const link = item.querySelector(":scope > .lm-md-toc-row > .lm-md-toc-link");
      const matched = !query || (link?.textContent || "").toLocaleLowerCase().includes(query);
      item.hidden = Boolean(query) && !matched;
      link?.classList.toggle("lm-md-outline-search-match", Boolean(query && matched));
      if (matched && query) matches.push(item);
    }

    if (query) {
      for (const match of matches) {
        let ancestor = match.parentElement?.closest(".lm-md-toc-item");
        while (ancestor) {
          ancestor.hidden = false;
          setCollapsed(ancestor, false);
          ancestor = ancestor.parentElement?.closest(".lm-md-toc-item");
        }
      }
      count.textContent = `匹配 ${matches.length} 个标题`;
    } else {
      restoreCollapseState();
      count.textContent = `共 ${allItems.length} 个标题`;
    }
  }

  function applyActiveHeading(headingId) {
    activeHeadingId = headingId || "";
    for (const link of scroll.querySelectorAll(".lm-md-toc-link")) {
      const active = Boolean(activeHeadingId && link.dataset.tocTarget === activeHeadingId);
      link.classList.toggle("lm-md-toc-active", active);
      if (active) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    }
  }

  function saveCurrentState() {
    if (!activeDocumentKey || view.hidden) return;
    const current = documents[activeDocumentKey] || {};
    documents[activeDocumentKey] = {
      ...current,
      search: search.value,
      collapsedIds: Array.from(collapsedIds),
      scrollTop: scroll.scrollTop,
      touchedAt: Date.now(),
    };
    const keys = Object.keys(documents).sort((left, right) =>
      (documents[right]?.touchedAt || 0) - (documents[left]?.touchedAt || 0));
    for (const key of keys.slice(40)) delete documents[key];
    vscode.setState({ documents });
  }

  function scheduleSave() {
    if (saveTimer !== null) window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
      saveTimer = null;
      saveCurrentState();
    }, 160);
  }

  function locateActiveHeading() {
    if (!activeHeadingId) return;
    if (search.value) {
      search.value = "";
      applyFilter();
    }
    const link = Array.from(scroll.querySelectorAll(".lm-md-toc-link"))
      .find((candidate) => candidate.dataset.tocTarget === activeHeadingId);
    if (!link) return;
    let ancestor = link.closest(".lm-md-toc-item")?.parentElement?.closest(".lm-md-toc-item");
    while (ancestor) {
      setCollapsed(ancestor, false);
      ancestor = ancestor.parentElement?.closest(".lm-md-toc-item");
    }
    applyActiveHeading(activeHeadingId);
    link.scrollIntoView({ block: "center", inline: "nearest" });
    syncCollapsedIds();
    saveCurrentState();
  }

  function renderOutline(message) {
    if (activeDocumentKey && activeDocumentKey !== message.documentKey) saveCurrentState();
    activeDocumentKey = message.documentKey || "";
    activePreviewKey = message.previewKey || "";
    const state = documents[activeDocumentKey] || {};
    collapsedIds.clear();
    for (const id of Array.isArray(state.collapsedIds) ? state.collapsedIds : []) {
      if (typeof id === "string") collapsedIds.add(id);
    }
    file.textContent = message.fileName || "";
    scroll.innerHTML = typeof message.tocHtml === "string" ? message.tocHtml : "";
    view.hidden = false;
    empty.hidden = true;
    search.value = typeof state.search === "string" ? state.search : "";
    applyFilter();
    scroll.scrollTop = Number.isFinite(state.scrollTop) ? state.scrollTop : 0;
    applyActiveHeading(message.activeHeadingId || "");
  }

  document.getElementById("lm-md-outline-collapse").addEventListener("click", () => {
    for (const item of items()) setCollapsed(item, true);
    syncCollapsedIds();
    applyFilter();
    saveCurrentState();
  });

  document.getElementById("lm-md-outline-expand").addEventListener("click", () => {
    for (const item of items()) setCollapsed(item, false);
    collapsedIds.clear();
    applyFilter();
    saveCurrentState();
  });

  document.getElementById("lm-md-outline-clear").addEventListener("click", () => {
    search.value = "";
    applyFilter();
    saveCurrentState();
    search.focus();
  });

  document.getElementById("lm-md-outline-locate").addEventListener("click", locateActiveHeading);
  search.addEventListener("input", () => {
    applyFilter();
    scheduleSave();
  });
  scroll.addEventListener("scroll", scheduleSave, { passive: true });

  scroll.addEventListener("click", (event) => {
    const collapse = event.target.closest(".lm-md-toc-collapse");
    if (collapse) {
      event.preventDefault();
      const item = collapse.closest(".lm-md-toc-item");
      const collapsed = collapse.getAttribute("aria-expanded") !== "false";
      setCollapsed(item, collapsed);
      syncCollapsedIds();
      saveCurrentState();
      return;
    }
    const link = event.target.closest(".lm-md-toc-link");
    if (!link) return;
    const startLine = Number(link.dataset.mdStartLine);
    if (!Number.isInteger(startLine) || startLine < 1 || !activePreviewKey) return;
    event.preventDefault();
    applyActiveHeading(link.dataset.tocTarget || "");
    vscode.postMessage({
      type: "revealOutlineHeading",
      previewKey: activePreviewKey,
      startLine,
    });
  });

  window.addEventListener("message", (event) => {
    const message = event.data;
    if (message?.type === "renderOutline") renderOutline(message);
    if (message?.type === "clearOutline") {
      saveCurrentState();
      activeDocumentKey = "";
      activePreviewKey = "";
      activeHeadingId = "";
      view.hidden = true;
      empty.hidden = false;
    }
    if (message?.type === "setActiveHeading") applyActiveHeading(message.headingId);
  });

  vscode.postMessage({ type: "outlineReady" });
})();
