const assert = require("node:assert/strict");
const path = require("node:path");
const vscode = require("vscode");
const manifest = require("../package.json");

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function run() {
  const extension = vscode.extensions.getExtension(`${manifest.publisher}.${manifest.name}`);
  assert.ok(extension, "the development extension must be discoverable");
  await extension.activate();

  const readmePath = path.resolve(__dirname, "..", "README.md");
  const document = await vscode.workspace.openTextDocument(readmePath);
  const editor = await vscode.window.showTextDocument(
    document,
    vscode.ViewColumn.One,
  );

  assert.equal(document.languageId, "markdown");
  await vscode.commands.executeCommand("lmMd.openPreview");
  await delay(500);

  const tabs = vscode.window.tabGroups.all.flatMap((group) =>
    group.tabs.map((tab) => ({ label: tab.label, isActive: tab.isActive })),
  );
  console.log("LM_MD_INTEGRATION_TABS " + JSON.stringify(tabs));
  assert.ok(
    tabs.some((tab) => tab.label.startsWith("Preview: ")),
    "openPreview must create the Markdown preview tab",
  );

  editor.selection = new vscode.Selection(0, 0, 0, 5);
  await vscode.commands.executeCommand("lmMd.openCopilotForSelection");
  console.log("LM_MD_INTEGRATION_COMMANDS ok");
}

module.exports = { run };
