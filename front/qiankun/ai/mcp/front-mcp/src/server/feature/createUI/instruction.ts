function normalizePath(filePath: string): string {
	return filePath.replace(/\//g, "\\");
}

type ToolDefinition = {
	name?: string;
	description?: string;
	props?: unknown[];
	requirements?: string[];
};

type ImageDefinition = ToolDefinition & {
	uiPath?: string;
	targetPath?: string;
};

type PageRequest = {
	source?: string;
	targetPath?: string;
	apiName?: string;
};

type PageRequirement = {
	type?: string;
	sub?: string;
	requirements?: string[];
};

type PageDepends = {
	components?: Record<string, ToolDefinition[]>;
	utils?: ToolDefinition[];
	modal?: ToolDefinition[];
	model?: ToolDefinition[];
	images?: ImageDefinition[];
};

type PageChild = {
	type?: string;
	name?: string;
	description?: string;
	isComponent?: boolean;
	uiPath?: string;
	targetPath?: string;
	depends?: PageDepends;
	tools?: PageDepends;
	requirements?: PageRequirement[];
};

type PageDefinition = {
	name?: string;
	description?: string;
	uiPath?: string;
	targetPath?: string;
	type?: string;
	requests?: PageRequest[];
	depends?: PageDepends;
	tools?: PageDepends;
	requirements?: PageRequirement[];
	children?: PageChild[];
};

type CreateUiInstructionTask = {
	type: string;
	name: string;
	description: string;
	filePath?: string;
	requirements?: string[];
};

type CreateUiInstruction = {
	tasks: CreateUiInstructionTask[];
	additionalNotes: string[];
};

function getToolName(tool: ToolDefinition): string {
	return tool.name ?? tool.description ?? "未命名工具";
}

function getToolDescription(tool: ToolDefinition): string | undefined {
	return tool.description?.trim() || undefined;
}

function getToolRequirements(tool: ToolDefinition): string[] {
	return (tool.requirements ?? []).map((item) => item.trim()).filter(Boolean);
}

function buildDependencyRequirementLines(depends?: PageDepends): string[] {
	if (!depends) {
		return [];
	}

	const lines: string[] = [];
	const componentEntries = Object.entries(depends.components ?? {}).filter(([, items]) => (items ?? []).length > 0);

	if (componentEntries.length > 0) {
		const componentText = componentEntries
			.map(([groupName, items]) => {
				const itemText = items
					.map((tool) => {
						const name = getToolName(tool);
						const description = getToolDescription(tool);
						return description ? `${name}(${description})` : name;
					})
					.join("、");

				return `${groupName}: ${itemText}`;
			})
			.join("；");

		lines.push(`优先使用以下组件能力：${componentText}`);
	}

	const utilityGroups = [
		{ label: "utils", items: depends.utils },
		{ label: "modal", items: depends.modal },
		{ label: "model", items: depends.model },
	];

	for (const group of utilityGroups) {
		const validItems = (group.items ?? []).filter(Boolean);
		if (validItems.length === 0) {
			continue;
		}

		lines.push(`${group.label} 能力：${validItems.map((tool) => getToolName(tool)).join("、")}`);
	}

	const toolRequirements = [
		...(componentEntries.flatMap(([, items]) => items)),
		...(depends.utils ?? []),
		...(depends.modal ?? []),
		...(depends.model ?? []),
	]
		.flatMap((tool) => getToolRequirements(tool))
		.map((item) => item.trim())
		.filter(Boolean);

	if (toolRequirements.length > 0) {
		lines.push(...toolRequirements.map((item) => `工具约束：${item}`));
	}

	const imageItems = (depends.images ?? []).filter(Boolean);
	if (imageItems.length > 0) {
		const imageText = imageItems
			.map((image) => {
				const name = getToolName(image);
				const segments = [name];

				if (image.uiPath?.trim()) {
					segments.push(`来源 ${normalizePath(image.uiPath)}`);
				}

				if (image.targetPath?.trim()) {
					segments.push(`输出到 ${normalizePath(image.targetPath)}`);
				}

				return segments.join("，");
			})
			.join("；");

		lines.push(`图片资源：${imageText}`);
	}

	return lines;
}

function buildRequirementLines(requirements?: PageRequirement[]): string[] {
	if (!requirements || requirements.length === 0) {
		return [];
	}

	const requirementText = requirements
		.map((item) => {
			const actions = (item.requirements ?? []).map((requirement) => requirement.trim()).filter(Boolean);
			const labels = [item.type?.trim(), item.sub?.trim()].filter(Boolean);
			const prefix = labels.length > 0 ? labels.join("/") : "未命名要求";
			return actions.length > 0 ? `${prefix}: ${actions.join("；")}` : prefix;
		})
		.filter(Boolean);

	return requirementText.length > 0 ? [`页面要求：${requirementText.join("；")}`] : [];
}

async function buildChildTask(child: PageChild): Promise<CreateUiInstructionTask> {
	const requirements = [
		"严格依据对应 UI 图片实现布局和交互结构",
		...(child.type ? [`子节点类型：${child.type}`] : []),
		...(child.uiPath ? [`子节点图片：${normalizePath(child.uiPath)}`] : []),
		...buildRequirementLines(child.requirements),
		...buildDependencyRequirementLines(child.depends ?? child.tools),
	];

	if (requirements.length === 1) {
		requirements.push("如有与主页面的交互，请保留清晰的组件接口");
	}

	return {
		type: child.isComponent ? "create_component" : "create_child_page",
		name: `创建${child.name ?? "子页面"}`,
		description: child.description ?? `请根据 UI 图片创建 ${child.name ?? "子页面"}`,
		filePath: child.targetPath ? normalizePath(child.targetPath) : undefined,
		requirements,
	};
}

export async function buildCreateUiInstruction(page: PageDefinition): Promise<CreateUiInstruction> {
	const requestApiNames = (page.requests ?? [])
		.map((item) => item.apiName?.trim())
		.filter((item): item is string => Boolean(item));

	const tasks: CreateUiInstructionTask[] = [
		{
			type: "create_page",
			name: `创建${page.name ?? "页面"}`,
			description: "请根据页面配置和 UI 图片创建",
			filePath: page.targetPath ? normalizePath(page.targetPath) : undefined,
			requirements: [
				...(page.type ? [`页面类型：${page.type}`] : []),
				"优先依据 page 中的 name、description、depends、requirements 和 children 生成页面代码",
				...(page.uiPath ? [`主页面图片：${normalizePath(page.uiPath)}`] : []),
				"主页面图片从 page.uiPath 读取，子组件图片从 page.children[].uiPath 读取",
				requestApiNames.length > 0 ? `页面中涉及的 API 函数包括：${requestApiNames.join("、")}` : "如果页面不依赖 API，则不要生成无关请求逻辑",
				...buildRequirementLines(page.requirements),
				...buildDependencyRequirementLines(page.depends ?? page.tools),
			],
		},
	];

	for (const child of page.children ?? []) {
		tasks.push(await buildChildTask(child));
	}

	return {
		tasks,
		additionalNotes: [
			"create_ui_mcp 不负责生成 API；如 page.requests 存在，必须先执行 create_api_mcp 并回填 apiName。",
			"page.depends 用于描述组件、工具、模型和图片等依赖；page.requirements 用于描述布局和交互要求。",
			"为兼容历史数据，若仍存在 tools 字段，会按 depends 的同等语义处理。",
			"页面、子组件和弹框都应根据 page.uiPath 和 page.children[].uiPath 生成，而不是凭空补充未声明结构。",
		],
	};
}

export type { PageDefinition };
