const dns = require("node:dns").promises;
const crypto = require("node:crypto");
const http = require("node:http");
const https = require("node:https");
const path = require("node:path");
const net = require("node:net");
const COS = require("cos-nodejs-sdk-v5");
const { getPreviewSettings, getTencentCosCredentials } = require("./preview-settings");

const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_REDIRECTS = 4;
const MIME_TO_EXTENSION = new Map([
  ["image/png", ".png"],
  ["image/jpeg", ".jpg"],
  ["image/gif", ".gif"],
  ["image/webp", ".webp"],
  ["image/avif", ".avif"],
  ["image/bmp", ".bmp"],
  ["image/tiff", ".tif"],
]);
const EXTENSION_TO_MIME = new Map(
  [...MIME_TO_EXTENSION.entries()].flatMap(([mime, extension]) => [
    [extension, mime],
    ...(extension === ".jpg" ? [[".jpeg", mime]] : []),
  ]),
);

function isPrivateIpv4(address) {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b] = parts;
  return a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 0 || b === 168)) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 203 && b === 0);
}

function isPrivateIpv6(address) {
  const value = address.toLowerCase().split("%")[0];
  if (value === "::" || value === "::1" || value.startsWith("fc") || value.startsWith("fd") ||
      value.startsWith("fe8") || value.startsWith("fe9") || value.startsWith("fea") ||
      value.startsWith("feb") || value.startsWith("ff") || value.startsWith("2001:db8:")) return true;

  const mapped = value.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIpv4(mapped[1]);
  const mappedHex = value.match(/::ffff:([\da-f]{1,4}):([\da-f]{1,4})$/);
  if (mappedHex) {
    const high = Number.parseInt(mappedHex[1], 16);
    const low = Number.parseInt(mappedHex[2], 16);
    return isPrivateIpv4(`${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`);
  }
  return false;
}

function isPublicAddress(address) {
  const family = net.isIP(address);
  if (family === 4) return !isPrivateIpv4(address);
  if (family === 6) return !isPrivateIpv6(address);
  return false;
}

function validateImageBuffer(buffer, contentType) {
  const bytes = Buffer.from(buffer || []);
  const isAvif = bytes.length >= 16 && bytes.toString("ascii", 4, 8) === "ftyp" &&
    ["avif", "avis"].some((brand) => bytes.subarray(8, Math.min(bytes.length, 64)).includes(Buffer.from(brand)));
  const signatures = {
    "image/png": bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    "image/jpeg": bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
    "image/gif": bytes.length >= 6 && /^GIF8[79]a$/.test(bytes.toString("ascii", 0, 6)),
    "image/webp": bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP",
    "image/avif": isAvif,
    "image/bmp": bytes.length >= 2 && bytes.toString("ascii", 0, 2) === "BM",
    "image/tiff": bytes.length >= 4 && ["49492a00", "4d4d002a", "49492b00", "4d4d002b"].includes(bytes.subarray(0, 4).toString("hex")),
  };
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES || signatures[contentType] !== true) {
    throw new Error("图片内容与格式不匹配，或图片为空/超过 20 MB；未上传。");
  }
  return bytes;
}

function assertImageWithinWorkspace(vscode, documentUri, imageUri) {
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(documentUri);
  const rootUri = workspaceFolder?.uri || vscode.Uri.joinPath(documentUri, "..");
  if (rootUri.scheme !== imageUri.scheme || rootUri.authority !== imageUri.authority) {
    throw new Error("出于安全限制，只能上传当前工作区或 Markdown 所在目录中的本地图片。");
  }
  const rootPath = path.resolve(rootUri.fsPath || rootUri.path);
  const imagePath = path.resolve(imageUri.fsPath || imageUri.path);
  const relative = path.relative(rootPath, imagePath);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error("出于安全限制，只能上传当前工作区或 Markdown 所在目录中的本地图片。");
  }
}

async function resolvePublicAddresses(hostname) {
  const normalizedHost = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (normalizedHost === "localhost" || normalizedHost.endsWith(".localhost") ||
      normalizedHost.endsWith(".local") || normalizedHost.endsWith(".internal")) {
    throw new Error("出于安全限制，不能上传来自本机或内网地址的图片。");
  }
  const literalFamily = net.isIP(normalizedHost);
  const addresses = literalFamily
    ? [{ address: normalizedHost, family: literalFamily }]
    : await dns.lookup(normalizedHost, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) {
    throw new Error("出于安全限制，图片地址必须解析到公网 IP。");
  }
  return addresses;
}

