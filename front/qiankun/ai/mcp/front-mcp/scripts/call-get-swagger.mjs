import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

function getArgValue(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

async function main() {
  const source = getArgValue("--source") ?? "https://apit-dsb.dingtax.cn/dsb/yqarw/api/doc.html#/";
  const name = getArgValue("--name") ?? "";
  const resolveRefs = getArgValue("--resolve-refs") ?? "true";
  const maxDepth = getArgValue("--max-depth") ?? "6";

  const currentFilePath = fileURLToPath(import.meta.url);
  const scriptsDir = path.dirname(currentFilePath);
  const serverEntryPath = path.join(scriptsDir, "..", "dist", "index.js");

  const transport = new StdioClientTransport({
    command: "node",
    args: [serverEntryPath],
    stderr: "inherit",
  });

  const client = new Client(
    { name: "lm-mcp-client", version: "1.0.0" },
    { capabilities: {} }
  );

  await client.connect(transport);

  const tools = await client.listTools();
  process.stdout.write(`Available tools: ${tools.tools.map((t) => t.name).join(", ")}\n`);

  const args = {};
  if (source) args.source = source;
  if (name !== undefined && name !== "") args.name = name;
  if (resolveRefs !== undefined) args.resolveRefs = resolveRefs === "true";
  if (maxDepth !== undefined) args.maxDepth = parseInt(maxDepth, 10);

  const result = await client.callTool({
    name: "get_swagger_mcp",
    arguments: args,
  });

  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  await transport.close();
}

main().catch((error) => {
  process.stderr.write(String(error) + "\n");
  process.exit(1);
});