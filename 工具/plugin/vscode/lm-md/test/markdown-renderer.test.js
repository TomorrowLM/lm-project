const test = require("node:test");
const assert = require("node:assert/strict");
const {
  renderMarkdownDocument,
  renderMarkdownWithSourceMap,
} = require("../src/markdown-renderer");

test("renders Markdown blocks with source line metadata", () => {
  const html = renderMarkdownWithSourceMap(
    "# 标题\n\n正文第一行\n正文第二行\n\n```js\nconst x = 1;\n```",
  );

  assert.match(html, /<h1[^>]*data-md-start-line="1"[^>]*data-md-end-line="1"/);
  assert.match(html, /<p[^>]*data-md-start-line="3"[^>]*data-md-end-line="4"/);
  assert.match(html, /<pre[^>]*data-md-start-line="6"[^>]*data-md-end-line="8"/);
  assert.doesNotMatch(html, /<script>alert/);
});

test("keeps Mermaid fences identifiable and mapped to their Markdown source lines", () => {
  const html = renderMarkdownWithSourceMap("# Flow\n\n```mermaid\nflowchart LR\n  A --> B\n```");

  assert.match(html, /<pre data-md-start-line="3" data-md-end-line="6"><code class="language-mermaid">flowchart LR/);
});

test("adds stable heading ids for the preview directory", () => {
  const html = renderMarkdownWithSourceMap("# 需求概述\n\n## 需求概述\n");

  assert.match(html, /<h1[^>]*id="需求概述"/);
  assert.match(html, /<h2[^>]*id="需求概述-2"/);
});

test("hides YAML front matter without shifting source line metadata", () => {
  const html = renderMarkdownWithSourceMap(
    "---\nname: writing-skills\ndescription: >-\n  hidden metadata\n---\n\n# 正文标题\n\n正文内容",
  );

  assert.doesNotMatch(html, /writing-skills|hidden metadata/);
  assert.match(html, /<h1[^>]*data-md-start-line="7"[^>]*>正文标题<\/h1>/);
  assert.match(html, /<p[^>]*data-md-start-line="9"[^>]*>正文内容<\/p>/);
});

test("renders safe legacy font tags while keeping raw HTML disabled", () => {
  const html = renderMarkdownWithSourceMap(
    '- **生产部署：** <font style="color:rgb(28, 30, 33);">使用 LangSmith</font>\n- <font color="#c00">部署使用</font>',
  );

  assert.match(html, /<font color="rgb\(28, 30, 33\)">使用 LangSmith<\/font>/);
  assert.match(html, /<font color="#c00">部署使用<\/font>/);
  assert.doesNotMatch(html, /style="color:/);

  const unsafe = renderMarkdownWithSourceMap(
    '<font style="color:red; background:url(javascript:alert(1))">安全文本</font><script>alert(1)</script>',
  );
  assert.match(unsafe, /<font color="red">安全文本<\/font>/);
  assert.doesNotMatch(unsafe, /<script>alert/);
});

test("custom HTML tokens advance correctly during Markdown link label validation", () => {
  const rendered = renderMarkdownWithSourceMap(
    '[<font style="color:rgb(28, 30, 33);">LangSmith</font>](https://example.com)\n\n' +
      '[<img src="https://example.com/diagram.svg" alt="架构图" />](https://example.com)',
  );

  assert.match(rendered, /<a href="https:\/\/example\.com"><font color="rgb\(28, 30, 33\)">LangSmith<\/font><\/a>/);
  assert.match(rendered, /<a href="https:\/\/example\.com"><img src="https:\/\/example\.com\/diagram\.svg" alt="架构图" \/><\/a>/);
});

test("resolves Markdown image sources before rendering", () => {
  const rendered = renderMarkdownDocument(
    "![流程图](./images/flow%20chart.png)",
    { resolveImageSource: (source) => `webview:${source}` },
  );

  assert.match(rendered.html, /<img src="webview:\.\/images\/flow%20chart\.png"/);
});

test("renders safe legacy HTML images and rejects unsafe attributes and schemes", () => {
  const rendered = renderMarkdownDocument(
    '- <img src="../assets/diagram.png" alt="架构图" style="zoom: 33%;" onerror="alert(1)" />',
    { resolveImageSource: (source) => `webview:${source}` },
  );

  assert.match(rendered.html, /<img src="webview:\.\.\/assets\/diagram\.png"/);
  assert.match(rendered.html, /alt="架构图"/);
  assert.match(rendered.html, /style="zoom:33%;"/);
  assert.doesNotMatch(rendered.html, /onerror|alert\(1\)/);

  const unsafe = renderMarkdownWithSourceMap('<img src="javascript:alert(1)" onerror="alert(1)">');
  assert.doesNotMatch(unsafe, /<img[^>]*onerror/i);
  assert.match(unsafe, /&lt;img/);
});
