import type { CallToolRequest } from "@modelcontextprotocol/sdk/types.js";
import { textResponseFromJson } from "@/utils/text.js";
import { handleSwaggerGetModelTool } from "@/server/base/swagger/index.js";
import { createApiToolInputSchema } from "./schema.js";
import { buildCreateApiInstruction } from "./instruction.js";

type CreateApiToolItemArgs = {
  source?: string;
  document?: unknown;
  name?: string;
  resolveRefs?: boolean;
  maxDepth?: number;
  targetPath?: string;
};

type CreateApiToolArgs = {
  requests?: CreateApiToolItemArgs[];
};

function getTextContent(content: Array<{ type: string; text?: string }> | undefined) {
  if (!Array.isArray(content) || content.length === 0) {
    return "";
  }

  return content
    .filter((item) => item.type === "text" && typeof item.text === "string")
    .map((item) => item.text!.replace(/^\[part \d+\/\d+\]\r?\n/, ""))
    .join("");
}

function parseSwaggerResponse(swaggerResult: Awaited<ReturnType<typeof handleSwaggerGetModelTool>>) {
  const text = getTextContent(swaggerResult.content);

  if (text) {
    try {
      return JSON.parse(text);
    } catch (err) {
      return {
        error: "解析 Swagger 响应失败",
        message: err instanceof Error ? err.message : String(err),
        rawText: text,
      };
    }
  }

  return { error: "Swagger 工具返回格式异常" };
}

export const createApiTool = {
  name: "create_api_mcp",
  description: "通过 Swagger 获取接口信息，并通知模型在指定 API 文件中创建接口函数和 TypeScript 类型",
  inputSchema: createApiToolInputSchema,
} as const;

export async function handleCreateApiTool(request: CallToolRequest) {
  const rawArgs = request.params.arguments as CreateApiToolArgs | undefined;
  console.error("Received create_api_mcp request with arguments:", rawArgs);
  const argsList = Array.isArray(rawArgs?.requests) ? rawArgs.requests : [];

  if (!Array.isArray(rawArgs?.requests)) {
    throw new Error("create_api_mcp: 参数 'requests' 必须是数组");
  }

  if (argsList.length === 0) {
    throw new Error("create_api_mcp: 缺少必要的参数 'requests'");
  }

  const invalidIndex = argsList.findIndex((item) => !item);
  if (invalidIndex !== -1) {
    throw new Error(`create_api_mcp: 第 ${invalidIndex + 1} 项参数无效`);
  }

  const responseList = await Promise.all(
    argsList.map(async (args) => {
      const { targetPath, ...swaggerArgs } = args;
      const swaggerRequest: CallToolRequest = {
        ...request,
        params: {
          ...request.params,
          name: "get_swagger_mcp",
          arguments: swaggerArgs,
        },
      };

      const swaggerResult = await handleSwaggerGetModelTool(swaggerRequest);
      const swaggerData = parseSwaggerResponse(swaggerResult);
      const instruction = buildCreateApiInstruction(targetPath, swaggerData);
      return instruction;
    })
  );

  // return textResponseFromJson(responseList);
  return textResponseFromJson({
    type: "create_api",
    description: "创建 API 函数和 TypeScript 类型",
    instructions: responseList,
  });
}
