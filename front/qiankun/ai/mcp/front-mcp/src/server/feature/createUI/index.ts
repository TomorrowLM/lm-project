import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { CallToolRequest } from "@modelcontextprotocol/sdk/types.js";
import { textResponseFromJson } from "@/utils/text.js";
import { createUiToolInputSchema } from "./schema.js";
import { buildCreateUiInstruction, type PageDefinition } from "./instruction.js";

type CreateUiToolArgs = {
	page?: string;
};

type PageFilePayload = {
	type?: string;
	name?: string;
	description?: string;
	page?: PageDefinition;
};

const currentFilePath = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFilePath);

// 解析输入的页面配置路径，支持绝对路径和相对于当前工作目录或当前文件目录的相对路径
async function resolvePageFilePath(inputPath: string) {
	const candidates = path.isAbsolute(inputPath)
		? [inputPath]
		: [path.resolve(process.cwd(), inputPath), path.resolve(currentDir, inputPath)];

	for (const candidate of candidates) {
		try {
			await fs.access(candidate);
			return candidate;
		} catch (err) {
			void err;
		}
	}

	throw new Error(`create_ui_mcp: 未找到页面配置文件 ${inputPath}`);
}

// 检查 page.requests 中是否存在缺失 apiName 的项
function getInvalidApiRequests(page: PageDefinition) {
	return (page.requests ?? [])
		.map((request, index) => ({ request, index }))
		.filter(({ request }) => !request.apiName?.trim());
}

// 验证页面定义的完整性和正确性
function validatePageDefinition(page: PageDefinition) {
	if (!page.name) {
		throw new Error("create_ui_mcp: page.name 不能为空");
	}

	if (!page.targetPath) {
		throw new Error("create_ui_mcp: page.targetPath 不能为空");
	}

	const invalidApiRequests = getInvalidApiRequests(page);
	if (invalidApiRequests.length > 0) {
		const details = invalidApiRequests
			.map(({ request, index }) => `第 ${index + 1} 项(source=${request.source ?? ""}, targetPath=${request.targetPath ?? ""})`)
			.join("；");

		throw new Error(
			`create_ui_mcp: page.requests 中存在缺失 apiName 的项：${details}。请先执行 create_api_mcp，并将返回的 apiName 回填到 page.json 后再执行 create_ui_mcp。`
		);
	}
}

export const createUiTool = {
	name: "create_ui_mcp",
	description: "读取 page.json 并返回页面创建指令；如 requests 存在则要求已回填 apiName",
	inputSchema: createUiToolInputSchema,
} as const;

export async function handleCreateUiTool(request: CallToolRequest) {
	const args = (request.params.arguments ?? {}) as CreateUiToolArgs;

	if (!args.page?.trim()) {
		throw new Error("create_ui_mcp: 缺少必要的参数 'page'");
	}

	const pageFilePath = await resolvePageFilePath(args.page);
	const rawText = await fs.readFile(pageFilePath, "utf-8");

	let payload: PageFilePayload;
	try {
		payload = JSON.parse(rawText) as PageFilePayload;
	} catch (err) {
		throw new Error(
			`create_ui_mcp: 页面配置 JSON 解析失败 ${pageFilePath}: ${err instanceof Error ? err.message : String(err)}`
		);
	}

	if (!payload.page) {
		throw new Error("create_ui_mcp: 页面配置缺少 page 节点");
	}

	validatePageDefinition(payload.page);
	const normalizedPage = {
		...payload.page,
		type: payload.page.type ?? "page",
	};
	const instruction = await buildCreateUiInstruction(normalizedPage);

	return textResponseFromJson({
		type: payload.type ?? "create_ui",
		description: payload.description ?? payload.name ?? normalizedPage.name,
		page: normalizedPage,
		instruction,
	});
}