function downloadHttpsImage(address, redirects = 0) {
  return new Promise((resolve, reject) => {
    let parsed;
    try {
      parsed = new URL(address);
    } catch {
      reject(new Error("图片地址无效。"));
      return;
    }
    if (!["https:", "http:"].includes(parsed.protocol) || parsed.username || parsed.password ||
        (parsed.port && parsed.port !== (parsed.protocol === "https:" ? "443" : "80"))) {
      reject(new Error("只支持无账号信息的公网 HTTP/HTTPS 图片地址。"));
      return;
    }

    void resolvePublicAddresses(parsed.hostname).then((addresses) => {
      const client = parsed.protocol === "https:" ? https : http;
      const options = {};
      if (!net.isIP(parsed.hostname.replace(/^\[|\]$/g, ""))) {
        options.lookup = (_hostname, lookupOptions, callback) => {
          const requestedFamily = lookupOptions?.family;
          const selected = addresses.find((entry) => !requestedFamily || entry.family === requestedFamily) || addresses[0];
          if (lookupOptions?.all) callback(null, addresses);
          else callback(null, selected.address, selected.family);
        };
      }

      const request = client.get(parsed, options, (response) => {
        const status = Number(response.statusCode || 0);
        if (status >= 300 && status < 400 && response.headers.location) {
          response.resume();
          if (redirects >= MAX_REDIRECTS) {
            reject(new Error("图片地址重定向次数过多。"));
            return;
          }
          let next;
          try { next = new URL(response.headers.location, parsed).toString(); }
          catch { reject(new Error("图片重定向地址无效。")); return; }
          if (parsed.protocol === "https:" && next.startsWith("http:")) {
            reject(new Error("为保护传输安全，不允许 HTTPS 图片降级到 HTTP。"));
            return;
          }
          downloadHttpsImage(next, redirects + 1).then(resolve, reject);
          return;
        }
        if (status !== 200) {
          response.resume();
          reject(new Error(`下载图片失败（HTTP ${status || "未知"}）。`));
          return;
        }
        const contentType = String(response.headers["content-type"] || "").split(";")[0].trim().toLowerCase();
        if (!MIME_TO_EXTENSION.has(contentType)) {
          response.resume();
          reject(new Error("只支持 PNG、JPEG、GIF、WebP、AVIF、BMP 和 TIFF 图片，不上传 SVG 或其他内容。"));
          return;
        }
        const expectedLength = Number(response.headers["content-length"] || 0);
        if (expectedLength > MAX_IMAGE_BYTES) {
          response.resume();
          reject(new Error("图片超过 20 MB 上传限制。"));
          return;
        }
        const chunks = [];
        let total = 0;
        response.on("data", (chunk) => {
          total += chunk.length;
          if (total > MAX_IMAGE_BYTES) {
            request.destroy(new Error("图片超过 20 MB 上传限制。"));
            return;
          }
          chunks.push(chunk);
        });
        response.on("end", () => {
          try {
            resolve({
              buffer: validateImageBuffer(Buffer.concat(chunks), contentType),
              contentType,
              filename: filenameFromUrl(parsed, contentType),
            });
          } catch (error) {
            reject(error);
          }
        });
        response.on("error", reject);
      });
      request.setTimeout(25000, () => request.destroy(new Error("下载图片超时。")));
      request.on("error", reject);
    }).catch(reject);
  });
}

