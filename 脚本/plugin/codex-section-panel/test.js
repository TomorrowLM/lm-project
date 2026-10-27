"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const sourcePath = path.join(__dirname, "main.js");
let source = "";
try {
  source = fs.readFileSync(sourcePath, "utf8");
} catch (error) {
  // The initial red test intentionally treats a missing implementation as a feature failure.
}

const obsidian = {
  Component: class {},
  ItemView: class {},
  MarkdownRenderer: { renderMarkdown: async () => {} },
  MarkdownView: class {},
  Notice: class {},
  Plugin: class {},
  PluginSettingTab: class {},
  Setting: class {},
  setIcon: () => {},
};
const sandbox = {
  clearTimeout,
  console,
  exports: {},
  module: { exports: {} },
  require: (id) => id === "obsidian" ? obsidian : require(id),
  setTimeout,
};

if (source) vm.runInNewContext(source, sandbox, { filename: sourcePath });
const api = sandbox.CodexSectionPanelTestAPI || {};

assert.equal(typeof api.findMarkdownSection, "function", "section parser should be exposed for testing");
assert.equal(typeof api.buildOneShotPrompt, "function", "one-shot prompt builder should be exposed for testing");
assert.equal(typeof api.buildCodexArgs, "function", "Codex CLI argument builder should be exposed for testing");
assert.equal(typeof api.buildCodexEnvironment, "function", "Codex CLI environment builder should be exposed for testing");
assert.equal(typeof api.createConversationRecord, "function", "conversation record factory should be exposed for testing");
assert.equal(typeof api.normalizeChatState, "function", "chat state normalizer should be exposed for testing");
assert.equal(typeof api.normalizePluginData, "function", "plugin data normalizer should be exposed for testing");
assert.equal(typeof api.appendConversationMessage, "function", "conversation message appender should be exposed for testing");
assert.equal(typeof api.buildMessageClipboardText, "function", "message clipboard formatter should be exposed for testing");
assert.equal(typeof api.buildConversationClipboardText, "function", "conversation clipboard formatter should be exposed for testing");
assert.equal(typeof api.buildReferenceClipboardText, "function", "reference clipboard formatter should be exposed for testing");
assert.equal(typeof api.buildConversationPrompt, "function", "conversation prompt builder should be exposed for testing");
assert.equal(typeof api.buildUnifiedConversationPrompt, "function", "unified conversation prompt builder should be exposed for testing");
assert.equal(typeof api.buildUnifiedTurnPrompt, "function", "unified turn prompt builder should be exposed for testing");
assert.equal(typeof api.buildHistoricalTurnPrompt, "function", "follow-up prompts should map saved references without resending their bodies");
assert.equal(typeof api.getConversationDisplayTitle, "function", "history rows should prefer a cited section heading");
assert.equal(typeof api.formatHistoryTime, "function", "history rows should use compact relative timestamps");
assert.equal(typeof api.formatMessageTime, "function", "chat messages should expose a compact local timestamp");
assert.equal(typeof api.sumActivityDuration, "function", "phase actions should expose their aggregate completed duration");
assert.equal(typeof api.parseCodexResponse, "function", "unified Codex response parser should be exposed for testing");
assert.equal(typeof api.formatCodexResponseForDisplay, "function", "saved Codex responses should have a readable legacy display formatter");
assert.equal(typeof api.formatStreamingCodexText, "function", "streaming response formatter should be exposed for testing");
assert.equal(typeof api.buildDocumentEditPrompt, "function", "document edit prompt builder should be exposed for testing");
assert.equal(typeof api.parseDocumentEditProposal, "function", "document edit proposal parser should be exposed for testing");
assert.equal(typeof api.applyDocumentEditsToMarkdown, "function", "document edit applier should be exposed for testing");
assert.equal(typeof api.buildDocumentEditPlan, "function", "document edit planner should be exposed for testing");
assert.equal(typeof api.extractCodexDelta, "function", "Codex stream parser should be exposed for testing");
assert.equal(typeof api.extractCodexPhase, "function", "Codex phase parser should be exposed for testing");
assert.equal(typeof api.parseCodexJsonLines, "function", "Codex JSONL parser should be exposed for testing");
assert.equal(typeof api.appendPendingContext, "function", "pending context appender should be exposed for testing");
assert.equal(typeof api.removePendingContext, "function", "pending context remover should be exposed for testing");
assert.equal(typeof api.resolveRequestContexts, "function", "request context resolver should be exposed for testing");
assert.equal(typeof api.normalizeExternalContext, "function", "external context normalizer should be exposed for testing");
assert.equal(typeof api.addSectionContext, "function", "section context adder should be exposed for testing");
assert.equal(typeof api.createSelectionContext, "function", "selection context builder should be exposed for testing");
assert.equal(typeof api.buildAppServerArgs, "function", "app-server argument builder should be exposed for testing");
assert.equal(typeof api.createJsonRpcRequest, "function", "JSON-RPC request builder should be exposed for testing");
assert.equal(typeof api.parseAppServerJsonLines, "function", "app-server JSONL parser should be exposed for testing");
assert.equal(typeof api.extractAppServerDelta, "function", "app-server delta parser should be exposed for testing");
assert.equal(typeof api.extractAppServerPhase, "function", "app-server phase parser should be exposed for testing");
assert.equal(typeof api.extractAppServerError, "function", "app-server error parser should be exposed for testing");
assert.equal(typeof api.buildAppServerTimeoutMessage, "function", "app-server timeout message builder should be exposed for testing");
assert.equal(typeof api.getAppServerTurnTimeoutMs, "function", "app-server timeout policy should be exposed for testing");
assert.equal(typeof api.getAppServerTimeoutDelayMs, "function", "app-server timeout delay policy should be exposed for testing");
assert.equal(typeof api.clearFailedConversationThread, "function", "failed thread cleanup should be exposed for testing");
assert.equal(typeof api.isDefinitiveThreadLossError, "function", "thread loss classifier should be exposed for testing");
assert.equal(typeof api.normalizeAvailableModels, "function", "model catalog normalizer should be exposed for testing");
assert.equal(typeof api.normalizeProxyUrl, "function", "proxy URL normalizer should be exposed for testing");
assert.equal(typeof api.buildProxyFailureMessage, "function", "proxy failure message builder should be exposed for testing");

