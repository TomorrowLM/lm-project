const MarkdownIt = require("markdown-it");

const markdownUtils = new MarkdownIt().utils;

function escapeHtmlAttribute(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function unescapeMarkdown(value) {
  return markdownUtils.unescapeAll(String(value || ""));
}

function parseBracket(source, start, open, close) {
  if (source[start] !== open) return null;
  let depth = 1;
  let escaped = false;
  for (let index = start + 1; index < source.length; index += 1) {
    const character = source[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === "\\") {
      escaped = true;
      continue;
    }
    if (character === open) depth += 1;
    if (character === close && --depth === 0) {
      return { start, end: index + 1, content: source.slice(start + 1, index) };
    }
  }
  return null;
}

function parseInlineImage(source, imageStart) {
  const alt = parseBracket(source, imageStart + 1, "[", "]");
  if (!alt) return null;
  let cursor = alt.end;
  while (/\s/.test(source[cursor] || "")) cursor += 1;

  if (source[cursor] === "(") {
    const openParen = cursor;
    cursor += 1;
    while (/\s/.test(source[cursor] || "")) cursor += 1;
    let destinationStart = cursor;
    let destinationEnd = cursor;
    let destination = "";
    if (source[cursor] === "<") {
      destinationStart = cursor + 1;
      let escaped = false;
      for (cursor += 1; cursor < source.length; cursor += 1) {
        if (escaped) { escaped = false; continue; }
        if (source[cursor] === "\\") { escaped = true; continue; }
        if (source[cursor] === ">") break;
      }
      if (cursor >= source.length) return null;
      destinationEnd = cursor;
      destination = source.slice(destinationStart, destinationEnd);
      cursor += 1;
    } else {
      let nested = 0;
      let escaped = false;
      for (; cursor < source.length; cursor += 1) {
        const character = source[cursor];
        if (escaped) { escaped = false; continue; }
        if (character === "\\") { escaped = true; continue; }
        if (character === "(" && nested >= 0) { nested += 1; continue; }
        if (character === ")") {
          if (nested === 0) break;
          nested -= 1;
          continue;
        }
        if (/\s/.test(character) && nested === 0) break;
      }
      destinationEnd = cursor;
      destination = source.slice(destinationStart, destinationEnd);
    }
    if (!destination) return null;

    while (/\s/.test(source[cursor] || "")) cursor += 1;
    let title = "";
    const titleQuote = source[cursor];
    if (["'", '"'].includes(titleQuote)) {
      const titleStart = cursor + 1;
      let escaped = false;
      for (cursor += 1; cursor < source.length; cursor += 1) {
        if (escaped) { escaped = false; continue; }
        if (source[cursor] === "\\") { escaped = true; continue; }
        if (source[cursor] === titleQuote) break;
      }
      if (cursor >= source.length) return null;
      title = source.slice(titleStart, cursor);
      cursor += 1;
      while (/\s/.test(source[cursor] || "")) cursor += 1;
    }
    if (source[cursor] !== ")") return null;
    return {
      kind: "markdown-inline",
      start: imageStart,
      end: cursor + 1,
      destinationStart,
      destinationEnd,
      source: unescapeMarkdown(destination),
      alt: unescapeMarkdown(alt.content),
      title: unescapeMarkdown(title),
      raw: source.slice(imageStart, cursor + 1),
      openParen,
    };
  }

  let reference = null;
  if (source[cursor] === "[") {
    reference = parseBracket(source, cursor, "[", "]");
    if (reference) cursor = reference.end;
  } else {
    reference = { content: alt.content, end: alt.end };
  }

  return {
    kind: "markdown-reference",
    start: imageStart,
    end: cursor,
    source: "",
    alt: unescapeMarkdown(alt.content),
    reference: unescapeMarkdown(reference.content || alt.content).trim().toLowerCase(),
    raw: source.slice(imageStart, cursor),
  };
}

function parseHtmlImage(tag, absoluteStart) {
  const srcMatch = /\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(tag);
  if (!srcMatch) return null;
  const valueIndex = srcMatch[0].lastIndexOf(srcMatch[1] ?? srcMatch[2] ?? srcMatch[3]);
  const altMatch = /\balt\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(tag);
  const titleMatch = /\btitle\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(tag);
  return {
    kind: "html",
    start: absoluteStart,
    end: absoluteStart + tag.length,
    destinationStart: absoluteStart + srcMatch.index + valueIndex,
    destinationEnd: absoluteStart + srcMatch.index + valueIndex + String(srcMatch[1] ?? srcMatch[2] ?? srcMatch[3]).length,
    source: unescapeMarkdown(srcMatch[1] ?? srcMatch[2] ?? srcMatch[3]),
    alt: unescapeMarkdown(altMatch?.[1] ?? altMatch?.[2] ?? altMatch?.[3] ?? ""),
    title: unescapeMarkdown(titleMatch?.[1] ?? titleMatch?.[2] ?? titleMatch?.[3] ?? ""),
    raw: tag,
  };
}

function findImageCandidates(markdown, range) {
  const startLine = Number(range?.startLine);
  const endLine = Number(range?.endLine);
  if (!Number.isInteger(startLine) || !Number.isInteger(endLine) || startLine < 1 || endLine < startLine) {
    throw new Error("图片缺少有效的源文档位置，请刷新预览后重试。");
  }
  const lines = markdown.split(/\r\n|\n|\r/);
  if (startLine > lines.length || endLine > lines.length) {
    throw new Error("图片源位置已变化，请刷新预览后重试。");
  }
  const offsets = [];
  let offset = 0;
  const newlinePattern = /\r\n|\n|\r/g;
  for (let index = 0; index < lines.length; index += 1) {
    offsets.push(offset);
    offset += lines[index].length;
    if (index < lines.length - 1) {
      newlinePattern.lastIndex = offset;
      const newline = newlinePattern.exec(markdown);
      offset += newline?.[0].length || 1;
    }
  }
  const sourceStart = offsets[startLine - 1];
  const sourceEnd = endLine < lines.length ? offsets[endLine] : markdown.length;
  const segment = markdown.slice(sourceStart, sourceEnd);
  const candidates = [];

  const htmlPattern = /<img\b[^>]*>/gi;
  for (const match of segment.matchAll(htmlPattern)) {
    const candidate = parseHtmlImage(match[0], sourceStart + match.index);
    if (candidate) candidates.push(candidate);
  }

  for (let index = 0; index < segment.length - 1; index += 1) {
    if (segment[index] !== "!" || segment[index + 1] !== "[") continue;
    if (index > 0 && segment[index - 1] === "\\") continue;
    const candidate = parseInlineImage(segment, index);
    if (candidate) {
      candidate.start += sourceStart;
      candidate.end += sourceStart;
      candidate.destinationStart = candidate.destinationStart === undefined ? undefined : candidate.destinationStart + sourceStart;
      candidate.destinationEnd = candidate.destinationEnd === undefined ? undefined : candidate.destinationEnd + sourceStart;
      candidates.push(candidate);
      index = Math.max(index, candidate.end - sourceStart - 1);
    }
  }
  const sorted = candidates.sort((left, right) => left.start - right.start);
  const normalizeReference = (value) => unescapeMarkdown(value).trim().toLocaleLowerCase().replace(/\s+/g, " ");
  const definitions = new Map();
  const definitionPattern = /^[ \t]{0,3}\[([^\]]+)\]:[ \t]*(<([^>]+)>|(\S+))/gm;
  for (const match of markdown.matchAll(definitionPattern)) {
    const label = normalizeReference(match[1]);
    const destination = match[3] ?? match[4] ?? "";
    const rawDestination = match[2] ?? match[4] ?? "";
    const destinationIndex = match[0].indexOf(rawDestination) + (match[2] ? 1 : 0);
    if (!definitions.has(label)) {
      definitions.set(label, {
        source: unescapeMarkdown(destination),
        destinationStart: match.index + destinationIndex,
        destinationEnd: match.index + destinationIndex + destination.length,
      });
    }
  }
  for (const candidate of sorted) {
    if (candidate.kind !== "markdown-reference") continue;
    const definition = definitions.get(normalizeReference(candidate.reference));
    if (definition) Object.assign(candidate, definition);
  }
  return sorted;
}

