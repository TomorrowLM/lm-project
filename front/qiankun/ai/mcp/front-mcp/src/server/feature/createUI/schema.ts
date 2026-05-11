export const createUiToolInputSchema = {
	type: "object",
	description: "读取 page.json 并返回页面创建指令；若 requests 存在则要求已回填 apiName",
	properties: {
		page: {
			type: "string",
			description: "页面配置 JSON 文件路径，支持相对路径或绝对路径",
		},
	},
	required: ["page"],
} as const;