const codexEnv = api.buildCodexEnvironment({ USERPROFILE: "C:\\Users\\12032" }, "C:\\Users\\12032");
assert.equal(codexEnv.HOME, "C:\\Users\\12032");
assert.equal(codexEnv.CODEX_HOME, path.join("C:\\Users\\12032", ".codex"));
const preservedCodexEnv = api.buildCodexEnvironment({
  HOME: "D:\\CustomHome",
  CODEX_HOME: "D:\\CustomHome\\codex",
}, "C:\\Users\\12032");
assert.equal(preservedCodexEnv.HOME, "D:\\CustomHome");
assert.equal(preservedCodexEnv.CODEX_HOME, "D:\\CustomHome\\codex");
assert.equal(api.normalizeProxyUrl("127.0.0.1:7890"), "http://127.0.0.1:7890");
assert.equal(api.normalizeProxyUrl("http://127.0.0.1:7890/"), "http://127.0.0.1:7890");
assert.equal(api.normalizeProxyUrl("off"), "");
assert.equal(api.normalizeProxyUrl("auto"), "auto");
const proxyEnv = api.buildCodexEnvironment({ USERPROFILE: "C:\\Users\\12032" }, "C:\\Users\\12032", "http://127.0.0.1:7890");
assert.equal(proxyEnv.HTTP_PROXY, "http://127.0.0.1:7890");
assert.equal(proxyEnv.HTTPS_PROXY, "http://127.0.0.1:7890");
assert.equal(proxyEnv.ALL_PROXY, "http://127.0.0.1:7890");
const preservedProxyEnv = api.buildCodexEnvironment({ HTTPS_PROXY: "http://existing:8080" }, "C:\\Users\\12032", "http://127.0.0.1:7890");
assert.equal(preservedProxyEnv.HTTPS_PROXY, "http://existing:8080");
assert.match(
  api.buildProxyFailureMessage("http://127.0.0.1:7890", "TLS handshake failed"),
  /代理.*127\.0\.0\.1:7890.*TLS handshake failed/,
);

const legacyData = api.normalizePluginData({ codexPath: "D:\\Tools\\codex.exe" });
assert.equal(legacyData.settings.codexPath, "D:\\Tools\\codex.exe");
assert.equal(legacyData.settings.proxyUrl, "auto");
assert.equal(legacyData.chatState.conversations.length, 1);

const chatState = api.normalizeChatState({ conversations: [], activeConversationId: "" });
assert.equal(chatState.conversations.length, 1, "an empty history should create one conversation");
assert.equal(api.normalizeChatState({ conversations: [], historyCollapsed: true }).historyCollapsed, true);
const conversation = chatState.conversations[0];
api.appendConversationMessage(conversation, "user", "请解释垃圾回收机制", "complete", 1000);
api.appendConversationMessage(conversation, "codex", "这是 Codex 的回答。", "complete", 2000);
assert.equal(conversation.title, "请解释垃圾回收机制");
assert.equal(conversation.messages[0].role, "user");
assert.equal(conversation.messages[1].role, "codex");

const structuredEdit = { summary: "合并重复章节", edits: [{ contextIndex: 1, replacement: "## 合并章节\n\n新正文" }] };
const persistedProposalState = api.normalizeChatState({ conversations: [{
  id: "proposal-conversation",
  messages: [
    {
      id: "proposal-user",
      role: "user",
      content: "请合并章节",
      requestModel: "gpt-6.1-sol",
      references: [{ path: "note.md", marker: "[[note]] (L1-L2)", rangeLabel: "L1-L2", text: "## 引用正文" }],
    },
    {
      id: "proposal-codex",
      role: "codex",
      content: "将合并重复章节。",
      replyToMessageId: "proposal-user",
      proposal: structuredEdit,
      editStatus: "pending",
    },
  ],
}] });
assert.equal(persistedProposalState.conversations[0].messages[0].requestModel, "gpt-6.1-sol",
  "a saved user turn retains the model needed for retry");
assert.equal(persistedProposalState.conversations[0].messages[1].replyToMessageId, "proposal-user",
  "a Codex result remains linked to its originating user turn");
assert.deepEqual(JSON.parse(JSON.stringify(persistedProposalState.conversations[0].messages[1].proposal)), structuredEdit,
  "structured edit proposals survive persistence and history reload");
assert.equal(persistedProposalState.conversations[0].messages[1].editStatus, "pending");
const persistedResponseError = api.normalizeChatState({ conversations: [{ id: "protocol-error", messages: [{
  role: "codex", content: "已完成合并。", status: "error", responseError: "未通过结构校验，笔记未改动。",
}] }] }).conversations[0].messages[0];
assert.equal(persistedResponseError.responseError, "未通过结构校验，笔记未改动。",
  "protocol failure guidance survives conversation history reload");
const invalidPersistedProposal = api.normalizeChatState({ conversations: [{ messages: [{
  role: "codex", content: "ordinary response", proposal: { summary: "invalid", edits: [{ contextIndex: 0, replacement: "x" }] },
}] }] });
assert.equal(invalidPersistedProposal.conversations[0].messages[0].proposal, null,
  "invalid edit payloads must not be rendered as document changes");
assert.match(api.formatMessageTime(1791977400000), /^\d{2}:\d{2}:\d{2}$/);
assert.equal(api.sumActivityDuration([
  { id: "one", label: "one", status: "completed", startedAt: 1000, endedAt: 2200 },
  { id: "two", label: "two", status: "failed", startedAt: 3000, endedAt: 3600 },
  { id: "running", label: "running", status: "running", startedAt: 4000, endedAt: 0 },
  { id: "invalid", label: "invalid", status: "completed", startedAt: 5000, endedAt: 4500 },
]), 1800, "aggregate duration includes finished actions and excludes running or invalid intervals");

const persistedThread = api.createConversationRecord({ id: "conversation-thread", threadId: "thread-1", model: "gpt-test" });
assert.equal(persistedThread.threadId, "thread-1");
assert.equal(persistedThread.model, "gpt-test");
assert.equal(
  api.extractCodexDelta({ type: "item.delta", delta: "第一段" }, ""),
  "第一段",
);
assert.equal(
  api.extractCodexDelta({ type: "item.completed", item: { type: "agent_message", text: "完整回答" } }, ""),
  "完整回答",
);
assert.equal(
  api.extractCodexDelta({ type: "item.completed", item: { type: "agent_message", text: "完整回答" } }, "第一段"),
  "",
  "a completed event must not duplicate already streamed deltas",
);
assert.equal(
  api.extractCodexDelta({ type: "item.updated", item: { type: "agent_message", text: "第一段第二段" } }, "第一段"),
  "第二段",
  "an updated agent message should stream only its new suffix",
);
assert.equal(api.extractCodexPhase({ type: "turn.started" }), "thinking");
assert.equal(api.extractCodexPhase({ type: "item.updated", item: { type: "agent_message" } }), "generating");
assert.equal(api.extractCodexPhase({ type: "turn.completed" }), "complete");
const parsedLines = api.parseCodexJsonLines(
  '{"type":"item.delta","delta":"第一段"}\n{"type":"turn.started"}\n未完成',
);
assert.equal(parsedLines.events.length, 2);
assert.equal(parsedLines.events[0].delta, "第一段");
assert.equal(parsedLines.remainder, "未完成");

