"use strict";

// Selection Context Bridge is intentionally dependency-free. Keep this file
// self-contained so it can be copied between vaults without a build step.

function withoutMarkdownExtension(path) {
  return String(path || "").replace(/\.md$/i, "");
}

function point(value) {
  return {
    line: Number.isFinite(value && value.line) ? value.line : 0,
    ch: Number.isFinite(value && value.ch) ? value.ch : 0,
  };
}

function rangeLabel(selection) {
  const from = point(selection.range && selection.range.from);
  const to = point(selection.range && selection.range.to);
  return `L${from.line + 1}:C${from.ch + 1}-L${to.line + 1}:C${to.ch + 1}`;
}

function marker(selection) {
  return `[[${selection.linktext}]] (${rangeLabel(selection)})`;
}

function selectionKey(selection) {
  return `${selection.path}\0${rangeLabel(selection)}\0${selection.text}`;
}

function createSelection(input) {
  const path = String(input && input.path || "");
  const text = String(input && input.text || "");
  const value = {
    path,
    linktext: String(input && input.linktext || withoutMarkdownExtension(path)),
    range: {
      from: point(input && input.from),
      to: point(input && input.to),
    },
    text,
  };
  value.marker = marker(value);
  value.key = selectionKey(value);
  return value;
}

function countWords(text) {
  const value = String(text || "").trim();
  return value ? value.split(/\s+/).length : 0;
}

function dshLine(selection, absolutePath) {
  const filePath = absolutePath || selection.path;
  return `[ BRIDGES is delivering packages for you…… · ${countWords(selection.text)} words · ${rangeLabel(selection)} · ${filePath} · ]`;
}

class SelectionBuffer {
  constructor() {
    this.items = [];
  }

  add(selection) {
    const item = selection && selection.key ? selection : createSelection(selection);
    if (!item.text.trim() || !item.path || this.items.some((candidate) => candidate.key === item.key)) return false;
    this.items.push(item);
    return true;
  }

  clear() {
    this.items = [];
  }

  size() {
    return this.items.length;
  }

  list() {
    return this.items.slice();
  }

  codexDraft() {
    return this.items.map((item) => `${item.marker}\n\n`).join("");
  }

  dshDraft(absolutePathFor) {
    return this.items.map((item) => {
      const location = typeof absolutePathFor === "function" ? absolutePathFor(item.path) : item.path;
      return `${dshLine(item, location)}\n${item.text.trim()}\n`;
    }).join("\n");
  }
}

function resolveTargets(target) {
  if (target === "dsh") return ["dsh"];
  if (target === "both") return ["codex", "dsh"];
  return ["codex"];
}

function getBackend(plugin, id) {
  try {
    return plugin.app.plugins.getPlugin(id) || null;
  } catch (error) {
    return null;
  }
}

function getNotice(plugin, message) {
  try {
    return new plugin.obsidian.Notice(message, 6000);
  } catch (error) {
    return null;
  }
}

class SelectionContextBridge extends (typeof require === "function" ? require("obsidian").Plugin : class {}) {
  constructor(app, manifest) {
    super(app, manifest);
    this.buffer = new SelectionBuffer();
    this.settings = { target: "codex" };
    this.obsidian = typeof require === "function" ? require("obsidian") : {};
    this.api = {
      addSelection: (selection) => this.buffer.add(selection),
      clear: () => this.buffer.clear(),
      list: () => this.buffer.list(),
      send: (target) => this.sendToTargets(target || this.settings.target),
    };
  }

  async onload() {
    await this.loadSettings();
    this.registerEditorMenu();
    this.addCommand({
      id: "send-buffer",
      name: "发送已收集选区",
      callback: () => void this.sendToTargets(this.settings.target),
    });
    this.addCommand({
      id: "clear-buffer",
      name: "清空已收集选区",
      callback: () => {
        this.buffer.clear();
        this.notice("已清空选区缓存。");
      },
    });
    this.addSettingTab(new SelectionContextSettingTab(this.app, this));
  }

