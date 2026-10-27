const MAX_DOCUMENTS = 40;
const MAX_HEADING_IDS = 5000;

function normalizeScrollOffset(value) {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function normalizeSourceLine(value) {
  return Number.isInteger(value) && value > 0 ? Math.min(value, 1_000_000_000) : 0;
}

function normalizeAnchorProgress(value) {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}

function normalizeAnchorViewportY(value) {
  return Number.isFinite(value) ? Math.max(0, Math.min(100_000, Math.round(value))) : 0;
}

function normalizeIds(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value
    .filter((item) => typeof item === "string" && item.length > 0)
    .map((item) => item.slice(0, 512)))]
    .slice(0, MAX_HEADING_IDS);
}

function normalizePreviewState(state) {
  const previewAnchorStartLine = normalizeSourceLine(state?.previewAnchorStartLine);
  const previewAnchorEndLine = normalizeSourceLine(state?.previewAnchorEndLine);
  const hasScrollAnchorState = [
    "previewAnchorStartLine",
    "previewAnchorEndLine",
    "previewAnchorProgress",
    "previewAnchorViewportY",
    "previewScrollUpdatedAt",
  ].some((key) => Object.prototype.hasOwnProperty.call(state || {}, key));
  return {
    collapsedHeadingIds: normalizeIds(state?.collapsedHeadingIds),
    collapsedTocIds: normalizeIds(state?.collapsedTocIds),
    tocHidden: Boolean(state?.tocHidden),
    tocDetailsOpen: state?.tocDetailsOpen !== false,
    changePanelCollapsed: Boolean(state?.changePanelCollapsed),
    changePanelHidden: Boolean(state?.changePanelHidden),
    tocSearch: typeof state?.tocSearch === "string" ? state.tocSearch.slice(0, 1000) : "",
    contentSearch: typeof state?.contentSearch === "string" ? state.contentSearch.slice(0, 1000) : "",
    previewScrollTop: normalizeScrollOffset(state?.previewScrollTop),
    tocScrollTop: normalizeScrollOffset(state?.tocScrollTop),
    changeListScrollTop: normalizeScrollOffset(state?.changeListScrollTop),
    ...(hasScrollAnchorState ? {
      previewAnchorStartLine,
      previewAnchorEndLine: previewAnchorEndLine >= previewAnchorStartLine
        ? previewAnchorEndLine
        : previewAnchorStartLine,
      previewAnchorProgress: normalizeAnchorProgress(state?.previewAnchorProgress),
      previewAnchorViewportY: normalizeAnchorViewportY(state?.previewAnchorViewportY),
      previewScrollUpdatedAt: normalizeScrollOffset(state?.previewScrollUpdatedAt),
    } : {}),
  };
}

class PreviewStateStore {
  constructor() {
    this.states = new Map();
  }

  get(uri) {
    const key = typeof uri === "string" ? uri : uri?.toString?.();
    if (!key) return normalizePreviewState();
    const state = this.states.get(key);
    if (!state) return normalizePreviewState();
    this.states.delete(key);
    this.states.set(key, state);
    return normalizePreviewState(state);
  }

  has(uri) {
    const key = typeof uri === "string" ? uri : uri?.toString?.();
    return Boolean(key && this.states.has(key));
  }

  set(uri, state) {
    const key = typeof uri === "string" ? uri : uri?.toString?.();
    if (!key) return null;
    const normalized = normalizePreviewState(state);
    this.states.delete(key);
    this.states.set(key, normalized);
    while (this.states.size > MAX_DOCUMENTS) {
      this.states.delete(this.states.keys().next().value);
    }
    return normalizePreviewState(normalized);
  }

  dispose() {
    this.states.clear();
  }
}

module.exports = { PreviewStateStore, normalizePreviewState };