const markdown = [
  "# Python",
  "## 垃圾回收机制",
  "正文第一行",
  "### 子章节",
  "子章节正文",
  "```md",
  "## 代码中的标题",
  "```",
  "## 下一个章节",
].join("\n");
assert.equal(
  JSON.stringify(api.findMarkdownSection(markdown, 2)),
  JSON.stringify({
    from: { line: 1, ch: 0 },
    to: { line: 8, ch: 0 },
    heading: "## 垃圾回收机制",
  }),
  "the section should end at the next same-level heading, ignoring fenced code",
);

const context = {
  heading: "## 垃圾回收机制",
  linktext: "agent/agent",
  path: "agent/agent.md",
  rangeLabel: "L2:C1-L9:C1",
  text: "## 垃圾回收机制\n正文第一行",
};
const selectionContext = api.createSelectionContext({
  path: "agent/agent.md",
  from: { line: 740, ch: 0 },
  to: { line: 1054, ch: 0 },
  text: "选中的内容",
});
assert.equal(selectionContext.kind, "selection");
assert.equal(selectionContext.marker, "[[agent/agent]] (L741:C1-L1055:C1)");
assert.equal(selectionContext.text, "选中的内容");

const selectionRequestContexts = api.resolveRequestContexts([], selectionContext, null);
assert.equal(selectionRequestContexts.length, 1);
assert.equal(
  selectionRequestContexts[0].text,
  selectionContext.text,
  "sending with a selection should use the current selection when no context was added yet",
);
const sectionRequestContexts = api.resolveRequestContexts([], null, context);
assert.equal(sectionRequestContexts.length, 1);
assert.equal(
  sectionRequestContexts[0].heading,
  context.heading,
  "sending without a selection should fall back to the current section",
);
assert.equal(
  api.resolveRequestContexts([], null, null).length,
  0,
  "sending without any readable context should stay empty",
);

const secondSelection = api.createSelectionContext({
  path: "agent/agent.md",
  from: { line: 1100, ch: 0 },
  to: { line: 1130, ch: 0 },
  text: "第二个选区",
});
const firstSection = api.createSelectionContext({
  path: "agent/agent.md",
  kind: "section",
  heading: "## 第一章节",
  range: { from: { line: 20, ch: 0 }, to: { line: 30, ch: 0 } },
  text: "## 第一章节\n第一章内容",
});
const secondSection = api.createSelectionContext({
  path: "agent/agent.md",
  kind: "section",
  heading: "## 第二章节",
  range: { from: { line: 40, ch: 0 }, to: { line: 50, ch: 0 } },
  text: "## 第二章节\n第二章内容",
});
let pendingSections = [];
pendingSections = api.addSectionContext(pendingSections, firstSection);
pendingSections = api.addSectionContext(pendingSections, secondSection);
assert.equal(pendingSections.length, 2, "multiple chapters should be attachable");
assert.equal(pendingSections[1].heading, "## 第二章节");

const externalSelection = api.normalizeExternalContext({
  path: "agent/agent.md",
  linktext: "agent/agent",
  range: { from: { line: 10, ch: 0 }, to: { line: 12, ch: 4 } },
  text: "来自桥接插件的选区",
});
assert.equal(externalSelection.kind, "selection");
assert.equal(externalSelection.rangeLabel, "L11:C1-L13:C5");
assert.equal(externalSelection.text, "来自桥接插件的选区");
let pendingContexts = [];
pendingContexts = api.appendPendingContext(pendingContexts, selectionContext);
pendingContexts = api.appendPendingContext(pendingContexts, secondSelection);
pendingContexts = api.appendPendingContext(pendingContexts, selectionContext);
assert.equal(pendingContexts.length, 2, "the same selection should not be added twice");
assert.equal(pendingContexts[1].text, "第二个选区");
pendingContexts = api.removePendingContext(pendingContexts, 0);
assert.equal(pendingContexts.length, 1);
assert.equal(pendingContexts[0].text, "第二个选区");

const prompt = api.buildOneShotPrompt("请解释这一节", context);
assert.match(prompt, /agent\/agent\.md/);
assert.match(prompt, /L2:C1-L9:C1/);
assert.match(prompt, /正文第一行/);
assert.match(prompt, /请解释这一节/);

const conversationPrompt = api.buildConversationPrompt("继续说明", context, conversation.messages);
assert.match(conversationPrompt, /历史对话/);
assert.match(conversationPrompt, /用户：\n请解释垃圾回收机制/);
assert.match(conversationPrompt, /Codex：\n这是 Codex 的回答。/);
assert.match(conversationPrompt, /继续说明/);
assert.match(conversationPrompt, /正文第一行/);

