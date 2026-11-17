const { normalizeSourceRanges } = require("./selection-range");

const DSH_SEND_PLUGIN_REQUEST_COMMAND = "dshPanel.sendPluginRequest";
const DSH_BRIDGE_PLUGIN_ID = "dsh-vscode-bridge";

async function syncSelectionToDsh(vscode, uri, selection) {
  const document = await vscode.workspace.openTextDocument(uri);
  const ranges = normalizeSourceRanges(selection?.ranges || [{
    startLine: selection?.startLine,
    endLine: selection?.endLine,
  }]).map((range) => ({
    startLine: Math.max(1, Math.min(document.lineCount, range.startLine)),
    endLine: Math.max(1, Math.min(document.lineCount, range.endLine)),
  })).filter((range) => range.endLine >= range.startLine);

  if (ranges.length === 0) {
    throw new Error("没有可同步的 Markdown 行范围。");
  }
  if (!uri.fsPath) {
    throw new Error("请先保存 Markdown 文件，再同步到 DSH。");
  }

  const commands = await vscode.commands.getCommands(true);
  if (!commands.includes(DSH_SEND_PLUGIN_REQUEST_COMMAND)) {
    throw new Error("未检测到支持 DSH 插件桥接的 DeepSeek Harness 扩展，请先更新并启用该扩展。");
  }

  const references = ranges.map(({ startLine, endLine }) => ({
    filePath: uri.fsPath,
    startLine,
    endLine,
    language: document.languageId,
  }));

  const result = await vscode.commands.executeCommand(DSH_SEND_PLUGIN_REQUEST_COMMAND, {
    pluginId: DSH_BRIDGE_PLUGIN_ID,
    method: "insertReferences",
    payload: { references },
  });
  if (!result || result.inserted !== references.length) {
    throw new Error("DSH 未能确认所有引用已插入，请检查当前可见的 DSH 面板。");
  }
  return result;
}

module.exports = { DSH_SEND_PLUGIN_REQUEST_COMMAND, syncSelectionToDsh };
