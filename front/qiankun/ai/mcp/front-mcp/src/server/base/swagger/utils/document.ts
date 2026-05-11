/**
 * Swagger/OpenAPI 文档处理工具
 */

import fs from "node:fs/promises";
import path from "node:path";
import { isHttpUrl, normalizeSource } from "@/utils/url.js";
import type { SwaggerGetModelArgs } from "@/server/base/swagger/types.js";

/**
 * 验证文档是否为有效的 Swagger/OpenAPI 规范
 */
function isValidSpec(doc: any): boolean {
  if (!doc || typeof doc !== "object") return false;
  if (typeof doc.openapi === "string") return true;
  if (doc.swagger === "2.0") return true;
  if (doc.components?.schemas && typeof doc.components.schemas === "object") return true;
  if (doc.definitions && typeof doc.definitions === "object") return true;
  return false;
}

/**
 * 尝试从 URL 获取 JSON 文档
 */
async function tryFetchJson(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`get_swagger_mcp: 拉取失败 ${response.status} ${response.statusText}`);
  }
  const text = await response.text();
  const trimmed = String(text ?? "").trim();
  if (!trimmed) {
    throw new Error(`get_swagger_mcp: 从 ${url} 获取到空响应`);
  }

  const contentType = String(response.headers.get("content-type") ?? "").toLowerCase();

  // 如果返回的不是 application/json 且内容看起来也不是 JSON，尝试从文本中提取首个 JSON 对象/数组
  if (!contentType.includes("application/json") && !trimmed.startsWith("{") && !trimmed.startsWith("[")) {
    const m = trimmed.match(/({[\s\S]*}\s*)|(\[[\s\S]*][\s\S]*)/);
    if (m && m[0]) {
      try {
        return JSON.parse(m[0]);
      } catch (err) {
        // fallthrough to throw below with preview
        void err;
      }
    }

    throw new Error(
      `get_swagger_mcp: URL 返回非 JSON 内容 (content-type: ${contentType || "unknown"})，URL: ${url}，响应预览: ${trimmed.slice(0,200)}`
    );
  }

  try {
    const json = JSON.parse(trimmed) as unknown;
    return json;
  } catch (err: any) {
    throw new Error(`get_swagger_mcp: JSON 解析失败 ${url}: ${err?.message ?? String(err)}，响应预览: ${trimmed.slice(0,200)}`);
  }
}

/**
 * 加载 Swagger/OpenAPI 文档（支持 HTTP URL 和本地文件路径）
 */
