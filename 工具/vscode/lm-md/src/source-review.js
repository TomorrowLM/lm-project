async function openSourceReview(vscode, uri, sourceReview) {
  const document = await vscode.workspace.openTextDocument(uri);
  const startLine = Math.max(1, Math.min(sourceReview.startLine, document.lineCount));
  const endLine = Math.max(startLine, Math.min(sourceReview.endLine, document.lineCount));
  const start = new vscode.Position(startLine - 1, 0);
  const end = new vscode.Position(
    endLine - 1,
    document.lineAt(endLine - 1).text.length,
  );
  const selection = new vscode.Range(start, end);
  const editor = await vscode.window.showTextDocument(document, {
    viewColumn: vscode.ViewColumn.Beside,
    preview: false,
    selection,
  });
  editor.revealRange(selection, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
}

module.exports = { openSourceReview };
