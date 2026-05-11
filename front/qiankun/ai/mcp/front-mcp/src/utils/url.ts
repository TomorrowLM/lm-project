/**
 * URL 处理工具函数
 */

/**
 * 检查字符串是否为 HTTP/HTTPS URL
 * @param value 要检查的字符串
 * @returns 如果是 HTTP/HTTPS URL 则返回 true
 */
export function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

/**
 * 规范化源字符串，去除引号和空白字符
 * @param value 原始字符串
 * @returns 规范化后的字符串
 */
export function normalizeSource(value: string): string {
  let result = value.trim();

  const unwrapOnce = (left: string, right: string) => {
    if (result.startsWith(left) && result.endsWith(right) && result.length >= left.length + right.length) {
      result = result.slice(left.length, result.length - right.length).trim();
      return true;
    }
    return false;
  };

  // 最多解包 3 层引号
  for (let i = 0; i < 3; i += 1) {
    if (
      unwrapOnce('"', '"') ||
      unwrapOnce("'", "'") ||
      unwrapOnce("`", "`")
    ) {
      continue;
    }
    break;
  }

  // 尝试提取 URL
  const urlMatch = result.match(/https?:\/\/[^\s"'`]+/i);
  if (urlMatch?.[0]) return urlMatch[0];

  // 移除剩余的引号和空白字符
  return result.replace(/[`'"\s]+/g, "").trim();
}