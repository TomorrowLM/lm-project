const test = require("node:test");
const assert = require("node:assert/strict");
const { PreviewStateStore, normalizePreviewState } = require("../src/preview-state");

test("normalizes and returns independent per-document preview fold state", () => {
  const store = new PreviewStateStore();
  const first = store.set("file:///docs/a.md", {
    collapsedHeadingIds: ["section", "section", 42],
    collapsedTocIds: ["toc"],
    tocHidden: true,
    tocDetailsOpen: false,
    changePanelCollapsed: true,
    changePanelHidden: true,
    tocSearch: "section",
    contentSearch: "match",
    previewScrollTop: 0,
    tocScrollTop: 0,
    changeListScrollTop: 0,
  });

  assert.deepEqual(first, {
    collapsedHeadingIds: ["section"],
    collapsedTocIds: ["toc"],
    tocHidden: true,
    tocDetailsOpen: false,
    changePanelCollapsed: true,
    changePanelHidden: true,
    tocSearch: "section",
    contentSearch: "match",
    previewScrollTop: 0,
    tocScrollTop: 0,
    changeListScrollTop: 0,
  });
  assert.deepEqual(store.get("file:///docs/a.md"), first);
  assert.deepEqual(store.get("file:///docs/b.md"), normalizePreviewState());

  first.collapsedTocIds.push("mutated");
  assert.deepEqual(store.get("file:///docs/a.md").collapsedTocIds, ["toc"]);
  store.dispose();
  assert.deepEqual(store.get("file:///docs/a.md"), normalizePreviewState());
});

test("preserves preview, outline, and change-list scroll positions per document", () => {
  const store = new PreviewStateStore();
  const state = store.set("file:///docs/scroll.md", {
    previewScrollTop: 1840,
    tocScrollTop: 320,
    changeListScrollTop: 96,
  });

  assert.equal(state.previewScrollTop, 1840);
  assert.equal(state.tocScrollTop, 320);
  assert.equal(state.changeListScrollTop, 96);
  assert.equal(store.get("file:///docs/scroll.md").previewScrollTop, 1840);
  assert.equal(store.get("file:///docs/other.md").previewScrollTop, 0);
});

test("normalizes invalid scroll positions to safe non-negative values", () => {
  const state = normalizePreviewState({
    previewScrollTop: -10,
    tocScrollTop: Number.NaN,
    changeListScrollTop: Number.POSITIVE_INFINITY,
  });

  assert.equal(state.previewScrollTop, 0);
  assert.equal(state.tocScrollTop, 0);
  assert.equal(state.changeListScrollTop, 0);
});
