# AI 聊天窗子应用技术方案

## 1. 目标

本子应用用于在 qiankun 微前端体系中承载统一 AI 聊天窗，参考 DeepSeek 的简洁聊天体验，并结合已有项目中的聊天技术实现：

- `yqa-g-h5-agent`：统一消息流、SSE 状态流、停止 / 重试 / Markdown / 自动滚动方案。
- `igor-llm`：`think` / `plan` / `phase` / `answer` / `quote` 等 Agent 内容块展示方案。

最终目标是形成一套可演进的统一聊天界面，后续支持普通对话、推理过程、工具调用、RAG 引用、多智能体协作等能力。

## 2. 设计原则

### 2.1 DeepSeek-like 简洁体验

界面参考 DeepSeek 的聊天展示方式：

- 页面背景清爽，内容居中展示。
- 空态下输入框居中，突出“开始提问”。
- 对话后输入框固定在底部。
- 模式按钮显性展示，例如 `DeepThink`、`Search`、`Tools`。
- 思考、计划、工具调用和引用信息使用低干扰的折叠或卡片展示。

### 2.2 统一消息模型

不让 UI 直接依赖某个后端协议，而是统一转换为前端标准消息模型。

```text
后端事件 / 内容块
	-> adapter 协议适配层
	-> UnifiedMessage[]
	-> ViewModel
	-> ChatMessageList
	-> 各类 Message / Block 渲染器
```

### 2.3 渐进式实现

先实现可运行的聊天窗，再逐步接入复杂 Agent 能力：

1. Mock 流式输出。
2. 接入 `lm-agent` 简单 SSE。
3. 支持 Agent 内容块。
4. 接入 qiankun 主应用。
5. 扩展工具调用、RAG、Memory、多 Agent。

## 3. 总体架构

```text
用户输入
	↓
ChatComposer
	↓
useUnifiedChat
	↓
SSE / REST 请求
	↓
Event Adapter
	↓
UnifiedMessage[]
	↓
Chat ViewModel
	↓
UnifiedChatMessageList
	↓
User / Assistant / System 渲染器
```

推荐目录结构：

```text
src/
	pages/
		chat/
			index.tsx

	components/
		ChatShell/
			ChatShell.tsx
			ChatHeader.tsx
			ChatEmpty.tsx
			ChatComposer.tsx
			ChatModeBar.tsx

		ChatMessages/
			ChatMessageList.tsx
			MessageRenderer.tsx
			UserMessage.tsx
			AssistantMessage.tsx
			SystemMessage.tsx

		ChatBlocks/
			TextBlock.tsx
			MarkdownBlock.tsx
			ThinkBlock.tsx
			PlanBlock.tsx
			PhaseBlock.tsx
			ToolBlock.tsx
			QuoteBlock.tsx

	hooks/
		chat/
			useUnifiedChat.ts
			useChatStream.ts
			useAutoScroll.ts

	services/
		chat.ts

	adapters/
		chat/
			simpleSseAdapter.ts
			yqaAdapter.ts
			igorAdapter.ts

	types/
		chat.ts
```

## 4. 技术选型

| 模块 | 推荐方案 | 说明 |
|---|---|---|
| 前端框架 | React + Vite | 适合 qiankun 子应用与快速 Demo |
| 微前端 | qiankun | 接入 `base` 主应用 |
| SSE | `@microsoft/fetch-event-source` | 初期更轻、更直观，适合学习和 FastAPI SSE |
| 复杂聊天协议 | `@ant-design/x-sdk` | 后续复杂化后可参考 `yqa-g-h5-agent` 升级 |
| Markdown | `markdown-it` + `html-react-parser` | 统一 Markdown 渲染方案，支持引用替换、数学公式、复杂代码块和 RAG 来源 |
| 代码高亮 | `highlight.js` | 渲染代码块语言标识、复制按钮和高亮样式 |
| 公式渲染 | `markdown-it-katex` + `katex` | 支持行内公式和块级公式 |
| 样式 | Less / CSS Modules | 与当前 qiankun 项目风格兼容 |
| 状态管理 | React state | 初期够用，复杂后再引入 Zustand |

### 4.1 Markdown 渲染方案

本项目统一采用 `markdown-it + html-react-parser`，不再同时引入 `@ant-design/x-markdown`，避免两套 Markdown 渲染链路重复。

#### 4.1.1 方案对比

