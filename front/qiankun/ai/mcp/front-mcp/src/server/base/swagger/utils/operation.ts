/**
 * Swagger/OpenAPI 操作查找和提取工具
 */

import type { FoundOperation, OperationIO } from "@/server/base/swagger/types.js";

/**
 * 通过关键词查找操作
 */
export function findOperationByKeyword(doc: any, keyword: string): FoundOperation | undefined {
  const paths = doc?.paths;
  if (!paths || typeof paths !== "object") return undefined;

  const normalizedKeyword = String(keyword ?? "").trim();
  if (!normalizedKeyword) return undefined;

  const needle = normalizedKeyword.toLowerCase();

  const httpMethods = new Set([
    "get",
    "post",
    "put",
    "patch",
    "delete",
    "options",
    "head",
    "trace",
  ]);

  const scoreOf = (op: any, method: string, pathKey: string) => {
    const textParts = [
      op?.summary,
      op?.description,
      op?.operationId,
      Array.isArray(op?.tags) ? op.tags.join(" ") : undefined,
      method,
      pathKey,
    ]
      .filter(Boolean)
      .map((v: any) => String(v));

    const haystack = textParts.join(" ").toLowerCase();
    if (!haystack.includes(needle)) return -1;

    let score = 1;
    if (String(op?.summary ?? "").toLowerCase().includes(needle)) score += 3;
    if (String(op?.operationId ?? "").toLowerCase().includes(needle)) score += 2;
    if (String(pathKey).toLowerCase().includes(needle)) score += 1;
    return score;
  };

  let best: FoundOperation | undefined;

  for (const [pathKey, item] of Object.entries(paths)) {
    if (!item || typeof item !== "object") continue;


    for (const [method, operation] of Object.entries(item as any)) {
      const m = String(method).toLowerCase();
      if (!httpMethods.has(m)) continue;
      const score = scoreOf(operation, m, pathKey);
      if (score < 0) continue;
      if (!best || score > best.score) {
        best = { path: pathKey, method: m, operation, score };
      }
    }
  }

  return best;
}

/**
 * 从 content 中提取第一个 schema
 */
export function pickFirstContentSchema(content: any): any {
  if (!content || typeof content !== "object") return undefined;
  const preferred = ["application/json", "application/*+json", "*/*"];
  for (const key of preferred) {
    const entry = content[key];
    if (entry?.schema) return entry.schema;
  }
  const firstKey = Object.keys(content)[0];
  const first = firstKey ? content[firstKey] : undefined;
  return first?.schema;
}

/**
 * 提取操作的输入输出
 */
export function extractOperationIO(doc: any, found: FoundOperation): OperationIO {
  const op = found.operation;
  const isOAS3 = typeof doc?.openapi === "string";

  if (isOAS3) {
    const requestBodySchema = pickFirstContentSchema(op?.requestBody?.content);
    const parameters = Array.isArray(op?.parameters)
      ? op.parameters.map((p: any) => ({
          name: p?.name,
          in: p?.in,
          required: p?.required,
          schema: p?.schema,
          description: p?.description,
        }))
      : [];

    const responses = op?.responses && typeof op.responses === "object" ? op.responses : {};
    const preferredCodes = ["200", "201", "default"];
    const code =
      preferredCodes.find((c) => responses[c]) ?? Object.keys(responses).sort()[0] ?? "200";
    const responseSchema = pickFirstContentSchema(responses?.[code]?.content);

    return {
      operation: {
        path: found.path,
        method: found.method,
        summary: op?.summary,
        operationId: op?.operationId,
        tags: op?.tags,
      },
      request: { body: requestBodySchema, parameters },
      response: { code, body: responseSchema },
    };
  }

  const parameters = Array.isArray(op?.parameters) ? op.parameters : [];
  const bodyParam = parameters.find((p: any) => p && p.in === "body" && p.schema);
  const nonBodyParams = parameters
    .filter((p: any) => p && p.in !== "body")
    .map((p: any) => ({
      name: p?.name,
      in: p?.in,
      required: p?.required,
      type: p?.type,
      schema: p?.schema,
      description: p?.description,
    }));

  const responses = op?.responses && typeof op.responses === "object" ? op.responses : {};
  const preferredCodes = ["200", "201", "default"];
  const code = preferredCodes.find((c) => responses[c]) ?? Object.keys(responses).sort()[0] ?? "200";
  const responseSchema = responses?.[code]?.schema;

  return {
    operation: {
      path: found.path,
      method: found.method,
      summary: op?.summary,
      operationId: op?.operationId,
      tags: op?.tags,
    },
    request: { body: bodyParam?.schema, parameters: nonBodyParams },
    response: { code, body: responseSchema },
  };
}