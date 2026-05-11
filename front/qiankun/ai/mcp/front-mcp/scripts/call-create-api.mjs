import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

function getServerEntry() {
  const currentFilePath = fileURLToPath(import.meta.url);
  const scriptsDir = path.dirname(currentFilePath);
  return path.join(scriptsDir, "..", "dist", "index.js");
}

async function main() {
  const serverEntryPath = getServerEntry();

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

  const result = await client.callTool({
    name: "create_api_mcp",
    arguments: {
      requests: [
        {
          source: "https://apit-dsb.dingtax.cn/dsb/yqarw/api/doc.html#/%E4%BB%BB%E5%8A%A1%E7%AE%A1%E7%90%86/%E4%B8%80%E8%B5%B7%E5%AE%89-common/aiDetectRiskConfirmUsingPOST",
          targetPath: "ai/test",
        },
      ],
    },
  });

  console.log(JSON.stringify(result, null, 2));
  await transport.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