| 方案 | 适合场景 | 优点 | 不足 | 本项目结论 |
|---|---|---|---|---|
| `@ant-design/x-markdown` | 快速实现流式 Markdown 聊天 | 接入简单；适合普通 AI 回复；与 `@ant-design/x-sdk` 生态更一致；流式 Markdown 体验开箱更好 | 复杂引用替换、RAG 来源、业务卡片、工具结果节点替换不够灵活 | 不作为本项目主方案 |
| `markdown-it + html-react-parser` | DeepSeek-like 复杂内容展示、RAG、引用替换、工具卡片 | 可控性强；可把 HTML 节点替换为 React 组件；适合引用、公式、代码块、复杂 Agent 内容块 | 需要自己处理 XSS、代码块、表格、公式、流式优化和样式 | 作为本项目统一 Markdown 方案 |

`@ant-design/x-markdown` 不是不能用，而是不适合作为当前 `ai` 子应用的长期主方案。它更适合“快速做一个普通流式 Markdown 聊天窗”。本项目目标是 DeepSeek-like Agent 聊天窗，后续会展示：

```text
think / plan / phase / tool / answer / quote
RAG 引用来源
工具调用卡片
复杂代码块
数学公式
业务扩展卡片
```

这些能力要求 Markdown 渲染层具备更强的节点替换和结构化扩展能力，所以采用 `markdown-it + html-react-parser`。

#### 4.1.2 为什么不采用 `@ant-design/x-markdown`

主要原因：

1. **避免双 Markdown 链路**：同时维护 `@ant-design/x-markdown` 和 `markdown-it` 会造成样式、能力和行为不一致。
2. **引用替换不够直观**：RAG 场景需要把 `[ref_1]`、`【1】` 等引用标记替换成 `Reference` React 组件，`markdown-it + html-react-parser` 更直接。
3. **复杂业务节点更多**：后续 `tool`、`quote`、`card`、`agentForm` 等内容更接近 `igor-llm` 的组件映射思路。
4. **DeepSeek-like 展示不只是 Markdown**：最终界面包含思考、计划、工具、引用、答案多个块，Markdown 只是 `answer` 块的一部分。
5. **长期扩展优先于初期省事**：虽然 `@ant-design/x-markdown` 初期更快，但后续复杂扩展可能需要绕过或重写其渲染能力。

保留结论：

```text
普通 AI 回复 / 快速 Demo：@ant-design/x-markdown 更省事
Agent / RAG / DeepSeek-like 复杂展示：markdown-it + html-react-parser 更合适
```

选择原因：

- 后续需要支持 `quote` 引用替换和 RAG 来源展示。
- 需要将代码块、引用标记、表格等 HTML 节点替换为 React 组件。
- 需要兼容 Agent 内容块中的 `answer`、`quote`、`tool` 等复杂渲染。
- `igor-llm` 已验证该路线适合知识库 / 法规库 / 引用类聊天场景。

基础链路：

```text
Markdown 文本
	-> 引用标记预处理
	-> markdown-it 渲染 HTML
	-> html-react-parser 解析 HTML
	-> 替换为 CodeBlock / Reference / Table 等 React 组件
```

推荐依赖：

```text
markdown-it
html-react-parser
highlight.js
markdown-it-katex
katex
markdown-it-task-lists
markdown-it-sub
markdown-it-sup
dompurify
```

实现职责：

| 能力 | 方案 |
|---|---|
| Markdown 基础渲染 | `markdown-it` |
| React 组件替换 | `html-react-parser` |
| XSS 安全 | 默认关闭 `html`；如需开放 HTML，使用 `dompurify` 清洗 |
| 代码块 | 自定义 `CodeBlock`，支持高亮、语言标识、复制 |
| 表格 | 自定义表格样式，支持横向滚动和移动端适配 |
| 数学公式 | `markdown-it-katex` + `katex/dist/katex.min.css` |
| 任务列表 / 上下标 | `markdown-it-task-lists`、`markdown-it-sub`、`markdown-it-sup` |
| 引用替换 | 将 `[ref_1]` 等标记替换为 `Reference` 组件 |
| 流式优化 | 只重渲染当前 `answer` block，必要时节流 |

安全要求：

```ts
const md = new MarkdownIt({
	html: false,
	linkify: true,
	typographer: true,
	breaks: true,
});
```

如果后续必须支持 HTML：

```text
markdown-it render -> DOMPurify.sanitize -> html-react-parser
```

链接安全要求：

- 禁止 `javascript:`、`data:` 等危险协议。
- 外链统一加 `target="_blank"`。
- 外链统一加 `rel="noopener noreferrer"`。

引用替换示例：

```text
原始回答：Function Calling 是工具调用基础 [ref_1]
预处理后：Function Calling 是工具调用基础 <span data-ref="ref_1"></span>
最终渲染：Function Calling 是工具调用基础 <Reference id="ref_1" />
```

流式渲染策略：

