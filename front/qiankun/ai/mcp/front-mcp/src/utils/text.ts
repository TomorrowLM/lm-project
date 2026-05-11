/**
 * 文本处理工具函数
 */

/**
 * 将文本分块
 * @param text 要分块的文本
 * @param chunkSize 每块的大小
 * @returns 分块后的文本数组
 */
export function chunkText(text: string, chunkSize: number): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize));
  }
  return chunks;
}

/**
 * 从文本创建 MCP 响应
 * @param text 文本内容
 * @returns MCP 响应对象
 */
export function textResponseFromText(text: string) {
  const chunkSize = 12000;
  const parts = chunkText(text, chunkSize);
  if (parts.length <= 1) {
    return {
      content: [{ type: "text" as const, text }],
    };
  }
  return {
    content: parts.map((part, index) => ({
      type: "text" as const,
      text: `[part ${index + 1}/${parts.length}]\n${part}`,
    })),
  };
}

/**
 * 从 JSON 对象创建 MCP 响应
 * @param payload JSON 对象
 * @returns MCP 响应对象
 */
export function textResponseFromJson(payload: unknown) {
  const text = JSON.stringify(payload, null, 2);
  return textResponseFromText(text);
}