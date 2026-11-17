const MarkdownIt = require("markdown-it");
const highlightJs = require("highlight.js/lib/common");

const BLOCK_OPEN_TYPES = new Set([
  "blockquote_open",
  "bullet_list_open",
  "ordered_list_open",
  "heading_open",
  "paragraph_open",
  "table_open",
]);

function addSourceAttributes(token) {
  if (!token.map || !BLOCK_OPEN_TYPES.has(token.type)) return;
  token.attrSet("data-md-start-line", String(token.map[0] + 1));
  token.attrSet("data-md-end-line", String(token.map[1]));
}

function sanitizeFontColor(value) {
  const color = String(value || "").trim();
  if (/^#[\da-f]{3,8}$/i.test(color)) return color;
  if (/^(?:rgb|rgba)\([\d\s.,%+\-/]+\)$/i.test(color)) return color;
  if (/^[a-z]{1,24}$/i.test(color)) return color;
  return null;
}

function readHtmlAttribute(attributes, name) {
  const match = String(attributes || "").match(
    new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"),
  );
  return match ? match[1] ?? match[2] ?? match[3] ?? "" : "";
}

function fontColorFromAttributes(attributes) {
  const style = readHtmlAttribute(attributes, "style");
  const styleColor = style.match(/(?:^|;)\s*color\s*:\s*([^;]+)/i)?.[1];
  return sanitizeFontColor(styleColor) ||
    sanitizeFontColor(readHtmlAttribute(attributes, "color"));
}

function sanitizeImageSource(value) {
  const source = String(value || "").trim();
  if (!source || /[\u0000-\u001f]/.test(source)) return null;
  if (/^(?:https?:\/\/|\/\/|vscode-webview:|vscode-resource:)/i.test(source)) {
    return source;
  }
  if (/^data:image\/(?:png|gif|jpe?g|webp|avif);base64,/i.test(source)) {
    return source;
  }
  if (/^[a-z][a-z\d+.-]*:/i.test(source) && !/^file:/i.test(source)) {
    return null;
  }
  return source;
}

function sanitizeImageDimension(value) {
  const dimension = String(value || "").trim();
  if (!/^\d{1,5}(?:\.\d{1,2})?%?$/.test(dimension)) return null;
  const numericValue = Number.parseFloat(dimension);
  const maximum = dimension.endsWith("%") ? 100 : 10000;
  return numericValue > 0 && numericValue <= maximum ? dimension : null;
}

function sanitizeImageZoom(attributes) {
  const style = readHtmlAttribute(attributes, "style");
  const match = style.match(/^\s*zoom\s*:\s*(\d{1,3}(?:\.\d{1,2})?)%\s*;?\s*$/i);
  if (!match) return null;
  const zoom = Number.parseFloat(match[1]);
  return zoom > 0 && zoom <= 500 ? `${zoom}%` : null;
}

function parseSafeFontTag(state, silent) {
  const remaining = state.src.slice(state.pos);
  const closing = remaining.match(/^<\/font\s*>/i);
  const opening = closing ? null : remaining.match(/^<font\b([^>]*)>/i);
  if (!closing && !opening) return false;
  if (silent) {
    state.pos += (closing || opening)[0].length;
    return true;
  }

  if (closing) {
    state.push("font_close", "font", -1);
    state.pos += closing[0].length;
    return true;
  }

  const token = state.push("font_open", "font", 1);
  const color = fontColorFromAttributes(opening[1]);
  if (color) token.attrSet("color", color);
  state.pos += opening[0].length;
  return true;
}

function parseSafeImageTag(state, silent) {
  const remaining = state.src.slice(state.pos);
  const opening = remaining.match(/^<img\b([^>]*)\/?>/i);
  if (!opening) return false;

  const attributes = opening[1];
  const source = sanitizeImageSource(readHtmlAttribute(attributes, "src"));
  if (!source) return false;
  if (silent) {
    state.pos += opening[0].length;
    return true;
  }

  const token = state.push("safe_html_image", "img", 0);
  token.attrSet("src", source);
  token.attrSet("alt", state.md.utils.unescapeAll(readHtmlAttribute(attributes, "alt")));

  const title = readHtmlAttribute(attributes, "title");
  if (title) token.attrSet("title", state.md.utils.unescapeAll(title));

  for (const name of ["width", "height"]) {
    const dimension = sanitizeImageDimension(readHtmlAttribute(attributes, name));
    if (dimension) token.attrSet(name, dimension);
  }

  const zoom = sanitizeImageZoom(attributes);
  if (zoom) token.attrSet("style", `zoom:${zoom};`);

  state.pos += opening[0].length;
  return true;
}

function resolveImageTokens(tokens, resolveImageSource) {
  for (const token of tokens) {
    if (token.type === "image" || token.type === "safe_html_image") {
      const source = token.attrGet("src");
      const resolved = resolveImageSource(source);
      if (typeof resolved === "string" && resolved) {
        token.attrSet("src", resolved);
      }
    }
    if (Array.isArray(token.children)) {
      resolveImageTokens(token.children, resolveImageSource);
    }
  }
}

function addImageSourceMetadata(tokens) {
  for (const token of tokens) {
    if (token.type === "inline" && Array.isArray(token.children) && token.map) {
      let imageIndex = 0;
      for (const child of token.children) {
        if (child.type !== "image" && child.type !== "safe_html_image") continue;
        child.attrSet("data-md-image-source", child.attrGet("src") || "");
        child.attrSet("data-md-image-index", String(imageIndex++));
        child.attrSet("data-md-start-line", String(token.map[0] + 1));
        child.attrSet("data-md-end-line", String(token.map[1]));
      }
    }
    if (Array.isArray(token.children)) addImageSourceMetadata(token.children);
  }
}

function headingPlainText(inlineToken) {
  if (!inlineToken) return "";
  if (!Array.isArray(inlineToken.children) || inlineToken.children.length === 0) {
    return String(inlineToken.content || "");
  }

  return inlineToken.children
    .map((child) => {
      if (child.type === "image") return child.content || child.attrGet("alt") || "";
      if (child.type === "softbreak" || child.type === "hardbreak") return " ";
      return child.content || "";
    })
    .join("");
}

function slugifyHeading(text, usedIds, index) {
  const base = String(text || "")
    .trim()
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/[\s-]+/g, "-")
    .replace(/^-+|-+$/g, "") || `section-${index + 1}`;

  let id = base;
  let suffix = 2;
  while (usedIds.has(id)) id = `${base}-${suffix++}`;
  usedIds.add(id);
  return id;
}