```text
ANSWER_DELTA
	-> 追加 answer block content
	-> 只重新渲染当前 MarkdownBlock
	-> 流结束后执行一次完整解析和修正
```

## 5. 统一消息模型

```ts
type UnifiedMessageRole = 'user' | 'assistant' | 'system';

type UnifiedContentType =
	| 'text'
	| 'markdown'
	| 'think'
	| 'plan'
	| 'phase'
	| 'answer'
	| 'quote'
	| 'tool'
	| 'card';

interface UnifiedMessage {
	id: string;
	role: UnifiedMessageRole;
	status?: 'loading' | 'streaming' | 'done' | 'error';
	content: UnifiedContentBlock[];
	createdAt?: number;
}

interface UnifiedContentBlock {
	id: string;
	type: UnifiedContentType;
	content?: string;
	title?: string;
	status?: 'pending' | 'running' | 'success' | 'error';
	data?: unknown;
}
```

设计含义：

- `user` 消息通常只有一个 `text` 块。
- `assistant` 消息可以包含多个块，如 `think`、`plan`、`phase`、`answer`、`quote`。
- `system` 消息用于展示停止、错误、登录失效等提示。
- UI 只消费统一模型，不直接绑定后端原始事件。

## 6. 内容块渲染

| type | 渲染组件 | 展示方式 |
|---|---|---|
| `text` | `TextBlock` | 普通文本 |
| `markdown` / `answer` | `MarkdownBlock` | Markdown 回复 |
| `think` | `ThinkBlock` | 可折叠思考过程 |
| `plan` | `PlanBlock` | 执行计划列表 |
| `phase` | `PhaseBlock` | 当前阶段状态 |
| `tool` | `ToolBlock` | 工具调用卡片 |
| `quote` | `QuoteBlock` | RAG / 搜索引用来源 |
| `card` | `DynamicCardBlock` | 业务扩展卡片 |

渲染结构：

```text
MessageRenderer
	├── UserMessage
	├── AssistantMessage
	│     ├── ThinkBlock
	│     ├── PlanBlock
	│     ├── PhaseBlock
	│     ├── ToolBlock
	│     ├── AnswerBlock
	│     └── QuoteBlock
	└── SystemMessage
```

## 7. SSE 适配层

### 7.1 简单 SSE 适配

适合 `lm-agent` 初期纯文本流：

```text
delta text -> answer block 追加内容
done       -> answer block 完成
error      -> system error
```

### 7.2 `yqa-g-h5-agent` 风格适配

```text
PROCESSING_STATUS -> phase block
MESSAGE_DELTA     -> answer block 追加内容
MESSAGE_COMPLETE  -> answer block 完成
STREAM_FAILED     -> system error
```

### 7.3 `igor-llm` 风格适配

```text
think  -> think block
plan   -> plan block
phase  -> phase block
answer -> answer block
quote  -> quote block
```

## 8. 交互设计

### 8.1 空态

```text
Hi，我是 AI 助手
可以问我 Agent、代码、文档和知识库问题

[ DeepThink ] [ Search ] [ Tools ]

┌──────────────────────────────────────┐
│  给 AI 发送消息...                    │
└──────────────────────────────────────┘

推荐问题：
- 帮我解释 Agent 三要素
- 用 Mermaid 画出 ReAct 流程
- 分析这个项目的聊天架构
```

### 8.2 聊天态

```text
User:
	解释一下 Function Calling

Assistant:
	正在理解你的问题...

	Thinking
	我需要先区分普通 API 调用和 Function Calling...

	Answer
	Function Calling 是让模型输出结构化函数调用请求...
```

### 8.3 模式按钮

```ts
interface ChatModeState {
	deepThink: boolean;
	search: boolean;
	tools: boolean;
}
```

发送请求时透传：

```json
{
	"input": {
		"type": "TEXT",
		"text": "解释 Function Calling"
	},
	"options": {
		"deepThink": true,
		"search": false,
		"tools": true
	}
}
```

## 9. 错误与停止生成

| 类型 | 场景 | 展示 |
|---|---|---|
| 建连失败 | 后端 401 / 500 / 网络错误 | 用户消息下方展示发送失败和重试入口 |
| 流中失败 | SSE 已连接后失败 | 系统消息提示服务异常 |
| 用户取消 | 点击停止 | 有内容则保留；无内容则显示“已停止生成” |

停止生成初期只中断前端 SSE：

```text
AbortController.abort()
```

后续后端支持 `runId` 后，再增加取消接口：

```text
POST /chat/runs/{runId}/cancel
```

## 10. 自动滚动

参考 `yqa-g-h5-agent`：

