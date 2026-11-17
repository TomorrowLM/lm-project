"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const sourcePath = "D:/LM/lm-project/脚本/plugin/selection-context-bridge/main.js";
const source = fs.readFileSync(sourcePath, "utf8");
const obsidian = {
  Menu: class {},
  Notice: class {},
  Plugin: class {},
  PluginSettingTab: class {},
};
const sandbox = {
  clearTimeout,
  console,
  exports: {},
  module: { exports: {} },
  require: (id) => id === "obsidian" ? obsidian : require(id),
  setTimeout,
};

vm.runInNewContext(source, sandbox, { filename: sourcePath });
const api = sandbox.SelectionContextBridgeTestAPI;

assert.ok(api, "pure test API should be available");
assert.equal(api.SelectionBuffer, undefined, "the plugin should not expose a selection cache");

const markdown = [
  "# Python",
  "## 垃圾回收机制",
  "正文第一行",
  "### 子章节",
  "子章节正文",
  "```md",
  "## 代码中的标题",
  "```",
  "## 下一个章节",
].join("\n");

assert.equal(
  JSON.stringify(api.findMarkdownSection(markdown, 2)),
  JSON.stringify({
    from: { line: 1, ch: 0 },
    to: { line: 8, ch: 0 },
    heading: "## 垃圾回收机制",
  }),
  "the current section should end at the next same-level heading, ignoring fenced code",
);

const selection = api.createSelection({
  path: "agent/agent.md",
  from: { line: 1, ch: 0 },
  to: { line: 8, ch: 0 },
  text: "## 垃圾回收机制\n正文第一行",
});
assert.equal(
  api.codexRangeDraft(selection).trimEnd(),
  "[[agent/agent]] (L2:C1-L9:C1)",
  "Codex fallback draft should contain only the range marker, not chapter text",
);

console.log("selection-context-bridge tests passed");
