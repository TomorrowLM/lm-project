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
  if (!selection || !selection.range) return "";
  const from = point(selection.range && selection.range.from);
  const to = point(selection.range && selection.range.to);
  return `L${from.line + 1}:C${from.ch + 1}-L${to.line + 1}:C${to.ch + 1}`;
}

function marker(selection) {
  const range = rangeLabel(selection);
  return range ? `[[${selection.linktext}]] (${range})` : `[[${selection.linktext}]]`;
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
    range: input && (input.from || input.to)
      ? { from: point(input && input.from), to: point(input && input.to) }
      : null,
    text,
  };
  value.marker = marker(value);
  value.key = selectionKey(value);
  return value;
}

function findMarkdownSection(markdown, cursorLine) {
  const lines = String(markdown || "").split(/\r?\n/);
  if (lines.length === 0) return null;
  const lineNumber = Math.max(0, Math.min(Number(cursorLine) || 0, lines.length - 1));
  const headings = [];
  let fence = null;

  for (let line = 0; line < lines.length; line += 1) {
    const value = lines[line];
    const fenceMatch = /^\s{0,3}(`{3,}|~{3,})/.exec(value);
    if (fenceMatch) {
      const markerValue = fenceMatch[1];
      const markerChar = markerValue[0];
      if (!fence) {
        fence = { char: markerChar, length: markerValue.length };
      } else if (fence.char === markerChar && markerValue.length >= fence.length) {
        fence = null;
      }
      continue;
    }
    if (fence) continue;

    const heading = /^\s{0,3}(#{1,6})(?:\s+|$)/.exec(value);
    if (heading) headings.push({ line, level: heading[1].length, heading: value.trim() });
  }

  let current = null;
  for (const heading of headings) {
    if (heading.line > lineNumber) break;
    current = heading;
  }
  if (!current) return null;

  let end = lines.length;
  for (const heading of headings) {
    if (heading.line > current.line && heading.level <= current.level) {
      end = heading.line;
      break;
    }
  }

  return {
    from: { line: current.line, ch: 0 },
    to: end < lines.length
      ? { line: end, ch: 0 }
      : { line: lines.length - 1, ch: lines[lines.length - 1].length },
    heading: current.heading,
  };
}

function codexRangeDraft(selection) {
  if (!selection) return "";
  return `${selection.marker}${selection.range ? "" : `\n${selection.text.trim()}`}\n\n`;
}

function dshDraft(selection, absolutePathFor) {
  if (!selection) return "";
  if (!selection.range) return `${selection.text.trim()}\n`;
  const location = typeof absolutePathFor === "function" ? absolutePathFor(selection.path) : selection.path;
  return `${dshLine(selection, location)}\n${selection.text.trim()}\n`;
}

function countWords(text) {
  const value = String(text || "").trim();
  return value ? value.split(/\s+/).length : 0;
}

function dshLine(selection, absolutePath) {
  const filePath = absolutePath || selection.path;
  return `[ BRIDGES is delivering packages for you…… · ${countWords(selection.text)} words · ${rangeLabel(selection)} · ${filePath} · ]`;
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
    this.settings = { target: "codex" };
    this.obsidian = typeof require === "function" ? require("obsidian") : {};
    this.api = {
      send: (selection, target) => selection
        ? this.sendToTargets(selection, target || this.settings.target)
        : this.sendCurrentSelection(target || this.settings.target),
      sendCurrentSection: () => this.sendCurrentSectionFromActiveView(),
    };
  }

  async onload() {
    await this.loadSettings();
    this.registerEditorMenu();
    this.addCommand({
      id: "send-current-selection",
      name: "发送当前选区",
      callback: () => void this.sendCurrentSelection(this.settings.target),
    });
    this.addCommand({
      id: "send-current-section",
      name: "发送当前章节到 Codex",
      callback: () => void this.sendCurrentSectionFromActiveView(),
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

  addBridgeMenuItems(menu, selectionFactory, sectionFactory) {
    const add = (title, icon, target) => {
      menu.addItem((item) => item
        .setTitle(title)
        .setIcon(icon)
        .onClick(() => {
          const selection = selectionFactory();
          if (selection) void this.sendToTargets(selection, target);
          else this.notice("请先选择笔记中的文字。");
        }));
    };
    if (selectionFactory) {
      add("选区桥接：发送当前选区到 Codex", "bot-message-square", "codex");
      add("选区桥接：发送当前选区到 DSH", "send", "dsh");
      add("选区桥接：发送当前选区到 Codex + DSH", "split", "both");
    }
    if (sectionFactory) {
      menu.addItem((item) => item
        .setTitle("选区桥接：发送当前章节到 Codex")
        .setIcon("heading")
        .onClick(() => void this.sendCurrentSection(sectionFactory())));
    }
  }

  registerEditorMenu() {
    this.registerEvent(this.app.workspace.on("editor-menu", (menu, editor, view) => {
      if (!view || !view.file || !editor) return;
      const hasSelection = Boolean(String(editor.getSelection && editor.getSelection() || "").trim());
      this.addBridgeMenuItems(
        menu,
        hasSelection ? () => this.collect(editor, view) : null,
        () => this.collectCurrentSection(editor, view),
      );
    }));
    this.registerPreviewMenu();
  }

  registerPreviewMenu() {
    this.registerDomEvent(document, "contextmenu", (event) => {
      const viewType = this.obsidian.MarkdownView;
      const view = viewType && this.app.workspace.getActiveViewOfType(viewType);
      if (!view || !view.file || typeof view.getMode !== "function" || view.getMode() !== "preview") return;
      if (!view.containerEl || !view.containerEl.contains(event.target)) return;
      const text = String(window.getSelection && window.getSelection().toString() || "").trim();
      if (!text) return;
      event.preventDefault();
      const selection = this.collectPreview(view, text);
      const menu = new this.obsidian.Menu();
      this.addBridgeMenuItems(menu, () => selection, null);
      menu.showAtMouseEvent(event);
    });
  }

  collect(editor, view) {
    const text = String(editor.getSelection && editor.getSelection() || "");
    if (!text.trim() || !view || !view.file) return null;
    const from = editor.getCursor ? editor.getCursor("from") : { line: 0, ch: 0 };
    const to = editor.getCursor ? editor.getCursor("to") : from;
    return createSelection({ path: view.file.path, from, to, text });
  }

  collectPreview(view, text) {
    return createSelection({ path: view.file.path, text });
  }

  activeMarkdownView() {
    const viewType = this.obsidian.MarkdownView;
    return viewType && this.app.workspace.getActiveViewOfType(viewType);
  }

  async sendCurrentSelection(target) {
    const view = this.activeMarkdownView();
    const selection = view && view.editor ? this.collect(view.editor, view) : null;
    if (!selection) {
      this.notice("请先选择笔记中的文字。");
      return;
    }
    await this.sendToTargets(selection, target);
  }

  async collectCurrentSection(editor, view) {
    if (!editor || !view || !view.file || !this.app.vault || typeof this.app.vault.read !== "function") return null;
    const cursor = editor.getCursor ? editor.getCursor("from") : { line: 0, ch: 0 };
    const content = await this.app.vault.read(view.file);
    const range = findMarkdownSection(content, cursor.line);
    if (!range) return null;
    const lines = String(content || "").split(/\r?\n/);
    const endLine = range.to.line < lines.length && range.to.ch === 0 ? range.to.line : lines.length;
    const text = lines.slice(range.from.line, endLine).join("\n");
    return createSelection({ path: view.file.path, from: range.from, to: range.to, text });
  }

  async sendCurrentSection(sectionPromise) {
    const selection = await Promise.resolve(sectionPromise);
    if (!selection) {
      this.notice("当前光标所在位置没有 Markdown 章节标题。");
      return;
    }
    await this.sendToTargets(selection, "codex");
  }

  async sendCurrentSectionFromActiveView() {
    const view = this.activeMarkdownView();
    const selection = view && view.editor ? await this.collectCurrentSection(view.editor, view) : null;
    await this.sendCurrentSection(selection);
  }

  async collectAndSend(editor, view, target) {
    const selection = this.collect(editor, view);
    if (!selection) {
      this.notice("请先选择笔记中的文字。");
      return;
    }
    await this.sendToTargets(selection, target);
  }

  async sendToTargets(selection, target) {
    if (!selection || !selection.text.trim() || !selection.path) {
      this.notice("没有可发送的选区。");
      return;
    }
    const results = [];
    for (const backend of resolveTargets(target)) {
      try {
        if (backend === "codex") {
          await this.sendToCodex(selection);
        } else {
          await this.sendToDsh(selection);
        }
        results.push(backend);
      } catch (error) {
        this.notice(`${backend === "codex" ? "Codex" : "DSH"} 发送失败：${error instanceof Error ? error.message : String(error)}`);
      }
    }
    if (results.length > 0) {
      this.notice(`已发送当前${selection.range ? "范围" : "选区"}到 ${results.map((item) => item === "codex" ? "Codex" : "DSH").join("、")}。`);
    }
  }

  async sendToCodex(selection) {
    const host = getBackend(this, "codex-panel");
    if (host && host.api && host.api.selectionContext && typeof host.api.selectionContext.addSelections === "function") {
      await host.api.selectionContext.addSelections([selection]);
      return;
    }
    const runtime = host && host.runtime;
    if (!runtime) throw new Error("未检测到 Codex Panel，请先启用它。");
    if (typeof runtime.activatePanel === "function") await runtime.activatePanel();
    const panels = typeof runtime.chatRuntimeViews === "function" ? runtime.chatRuntimeViews() : [];
    const panel = Array.isArray(panels) ? panels[panels.length - 1] : null;
    const controller = panel && panel.session && panel.session.runtime && panel.session.runtime.composer && panel.session.runtime.composer.controller;
    if (!controller || typeof controller.setDraft !== "function") throw new Error("Codex 聊天面板尚未准备好。");
    const draft = String(controller.draft || "");
    const entry = codexRangeDraft(selection).trimEnd();
    const next = draft.includes(entry) ? draft : `${draft.trimEnd()}${draft.trim() ? "\n\n" : ""}${entry}\n\n`;
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

  async sendToDsh(selection) {
    const host = getBackend(this, "dsh-harness");
    if (!host) throw new Error("未检测到 DSH Harness，请先启用它。");
    if (host.api && host.api.selectionContext && typeof host.api.selectionContext.sendSelections === "function") {
      await host.api.selectionContext.sendSelections([selection]);
      return;
    }
    const draft = dshDraft(selection, (path) => this.absolutePath(path));
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
      .setDesc("右键菜单仍可单独选择目标；此设置用于命令面板中的“发送当前选区”。")
      .addDropdown((dropdown) => dropdown
        .addOption("codex", "Codex Panel")
        .addOption("dsh", "DSH")
        .addOption("both", "Codex + DSH")
        .setValue(this.plugin.settings.target)
        .onChange(async (value) => {
          this.plugin.settings.target = value;
          await this.plugin.saveSettings();
        }));
  }
}

// Pure API used by the local regression tests. It is harmless in Obsidian and
// makes the core behavior testable without booting the application.
var SelectionContextBridgeTestAPI = {
  createSelection,
  codexRangeDraft,
  findMarkdownSection,
  resolveTargets,
};

if (typeof module !== "undefined" && module && module.exports) module.exports = SelectionContextBridge;