```text
新消息进入 -> 强制滚到底部
内容高度变化 -> ResizeObserver 自动跟随
用户主动上滑 -> 不强制打断
```

## 11. qiankun 接入目标

子应用开发端口：

```text
8005
```

主应用路由：

```text
/qiankun/ai
```

生产入口：

```text
/qiankun/child/ai/
```

接入方式：

```text
base registerMicroApps
	name: ai
	entry: //localhost:8005 或 /qiankun/child/ai/
	container: #ai-container
	activeRule: /qiankun/ai
```

## 12. 实施阶段

### 第一阶段：统一聊天壳

- DeepSeek-like 页面布局。
- 空态和聊天态。
- 消息列表。
- 输入框。
- Mock 流式输出。

### 第二阶段：接入简单 SSE

- 接 `lm-agent` 的聊天流。
- 支持 `answer` 流式输出。
- 支持停止生成。

### 第三阶段：Agent 内容块

- 支持 `think`。
- 支持 `plan`。
- 支持 `phase`。
- 支持 `tool`。
- 支持 `quote`。

### 第四阶段：接入 qiankun

- `ai` 作为 qiankun 子应用导出生命周期。
- `base` 注册 `ai` 子应用。
- 支持开发与生产入口。

## 13. 最终方案总结

本子应用采用：

```text
DeepSeek 的清爽交互
+
yqa-g-h5-agent 的统一消息流与 SSE 状态设计
+
igor-llm 的 Agent 内容块模型
```

最终形成：

```text
Unified Chat UI
	├── DeepSeek-like ChatShell
	├── UnifiedMessage 数据模型
	├── Assistant 内容块渲染
	├── SSE Adapter 协议适配层
	└── qiankun 子应用导出
```

## 14. 后端返回与前端渲染案例

本节用一个完整例子说明：后端通过 SSE 返回什么数据，前端如何转换并渲染。

### 14.1 后端 SSE 响应结构总览

后端每条 SSE 消息由 `event` 和 `data` 两部分组成：

```text
event: ANSWER_DELTA
data: { ...JSON 字符串... }
```

其中 `event` 是 SSE 原生事件名，`data` 是 JSON 字符串。前端收到后解析 `data`，再根据 `eventType` 和 `payload.type` 更新聊天消息。

推荐后端统一返回结构：

```ts
interface ChatSSEEvent {
	/** SSE 事件类型，用于前端分发处理 */
	eventType: ChatEventType;
	/** 会话 ID，同一轮连续聊天共用一个 conversationId */
	conversationId?: string;
	/** 后端本次 Agent 执行 ID，用于停止生成、状态查询和排障 */
	runId?: string;
	/** AI 消息 ID，同一条 assistant 消息下可包含多个内容块 */
	messageId?: string | null;
	/** 事件序号，用于前端排查乱序和丢包，可选 */
	seq?: number;
	/** 事件载荷，不同 eventType 对应不同结构 */
	payload?: ChatEventPayload | null;
	/** 错误信息，仅 STREAM_FAILED 等失败事件携带 */
	error?: ChatStreamError | null;
}

type ChatEventType =
	| 'STREAM_CREATED'
	| 'MESSAGE_STARTED'
	| 'PHASE'
	| 'THINK_DELTA'
	| 'PLAN'
	| 'TOOL_STARTED'
	| 'TOOL_COMPLETED'
	| 'ANSWER_DELTA'
	| 'QUOTE'
	| 'MESSAGE_COMPLETE'
	| 'STREAM_COMPLETED'
	| 'STREAM_FAILED';
```

字段说明：

| 字段 | 类型 | 是否必填 | 说明 |
|---|---|---:|---|
| `eventType` | `ChatEventType` | 是 | 前端事件分发依据，例如 `ANSWER_DELTA`、`TOOL_STARTED`。 |
| `conversationId` | `string` | 建议必填 | 会话 ID，表示一整场连续聊天。首次请求可由后端创建并返回。 |
| `runId` | `string` | 建议必填 | 后端本次执行 ID，一次提问对应一次 run，用于停止生成。 |
| `messageId` | `string \| null` | 内容事件必填 | assistant 消息 ID；同一回答过程中的多个 block 共用同一个 `messageId`。 |
| `seq` | `number` | 可选 | 事件序号，用于调试乱序、重复、丢包。 |
| `payload` | `object \| null` | 视事件而定 | 事件主体数据，例如回答增量、工具调用、引用来源。 |
| `error` | `object \| null` | 失败事件必填 | 错误码、错误文案、是否可重试等。 |

### 14.2 内容块 Payload 结构

`payload` 是前端真正用来渲染 UI 的内容块。推荐统一成以下结构：

