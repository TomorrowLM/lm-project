const SECRET_ID_KEY = "lmMd.tencentCos.secretId";
const SECRET_KEY_KEY = "lmMd.tencentCos.secretKey";

const DEFAULTS = Object.freeze({
  theme: "auto",
  fontSize: 16,
  lineHeight: 1.75,
  contentWidth: "standard",
  cosBucket: "",
  cosRegion: "",
  cosPathPrefix: "images",
});

function normalizeTheme(value) {
  return ["auto", "dark", "light"].includes(value) ? value : DEFAULTS.theme;
}

function normalizeFontSize(value) {
  const size = Number(value);
  if (!Number.isFinite(size)) return DEFAULTS.fontSize;
  return Math.min(24, Math.max(12, Math.round(size * 2) / 2));
}

function normalizeLineHeight(value) {
  const height = Number(value);
  return [1.5, 1.75, 2].includes(height) ? height : DEFAULTS.lineHeight;
}

function normalizeContentWidth(value) {
  return ["narrow", "standard", "wide"].includes(value)
    ? value
    : DEFAULTS.contentWidth;
}

function normalizeCosBucket(value) {
  const bucket = String(value || "").trim();
  if (!bucket) return "";
  if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]-\d{6,}$/i.test(bucket)) {
    throw new Error("COS Bucket 格式不正确，应包含 bucket 名称和 AppID 后缀。");
  }
  return bucket;
}

function normalizeCosRegion(value) {
  const region = String(value || "").trim();
  if (region && !/^[a-z0-9-]{3,40}$/i.test(region)) {
    throw new Error("COS Region 格式不正确。");
  }
  return region;
}

function normalizeCosPathPrefix(value) {
  const prefix = String(value || "").trim().replace(/\\/g, "/");
  if (prefix.includes("\0") || prefix.split("/").some((part) => part === "..")) {
    throw new Error("COS 上传目录不能包含空字符或 .. 路径段。");
  }
  return prefix.replace(/^\/+|\/+$/g, "");
}

function normalizeSecret(value, label) {
  const secret = String(value || "").trim();
  if (secret.length > 512 || /[\u0000-\u001f\u007f]/u.test(secret)) {
    throw new Error(`${label} 格式不正确。`);
  }
  return secret;
}

async function getPreviewSettings(vscode, context) {
  const config = vscode.workspace.getConfiguration("lmMd");
  const [secretId, secretKey] = await Promise.all([
    context.secrets.get(SECRET_ID_KEY),
    context.secrets.get(SECRET_KEY_KEY),
  ]);
  return {
    theme: normalizeTheme(config.get("preview.theme", DEFAULTS.theme)),
    fontSize: normalizeFontSize(config.get("preview.fontSize", DEFAULTS.fontSize)),
    lineHeight: normalizeLineHeight(config.get("preview.lineHeight", DEFAULTS.lineHeight)),
    contentWidth: normalizeContentWidth(config.get("preview.contentWidth", DEFAULTS.contentWidth)),
    cosBucket: String(config.get("tencentCos.bucket", DEFAULTS.cosBucket) || ""),
    cosRegion: String(config.get("tencentCos.region", DEFAULTS.cosRegion) || ""),
    cosPathPrefix: String(config.get("tencentCos.pathPrefix", DEFAULTS.cosPathPrefix) || ""),
    cosCredentialsConfigured: Boolean(secretId && secretKey),
  };
}

async function savePreviewSettings(vscode, context, values = {}) {
  const config = vscode.workspace.getConfiguration("lmMd");
  const target = vscode.ConfigurationTarget.Global;
  const current = await getPreviewSettings(vscode, context);
  const valueOrCurrent = (name, fallback) =>
    Object.prototype.hasOwnProperty.call(values, name) ? values[name] : fallback;
  const next = {
    theme: normalizeTheme(valueOrCurrent("theme", current.theme)),
    fontSize: normalizeFontSize(valueOrCurrent("fontSize", current.fontSize)),
    lineHeight: normalizeLineHeight(valueOrCurrent("lineHeight", current.lineHeight)),
    contentWidth: normalizeContentWidth(valueOrCurrent("contentWidth", current.contentWidth)),
    cosBucket: normalizeCosBucket(valueOrCurrent("cosBucket", current.cosBucket)),
    cosRegion: normalizeCosRegion(valueOrCurrent("cosRegion", current.cosRegion)),
    cosPathPrefix: normalizeCosPathPrefix(valueOrCurrent("cosPathPrefix", current.cosPathPrefix)),
  };

  let secretId = "";
  let secretKey = "";
  const hasSecretInput = Object.prototype.hasOwnProperty.call(values, "cosSecretId") ||
    Object.prototype.hasOwnProperty.call(values, "cosSecretKey");
  if (values.clearCosCredentials !== true && hasSecretInput) {
    secretId = normalizeSecret(values.cosSecretId, "SecretId");
    secretKey = normalizeSecret(values.cosSecretKey, "SecretKey");
    if (Boolean(secretId) !== Boolean(secretKey)) {
      throw new Error("请同时填写 SecretId 和 SecretKey，或两项都留空以保留已保存的密钥。");
    }
  }

  await Promise.all([
    config.update("preview.theme", next.theme, target),
    config.update("preview.fontSize", next.fontSize, target),
    config.update("preview.lineHeight", next.lineHeight, target),
    config.update("preview.contentWidth", next.contentWidth, target),
    config.update("tencentCos.bucket", next.cosBucket, target),
    config.update("tencentCos.region", next.cosRegion, target),
    config.update("tencentCos.pathPrefix", next.cosPathPrefix, target),
  ]);

  if (values.clearCosCredentials === true) {
    await Promise.all([
      context.secrets.delete(SECRET_ID_KEY),
      context.secrets.delete(SECRET_KEY_KEY),
    ]);
  } else {
    if (secretId && secretKey) {
      await Promise.all([
        context.secrets.store(SECRET_ID_KEY, secretId),
        context.secrets.store(SECRET_KEY_KEY, secretKey),
      ]);
    }
  }

  return getPreviewSettings(vscode, context);
}

async function getTencentCosCredentials(context) {
  const [secretId, secretKey] = await Promise.all([
    context.secrets.get(SECRET_ID_KEY),
    context.secrets.get(SECRET_KEY_KEY),
  ]);
  return { secretId, secretKey };
}

module.exports = {
  DEFAULTS,
  getPreviewSettings,
  getTencentCosCredentials,
  normalizeCosBucket,
  normalizeCosPathPrefix,
  normalizeCosRegion,
  savePreviewSettings,
};