const unifiedConversationPrompt = api.buildUnifiedConversationPrompt(
  "如果需要请直接修改这一节",
  [context],
  conversation.messages,
);
assert.match(unifiedConversationPrompt, /只返回一个 JSON 对象/);
assert.match(unifiedConversationPrompt, /\"edit\":null/);
assert.match(unifiedConversationPrompt, /intent/);
assert.match(unifiedConversationPrompt, /contextIndex/);
const unifiedTurnPrompt = api.buildUnifiedTurnPrompt("继续回答", [context]);
assert.match(unifiedTurnPrompt, /只返回一个 JSON 对象/);
assert.match(unifiedTurnPrompt, /声称已修改 Obsidian 笔记/);

const normalCodexResponse = api.parseCodexResponse('{"answer":"已收到","edit":null}');
assert.equal(normalCodexResponse.answer, "已收到");
assert.equal(normalCodexResponse.proposal, null);
const editCodexResponse = api.parseCodexResponse(
  '{"answer":"我建议更新这一节。","edit":{"summary":"更新章节正文","edits":[{"contextIndex":1,"replacement":"## 垃圾回收机制\\n新的正文"}]}}',
);
assert.equal(editCodexResponse.answer, "我建议更新这一节。");
assert.equal(editCodexResponse.proposal.summary, "更新章节正文");
assert.equal(editCodexResponse.proposal.edits.length, 1);
const plainCodexResponse = api.parseCodexResponse("这是不遵循 JSON 协议的普通回答。");
assert.equal(plainCodexResponse.answer, "这是不遵循 JSON 协议的普通回答。");
assert.equal(plainCodexResponse.proposal, null);
const missingProposalReply = "已按“内存管理与垃圾回收机制”为主章节整理合并稿，并移除重复章节。";
const strictPlainCodexResponse = api.parseCodexResponse(missingProposalReply, { strict: true });
assert.equal(strictPlainCodexResponse.answer, missingProposalReply, "the original reply remains available when validation fails");
assert.match(strictPlainCodexResponse.error, /有效的结构化 JSON/,
  "live replies that bypass the structured protocol are rejected instead of silently presented as successful edits");
const strictMissingEdit = api.parseCodexResponse(JSON.stringify({ intent: "edit", answer: "已合并章节。", edit: null }), { strict: true });
assert.match(strictMissingEdit.error, /没有返回修改建议/,
  "an edit intent without an actual proposal is reported as a failed suggestion");
const strictValidEdit = api.parseCodexResponse(JSON.stringify({
  intent: "edit", answer: "已生成建议。", edit: { summary: "合并章节", edits: [{ contextIndex: 1, replacement: "## 合并章节\n正文" }] },
}), { strict: true });
assert.equal(strictValidEdit.error, "");
assert.equal(strictValidEdit.proposal.edits.length, 1);
const strictConsultation = api.parseCodexResponse(JSON.stringify({ intent: "answer", answer: "这是普通解答。", edit: null }), { strict: true });
assert.equal(strictConsultation.error, "", "explicit consultation replies remain successful without a proposal");
const commentaryWrappedEditResponse = [
  "我会读取两个引用范围，并保留原有章节结构。",
  "已核对技术表述，准备生成修改建议。",
  String.raw`{"edit":{"summary":"将两章合并为垃圾回收机制","edits":[{"contextIndex":1,"replacement":""},{"contextIndex":2,"replacement":"## 垃圾回收机制\n\nPython 自动管理对象内存。"}]}}`,
].join("\n");
const commentaryWrappedEdit = api.parseCodexResponse(commentaryWrappedEditResponse);
assert.equal(commentaryWrappedEdit.answer, "将两章合并为垃圾回收机制", "progress text and JSON protocol must not leak into the final chat bubble");
assert.equal(commentaryWrappedEdit.proposal.edits.length, 2, "an edit proposal at the end of a response should still be recognized");
assert.equal(commentaryWrappedEdit.proposal.edits[1].replacement, "## 垃圾回收机制\n\nPython 自动管理对象内存。");
const readableLegacyEdit = api.formatCodexResponseForDisplay(commentaryWrappedEditResponse);
assert.doesNotMatch(readableLegacyEdit, /"edit"|\\n/, "saved protocol JSON and literal newline escapes should be removed from the displayed response");
assert.match(readableLegacyEdit, /## 垃圾回收机制\n\nPython 自动管理对象内存。/, "saved replacement text should retain real Markdown line breaks");
const escapedMarkdownResponse = String.raw`{"answer":"已整理建议","edit":{"summary":"合并章节","edits":[{"contextIndex":1,"replacement":"## 内存管理与垃圾回收机制\n\n使用 **CPython** 说明循环回收。\n\n\*重点\*：不要把 \`del\` 理解为强制销毁。\n\n参考：\[官方文档\]\(https://docs.python.org/\)"}]}}`;
const escapedMarkdownParsed = api.parseCodexResponse(escapedMarkdownResponse);
assert.equal(escapedMarkdownParsed.answer, "已整理建议");
assert.equal(escapedMarkdownParsed.proposal.summary, "合并章节");
assert.equal(escapedMarkdownParsed.proposal.edits[0].replacement, "## 内存管理与垃圾回收机制\n\n使用 **CPython** 说明循环回收。\n\n*重点*：不要把 `del` 理解为强制销毁。\n\n参考：[官方文档](https://docs.python.org/)");
assert.equal(
  api.formatStreamingCodexText('{"answer":"未完成'),
  "正在生成结构化回答……",
  "streaming JSON should not expose the protocol envelope in the chat bubble",
);
assert.equal(api.formatStreamingCodexText("普通回答片段"), "普通回答片段");

const historicalReference = api.createSelectionContext({
  path: "agent/agent.md",
  linktext: "agent/agent",
  range: { from: { line: 40, ch: 0 }, to: { line: 45, ch: 0 } },
  text: "历史章节正文应该在恢复线程时被重新带回。",
  heading: "## 历史章节",
  kind: "section",
});
const historicalTurnPrompt = api.buildHistoricalTurnPrompt("修改内存管理内容", [historicalReference]);
assert.match(historicalTurnPrompt, /历史引用索引/);
assert.match(historicalTurnPrompt, /## 历史章节/);
assert.match(historicalTurnPrompt, /contextIndex/);
assert.doesNotMatch(historicalTurnPrompt, /历史章节正文应该在恢复线程时被重新带回/);
const currentReference = api.createSelectionContext({
  path: "agent/agent.md",
  linktext: "agent/agent",
  range: { from: { line: 50, ch: 0 }, to: { line: 55, ch: 0 } },
  text: "本轮章节正文。",
  heading: "## 当前章节",
  kind: "section",
});
const conversationWithReference = api.createConversationRecord({ threadId: "stale-thread" });
api.appendConversationMessage(
  conversationWithReference,
  "user",
  "请先阅读历史章节",
  "complete",
  1000,
  [historicalReference],
);
api.appendConversationMessage(conversationWithReference, "codex", "已阅读。", "complete", 2000);
const recoveryPrompt = api.buildConversationPrompt(
  "继续修改历史章节",
  [currentReference],
  conversationWithReference.messages,
  { includeHistoricalReferences: true },
);
assert.match(recoveryPrompt, /历史引用正文/);
assert.match(recoveryPrompt, /历史章节正文应该在恢复线程时被重新带回/);
assert.match(recoveryPrompt, /本轮章节正文/);
assert.equal(
  recoveryPrompt.match(/历史章节正文应该在恢复线程时被重新带回/g).length,
  1,
  "the current context should not be duplicated as a historical reference",
);
const normalPrompt = api.buildConversationPrompt(
  "继续修改历史章节",
  [currentReference],
  conversationWithReference.messages,
);
assert.doesNotMatch(
  normalPrompt,
  /历史章节正文应该在恢复线程时被重新带回/,
  "normal turns should rely on the Codex thread instead of replaying old reference bodies",
);
assert.equal(
  typeof api.collectConversationReferences,
  "function",
  "edit requests should be able to reuse references saved in the current conversation",
);
const collectedReferences = api.collectConversationReferences([
  {
    role: "user",
    content: "带引用的问题",
    references: [selectionContext],
  },
  {
    role: "user",
    content: "再次引用同一选区",
    references: [selectionContext, historicalReference],
  },
]);
assert.equal(
  JSON.stringify(collectedReferences.map((item) => item.marker)),
  JSON.stringify([selectionContext.marker, historicalReference.marker]),
  "historical references should be deduplicated while keeping the latest range contents",
);
assert.equal(
  api.getConversationDisplayTitle({
    title: "请帮我把前面两个章节合并整理成一份说明并检查重复内容",
    messages: [{ role: "user", references: [historicalReference] }],
  }),
  "历史章节",
);
const historyNow = new Date(2026, 9, 14, 16, 0, 0);
assert.equal(api.formatHistoryTime(new Date(2026, 9, 14, 14, 30, 0).getTime(), historyNow.getTime()), "今天 14:30");
assert.equal(api.formatHistoryTime(new Date(2026, 9, 13, 18, 20, 0).getTime(), historyNow.getTime()), "昨天 18:20");

assert.match(
  api.buildReferenceClipboardText(selectionContext),
  /^选中的内容$/,
);

const referenceMessage = api.appendConversationMessage(
  conversation,
  "user",
  "带引用的问题",
  "complete",
  3000,
  [selectionContext],
);
assert.equal(referenceMessage.references.length, 1);
assert.equal(referenceMessage.references[0].marker, selectionContext.marker);
assert.equal(
  api.buildMessageClipboardText(referenceMessage),
  `带引用的问题\n\n引用：${selectionContext.marker}`,
);
assert.equal(api.buildMessageClipboardText(conversation.messages[1]), "这是 Codex 的回答。");
assert.equal(typeof api.buildActivityClipboardText, "function", "activity clipboard formatter should be exposed for testing");
assert.equal(typeof api.buildActivitiesClipboardText, "function", "copy-all should format every phase action");
assert.equal(typeof api.removeConversationFromChatState, "function", "history deletion should have a testable state transition");
const copiedActivity = api.buildActivityClipboardText({ label: "执行命令", detail: "命令：检查笔记\n\n输出：" + "完整输出。".repeat(120) });
assert.match(copiedActivity, /^执行命令\n\n命令：检查笔记/);
assert.equal(copiedActivity.length, "执行命令\n\n命令：检查笔记\n\n输出：".length + "完整输出。".repeat(120).length,
  "copying an activity must preserve its entire recorded detail rather than only its visible preview");
const allActivityClipboardText = api.buildActivitiesClipboardText([
  { id: "phase-one", label: "读取章节", detail: "读取到三段正文。", status: "completed" },
  { id: "phase-two", label: "执行命令", detail: "命令：核对引用\n\n输出：检查完成。", status: "completed" },
]);
assert.ok(allActivityClipboardText.indexOf("读取章节") < allActivityClipboardText.indexOf("执行命令"), "copy-all preserves the phase timeline order");
assert.match(allActivityClipboardText, /读取到三段正文。/);
assert.match(allActivityClipboardText, /命令：核对引用\n\n输出：检查完成。/);
assert.equal(allActivityClipboardText.split("---").length, 2, "copy-all separates each complete phase action");
const conversationClipboardText = api.buildConversationClipboardText(conversation);
assert.match(conversationClipboardText, /用户：请解释垃圾回收机制/);
assert.match(conversationClipboardText, /Codex：这是 Codex 的回答。/);
assert.doesNotMatch(conversationClipboardText, /正文第一行/);
assert.match(conversationClipboardText, /引用：\[\[agent\/agent\]\]/);

const historyStateForDelete = api.normalizeChatState({
  activeConversationId: "delete-active",
  conversations: [
    { id: "delete-active", title: "当前对话", updatedAt: 200, messages: [{ role: "user", content: "当前消息" }] },
    { id: "delete-newest", title: "最近对话", updatedAt: 300, messages: [{ role: "user", content: "最近消息" }] },
    { id: "delete-oldest", title: "更早对话", updatedAt: 100, messages: [] },
  ],
});
const deletedInactive = api.removeConversationFromChatState(historyStateForDelete, "delete-oldest", 400);
assert.equal(deletedInactive.deleted, true);
assert.deepEqual(deletedInactive.chatState.conversations.map((item) => item.id), ["delete-active", "delete-newest"]);
assert.equal(deletedInactive.chatState.activeConversationId, "delete-active", "deleting an inactive record leaves the selected conversation unchanged");
const deletedActive = api.removeConversationFromChatState(historyStateForDelete, "delete-active", 500);
assert.deepEqual(deletedActive.chatState.conversations.map((item) => item.id), ["delete-newest", "delete-oldest"]);
assert.equal(deletedActive.chatState.activeConversationId, "delete-newest", "deleting the active record selects the most recently updated survivor");
const onlyHistory = api.normalizeChatState({
  activeConversationId: "delete-last",
  conversations: [{ id: "delete-last", title: "最后一条", threadId: "remote-thread", updatedAt: 100, messages: [{ role: "user", content: "旧消息" }] }],
});
const deletedLast = api.removeConversationFromChatState(onlyHistory, "delete-last", 900);
assert.equal(deletedLast.deleted, true);
assert.equal(deletedLast.chatState.conversations.length, 1, "the panel always retains one conversation slot");
assert.notEqual(deletedLast.chatState.activeConversationId, "delete-last");
assert.equal(deletedLast.chatState.conversations[0].messages.length, 0, "deleting the last record leaves a blank conversation");
assert.equal(deletedLast.chatState.conversations[0].threadId, "", "a replacement blank conversation does not retain the deleted Codex thread");
assert.equal(deletedLast.chatState.conversations[0].createdAt, 900);

const multiContextPrompt = api.buildConversationPrompt("比较两个选区", [selectionContext, secondSelection], []);
assert.match(multiContextPrompt, /引用 1/);
assert.match(multiContextPrompt, /选中的内容/);
assert.match(multiContextPrompt, /引用 2/);
assert.match(multiContextPrompt, /第二个选区/);
assert.doesNotMatch(multiContextPrompt, /主要上下文|补充背景|前面的引用仅作为背景补充|合并重复内容/);

assert.equal(api.getAppServerTurnTimeoutMs(""), 90000);
assert.equal(api.getAppServerTurnTimeoutMs("已经收到首段回答"), 180000);
assert.equal(api.getAppServerTurnTimeoutMs("", true), 180000);
assert.equal(api.getAppServerTimeoutDelayMs(1000, 1000, "", false), 90000);
assert.equal(api.getAppServerTimeoutDelayMs(1000, 81000, "", false), 10000);
assert.equal(
  api.getAppServerTimeoutDelayMs(1000, 81000, "", false, 70000, true),
  169000,
  "recent Codex tool/reasoning activity should refresh the idle timeout",
);
assert.equal(
  api.getAppServerTimeoutDelayMs(1000, 301000, "", false, 300000, true),
  179000,
  "a turn with recent progress must not fail solely because it passed five minutes",
);
assert.equal(
  api.getAppServerTimeoutDelayMs(1000, 301000, "", false, 121000, true),
  0,
  "a progressing turn must still time out after 180 seconds without new activity",
);
assert.equal(api.getAppServerTimeoutDelayMs(1000, 181000, "已经收到回答", true, 61000, true), 60000);
assert.equal(api.getAppServerTimeoutDelayMs(1000, 251000, "已经收到回答", true, 200000, true), 129000);
assert.equal(api.getAppServerTimeoutDelayMs(1000, 302000, "已经收到回答", true, 301000, true), 179000);
const failedConversation = api.createConversationRecord({ threadId: "stale-thread" });
assert.equal(api.clearFailedConversationThread(failedConversation, "stale-thread"), true);
assert.equal(failedConversation.threadId, "");
assert.equal(api.clearFailedConversationThread(failedConversation, "other-thread"), false);
assert.equal(api.isDefinitiveThreadLossError(new Error("Codex app-server 请求超时：thread/resume")), false);
assert.equal(api.isDefinitiveThreadLossError(new Error("网络连接失败，请重试")), false);
assert.equal(api.isDefinitiveThreadLossError(new Error("thread not found")), true);
assert.equal(api.isDefinitiveThreadLossError(new Error("线程已过期或无效")), true);
assert.match(
  api.buildAppServerTimeoutMessage(300000, "request timed out", "已经收到首段回答", true, 180000),
  /已收到部分回答.*连续 180 秒没有新进展.*运行 300 秒/,
);
assert.match(
  api.buildAppServerTimeoutMessage(90000, "request timed out", "", true, 90000),
  /已收到部分回答.*连续 90 秒没有新进展.*运行 90 秒/,
);

const noContextPrompt = api.buildConversationPrompt("只回答这个问题", [], []);
assert.match(noContextPrompt, /本轮没有附加章节正文/);
assert.match(noContextPrompt, /只回答这个问题/);

const editContext = api.createSelectionContext({
  path: "agent/agent.md",
  from: { line: 1, ch: 0 },
  to: { line: 2, ch: 0 },
  text: "旧内容\n",
});
const editPrompt = api.buildDocumentEditPrompt("把这一段改得更简洁", [editContext], []);
assert.match(editPrompt, /只返回一个 JSON 对象/);
assert.match(editPrompt, /contextIndex/);
assert.match(editPrompt, /replacement/);
assert.match(editPrompt, /把这一段改得更简洁/);
const editProposal = api.parseDocumentEditProposal(
  "```json\n{" +
  "\"summary\":\"已简化\",\"edits\":[{" +
  "\"contextIndex\":1,\"replacement\":\"新内容\\n\"" +
  "}]}\n```",
);
assert.equal(
  JSON.stringify(editProposal),
  JSON.stringify({
    summary: "已简化",
    edits: [{ contextIndex: 1, replacement: "新内容\n" }],
  }),
);
assert.throws(
  () => api.parseDocumentEditProposal("这不是 JSON"),
  /无法解析.*修改建议/,
);
assert.equal(
  api.applyDocumentEditsToMarkdown("标题\n旧内容\n后续\n", [editContext], editProposal.edits),
  "标题\n新内容\n后续\n",
);
const sectionEditContext = api.createSelectionContext({
  path: "agent/agent.md",
  kind: "section",
  heading: "## 章节",
  from: { line: 1, ch: 0 },
  to: { line: 2, ch: 0 },
  text: "旧内容",
});
assert.equal(
  api.applyDocumentEditsToMarkdown(
    "标题\n旧内容\n后续\n",
    [sectionEditContext],
    [{ contextIndex: 1, replacement: "新内容" }],
  ),
  "标题\n新内容\n后续\n",
);
assert.throws(
  () => api.applyDocumentEditsToMarkdown("标题\n已变化\n后续\n", [editContext], editProposal.edits),
  /引用范围已发生变化/,
);

const otherFileContext = api.createSelectionContext({
  path: "other-note.md",
  kind: "section",
  heading: "## 其他笔记",
  from: { line: 0, ch: 0 },
  to: { line: 1, ch: 0 },
  text: "另一篇笔记内容\n",
});
const unrelatedHistoricalContext = api.createSelectionContext({
  path: "historical-note.md",
  kind: "section",
  heading: "## 历史引用",
  from: { line: 0, ch: 0 },
  to: { line: 1, ch: 0 },
  text: "未参与本次修改\n",
});
assert.equal(
  JSON.stringify(
    api.buildDocumentEditPlan(
      [editContext, otherFileContext, unrelatedHistoricalContext],
      [{ contextIndex: 1, replacement: "只修改第一篇" }],
    ).map((group) => ({ path: group.path, indices: group.edits.map((edit) => edit.contextIndex) })),
  ),
  JSON.stringify([{ path: "agent/agent.md", indices: [1] }]),
  "unused historical contexts must not participate in the write plan",
);
assert.equal(
  JSON.stringify(
    api.buildDocumentEditPlan(
      [editContext, otherFileContext],
      [
        { contextIndex: 1, replacement: "修改第一篇" },
        { contextIndex: 2, replacement: "修改第二篇" },
      ],
    ).map((group) => ({ path: group.path, indices: group.edits.map((edit) => edit.contextIndex) })),
  ),
  JSON.stringify([
    { path: "agent/agent.md", indices: [1] },
    { path: "other-note.md", indices: [2] },
  ]),
  "edits targeting multiple notes must be grouped by note",
);

assert.equal(
  JSON.stringify(api.buildCodexArgs("C:/Temp/codex-last-message.md")),
  JSON.stringify([
    "exec",
    "--ephemeral",
    "--skip-git-repo-check",
    "--sandbox",
    "read-only",
    "--json",
    "--output-last-message",
    "C:/Temp/codex-last-message.md",
    "-",
  ]),
);

assert.equal(
  JSON.stringify(api.buildAppServerArgs()),
  JSON.stringify([
    "app-server",
    "--listen",
    "stdio://",
    "-c",
    "model_provider=\"chatgpt_http\"",
    "-c",
    "model_providers.chatgpt_http.name=\"ChatGPT HTTP\"",
    "-c",
    "model_providers.chatgpt_http.base_url=\"https://chatgpt.com/backend-api/codex\"",
    "-c",
    "model_providers.chatgpt_http.wire_api=\"responses\"",
    "-c",
    "model_providers.chatgpt_http.requires_openai_auth=true",
    "-c",
    "model_providers.chatgpt_http.supports_websockets=false",
  ]),
);
assert.equal(
  JSON.stringify(api.createJsonRpcRequest(7, "turn/start", { threadId: "thread-1" })),
  JSON.stringify({ jsonrpc: "2.0", id: 7, method: "turn/start", params: { threadId: "thread-1" } }),
);
const appServerParsed = api.parseAppServerJsonLines('{"jsonrpc":"2.0","method":"turn/started"}\npartial');
assert.equal(appServerParsed.events.length, 1);
assert.equal(appServerParsed.events[0].method, "turn/started");
assert.equal(appServerParsed.remainder, "partial");
assert.equal(
  api.extractAppServerDelta({ method: "item/agentMessage/delta", params: { delta: "你好" } }, ""),
  "你好",
);
assert.equal(api.extractAppServerPhase({ method: "turn/started" }), "thinking");
assert.equal(api.extractAppServerPhase({ method: "item/agentMessage/delta" }), "generating");
assert.equal(api.extractAppServerPhase({ method: "error" }), "retrying");
assert.equal(api.extractAppServerPhase({ method: "turn/completed" }), "complete");
assert.equal(typeof api.extractAppServerAction, "function", "public Codex actions must be captured for the message timeline");
assert.equal(typeof api.applyAppServerAction, "function", "actions must update by item ID instead of adding one row per token");
const commandStarted = api.extractAppServerAction({
  method: "item/started",
  params: { turnId: "turn-actions", item: { id: "command-1", type: "commandExecution", command: "Get-Content agent.md", status: "inProgress" } },
}, 1000);
let actionHistory = api.applyAppServerAction([], commandStarted);
actionHistory = api.applyAppServerAction(actionHistory, api.extractAppServerAction({
  method: "item/completed",
  params: { turnId: "turn-actions", item: { id: "command-1", type: "commandExecution", status: "completed", exitCode: 0, aggregatedOutput: "读取到三处正文" } },
}, 2500));
assert.equal(actionHistory.length, 1, "start and completion are one action");
assert.equal(actionHistory[0].status, "completed");
assert.match(actionHistory[0].detail, /Get-Content agent\.md/, "completion without a command must preserve the start detail");
assert.match(actionHistory[0].detail, /读取到三处正文/, "the public tool output should be included in the phase detail");
assert.equal(actionHistory[0].startedAt, 1000);
assert.equal(actionHistory[0].endedAt, 2500);
assert.equal(actionHistory[0].rawData.events.length, 2, "stage JSON retains both the original start and completion events");
assert.equal(JSON.stringify(actionHistory[0].rawData.events.map((event) => event.method)), JSON.stringify(["item/started", "item/completed"]));
assert.match(JSON.stringify(actionHistory[0].rawData), /读取到三处正文/, "stage JSON includes the public tool result");
assert.equal(api.extractAppServerAction({ method: "item/reasoning/textDelta", params: { itemId: "reason-1", delta: "hidden reasoning" } }), null);
const reasoningStart = api.extractAppServerAction({
  method: "item/started",
  params: { item: { id: "reason-private", type: "reasoning", summary: "公开摘要", text: "隐藏推理内容" } },
});
assert.equal(reasoningStart.rawData.events[0].params.item.summary, "公开摘要");
assert.equal(reasoningStart.rawData.events[0].params.item.text, undefined, "raw event JSON filters private reasoning text from reasoning items");
actionHistory = api.applyAppServerAction(actionHistory, api.extractAppServerAction({
  method: "item/started", params: { item: { id: "reason-1", type: "reasoning" } },
}, 2600));
actionHistory = api.applyAppServerAction(actionHistory, api.extractAppServerAction({
  method: "item/reasoning/summaryTextDelta", params: { itemId: "reason-1", delta: "正在核对章节" },
}, 2700));
assert.equal(actionHistory[1].detail, "正在核对章节");
const longPublicSummary = "公开推理摘要片段。".repeat(600);
actionHistory = api.applyAppServerAction(actionHistory, api.extractAppServerAction({
  method: "item/reasoning/summaryTextDelta", params: { itemId: "reason-1", delta: longPublicSummary },
}, 2800));
assert.equal(actionHistory[1].detail, `正在核对章节${longPublicSummary}`, "the complete public reasoning summary is retained without truncation");
assert.equal(actionHistory[1].rawData.events.length, 2, "summary delta chunks are aggregated into one public event alongside the start event");
assert.equal(actionHistory[1].rawData.events[1].params.delta, actionHistory[1].detail, "aggregated event JSON contains the complete public summary");
assert.equal(api.extractAppServerAction({
  method: "item/reasoning/textDelta", params: { itemId: "reason-1", delta: "hidden reasoning" },
}), null, "hidden reasoning text is never captured into a stage event");
const actionConversation = api.createConversationRecord();
api.appendConversationMessage(actionConversation, "codex", "完成", "complete", 3000, [], actionHistory);
const restoredActions = api.normalizeChatState({ conversations: [actionConversation] }).conversations[0].messages[0].activities;
assert.equal(restoredActions.length, 2, "actions survive save and reload with the answer");
assert.match(restoredActions[0].detail, /Get-Content agent\.md/);
assert.deepEqual(JSON.parse(JSON.stringify(restoredActions[1].rawData)), JSON.parse(JSON.stringify(actionHistory[1].rawData)),
  "aggregated public event JSON survives local conversation save and reload");
assert.equal(
  api.extractAppServerActivity({ method: "item/started", params: { item: { type: "webSearch" } } }),
  "正在检索资料……",
);
assert.equal(
  api.extractAppServerActivity({ method: "item/started", params: { item: { type: "commandExecution" } } }),
  "正在执行命令……",
);
assert.equal(
  api.extractAppServerActivity({ method: "item/started", params: { item: { type: "reasoning" } } }),
  "正在进行深度推理……",
);
assert.equal(
  api.extractAppServerError({ method: "error", params: { error: { message: "request timed out" } } }),
  "request timed out",
);
assert.match(
  api.buildAppServerTimeoutMessage(90000, "request timed out"),
  /连续 90 秒没有收到新进展.*运行 90 秒.*request timed out/,
);
assert.equal(
  JSON.stringify(api.normalizeAvailableModels({
    data: [
      { model: "gpt-fast", displayName: "Fast", hidden: false, isDefault: true },
      { model: "gpt-hidden", displayName: "Hidden", hidden: true, isDefault: false },
    ],
  })),
  JSON.stringify([{ id: "gpt-fast", model: "gpt-fast", displayName: "Fast", isDefault: true, supportedReasoningEfforts: [] }]),
);

async function runDocumentWriteIntegrationTests() {
  const PluginClass = sandbox.module.exports;
  const plugin = new PluginClass();
  const historyPlugin = new PluginClass();
  historyPlugin.chatState = api.normalizeChatState({
    activeConversationId: "persisted-active",
    conversations: [
      { id: "persisted-active", title: "保留对话", updatedAt: 200, messages: [] },
      { id: "persisted-delete", title: "待删对话", updatedAt: 100, messages: [] },
    ],
  });
  historyPlugin.persistChatState = async () => { throw new Error("模拟保存失败"); };
  const originalHistoryState = historyPlugin.chatState;
  await assert.rejects(() => historyPlugin.deleteConversation("persisted-delete"), /模拟保存失败/);
  assert.equal(historyPlugin.chatState, originalHistoryState, "a failed history persistence restores the in-memory conversations");

  const files = new Map([
    ["first-note.md", { path: "first-note.md" }],
    ["second-note.md", { path: "second-note.md" }],
  ]);
  const contents = new Map([
    ["first-note.md", "第一篇旧内容\n"],
    ["second-note.md", "第二篇旧内容\n"],
  ]);
  plugin.app = {
    vault: {
      getAbstractFileByPath: (filePath) => files.get(filePath) || null,
      read: async (file) => contents.get(file.path),
      modify: async (file, value) => contents.set(file.path, value),
    },
  };
  const firstContext = api.createSelectionContext({
    path: "first-note.md",
    kind: "selection",
    from: { line: 0, ch: 0 },
    to: { line: 1, ch: 0 },
    text: "第一篇旧内容\n",
  });
  const secondContext = api.createSelectionContext({
    path: "second-note.md",
    kind: "selection",
    from: { line: 0, ch: 0 },
    to: { line: 1, ch: 0 },
    text: "第二篇旧内容\n",
  });
  const result = await plugin.applyDocumentEdits(
    [firstContext, secondContext],
    [
      { contextIndex: 1, replacement: "第一篇新内容\n" },
      { contextIndex: 2, replacement: "第二篇新内容\n" },
    ],
  );
  assert.equal(result.changed, true);
  assert.equal(result.paths.length, 2);
  assert.equal(contents.get("first-note.md"), "第一篇新内容\n");
  assert.equal(contents.get("second-note.md"), "第二篇新内容\n");

  const rollbackContents = new Map([
    ["first-note.md", "第一篇旧内容\n"],
    ["second-note.md", "第二篇旧内容\n"],
  ]);
  plugin.app.vault.read = async (file) => rollbackContents.get(file.path);
  plugin.app.vault.modify = async (file, value) => {
    if (file.path === "second-note.md" && value === "第二篇新内容\n") {
      throw new Error("模拟第二篇写入失败");
    }
    rollbackContents.set(file.path, value);
  };
  await assert.rejects(
    () => plugin.applyDocumentEdits(
      [firstContext, secondContext],
      [
        { contextIndex: 1, replacement: "第一篇新内容\n" },
        { contextIndex: 2, replacement: "第二篇新内容\n" },
      ],
    ),
    /跨笔记写入失败.*已回滚已写入的笔记/,
  );
  assert.equal(rollbackContents.get("first-note.md"), "第一篇旧内容\n");
  assert.equal(rollbackContents.get("second-note.md"), "第二篇旧内容\n");

  plugin.persistChatState = async () => {};
  const transientConversation = api.createConversationRecord({ threadId: "preserved-thread" });
  plugin.appServer = {
    activeThreads: new Set(),
    resumeThread: async () => { throw new Error("Codex app-server 请求超时：thread/resume"); },
    startThread: async () => ({ threadId: "unexpected-new-thread" }),
    stop: () => {},
  };
  await assert.rejects(
    () => plugin.ensureConversationThread(transientConversation, "gpt-test"),
    /请求超时/,
  );
  assert.equal(transientConversation.threadId, "preserved-thread");

  const recoveryOrder = [];
  let stoppedAfterTransportFailure = false;
  plugin.appServer.interruptTurn = async (threadId, turnId) => {
    recoveryOrder.push(`interrupt:${threadId}:${turnId}`);
  };
  plugin.appServer.stop = () => {
    recoveryOrder.push("stop");
    stoppedAfterTransportFailure = true;
  };
  assert.equal(
    await plugin.recoverConversationAfterFailure(transientConversation, "preserved-thread", "active-turn"),
    true,
  );
  assert.equal(stoppedAfterTransportFailure, true);
  assert.deepEqual(recoveryOrder, ["interrupt:preserved-thread:active-turn", "stop"]);
  assert.equal(transientConversation.threadId, "preserved-thread");

  const missingConversation = api.createConversationRecord({ threadId: "missing-thread" });
  plugin.appServer = {
    activeThreads: new Set(),
    resumeThread: async () => { throw new Error("thread not found"); },
    startThread: async () => ({ threadId: "replacement-thread" }),
  };
  const replacement = await plugin.ensureConversationThread(missingConversation, "gpt-test");
  assert.equal(replacement.threadId, "replacement-thread");
  assert.equal(missingConversation.threadId, "replacement-thread");
}

runDocumentWriteIntegrationTests()
  .then(() => console.log("codex-section-panel tests passed"))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
