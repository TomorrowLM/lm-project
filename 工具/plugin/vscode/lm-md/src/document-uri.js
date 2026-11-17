function normalizeDocumentUri(uri) {
  if (!uri) return uri;
  let normalizedUri = uri;
  if (typeof uri.with === "function") {
    try {
      normalizedUri = uri.with({ query: "", fragment: "" });
    } catch {
      normalizedUri = uri;
    }
  }
  return normalizedUri;
}

function getDocumentUriKey(uri) {
  if (!uri) return "";

  const normalizedUri = normalizeDocumentUri(uri);

  let key = normalizedUri?.toString?.() || String(normalizedUri);
  if ((!key || key === "[object Object]") && uri.fsPath) {
    key = `${uri.scheme || "file"}:${uri.fsPath}`;
  }
  if (uri.scheme === "file" && process.platform === "win32") {
    key = key.toLowerCase();
  }
  return key;
}

module.exports = { getDocumentUriKey, normalizeDocumentUri };
