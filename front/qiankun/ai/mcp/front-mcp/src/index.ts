#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { tools, dispatchTool } from "@/server/index.js";

// 创建 MCP 服务器实例
const server = new Server(
  {
    name: "lm-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// 注册工具列表
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools,
  };
});

// 处理工具调用请求
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const result = await dispatchTool(request);
  if (result) return result;
  throw new McpError(
    ErrorCode.MethodNotFound,
    `未知的工具: ${request.params.name}`
  );
});

// 错误处理边界
server.onerror = (error) => {
  console.error('[MCP Error]', error);
};

process.on('SIGINT', async () => {
  await server.close();
  process.exit(0);
});

// 通过 stdio 启动服务并监听
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("LM MCP Server 已通过 stdio 启动...");
}

main().catch(console.error);