function addHeadingAttributesAndCollect(tokens) {
  const headings = [];
  const usedIds = new Set();

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    addSourceAttributes(token);
    if (token.type !== "heading_open") continue;

    const level = Number(String(token.tag || "h1").slice(1)) || 1;
    const inlineToken = tokens[index + 1]?.type === "inline" ? tokens[index + 1] : null;
    const text = headingPlainText(inlineToken).replace(/\s+/g, " ").trim();
    const id = slugifyHeading(text, usedIds, headings.length);
    token.attrSet("id", id);
    token.attrSet("data-md-heading-level", String(level));

    headings.push({
      id,
      level,
      text: text || id,
      startLine: token.map ? token.map[0] + 1 : 1,
      endLine: token.map ? token.map[1] : token.map?.[0] + 1 || 1,
    });
  }

  return headings;
}

function renderFence(md) {
  return (tokens, index) => {
    const token = tokens[index];
    const attrs = token.map
      ? ` data-md-start-line="${token.map[0] + 1}" data-md-end-line="${token.map[1]}"`
      : "";
    const info = token.info ? token.info.trim().split(/\s+/, 1)[0] : "";
    const language = info.toLowerCase();
    const canHighlight = language && language !== "mermaid" && highlightJs.getLanguage(language);
    const classes = [
      info ? `language-${md.utils.escapeHtml(info)}` : "",
      canHighlight ? "hljs" : "",
    ].filter(Boolean);
    const className = classes.length ? ` class="${classes.join(" ")}"` : "";
    const content = canHighlight
      ? highlightJs.highlight(token.content, {
          language,
          ignoreIllegals: true,
        }).value
      : md.utils.escapeHtml(token.content);
    return `<pre${attrs}><code${className}>${content}</code></pre>\n`;
  };
}

function maskFrontMatter(markdown) {
  const source = String(markdown || "");
  const lines = source.split("\n");
  const firstLine = String(lines[0] || "").replace(/^\uFEFF/, "");
  if (!/^\s*---\s*$/.test(firstLine)) return source;

  let closingIndex = -1;
  for (let index = 1; index < lines.length; index += 1) {
    if (/^\s*(?:---|\.\.\.)\s*$/.test(lines[index])) {
      closingIndex = index;
      break;
    }
  }
  if (closingIndex < 0) return source;

  const frontMatterLines = lines.slice(1, closingIndex);
  const hasYamlEntry = frontMatterLines.some((line) =>
    /^\s*[A-Za-z_][\w-]*\s*:/.test(line),
  );
  if (!hasYamlEntry) return source;

  // Keep one blank line for every metadata line so markdown-it source maps
  // continue to point at the original document lines.
  return lines
    .map((line, index) => (index <= closingIndex ? "" : line))
    .join("\n");
}

function renderMarkdownDocument(markdown, options = {}) {
  const md = new MarkdownIt({
    html: false,
    breaks: false,
    linkify: false,
    typographer: false,
  });

  md.renderer.rules.fence = renderFence(md);
  md.inline.ruler.before("html_inline", "safe_font_tags", parseSafeFontTag);
  md.inline.ruler.before("html_inline", "safe_image_tags", parseSafeImageTag);
  md.renderer.rules.font_open = (tokens, index) => {
    const color = tokens[index].attrGet("color");
    return color ? `<font color="${md.utils.escapeHtml(color)}">` : "<font>";
  };
  md.renderer.rules.font_close = () => "</font>";
  md.renderer.rules.safe_html_image = (tokens, index) => {
    const token = tokens[index];
    const attributes = ["src", "alt", "title", "width", "height", "style", "data-md-image-source", "data-md-image-index", "data-md-start-line", "data-md-end-line"]
      .map((name) => {
        const value = token.attrGet(name);
        return value === null ? "" : ` ${name}="${md.utils.escapeHtml(value)}"`;
      })
      .join("");
    return `<img${attributes} />`;
  };
  const env = {};
  const tokens = md.parse(maskFrontMatter(markdown), env);
  addImageSourceMetadata(tokens);
  if (typeof options.resolveImageSource === "function") {
    resolveImageTokens(tokens, options.resolveImageSource);
  }
  const headings = addHeadingAttributesAndCollect(tokens);
  return {
    html: md.renderer.render(tokens, md.options, env),
    headings,
  };
}

function renderMarkdownWithSourceMap(markdown) {
  return renderMarkdownDocument(markdown).html;
}

module.exports = { renderMarkdownDocument, renderMarkdownWithSourceMap };