function normalizeComparable(value) {
  return unescapeMarkdown(String(value || "")).trim().replace(/&amp;/gi, "&");
}

function findImageCandidate(markdown, payload) {
  const expectedSource = normalizeComparable(payload.source);
  const expectedAlt = String(payload.alt || "");
  const candidates = findImageCandidates(markdown, payload);
  const expectedIndex = Number(payload.imageIndex);
  let candidate = Number.isInteger(expectedIndex) && expectedIndex >= 0
    ? candidates[expectedIndex]
    : null;
  if (candidate && (normalizeComparable(candidate.source) !== expectedSource || candidate.alt !== expectedAlt)) {
    candidate = null;
  }
  if (!candidate) {
    const matches = candidates.filter((item) =>
      normalizeComparable(item.source) === expectedSource && item.alt === expectedAlt,
    );
    if (matches.length > 1) throw new Error("同一段落中有多张相同图片，无法安全确定目标；文档未修改。");
    [candidate] = matches;
  }

  if (!candidate) {
    throw new Error("未能安全匹配这张图片的 Markdown 源码；文档未修改。");
  }
  return candidate;
}

function replaceHtmlAttribute(tag, name, value) {
  const pattern = new RegExp(`(\\s${name}\\s*=\\s*)(?:"[^"]*"|'[^']*'|[^\\s>]+)`, "i");
  const escaped = `"${escapeHtmlAttribute(value)}"`;
  if (pattern.test(tag)) return tag.replace(pattern, (_match, prefix) => `${prefix}${escaped}`);
  return tag.replace(/\s*\/?\s*>$/, (tail) => ` ${name}=${escaped}${tail}`);
}

