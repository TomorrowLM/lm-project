import { swaggerGetModelInputSchema } from "@/server/base/swagger/schema.js";

const createApiToolItemInputSchema = {
  type: "object",
  properties: {
    ...swaggerGetModelInputSchema.properties,
    targetPath: {
      type: "string",
      description: "目标 API 文件路径（可选），用于提示模型生成代码的位置",
    },
  },
} as const;

export const createApiToolInputSchema = {
  type: "object",
  description: "通过 requests 数组批量生成 API 信息",
  properties: {
    requests: {
      type: "array",
      description: "批量创建 API 信息时传入对象数组",
      minItems: 1,
      items: createApiToolItemInputSchema,
    },
  },
  required: ["requests"],
} as const;