  async loadSettings() {
    const saved = await this.loadData();
    if (saved && ["codex", "dsh", "both"].includes(saved.target)) this.settings.target = saved.target;
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  notice(message) {
    return new this.obsidian.Notice(message, 6000);
  }

  registerEditorMenu() {
    this.registerEvent(this.app.workspace.on("editor-menu", (menu, editor, view) => {
      if (!view || !view.file || !editor || !String(editor.getSelection && editor.getSelection() || "").trim()) return;
      const add = (title, icon, target) => {
        menu.addItem((item) => item
          .setTitle(title)
          .setIcon(icon)
          .onClick(() => void this.collectAndSend(editor, view, target)));
      };
      add("选区桥接：添加到 Codex 聊天", "bot-message-square", "codex");
      add("选区桥接：添加到 DSH 聊天", "send", "dsh");
      add("选区桥接：添加到 Codex + DSH", "split", "both");
      menu.addItem((item) => item
        .setTitle(`选区桥接：清空缓存（${this.buffer.size()}）`)
        .setIcon("trash-2")
        .onClick(() => {
          this.buffer.clear();
          this.notice("已清空选区缓存。");
        }));
    }));
  }

  collect(editor, view) {
    const text = String(editor.getSelection && editor.getSelection() || "");
    if (!text.trim() || !view || !view.file) return null;
    const from = editor.getCursor ? editor.getCursor("from") : { line: 0, ch: 0 };
    const to = editor.getCursor ? editor.getCursor("to") : from;
    return createSelection({ path: view.file.path, from, to, text });
  }

  async collectAndSend(editor, view, target) {
    const selection = this.collect(editor, view);
    if (!selection) {
      this.notice("请先选择笔记中的文字。");
      return;
    }
    const added = this.buffer.add(selection);
    if (!added) {
      this.notice("该选区已在缓存中。");
      return;
    }
    await this.sendToTargets(target);
  }

  async sendToTargets(target) {
    if (this.buffer.size() === 0) {
      this.notice("还没有收集选区。请在笔记中选择文字后右键添加。");
      return;
    }
    const results = [];
    for (const backend of resolveTargets(target)) {
      try {
        if (backend === "codex") {
          await this.sendToCodex();
        } else {
          await this.sendToDsh();
        }
        results.push(backend);
      } catch (error) {
        this.notice(`${backend === "codex" ? "Codex" : "DSH"} 发送失败：${error instanceof Error ? error.message : String(error)}`);
      }
    }
    if (results.length > 0) {
      this.notice(`已发送 ${this.buffer.size()} 个选区到 ${results.map((item) => item === "codex" ? "Codex" : "DSH").join("、")}。`);
    }
  }

  async sendToCodex() {
    const host = getBackend(this, "codex-panel");
    if (host && host.api && host.api.selectionContext && typeof host.api.selectionContext.addSelections === "function") {
      await host.api.selectionContext.addSelections(this.buffer.list());
      return;
    }
    const runtime = host && host.runtime;
    if (!runtime) throw new Error("未检测到 Codex Panel，请先启用它。");
    if (typeof runtime.activatePanel === "function") await runtime.activatePanel();
    const panels = typeof runtime.chatRuntimeViews === "function" ? runtime.chatRuntimeViews() : [];
    const panel = Array.isArray(panels) ? panels[panels.length - 1] : null;
    const controller = panel && panel.session && panel.session.runtime && panel.session.runtime.composer && panel.session.runtime.composer.controller;
    if (!controller || typeof controller.setDraft !== "function") throw new Error("Codex 聊天面板尚未准备好。");
    const items = this.buffer.list();
    const snapshots = typeof controller.selectionSnapshots === "function" ? controller.selectionSnapshots() : [];
    const existing = new Set(snapshots.map((item) => marker(item)));
    for (const item of items) {
      if (existing.has(item.marker)) continue;
      if (typeof controller.rememberSelectionContextSnapshot === "function") {
        controller.rememberSelectionContextSnapshot({
          path: item.path,
          linktext: item.linktext,
          range: item.range,
          text: item.text,
        });
      }
      existing.add(item.marker);
    }
    const draft = String(controller.draft || "");
    const markers = items.map((item) => item.marker).filter((item) => !draft.includes(item));
    const next = markers.length === 0 ? draft : `${draft.trimEnd()}${draft.trim() ? "\n\n" : ""}${markers.join("\n\n")}\n\n`;
    controller.setDraft(next, { focus: true, preserveContext: true });
  }

  absolutePath(vaultPath) {
    try {
      const base = this.app.vault.adapter.getBasePath && this.app.vault.adapter.getBasePath();
      if (base) return `${String(base).replace(/[\\/]$/, "")}/${vaultPath}`;
    } catch (error) {
      // Fall back to the vault-relative path; DSH can still display it.
    }
    return vaultPath;
  }

  async sendToDsh() {
    const host = getBackend(this, "dsh-harness");
    if (!host) throw new Error("未检测到 DSH Harness，请先启用它。");
    if (host.api && host.api.selectionContext && typeof host.api.selectionContext.sendSelections === "function") {
      await host.api.selectionContext.sendSelections(this.buffer.list());
      return;
    }
    const draft = this.buffer.dshDraft((path) => this.absolutePath(path));
    let frame = typeof host.hotReadyFrame === "function" ? host.hotReadyFrame() : null;
    if (!frame && typeof host.openView === "function") {
      await host.openView();
      frame = typeof host.currentFrame === "function" ? host.currentFrame() : null;
    }
    if (!frame) throw new Error("DSH 聊天面板尚未准备好。");
    if (typeof host.ensureBridgeReady === "function" && !(await host.ensureBridgeReady(frame))) {
      throw new Error("DSH 桥接尚未就绪，请稍候重试。");
    }
    if (typeof host.fillDraftAndNotify !== "function") throw new Error("当前 DSH 版本不支持填充聊天草稿。");
    await host.fillDraftAndNotify(frame, draft);
  }
}

class SelectionContextSettingTab extends (typeof require === "function" ? require("obsidian").PluginSettingTab : class {}) {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();
    new this.plugin.obsidian.Setting(containerEl)
      .setName("默认发送目标")
      .setDesc("右键菜单仍可单独选择目标；此设置用于命令面板中的“发送已收集选区”。")
      .addDropdown((dropdown) => dropdown
        .addOption("codex", "Codex Panel")
        .addOption("dsh", "DSH")
        .addOption("both", "Codex + DSH")
        .setValue(this.plugin.settings.target)
        .onChange(async (value) => {
          this.plugin.settings.target = value;
          await this.plugin.saveSettings();
        }));
    new this.plugin.obsidian.Setting(containerEl)
      .setName("当前缓存")
      .setDesc(`${this.plugin.buffer.size()} 个选区。右键“清空缓存”或使用命令面板清空。`)
      .addButton((button) => button.setButtonText("清空").onClick(() => {
        this.plugin.buffer.clear();
        this.display();
      }));
  }
}

// Pure API used by the local regression tests. It is harmless in Obsidian and
// makes the core behavior testable without booting the application.
var SelectionContextBridgeTestAPI = {
  createSelection,
  SelectionBuffer: () => new SelectionBuffer(),
  resolveTargets,
};

if (typeof module !== "undefined" && module && module.exports) module.exports = SelectionContextBridge;