```ts
interface ChatContentBlockPayload {
	/** 内容块 ID，同一个 blockId 的 delta 会追加或合并到同一个块 */
	blockId: string;
	/** 内容块类型，决定前端用哪个 Block 组件渲染 */
	type: ChatContentBlockType;
	/** 内容块标题，例如“思考过程”“回答计划”“参考来源” */
	title?: string;
	/** 文本内容，适用于 think / phase / answer 等文本块 */
	content?: string;
	/** 内容块状态，用于展示 loading、成功、失败 */
	status?: ChatBlockStatus;
	/** 结构化扩展数据，适用于 plan / tool / quote / card */
	data?: unknown;
}

type ChatContentBlockType =
	| 'phase'
	| 'think'
	| 'plan'
	| 'tool'
	| 'answer'
	| 'quote'
	| 'card';

type ChatBlockStatus = 'pending' | 'running' | 'streaming' | 'success' | 'error';
```

字段说明：

| 字段 | 类型 | 是否必填 | 说明 |
|---|---|---:|---|
| `blockId` | `string` | 是 | 内容块唯一 ID；流式追加时，同一块保持同一个 `blockId`。 |
| `type` | `ChatContentBlockType` | 是 | 渲染类型，例如 `think` 用思考块，`answer` 用 Markdown 回答块。 |
| `title` | `string` | 可选 | 展示标题，例如“思考过程”“调用工具：搜索”。 |
| `content` | `string` | 文本块必填 | 文本内容；`ANSWER_DELTA` / `THINK_DELTA` 中是增量文本。 |
| `status` | `ChatBlockStatus` | 建议必填 | 块状态，用于展示执行中、流式中、成功、失败。 |
| `data` | `unknown` | 结构化块必填 | 计划步骤、工具参数、引用来源等结构化数据。 |

### 14.3 各类事件 payload 说明

| 事件 | payload.type | 主要字段 | 前端行为 |
|---|---|---|---|
| `STREAM_CREATED` | - | `conversationId`、`runId` | 记录会话和运行 ID。 |
| `MESSAGE_STARTED` | - | `messageId` | 创建 assistant 空消息。 |
| `PHASE` | `phase` | `title`、`content`、`status` | 展示当前处理阶段。 |
| `THINK_DELTA` | `think` | `blockId`、`content`、`status` | 追加思考过程内容。 |
| `PLAN` | `plan` | `data.steps` | 渲染计划步骤列表。 |
| `TOOL_STARTED` | `tool` | `data.toolName`、`data.arguments` | 渲染工具执行中卡片。 |
| `TOOL_COMPLETED` | `tool` | `data.toolName`、`data.result` | 更新工具卡片为完成状态。 |
| `ANSWER_DELTA` | `answer` | `blockId`、`content`、`status` | 追加最终回答 Markdown。 |
| `QUOTE` | `quote` | `data.references` | 渲染引用来源。 |
| `MESSAGE_COMPLETE` | - | `suggestedActions` | 显示复制、重试、推荐追问。 |
| `STREAM_COMPLETED` | - | - | 关闭 loading / streaming。 |
| `STREAM_FAILED` | - | `error` | 展示系统错误或重试入口。 |

### 14.4 结构化 data 字段示例

计划步骤数据：

```ts
interface PlanData {
	/** 计划步骤列表 */
	steps: Array<{
		/** 步骤 ID */
		id: string;
		/** 步骤标题 */
		title: string;
		/** 步骤状态 */
		status: 'pending' | 'running' | 'success' | 'error';
	}>;
}
```

工具调用数据：

```ts
interface ToolData {
	/** 工具名称，例如 web_search、code_example */
	toolName: string;
	/** 工具入参，用于展示和排障 */
	arguments?: Record<string, unknown>;
	/** 工具执行结果摘要 */
	result?: string;
}
```

引用来源数据：

```ts
interface QuoteData {
	/** 引用来源列表 */
	references: Array<{
		/** 引用 ID */
		id: string;
		/** 来源标题 */
		title: string;
		/** 来源地址，可以是 URL 或本地资源标识 */
		url?: string;
		/** 命中的内容片段 */
		snippet?: string;
	}>;
}
```

推荐追问数据：

```ts
interface SuggestedAction {
	/** 推荐动作 ID */
	actionId: string;
	/** 展示文案 */
	label: string;
	/** 点击后再次发送的输入内容 */
	input: {
		type: 'TEXT';
		text: string;
	};
}
```

错误数据：

```ts
interface ChatStreamError {
	/** 稳定错误码，前端可按错误码映射友好文案 */
	code: string;
	/** 后端错误描述 */
	message: string;
	/** 是否建议前端展示重试入口 */
	retryable: boolean;
	/** 排障 ID，用于日志关联 */
	requestId?: string;
}
```

