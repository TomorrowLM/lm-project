const { normalizeSourceRanges } = require("./selection-range");

function toEditorRange(range, lines) {
  const values = Array.isArray(lines) && lines.length > 0 ? lines : [""];
  const lastLine = values.length - 1;
  const requestedStart = Number.isInteger(range && range.startLine)
    ? range.startLine - 1
    : 0;
  const requestedEnd = Number.isInteger(range && range.endLine)
    ? range.endLine - 1
    : requestedStart;
  const startLine = Math.min(lastLine, Math.max(0, requestedStart));
  const endLine = Math.min(lastLine, Math.max(startLine, requestedEnd));

  return {
    start: { line: startLine, character: 0 },
    end: {
      line: endLine,
      character: String(values[endLine] || "").length,
    },
  };
}

function createRangeAttachmentUri(uri, range) {
  if (typeof uri?.with !== "function") {
    throw new Error("当前 VS Code 无法为多个引用范围生成独立附件");
  }
  const queryParts = String(uri.query || "")
    .split("&")
    .filter((part) => part && !/^lmMdRange=/u.test(part));
  queryParts.push(`lmMdRange=${range.startLine}-${range.endLine}`);
  return uri.with({ query: queryParts.join("&") });
}

async function syncSelectionToCopilot(vscode, uri, range) {
  const document = await vscode.workspace.openTextDocument(uri);
  const lines = document.getText().split(/\r?\n/);
  const inputRanges = Array.isArray(range)
    ? range
    : Array.isArray(range?.ranges)
      ? range.ranges
      : [range];
  const requestedRanges = normalizeSourceRanges(inputRanges);
  if (requestedRanges.length === 0) {
    throw new Error("没有可同步的有效行范围");
  }
  const boundedRanges = normalizeSourceRanges(
    requestedRanges.map((requestedRange) => {
      const editorRange = toEditorRange(requestedRange, lines);
      return {
        startLine: editorRange.start.line + 1,
        endLine: editorRange.end.line + 1,
      };
    }),
  );
  // VS Code 1.141.2's native Chat command crosses the extension-host
  // boundary as a plain object. It validates attachment ranges using the
  // internal IRange shape (one-based line/column fields), not the extension
  // API Selection shape (zero-based start/end Positions). The Chat attachment
  // model derives its identity from uri + range.toString(); ranges cross the
  // extension boundary as plain objects, so same-file ranges collide unless
  // each URI has a unique query marker. fsPath remains the original file and
  // the native range still carries the exact line numbers.
  const attachFiles = boundedRanges.map((sourceRange) => {
    const editorRange = toEditorRange(sourceRange, lines);
    const attachmentRange = {
      startLineNumber: editorRange.start.line + 1,
      startColumn: editorRange.start.character + 1,
      endLineNumber: editorRange.end.line + 1,
      endColumn: editorRange.end.character + 1,
    };
    return {
      // Give each line range its own native Chat attachment identity. Without
      // this marker, repeated single-range syncs from one file share the same
      // URI and VS Code can deduplicate the later citation.
      uri: createRangeAttachmentUri(uri, sourceRange),
      range: attachmentRange,
    };
  });
  const commands = await vscode.commands.getCommands(true);
  const openCommand = [
    "workbench.action.chat.open",
    "workbench.action.chat.openInSidebar",
  ].find((command) => commands.includes(command));
  if (!openCommand) {
    throw new Error("当前 VS Code 没有可用的原生 Chat 命令");
  }

  const focusCommand = [
    "workbench.action.chat.focusInput",
    "chat.action.focus",
  ].find((command) => commands.includes(command));
  const copilotFocusCommand = commands.includes(
    "workbench.panel.chat.view.copilot.focus",
  )
    ? "workbench.panel.chat.view.copilot.focus"
    : undefined;
  const auxiliaryFocusCommand = commands.includes(
    "workbench.action.focusAuxiliaryBar",
  )
    ? "workbench.action.focusAuxiliaryBar"
    : undefined;
  const attachArguments = {
    // Attach only the current selection. Repeated syncs must not reset the
    // Copilot composer, so the native chat can retain earlier references.
    attachFiles,
  };
  if (auxiliaryFocusCommand) {
    await vscode.commands.executeCommand(auxiliaryFocusCommand);
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  if (copilotFocusCommand) {
    await vscode.commands.executeCommand(copilotFocusCommand);
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  if (focusCommand) {
    await vscode.commands.executeCommand(focusCommand);
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  if (copilotFocusCommand) {
    await vscode.commands.executeCommand(copilotFocusCommand);
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  if (auxiliaryFocusCommand) {
    await vscode.commands.executeCommand(auxiliaryFocusCommand);
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  if (focusCommand) {
    await vscode.commands.executeCommand(focusCommand);
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  await vscode.commands.executeCommand(openCommand, attachArguments);

  if (focusCommand) {
    await vscode.commands.executeCommand(focusCommand);
  }

  return {
    command: openCommand,
    range: attachFiles[0].range,
    ranges: attachFiles.map((attachment) => attachment.range),
  };
}

module.exports = {
  syncSelectionToCopilot,
  toEditorRange,
};
