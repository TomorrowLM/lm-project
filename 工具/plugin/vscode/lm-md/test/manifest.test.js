const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const manifest = JSON.parse(
  fs.readFileSync(path.join(root, "package.json"), "utf8"),
);

test("uses the publisher ID that owns the Marketplace listing", () => {
  assert.equal(manifest.publisher, "lmtomorrow");
});

test("declares a bundled extension icon", () => {
  assert.equal(manifest.icon, "images/icon-1024.png");
  assert.ok(fs.existsSync(path.join(root, manifest.icon)));
});

test("bundled extension icon stays within Marketplace dimensions", () => {
  const icon = fs.readFileSync(path.join(root, manifest.icon));
  assert.equal(icon.toString("ascii", 1, 4), "PNG");
  assert.ok(icon.readUInt32BE(16) <= 1024, "icon width must be at most 1024 pixels");
  assert.ok(icon.readUInt32BE(20) <= 1024, "icon height must be at most 1024 pixels");
});

test("extension manifest declares the Markdown preview command", () => {
  const commands = manifest.contributes.commands.map((item) => item.command);
  assert.ok(commands.includes("lmMd.openPreview"));
});

test("extension manifest declares the Copilot selection command", () => {
  const commands = manifest.contributes.commands.map((item) => item.command);
  assert.ok(commands.includes("lmMd.openCopilotForSelection"));
});

test("extension manifest declares the preview location fallback command", () => {
  const commands = manifest.contributes.commands.map((item) => item.command);
  assert.ok(commands.includes("lmMd.revealPreviewLocation"));
  assert.ok(manifest.activationEvents.includes("onCommand:lmMd.revealPreviewLocation"));
  const contextItems = manifest.contributes.menus["editor/context"];
  const menuItem = contextItems.find((item) => item.command === "lmMd.revealPreviewLocation");
  assert.ok(menuItem);
  assert.equal(menuItem.when, "editorLangId == markdown");
});

test("binds Ctrl+F to toolbar visibility while a preview webview has focus", () => {
  const commands = manifest.contributes.commands.map((item) => item.command);
  const binding = manifest.contributes.keybindings.find(
    (item) => item.command === "lmMd.togglePreviewToolbar",
  );
  assert.ok(commands.includes("lmMd.togglePreviewToolbar"));
  assert.deepEqual(binding, {
    command: "lmMd.togglePreviewToolbar",
    key: "ctrl+f",
    when: "webviewFocus",
  });
});

test("Copilot command is visible only for Markdown selections", () => {
  const items = manifest.contributes.menus["editor/context"];
  const item = items.find(
    (entry) => entry.command === "lmMd.openCopilotForSelection",
  );
  assert.equal(item.when, "editorLangId == markdown && editorHasSelection");
});

test("Copilot sync command is available in the Markdown editor context menu", () => {
  const items = manifest.contributes.menus["editor/context"];
  const item = items.find(
    (entry) => entry.command === "lmMd.openCopilotForSelection",
  );
  assert.ok(item);
  assert.match(item.when, /editorLangId == markdown/);
  assert.match(item.when, /editorHasSelection/);
});

test("Markdown custom editor is the default editor for .md files", () => {
  const editor = manifest.contributes.customEditors.find(
    (item) => item.viewType === "lmMd.previewEditor",
  );
  assert.ok(editor);
  assert.equal(editor.priority, "default");
  assert.deepEqual(editor.selector, [{ filenamePattern: "*.md" }]);
  assert.equal(
    manifest.contributes.configurationDefaults["workbench.editorAssociations"]["*.md"],
    "lmMd.previewEditor",
  );
});
