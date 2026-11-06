const {
  getPreviewSettings,
  savePreviewSettings,
} = require("./preview-settings");
const { applyImageDimension, replaceImageSource } = require("./markdown-image-source");
const { uploadImageToTencentCos } = require("./tencent-cos-upload");

function createPreviewActions(vscode, context) {
  async function getDocument(uri) {
    const existing = vscode.workspace.textDocuments.find((document) =>
      document.uri.toString() === uri.toString(),
    );
    return existing || vscode.workspace.openTextDocument(uri);
  }

  return {
    getSettings: () => getPreviewSettings(vscode, context),
    saveSettings: (values) => savePreviewSettings(vscode, context, values),
    async setImageSize(uri, payload) {
      const document = await getDocument(uri);
      return applyImageDimension(vscode, document, payload);
    },
    async uploadImage(uri, payload) {
      const document = await getDocument(uri);
      const url = await uploadImageToTencentCos(vscode, context, uri, payload?.source);
      await replaceImageSource(vscode, document, payload, url);
      return { url };
    },
  };
}

module.exports = { createPreviewActions };