function filenameFromUrl(url, contentType) {
  let name = "";
  try { name = decodeURIComponent(path.posix.basename(url.pathname)); }
  catch { name = path.posix.basename(url.pathname); }
  name = name.replace(/[\u0000-\u001f\u007f<>:"/\\|?*]/g, "_").trim();
  const extension = path.extname(name).toLowerCase();
  if (!name || name === "." || name === "..") return `image${MIME_TO_EXTENSION.get(contentType)}`;
  if (!EXTENSION_TO_MIME.has(extension)) {
    name = `${path.basename(name, extension)}${MIME_TO_EXTENSION.get(contentType)}`;
  }
  return name;
}

function decodeDataImage(source) {
  const match = String(source).match(/^data:(image\/(?:png|jpeg|gif|webp|avif|bmp|tiff));(base64|charset=[^,]+),([\s\S]*)$/i);
  if (!match) throw new Error("不支持上传该内嵌图片格式。");
  const contentType = match[1].toLowerCase();
  const buffer = match[2].toLowerCase() === "base64"
    ? Buffer.from(match[3], "base64")
    : Buffer.from(decodeURIComponent(match[3]), "utf8");
  return { buffer: validateImageBuffer(buffer, contentType), contentType, filename: `image${MIME_TO_EXTENSION.get(contentType)}` };
}

async function readLocalImage(vscode, documentUri, source) {
  let uri;
  if (/^file:/i.test(source)) {
    uri = vscode.Uri.parse(source);
  } else if (/^[a-z]:[\\/]/i.test(source) || /^\\\\/.test(source) || source.startsWith("/")) {
    uri = vscode.Uri.file(source);
  } else {
    const cleanPath = source.split(/[?#]/, 1)[0];
    uri = vscode.Uri.joinPath(documentUri, "..", cleanPath.replace(/^\/+/, ""));
  }
  assertImageWithinWorkspace(vscode, documentUri, uri);
  const buffer = Buffer.from(await vscode.workspace.fs.readFile(uri));
  const extension = path.extname(uri.path).toLowerCase();
  const contentType = EXTENSION_TO_MIME.get(extension);
  if (!contentType) throw new Error("图片格式不支持；请使用 PNG、JPEG、GIF、WebP、AVIF、BMP 或 TIFF。");
  return { buffer: validateImageBuffer(buffer, contentType), contentType, filename: filenameFromUrl(new URL(`https://local.invalid/${encodeURIComponent(path.posix.basename(uri.path))}`), contentType) };
}

async function readImageForUpload(vscode, documentUri, source) {
  const value = String(source || "").trim();
  if (!value) throw new Error("没有获取到图片地址。");
  if (value.startsWith("data:")) return decodeDataImage(value);
  if (/^(?:https?:)?\/\//i.test(value)) {
    const remote = value.startsWith("//") ? `https:${value}` : value;
    return downloadHttpsImage(remote);
  }
  const local = await readLocalImage(vscode, documentUri, value);
  if (!local.buffer.length || local.buffer.length > MAX_IMAGE_BYTES) throw new Error("图片为空或超过 20 MB 上传限制。");
  return local;
}

function safeCosSegment(value) {
  return String(value || "")
    .normalize("NFC")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[\\]/g, "_")
    .replace(/\.{2,}/g, ".")
    .replace(/^\.+|\.+$/g, "") || "image";
}

function buildCosKey(settings, documentUri, filename) {
  const documentName = path.posix.basename(documentUri.path || "document.md", path.posix.extname(documentUri.path || ""));
  const parts = [
    settings.cosPathPrefix,
    safeCosSegment(documentName),
    safeCosSegment(filename),
  ].filter(Boolean);
  return parts.join("/");
}

function encodeCosKey(key) {
  return key.split("/").map((segment) => encodeURIComponent(segment)).join("/");
}

async function uploadImageToTencentCos(vscode, context, documentUri, source) {
  const [settings, credentials] = await Promise.all([
    getPreviewSettings(vscode, context),
    getTencentCosCredentials(context),
  ]);
  if (!credentials.secretId || !credentials.secretKey) {
    throw new Error("请先在预览设置中填写 Tencent COS SecretId 和 SecretKey。");
  }
  if (!settings.cosBucket || !settings.cosRegion) {
    throw new Error("请先在预览设置中填写腾讯 COS Bucket 和 Region。");
  }

  const image = await readImageForUpload(vscode, documentUri, source);
  const extension = path.extname(image.filename);
  const uniqueFilename = `${path.basename(image.filename, extension)}-${Date.now()}-${crypto.randomBytes(3).toString("hex")}${extension}`;
  const key = buildCosKey(settings, documentUri, uniqueFilename);
  const client = new COS({
    SecretId: credentials.secretId,
    SecretKey: credentials.secretKey,
    Protocol: "https:",
    Timeout: 30000,
  });

  await new Promise((resolve, reject) => {
    client.putObject({
      Bucket: settings.cosBucket,
      Region: settings.cosRegion,
      Key: key,
      Body: image.buffer,
      ContentLength: image.buffer.length,
      ContentType: image.contentType,
    }, (error) => {
      if (error) reject(new Error(`腾讯 COS 上传失败：${error.message || "请求失败"}`));
      else resolve();
    });
  });

  return `https://${settings.cosBucket}.cos.${settings.cosRegion}.myqcloud.com/${encodeCosKey(key)}`;
}

module.exports = {
  MAX_IMAGE_BYTES,
  buildCosKey,
  downloadHttpsImage,
  isPublicAddress,
  readImageForUpload,
  uploadImageToTencentCos,
};
