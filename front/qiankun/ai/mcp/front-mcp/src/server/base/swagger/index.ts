import type { CallToolRequest } from "@modelcontextprotocol/sdk/types.js";
import { textResponseFromJson } from "@/utils/text.js";
import type { SwaggerGetModelArgs } from "@/server/base/swagger/types.js";
import {
  loadDocument,
  getSchemasRoot,
  resolveSchemaNode,
  findOperationByKeyword,
  extractOperationIO,
} from "@/server/base/swagger/utils/index.js";
import { swaggerGetModelInputSchema } from "@/server/base/swagger/schema.js";

export const swaggerGetModelTool = {
  name: "get_swagger_mcp",
  description: "读取 Swagger/OpenAPI 文档，列出模型或返回指定模型的数据结构（支持解析 $ref）",
  inputSchema: swaggerGetModelInputSchema,
} as const;

// 处理 Swagger/OpenAPI 模型获取工具调用
export async function handleSwaggerGetModelTool(request: CallToolRequest) {
  const args = (request.params.arguments ?? {}) as SwaggerGetModelArgs;

  // 如果传入的是 Swagger UI 带 fragment 的具体接口链接，且未显式提供 name，
  // 则从 fragment 的最后一段提取操作标识（解码）并赋值给 args.name，便于定位该接口。
  try {
    const rawSource = request.params.arguments?.source;
    if (!args.name && typeof rawSource === "string" && rawSource.includes("#")) {
      const frag = rawSource.split("#")[1] ?? "";
      const parts = frag.split("/").filter(Boolean);
      const last = parts.length > 0 ? decodeURIComponent(parts[parts.length - 1]) : "";
      if (last) {
        args.name = last;
        console.error(`[MCP Swagger Debug] extracted name from fragment: ${args.name}`);
      }
    }
  } catch (err) {
    void err;
  }

  // 调试信息 - 会在 MCP 服务器终端显示
  console.error(`[MCP Swagger Debug] request.params.arguments = ${JSON.stringify(request.params.arguments)}`);
  console.error(`[MCP Swagger Debug] args.source = ${JSON.stringify(args.source)}`);
  console.error(`[MCP Swagger Debug] final args.source = ${JSON.stringify(args.source)}`);

  const doc = await loadDocument(args); // 加载 Swagger/OpenAPI 文档
  console.error(`[MCP Swagger Debug] document loaded successfully`, doc);
  const schemas = getSchemasRoot(doc as any); // 提取模型定义根节点
  console.error(`DEBUG handleSwaggerGetModelTool: schemas = ${JSON.stringify(schemas)}`);
  const names = Object.keys(schemas).sort((a, b) => a.localeCompare(b));

  const resolveRefs = args.resolveRefs ?? true;
  const maxDepth = Number.isFinite(args.maxDepth) ? Math.max(0, Math.floor(args.maxDepth!)) : 6;

  if (!args.name) {
    return textResponseFromJson({ models: names });
  }

  const rawModel = (schemas as any)[args.name];
  if (!rawModel) {
    const found = findOperationByKeyword(doc as any, args.name);
    console.error(`DEBUG handleSwaggerGetModelTool: found operation = ${JSON.stringify(found)}`);
    if (found) {
      const io = extractOperationIO(doc as any, found);
      const operationResult = {
        match: "operation",
        keyword: args.name,
        operation: io.operation,
        request: {
          ...io.request,
          body: resolveRefs && io.request.body
            ? resolveSchemaNode({ doc, node: io.request.body, depth: maxDepth, seenRefs: new Set() })
            : io.request.body,
        },
        response: {
          ...io.response,
          body: resolveRefs && io.response.body
            ? resolveSchemaNode({ doc, node: io.response.body, depth: maxDepth, seenRefs: new Set() })
            : io.response.body,
        },
      };

      return textResponseFromJson(operationResult);
    }

    return textResponseFromJson({ error: `未找到模型: ${args.name}`, models: names });
  }

  const model = resolveRefs
    ? resolveSchemaNode({ doc, node: rawModel, depth: maxDepth, seenRefs: new Set() })
    : rawModel;

  return textResponseFromJson({ name: args.name, schema: model });
}
