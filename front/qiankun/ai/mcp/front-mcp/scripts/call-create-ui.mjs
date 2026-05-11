import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

function getServerEntry() {
	const currentFilePath = fileURLToPath(import.meta.url);
	const scriptsDir = path.dirname(currentFilePath);
	return path.join(scriptsDir, "..", "dist", "index.js");
}

function getDefaultPagePath() {
	const currentFilePath = fileURLToPath(import.meta.url);
	const scriptsDir = path.dirname(currentFilePath);
	return path.join(scriptsDir, "..", "src", "server", "feature", "createUI", "json", "page.json");
}

async function main() {
	const serverEntryPath = getServerEntry();
	const pagePath = process.argv[2] ?? getDefaultPagePath();

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
		name: "create_ui_mcp",
		arguments: {
			page: pagePath,
		},
	});

	console.log(JSON.stringify(result, null, 2));
	await transport.close();
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});