### 14.5 字段生成规则

| 字段 | 生成方 | 生成时机 | 规则 |
|---|---|---|---|
| `conversationId` | 后端 | 首次创建会话时 | 前端首次可不传，后续追问复用。 |
| `clientRequestId` | 前端 | 每次点击发送时 | 每次请求都新生成，建议使用 `crypto.randomUUID()`。 |
| `runId` | 后端 | 每次 Agent 执行开始时 | 每次提问生成一个新 `runId`，用于停止当前生成。 |
| `messageId` | 后端 | assistant 消息开始时 | 同一次回答过程保持不变。 |
| `blockId` | 后端 | 内容块首次出现时 | 同一块流式追加必须保持不变。 |
| `seq` | 后端 | 每次发送 SSE 事件时 | 单调递增，便于前端排查事件顺序。 |

### 14.6 ID 字段职责说明

这些 ID 分别服务于不同层级，避免把会话、请求、执行、消息和内容块混在一起。

```text
conversationId
  └── clientRequestId
	  └── runId
		  └── messageId
			  └── blockId
				  └── seq
```

| 字段 | 含义 | 主要用途 |
|---|---|---|
| `conversationId` | 一整场连续聊天 | 多轮上下文、历史记录、继续追问。 |
| `clientRequestId` | 前端本次点击发送的请求 ID | 防重复、幂等、前后端日志关联。 |
| `runId` | 后端本次 Agent 执行 ID | 停止生成、执行状态查询、排障。 |
| `messageId` | 一条 assistant 消息 ID | 将多个内容块归属于同一条 AI 回复。 |
| `blockId` | assistant 消息里的内容块 ID | 流式追加、更新指定块，如 answer / think / tool。 |
| `seq` | SSE 事件顺序号 | 判断事件顺序、重复、丢失。 |

`clientRequestId` 是前端为“本次发送请求”生成的唯一编号，不是会话 ID，也不是后端运行 ID。

```ts
const clientRequestId = crypto.randomUUID();
```

每次发送新问题都应生成新的 `clientRequestId`：

```text
第一次提问 -> clientRequestId = req_001
第二次追问 -> clientRequestId = req_002
第三次重试 -> clientRequestId = req_003
```

### 14.7 ID 分阶段使用建议

对最小 Demo 来说，不必一开始强依赖全部 ID；但文档保留完整设计，方便后续扩展。

| 阶段 | 建议强依赖字段 | 说明 |
|---|---|---|
| 普通流式聊天 | `clientRequestId`、`messageId`、`blockId` | 支持发送、AI 流式回答和内容追加。 |
| 多轮会话 | `conversationId` | 支持上下文续聊和历史会话。 |
| Agent 执行控制 | `runId` | 支持停止生成、运行状态查询。 |
| 生产排障 | `seq` | 支持分析 SSE 事件顺序、重复和丢失。 |

一句话总结：

```text
conversationId 管上下文，clientRequestId 管请求，runId 管执行，messageId 管消息，blockId 管内容块，seq 管事件顺序。
```

### 14.8 用户请求

前端发送：

```json
{
	"conversationId": "conv_001",
	"clientRequestId": "req_001",
	"input": {
		"type": "TEXT",
		"text": "帮我解释 Function Calling，并给一个例子"
	},
	"options": {
		"deepThink": true,
		"search": false,
		"tools": true
	}
}
```

### 14.9 SSE 流创建

```text
event: STREAM_CREATED
data: {
	"eventType": "STREAM_CREATED",
	"conversationId": "conv_001",
	"runId": "run_001",
	"messageId": null,
	"payload": null
}
```

前端处理：

```text
记录 conversationId / runId，用于后续续聊、停止生成和排障。
```

### 14.10 阶段状态

```text
event: PHASE
data: {
	"eventType": "PHASE",
	"conversationId": "conv_001",
	"runId": "run_001",
	"messageId": "msg_ai_001",
	"payload": {
		"blockId": "phase_001",
		"type": "phase",
		"title": "理解请求",
		"content": "正在分析你的问题...",
		"status": "running"
	}
}
```

前端渲染：

```text
Assistant:
	正在分析你的问题...
```

### 14.11 思考过程

```text
event: THINK_DELTA
data: {
	"eventType": "THINK_DELTA",
	"conversationId": "conv_001",
	"runId": "run_001",
	"messageId": "msg_ai_001",
	"payload": {
		"blockId": "think_001",
		"type": "think",
		"title": "思考过程",
		"content": "我需要先解释 Function Calling 和普通 API 调用的区别。",
		"status": "streaming"
	}
}
```

