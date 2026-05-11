/**
 * Swagger 工具类型定义
 */

export type SwaggerGetModelArgs = {
  source?: string;
  document?: unknown;
  name?: string;
  resolveRefs?: boolean;
  maxDepth?: number;
};

export interface ResolveSchemaNodeOptions {
  doc: any;
  node: any;
  depth: number;
  seenRefs: Set<string>;
}

export interface FoundOperation {
  path: string;
  method: string;
  operation: any;
  score: number;
}

export interface OperationIO {
  operation: {
    path: string;
    method: string;
    summary?: string;
    operationId?: string;
    tags?: string[];
  };
  request: {
    body?: any;
    parameters: any[];
  };
  response: {
    code: string;
    body?: any;
  };
}