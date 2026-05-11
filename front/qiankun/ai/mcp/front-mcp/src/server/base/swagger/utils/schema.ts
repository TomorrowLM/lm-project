/**
 * Swagger/OpenAPI Schema 解析工具
 */

import type { ResolveSchemaNodeOptions } from "@/server/base/swagger/types.js";

/**
 * 解码 JSON Pointer token
 */
export function decodeJsonPointerToken(token: string): string {
  return token.replace(/~1/g, "/").replace(/~0/g, "~");
}

/**
 * 通过 JSON Pointer 获取值
 */
export function getByJsonPointer(root: any, pointer: string): any {
  const trimmed = pointer.replace(/^#/, "");
  if (!trimmed) return root;
  const segments = trimmed.split("/").filter(Boolean).map(decodeJsonPointerToken);
  let current = root;
  for (const key of segments) {
    if (current == null || typeof current !== "object") return undefined;
    current = current[key];
  }
  return current;
}

/**
 * 递归解析 Swagger/OpenAPI 文档中的 $ref（支持循环引用）
 */
export function resolveSchemaNode(options: ResolveSchemaNodeOptions): any {
  const { doc, node, depth, seenRefs } = options;
  if (depth <= 0) return node;
  if (!node || typeof node !== "object") return node;

  if (typeof node.$ref === "string") {
    const ref = node.$ref as string;
    if (!ref.startsWith("#/")) return { $ref: ref };
    if (seenRefs.has(ref)) return { $ref: ref };
    const target = getByJsonPointer(doc, ref);
    if (target == null) return { $ref: ref };
    const nextSeen = new Set(seenRefs);
    nextSeen.add(ref);
    return resolveSchemaNode({ doc, node: target, depth: depth - 1, seenRefs: nextSeen });
  }

  if (Array.isArray(node.allOf)) {
    const parts = node.allOf.map((part: any) =>
      resolveSchemaNode({ doc, node: part, depth: depth - 1, seenRefs })
    );
    return { ...node, allOf: parts };
  }

  if (Array.isArray(node.oneOf)) {
    const parts = node.oneOf.map((part: any) =>
      resolveSchemaNode({ doc, node: part, depth: depth - 1, seenRefs })
    );
    return { ...node, oneOf: parts };
  }

  if (Array.isArray(node.anyOf)) {
    const parts = node.anyOf.map((part: any) =>
      resolveSchemaNode({ doc, node: part, depth: depth - 1, seenRefs })
    );
    return { ...node, anyOf: parts };
  }

  const resolved: any = Array.isArray(node) ? [] : { ...node };

  if (resolved.properties && typeof resolved.properties === "object") {
    const nextProps: Record<string, any> = {};
    for (const [key, value] of Object.entries(resolved.properties)) {
      nextProps[key] = resolveSchemaNode({ doc, node: value, depth: depth - 1, seenRefs });
    }
    resolved.properties = nextProps;
  }

  if (resolved.items) {
    resolved.items = resolveSchemaNode({ doc, node: resolved.items, depth: depth - 1, seenRefs });
  }

  if (resolved.additionalProperties && typeof resolved.additionalProperties === "object") {
    resolved.additionalProperties = resolveSchemaNode({
      doc,
      node: resolved.additionalProperties,
      depth: depth - 1,
      seenRefs,
    });
  }

  return resolved;
}