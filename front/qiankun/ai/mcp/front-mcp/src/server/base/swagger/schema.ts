export const swaggerGetModelInputSchema = {
  type: "object",
  properties: {
    source: {
      type: "string",
      description: "Swagger/OpenAPI 文档 URL 或本地文件路径（JSON）",
      default: "https://apit-dsb.dingtax.cn/dsb/yqarw/api/doc.html#/",
    },
    document: {
      type: "object",
      description: "直接传入 Swagger/OpenAPI 文档对象（优先于 source）",
    },
    name: {
      type: "string",
      description: "模型名（不传则返回所有模型名）",
      default: "",
    },
    resolveRefs: {
      type: "boolean",
      description: "是否解析 $ref（默认 true）",
    },
    maxDepth: {
      type: "number",
      description: "解析深度（默认 6）",
    },
  },
} as const;