继续返回同一个 `blockId`：

```text
event: THINK_DELTA
data: {
	"eventType": "THINK_DELTA",
	"conversationId": "conv_001",
	"runId": "run_001",
	"messageId": "msg_ai_001",
	"payload": {
		"blockId": "think_001",
		"type": "think",
		"content": "然后给出 JSON 参数和工具执行流程。",
		"status": "streaming"
	}
}
```

前端处理：

```text
同一个 messageId + blockId 的内容追加到同一个 think block。
```

前端渲染：

```text
▾ 正在思考
	我需要先解释 Function Calling 和普通 API 调用的区别。然后给出 JSON 参数和工具执行流程。
```

### 14.12 计划步骤

```text
event: PLAN
data: {
	"eventType": "PLAN",
	"conversationId": "conv_001",
	"runId": "run_001",
	"messageId": "msg_ai_001",
	"payload": {
		"blockId": "plan_001",
		"type": "plan",
		"title": "回答计划",
		"status": "success",
		"data": {
			"steps": [
				{ "id": "step_1", "title": "解释概念", "status": "success" },
				{ "id": "step_2", "title": "对比普通 API 调用", "status": "success" },
				{ "id": "step_3", "title": "给出代码例子", "status": "running" }
			]
		}
	}
}
```

前端渲染：

```text
回答计划
✅ 解释概念
✅ 对比普通 API 调用
⏳ 给出代码例子
```

### 14.13 工具调用

```text
event: TOOL_STARTED
data: {
	"eventType": "TOOL_STARTED",
	"conversationId": "conv_001",
	"runId": "run_001",
	"messageId": "msg_ai_001",
	"payload": {
		"blockId": "tool_001",
		"type": "tool",
		"title": "调用工具：代码示例生成器",
		"status": "running",
		"data": {
			"toolName": "code_example",
			"arguments": {
				"language": "typescript",
				"topic": "function calling"
			}
		}
	}
}
```

前端渲染：

```text
🔧 调用工具：代码示例生成器
状态：执行中
参数：language=typescript, topic=function calling
```

工具完成：

```text
event: TOOL_COMPLETED
data: {
	"eventType": "TOOL_COMPLETED",
	"conversationId": "conv_001",
	"runId": "run_001",
	"messageId": "msg_ai_001",
	"payload": {
		"blockId": "tool_001",
		"type": "tool",
		"title": "工具执行完成",
		"status": "success",
		"data": {
			"toolName": "code_example",
			"result": "已生成 TypeScript 示例"
		}
	}
}
```

前端渲染：

```text
✅ 工具执行完成
已生成 TypeScript 示例
```

### 14.14 最终回答流式输出

```text
event: ANSWER_DELTA
data: {
	"eventType": "ANSWER_DELTA",
	"conversationId": "conv_001",
	"runId": "run_001",
	"messageId": "msg_ai_001",
	"payload": {
		"blockId": "answer_001",
		"type": "answer",
		"content": "Function Calling 是让大模型输出结构化函数调用请求，",
		"status": "streaming"
	}
}
```

继续返回：

```text
event: ANSWER_DELTA
data: {
	"eventType": "ANSWER_DELTA",
	"conversationId": "conv_001",
	"runId": "run_001",
	"messageId": "msg_ai_001",
	"payload": {
		"blockId": "answer_001",
		"type": "answer",
		"content": "由你的程序实际执行函数，再把结果交还给模型生成最终回复。",
		"status": "streaming"
	}
}
```

前端渲染：

```text
Function Calling 是让大模型输出结构化函数调用请求，由你的程序实际执行函数，再把结果交还给模型生成最终回复。
```

### 14.15 引用来源

```text
event: QUOTE
data: {
	"eventType": "QUOTE",
	"conversationId": "conv_001",
	"runId": "run_001",
	"messageId": "msg_ai_001",
	"payload": {
		"blockId": "quote_001",
		"type": "quote",
		"title": "参考来源",
		"status": "success",
		"data": {
			"references": [
				{
					"id": "ref_1",
					"title": "OpenAI Function Calling Guide",
					"url": "https://platform.openai.com/docs",
					"snippet": "Function calling allows models to call tools..."
				},
				{
					"id": "ref_2",
					"title": "项目 agent.md",
					"url": "local://lm-document/document/agent.md",
					"snippet": "Function Calling 是让 LLM 能够调用外部函数的机制..."
				}
			]
		}
	}
}
```

前端渲染：

```text
参考来源
[1] OpenAI Function Calling Guide
[2] 项目 agent.md
```

### 14.16 消息完成