function removeHtmlAttribute(tag, name) {
  const pattern = new RegExp(`\\s${name}\\s*=\\s*(?:"[^"]*"|'[^']*'|[^\\s>]+)`, "i");
  return tag.replace(pattern, "");
}

function htmlImageFromCandidate(candidate, payload, { source, width } = {}) {
  let tag;
  if (candidate.kind === "html") {
    tag = candidate.raw;
  } else {
    const nextSource = source || payload.source;
    const alt = candidate.alt || payload.alt || "";
    const title = candidate.title || payload.title || "";
    tag = `<img src="${escapeHtmlAttribute(nextSource)}" alt="${escapeHtmlAttribute(alt)}"${title ? ` title="${escapeHtmlAttribute(title)}"` : ""} />`;
  }
  if (source) tag = replaceHtmlAttribute(tag, "src", source);
  if (width) {
    tag = replaceHtmlAttribute(tag, "width", width);
    tag = removeHtmlAttribute(tag, "height");
  }
  return tag;
}

function createImageEdit(vscode, document, payload, change) {
  const text = document.getText();
  const candidate = findImageCandidate(text, payload);
  let replacement;
  let replaceStart = candidate.start;
  let replaceEnd = candidate.end;

  if (change.width) {
    replacement = htmlImageFromCandidate(candidate, payload, { width: change.width });
  } else if (change.source) {
    if (candidate.kind === "markdown-inline" || candidate.kind === "html") {
      replaceStart = candidate.destinationStart;
      replaceEnd = candidate.destinationEnd;
      replacement = change.source;
    } else {
      replacement = htmlImageFromCandidate(candidate, payload, { source: change.source });
    }
  } else {
    throw new Error("没有可应用的图片修改。");
  }

  const edit = new vscode.WorkspaceEdit();
  edit.replace(
    document.uri,
    new vscode.Range(document.positionAt(replaceStart), document.positionAt(replaceEnd)),
    replacement,
  );
  return edit;
}

async function applyImageDimension(vscode, document, payload) {
  const value = String(payload?.width || "").trim();
  if (!/^\d{1,3}(?:\.\d{1,2})?%$/.test(value) || Number.parseFloat(value) < 10 || Number.parseFloat(value) > 100) {
    throw new Error("图片宽度需为 10% 到 100% 之间的百分比。");
  }
  const edit = createImageEdit(vscode, document, payload, { width: value });
  if (!await vscode.workspace.applyEdit(edit)) throw new Error("无法修改图片源码。");
}

async function replaceImageSource(vscode, document, payload, nextSource) {
  const edit = createImageEdit(vscode, document, payload, { source: nextSource });
  if (!await vscode.workspace.applyEdit(edit)) throw new Error("上传成功，但无法更新 Markdown 图片地址。");
}

module.exports = {
  applyImageDimension,
  findImageCandidate,
  replaceImageSource,
};