export async function loadDocument(args: SwaggerGetModelArgs): Promise<any> {
  // 如果调用方显式传入了非空对象形式的 document，则使用它；空对象会被忽略以避免覆盖有效的远程文档加载
  if (args.document && typeof args.document === "object" && Object.keys(args.document).length > 0) {
    return args.document;
  }

  // 如果 source 中包含 fragment（如 Swagger UI 的 #/.../operationId），
  // 解析出可能的分组名和操作标识，便于在 swagger-resources 列表中定位对应的分组 JSON
  let fragmentGroup: string | undefined;
  let fragmentOperation: string | undefined;
  try {
    const rawSource = String(args.source ?? "");
    if (rawSource.includes("#")) {
      const frag = rawSource.split("#")[1] ?? "";
      const parts = frag.split("/").filter(Boolean);
      if (parts.length >= 2) {
        fragmentGroup = decodeURIComponent(parts[parts.length - 2]);
      }
      if (parts.length >= 1) {
        fragmentOperation = decodeURIComponent(parts[parts.length - 1]);
      }
    }
  } catch (err) {
    void err;
  }
  
  // 使用默认 URL 如果 source 未提供或为空
  const defaultSource = "https://apit-dsb.dingtax.cn/dsb/yqarw/api/doc.html#/";
  let source: string | undefined;
  
  console.error(`DEBUG: args.source = ${JSON.stringify(args.source)}`);
  console.error(`DEBUG: args.source !== undefined = ${args.source !== undefined}`);
  console.error(`DEBUG: args.source !== null = ${args.source !== null}`);
  console.error(`DEBUG: args.source?.trim() !== "" = ${args.source?.trim() !== ""}`);
  
  if (args.source !== undefined && args.source !== null && args.source.trim() !== "") {
    source = normalizeSource(args.source);
    console.error(`DEBUG: normalized source = ${source}`);
  } else {
    source = defaultSource;
    console.error(`DEBUG: using default source = ${source}`);
  }
  
  console.error(`DEBUG: final source = ${source}`);
  
  if (!source || source.trim() === "") {
    throw new Error("get_swagger_mcp: 需要提供 source 或 document");
  }

  if (isHttpUrl(source)) {
    try {
      const doc = await tryFetchJson(source);
      if (isValidSpec(doc)) return doc;
    } catch (error) {
      void error;
    }

    const candidateUrls: string[] = [];
    try {
      const inputUrl = new URL(source);
      inputUrl.hash = "";
      const pathname = inputUrl.pathname.replace(/\/+$/, "");
      const isDocHtml = /\/doc\.html$/i.test(pathname) || /\/swagger-ui\.html$/i.test(pathname);
      if (isDocHtml) {
        const basePath = pathname.replace(/\/(doc\.html|swagger-ui\.html)$/i, "/");
        const baseUrl = new URL(inputUrl.toString());
        baseUrl.pathname = basePath;
        baseUrl.search = "";

        candidateUrls.push(new URL("v3/api-docs", baseUrl).toString());
        candidateUrls.push(new URL("v2/api-docs", baseUrl).toString());
        candidateUrls.push(new URL("swagger-resources", baseUrl).toString());
      }
    } catch (error) {
      void error;
    }

    for (const url of candidateUrls) {
      try {
        const doc = await tryFetchJson(url);
        if (isValidSpec(doc)) return doc;

        if (Array.isArray(doc)) {
          // 优先尝试根据 fragmentGroup 或 fragmentOperation 在 swagger-resources 列表中定位对应条目
          let match = undefined as any;
          if (fragmentGroup) {
            match = (doc as any[]).find((item: any) => {
              if (!item) return false;
              const n = String(item.name ?? item.title ?? "").toLowerCase();
              const u = String(item.url ?? "").toLowerCase();
              const g = String(fragmentGroup ?? "").toLowerCase();
              return n.includes(g) || u.includes(encodeURIComponent(g)) || u.includes(g);
            });
          }

          if (!match && fragmentOperation) {
            const op = String(fragmentOperation ?? "").toLowerCase();
            match = (doc as any[]).find((item: any) => {
              const n = String(item.name ?? item.title ?? "").toLowerCase();
              const u = String(item.url ?? "").toLowerCase();
              return n.includes(op) || u.includes(encodeURIComponent(op)) || u.includes(op);
            });
          }

          const firstWithUrl = match ?? (doc as any[]).find((item: any) => item && typeof item.url === "string");
          if (firstWithUrl?.url) {
            const base = new URL(url);
            const nextUrl = new URL(String(firstWithUrl.url).replace(/^\//, ""), base).toString();
            const nextDoc = await tryFetchJson(nextUrl);
            if (isValidSpec(nextDoc)) return nextDoc;
          }
        }
      } catch (error) {
        void error;
      }
    }

    throw new Error(
      `get_swagger_mcp: 无法从该 URL 获取可解析的 Swagger/OpenAPI JSON。请传入 JSON 文档地址（如 /v2/api-docs 或 /v3/api-docs），当前: ${source}`
    );
  }

  const filePath = path.isAbsolute(source) ? source : path.resolve(process.cwd(), source);
  const raw = await fs.readFile(filePath, "utf-8");
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) throw new Error(`get_swagger_mcp: 本地文件 ${filePath} 内容为空`);
  try {
    return JSON.parse(trimmed) as unknown;
  } catch (err: any) {
    throw new Error(`get_swagger_mcp: 解析本地 JSON 文件失败 ${filePath}: ${err?.message ?? String(err)}，文件预览: ${trimmed.slice(0,200)}`);
  }
}

/**
 * 从 Swagger/OpenAPI 文档中提取模型定义根节点
 */
export function getSchemasRoot(doc: any): Record<string, any> {
  if (doc?.openapi && doc?.components?.schemas && typeof doc.components.schemas === "object") {
    return doc.components.schemas;
  }
  if (doc?.swagger === "2.0" && doc?.definitions && typeof doc.definitions === "object") {
    return doc.definitions;
  }
  if (doc?.components?.schemas && typeof doc.components.schemas === "object") {
    return doc.components.schemas;
  }
  if (doc?.definitions && typeof doc.definitions === "object") {
    return doc.definitions;
  }
  return {};
}