```text
event: MESSAGE_COMPLETE
data: {
	"eventType": "MESSAGE_COMPLETE",
	"conversationId": "conv_001",
	"runId": "run_001",
	"messageId": "msg_ai_001",
	"payload": {
		"suggestedActions": [
			{
				"actionId": "suggest_1",
				"label": "再给一个 Python 例子",
				"input": {
					"type": "TEXT",
					"text": "再给一个 Python Function Calling 例子"
				}
			},
			{
				"actionId": "suggest_2",
				"label": "解释它和 MCP 的关系",
				"input": {
					"type": "TEXT",
					"text": "Function Calling 和 MCP 有什么关系？"
				}
			}
		]
	}
}
```

前端渲染：

```text
[复制] [重试]

推荐追问：
- 再给一个 Python 例子
- 解释它和 MCP 的关系
```

### 14.17 流结束

```text
event: STREAM_COMPLETED
data: {
	"eventType": "STREAM_COMPLETED",
	"conversationId": "conv_001",
	"runId": "run_001",
	"messageId": "msg_ai_001",
	"payload": null
}
```

前端处理：

```text
关闭 loading，关闭 streaming，显示操作栏。
```

### 14.18 前端统一消息结果

经过 adapter 转换后，前端内部数据结构示例：

```json
{
	"id": "msg_ai_001",
	"role": "assistant",
	"status": "done",
	"content": [
		{
			"id": "phase_001",
			"type": "phase",
			"title": "理解请求",
			"content": "正在分析你的问题...",
			"status": "success"
		},
		{
			"id": "think_001",
			"type": "think",
			"title": "思考过程",
			"content": "我需要先解释 Function Calling 和普通 API 调用的区别。然后给出 JSON 参数和工具执行流程。",
			"status": "success"
		},
		{
			"id": "plan_001",
			"type": "plan",
			"title": "回答计划",
			"status": "success",
			"data": {
				"steps": [
					{ "id": "step_1", "title": "解释概念", "status": "success" },
					{ "id": "step_2", "title": "对比普通 API 调用", "status": "success" },
					{ "id": "step_3", "title": "给出代码例子", "status": "success" }
				]
			}
		},
		{
			"id": "tool_001",
			"type": "tool",
			"title": "工具执行完成",
			"status": "success",
			"data": {
				"toolName": "code_example",
				"result": "已生成 TypeScript 示例"
			}
		},
		{
			"id": "answer_001",
			"type": "answer",
			"content": "Function Calling 是让大模型输出结构化函数调用请求，由你的程序实际执行函数，再把结果交还给模型生成最终回复。",
			"status": "success"
		},
		{
			"id": "quote_001",
			"type": "quote",
			"title": "参考来源",
			"status": "success",
			"data": {
				"references": [
					{
						"id": "ref_1",
						"title": "OpenAI Function Calling Guide",
						"url": "https://platform.openai.com/docs"
					}
				]
			}
		}
	]
}
```

### 14.19 前端渲染伪代码

```tsx
function AssistantMessage({ message }) {
	return (
		<div className="assistant-message">
			{message.content.map((block) => {
				switch (block.type) {
					case 'think':
						return <ThinkBlock key={block.id} block={block} />;
					case 'plan':
						return <PlanBlock key={block.id} block={block} />;
					case 'phase':
						return <PhaseBlock key={block.id} block={block} />;
					case 'tool':
						return <ToolBlock key={block.id} block={block} />;
					case 'answer':
						return <MarkdownBlock key={block.id} content={block.content} />;
					case 'quote':
						return <QuoteBlock key={block.id} block={block} />;
					default:
						return null;
				}
			})}
		</div>
	);
}
```

### 14.20 最小可用 SSE 版本

如果初期只做普通聊天 Demo，后端只需要三种事件。

开始：

```text
event: MESSAGE_STARTED
data: {
	"eventType": "MESSAGE_STARTED",
	"messageId": "msg_ai_001"
}
```

文本增量：

```text
event: ANSWER_DELTA
data: {
	"eventType": "ANSWER_DELTA",
	"messageId": "msg_ai_001",
	"payload": {
		"blockId": "answer_001",
		"type": "answer",
		"content": "这是一段流式返回内容",
		"status": "streaming"
	}
}
```

结束：

```text
event: STREAM_COMPLETED
data: {
	"eventType": "STREAM_COMPLETED",
	"messageId": "msg_ai_001"
}
```

最小版本即可完成：

```text
用户消息
AI 流式回答
loading
结束状态
```

后续再逐步增加：

```text
THINK_DELTA
PLAN
PHASE
TOOL_STARTED
TOOL_COMPLETED
QUOTE
MESSAGE_COMPLETE
STREAM_FAILED
```
