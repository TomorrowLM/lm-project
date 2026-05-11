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
  const name = getArgValue("--name") ?? "World";

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
  process.stdout.write(`tools: ${tools.tools.map((t) => t.name).join(", ")}\n`);

  const result = await client.callTool({
    name: "hello_world_mcp",
    arguments: { name },
  });

  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  await transport.close();
}

main().catch((error) => {
  process.stderr.write(String(error) + "\n");
  process.exit(1);
});
