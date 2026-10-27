"use strict";

const obsidian = require("obsidian");
const { ItemView, MarkdownRenderer, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, setIcon } = obsidian;
const childProcess = require("child_process");
const fs = require("fs");
const net = require("net");
const os = require("os");
const path = require("path");
const tls = require("tls");
const { URL } = require("url");

const VIEW_TYPE = "codex-section-panel";
const MAX_PROMPT_HISTORY_CHARS = 24000;
const MAX_PROMPT_REFERENCE_CHARS = 24000;
const APP_SERVER_TURN_TIMEOUT_MS = 90000;
const APP_SERVER_STREAMING_TIMEOUT_MS = 180000;
const APP_SERVER_INTERRUPT_TIMEOUT_MS = 3000;
const PROXY_PROBE_TIMEOUT_MS = 5000;
const PROXY_CACHE_TTL_MS = 30000;
const DEFAULT_CODEX_PATH = "C:\\Users\\12032\\AppData\\Local\\OpenAI\\Codex\\bin\\2e5e00daee91c61d\\codex.exe";
const AUTO_PROXY_CANDIDATES = ["http://127.0.0.1:7890"];
const DEFAULT_SETTINGS = {
  codexPath: DEFAULT_CODEX_PATH,
  defaultModel: "",
  proxyUrl: "auto",
};

function withoutMarkdownExtension(value) {
  return String(value || "").replace(/\.md$/i, "");
}

function point(value) {
  return {
    line: Number.isFinite(value && value.line) ? value.line : 0,
    ch: Number.isFinite(value && value.ch) ? value.ch : 0,
  };
}

function rangeLabel(range) {
  if (!range) return "";
  const from = point(range.from);
  const to = point(range.to);
  return `L${from.line + 1}:C${from.ch + 1}-L${to.line + 1}:C${to.ch + 1}`;
}

function createSelectionContext(input) {
  const pathValue = String(input && input.path || "");
  const text = String(input && input.text || "");
  const range = input && input.range
    ? { from: point(input.range.from), to: point(input.range.to) }
    : input && (input.from || input.to)
      ? { from: point(input.from), to: point(input.to) }
      : null;
  const linktext = String(input && input.linktext || withoutMarkdownExtension(pathValue));
  return {
    heading: String(input && input.heading || "当前选区"),
    kind: String(input && input.kind || "selection"),
    linktext,
    marker: range ? `[[${linktext}]] (${rangeLabel(range)})` : `[[${linktext}]]`,
    path: pathValue,
    range,
    rangeLabel: rangeLabel(range),
    text,
  };
}

function normalizeExternalContext(input) {
  if (!input || !String(input.path || "").trim() || !String(input.text || "").trim()) return null;
  return createSelectionContext({
    path: input.path,
    linktext: input.linktext,
    range: input.range,
    from: input.from,
    to: input.to,
    text: input.text,
    heading: input.heading || "当前选区",
    kind: input.kind || "selection",
  });
}

function contextKey(context) {
  return [
    context && context.kind || "",
    context && context.path || "",
    context && context.rangeLabel || "",
    context && context.text || "",
  ].join("|");
}

function appendPendingContext(contexts, context) {
  const list = Array.isArray(contexts) ? contexts.slice() : [];
  if (!context) return list;
  if (!list.some((item) => contextKey(item) === contextKey(context))) list.push(context);
  return list;
}

function addSectionContext(contexts, context) {
  return appendPendingContext(contexts, context);
}

function removePendingContext(contexts, index) {
  return Array.isArray(contexts)
    ? contexts.filter((item, itemIndex) => itemIndex !== index)
    : [];
}

function normalizePendingContexts(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  return value ? [value] : [];
}

function clearFailedConversationThread(conversation, threadId) {
  if (!conversation || !threadId || conversation.threadId !== threadId) return false;
  conversation.threadId = "";
  return true;
}

function isDefinitiveThreadLossError(error) {
  const code = String(error && (error.code || error.errorCode || error.data && error.data.code) || "").toLowerCase();
  if (/(thread[_-](not[_-]found|invalid|expired)|invalid[_-]thread|thread[_-]expired)/.test(code)) return true;
  const message = String(error && error.message || error || "").trim();
  if (!message) return false;
  return /(?:thread|线程).{0,40}(?:not found|does not exist|unknown|invalid|expired|deleted|不存在|无效|过期|删除)/i.test(message)
    || /(?:not found|does not exist|unknown|invalid|expired|deleted|no such|could not find|cannot find).{0,40}(?:thread|线程)/i.test(message);
}

function resolveRequestContexts(pendingContexts, selectionContext, sectionContext) {
  const pending = normalizePendingContexts(pendingContexts);
  if (pending.length > 0) return pending;
  if (selectionContext) return [selectionContext];
  if (sectionContext) return [sectionContext];
  return [];
}

function findMarkdownSection(markdown, cursorLine) {
  const lines = String(markdown || "").split(/\r?\n/);
  if (lines.length === 0) return null;
  const lineNumber = Math.max(0, Math.min(Number(cursorLine) || 0, lines.length - 1));
  const headings = [];
  let fence = null;

  for (let line = 0; line < lines.length; line += 1) {
    const value = lines[line];
    const fenceMatch = /^\s{0,3}(`{3,}|~{3,})/.exec(value);
    if (fenceMatch) {
      const markerValue = fenceMatch[1];
      const markerChar = markerValue[0];
      if (!fence) {
        fence = { char: markerChar, length: markerValue.length };
      } else if (fence.char === markerChar && markerValue.length >= fence.length) {
        fence = null;
      }
      continue;
    }
    if (fence) continue;

    const heading = /^\s{0,3}(#{1,6})(?:\s+|$)/.exec(value);
    if (heading) headings.push({ line, level: heading[1].length, heading: value.trim() });
  }

  let current = null;
  for (const heading of headings) {
    if (heading.line > lineNumber) break;
    current = heading;
  }
  if (!current) return null;

  let end = lines.length;
  for (const heading of headings) {
    if (heading.line > current.line && heading.level <= current.level) {
      end = heading.line;
      break;
    }
  }

  return {
    from: { line: current.line, ch: 0 },
    to: end < lines.length
      ? { line: end, ch: 0 }
      : { line: lines.length - 1, ch: lines[lines.length - 1].length },
    heading: current.heading,
  };
}

function buildOneShotPrompt(question, context) {
  const userQuestion = String(question || "").trim() || "请分析这个章节。";
  return [
    "你正在分析一段来自 Obsidian 的 Markdown 章节。",
    `文件：${context.path}`,
    `范围：${context.rangeLabel}`,
    `标题：${context.heading || "当前选区"}`,
    "",
    "以下章节正文只用于本次请求，不要假设之后仍然可以访问该文件：",
    context.text,
    "",
    "用户问题：",
    userQuestion,
  ].join("\n");
}

function buildCodexArgs(outputPath) {
  return [
    "exec",
    "--ephemeral",
    "--skip-git-repo-check",
    "--sandbox",
    "read-only",
    "--json",
    "--output-last-message",
    outputPath,
    "-",
  ];
}

function buildAppServerArgs() {
  return [
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
  ];
}

function createJsonRpcRequest(id, method, params) {
  return {
    jsonrpc: "2.0",
    id,
    method,
    params: params || {},
  };
}

function parseAppServerJsonLines(buffer) {
  const lines = String(buffer || "").split(/\r?\n/);
  const remainder = lines.pop() || "";
  const events = [];
  for (const line of lines) {
    const value = line.trim();
    if (!value) continue;
    try {
      const event = JSON.parse(value);
      if (event && typeof event === "object") events.push(event);
    } catch (error) {
      // Ignore a malformed diagnostic line and keep the protocol stream alive.
    }
  }
  return { events, remainder };
}

function extractAppServerDelta(event) {
  if (!event || event.method !== "item/agentMessage/delta") return "";
  return event.params && typeof event.params.delta === "string" ? event.params.delta : "";
}

function extractAppServerPhase(event) {
  if (!event || typeof event.method !== "string") return "";
  if (event.method === "turn/started" || event.method === "item/started") return "thinking";
  if (event.method === "item/agentMessage/delta") return "generating";
  if (event.method === "error") return "retrying";
  if (event.method === "turn/completed") return "complete";
  return "";
}

function extractAppServerActivity(event) {
  if (!event || typeof event.method !== "string") return "";
  if (event.method === "turn/started") return "正在启动 Codex 请求……";
  if (event.method === "item/agentMessage/delta") return "正在生成回答……";
  if (event.method === "error") return "正在处理连接错误……";
  if (event.method === "turn/completed") return "请求已结束";
  if (event.method !== "item/started") return "";

  const item = event.params && event.params.item;
  const type = String(item && (item.type || item.itemType) || "").toLowerCase();
  if (type.includes("websearch") || type.includes("web_search")) return "正在检索资料……";
  if (type.includes("commandexecution") || type.includes("command_execution")) return "正在执行命令……";
  if (type.includes("filechange") || type.includes("file_change")) return "正在处理文件……";
  if (type.includes("reasoning")) return "正在进行深度推理……";
  if (type.includes("agentmessage") || type.includes("agent_message")) return "正在生成回答……";
  return "正在处理 Codex 任务……";
}

function normalizeActivities(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((action) => action && action.id && action.label).slice(-160).map((action) => {
    const kind = String(action.kind || "task");
    return {
      id: String(action.id),
      kind,
      label: String(action.label).slice(0, 120),
      detail: kind === "reasoning" ? String(action.detail || "") : String(action.detail || "").slice(0, 4000),
      rawData: normalizeActivityRawData(action.rawData),
      status: ["running", "completed", "failed", "interrupted"].includes(action.status) ? action.status : "running",
      startedAt: Number.isFinite(action.startedAt) ? action.startedAt : 0,
      endedAt: Number.isFinite(action.endedAt) ? action.endedAt : 0,
    };
  });
}

function normalizePublicActivityEvent(event) {
  if (!event || typeof event !== "object" || typeof event.method !== "string"
    || event.method === "item/reasoning/textDelta") return null;
  let copy;
  try {
    copy = JSON.parse(JSON.stringify(event));
  } catch (error) {
    return null;
  }
  const item = copy.params && copy.params.item;
  if (item && String(item.type || "").toLowerCase().replace(/_/g, "") === "reasoning") {
    for (const key of ["text", "content", "reasoning", "analysis", "rawText"]) delete item[key];
  }
  return copy;
}

function normalizeActivityRawData(value) {
  if (!value || typeof value !== "object" || !Array.isArray(value.events)) return null;
  const events = value.events.map(normalizePublicActivityEvent).filter(Boolean);
  return events.length ? { events } : null;
}

function mergeActivityRawData(previous, incoming) {
  const current = normalizeActivityRawData(previous) || { events: [] };
  const next = normalizeActivityRawData(incoming);
  if (!next) return current.events.length ? current : null;
  for (const event of next.events) {
    const params = event.params || {};
    const appendField = event.method === "item/reasoning/summaryTextDelta" || event.method === "item/agentMessage/delta";
    const eventId = String(params.itemId || params.id || "");
    if (appendField && eventId && typeof params.delta === "string") {
      const existing = current.events.find((candidate) => {
        const candidateParams = candidate.params || {};
        return candidate.method === event.method
          && String(candidateParams.itemId || candidateParams.id || "") === eventId;
      });
      if (existing) {
        existing.params.delta = `${String(existing.params.delta || "")}${params.delta}`;
        continue;
      }
    }
    current.events.push(event);
  }
  return current.events.length ? current : null;
}

function sumActivityDuration(activities) {
  return normalizeActivities(activities).reduce((total, action) => {
    if (action.status === "running" || !action.endedAt || action.endedAt < action.startedAt) return total;
    return total + action.endedAt - action.startedAt;
  }, 0);
}

function formatActivityValue(value) {
  if (typeof value === "string") return value.trim();
  if (value === null || value === undefined) return "";
  try {
    return JSON.stringify(value, null, 2);
  } catch (error) {
    return String(value);
  }
}

function joinActivityDetails(previous, incoming) {
  const left = String(previous || "").trim();
  const right = String(incoming || "").trim();
  if (!left) return right;
  if (!right || left === right || left.startsWith(right)) return left;
  if (right.startsWith(left)) return right;
  return `${left}\n\n${right}`;
}

function activityField(label, value) {
  const text = formatActivityValue(value);
  return text ? `${label}：${text}` : "";
}

function getAppServerItemDetail(item, type) {
  const lines = [];
  if (type === "reasoning") {
    const summary = Array.isArray(item.summary)
      ? item.summary.map((part) => typeof part === "string" ? part : part && part.text || "").filter(Boolean).join("\n")
      : item.summary;
    if (summary) lines.push(formatActivityValue(summary));
  } else if (type === "websearch") {
    const action = item.action || {};
    lines.push(activityField("检索词", action.query || (Array.isArray(action.queries) ? action.queries.join("\n") : "") || item.query || action.url || item.url));
    const results = Array.isArray(item.results) ? item.results : Array.isArray(action.results) ? action.results : [];
    for (const result of results.slice(0, 5)) {
      if (!result || typeof result !== "object") continue;
      lines.push([result.title, result.snippet || result.description, result.url].filter(Boolean).join("\n"));
    }
  } else if (type === "commandexecution") {
    lines.push(activityField("命令", Array.isArray(item.command) ? item.command.join(" ") : item.command));
    if (item.cwd) lines.push(activityField("目录", item.cwd));
    const output = item.aggregatedOutput || item.stdout || item.output;
    if (output) lines.push(activityField("输出", output));
    if (item.stderr) lines.push(activityField("错误输出", item.stderr));
    if (Number.isFinite(item.exitCode)) lines.push(activityField("退出码", item.exitCode));
  } else if (type === "filechange") {
    const changes = Array.isArray(item.changes) ? item.changes : [];
    for (const change of changes) {
      if (!change) continue;
      lines.push([change.path, change.diff || change.patch].filter(Boolean).join("\n"));
    }
    if (!lines.length && item.output) lines.push(activityField("结果", item.output));
  } else if (type === "mcptoolcall" || type === "dynamictoolcall") {
    lines.push(activityField("工具", [item.server, item.tool || item.toolName].filter(Boolean).join(" / ")));
    const input = item.arguments || item.input || item.params;
    if (input) lines.push(activityField("输入", input));
    const output = item.result || item.structuredContent || item.output;
    if (output) lines.push(activityField("结果", output));
  }
  return lines.filter(Boolean).join("\n\n").slice(0, 4000);
}

function extractAppServerAction(event, now = Date.now()) {
  if (!event || !event.method) return null;
  const params = event.params || {};
  const item = params.item || {};
  const itemId = String(item.id || params.itemId || "");
  const publicEvent = normalizePublicActivityEvent(event);
  const base = {
    id: itemId, startedAt: now, endedAt: 0, status: "running", detail: "",
    rawData: publicEvent ? { events: [publicEvent] } : null,
  };
  if (event.method === "turn/started") {
    return { ...base, id: `turn:${params.turn && params.turn.id || params.turnId || "current"}`, kind: "turn", label: "处理请求" };
  }
  if (event.method === "error") {
    const detail = extractAppServerError(event);
    if (!detail) return null;
    return { ...base, id: `error:${now}`, kind: "retry", label: params.willRetry ? "连接重试" : "请求错误", detail,
      status: params.willRetry ? "running" : "failed", endedAt: params.willRetry ? 0 : now };
  }
  // Only the public summary is displayed, never item/reasoning/textDelta.
  if (event.method === "item/reasoning/summaryTextDelta") {
    if (!itemId || !params.delta) return null;
    return { ...base, kind: "reasoning", label: "推理", detail: String(params.delta), appendDetail: true };
  }
  if (event.method === "item/agentMessage/delta") {
    if (!params.delta) return null;
    return { ...base, id: itemId || "answer", kind: "answer", label: "生成回答" };
  }
  if (event.method !== "item/started" && event.method !== "item/completed") return null;
  if (!itemId) return null;
  const type = String(item.type || "").toLowerCase().replace(/_/g, "");
  let kind;
  let label;
  let detail = getAppServerItemDetail(item, type);
  if (type === "reasoning") {
    kind = "reasoning"; label = "推理";
  } else if (type === "websearch") {
    kind = "search"; label = "检索资料";
  } else if (type === "commandexecution") {
    kind = "command"; label = "执行命令";
  } else if (type === "filechange") {
    kind = "file"; label = "处理文件";
  } else if (type === "mcptoolcall" || type === "dynamictoolcall") {
    kind = "tool"; label = "调用工具";
  } else if (type === "agentmessage") {
    kind = "answer";
    label = item.phase === "commentary" ? "Codex 进度" : "生成回答";
    detail = item.phase === "commentary" ? String(item.text || item.message || "").slice(0, 4000) : "";
  } else {
    return null;
  }
  const complete = event.method === "item/completed";
  const failed = item.status === "failed" || item.error || (Number.isFinite(item.exitCode) && item.exitCode !== 0);
  return { ...base, kind, label, detail, status: failed ? "failed" : complete ? "completed" : "running", endedAt: complete ? now : 0 };
}

function applyAppServerAction(activities, incoming) {
  const list = normalizeActivities(activities);
  if (!incoming) return list;
  const index = list.findIndex((action) => action.id === incoming.id);
  if (index < 0) return normalizeActivities([...list, incoming]);
  const previous = list[index];
  list[index] = {
    ...previous,
    ...incoming,
    startedAt: previous.startedAt || incoming.startedAt,
    rawData: mergeActivityRawData(previous.rawData, incoming.rawData),
    detail: incoming.appendDetail
      ? `${previous.detail}${incoming.detail || ""}`
      : joinActivityDetails(previous.detail, incoming.detail),
    status: previous.status !== "running" && incoming.status === "running" ? previous.status : incoming.status,
    endedAt: incoming.endedAt || previous.endedAt,
  };
  return normalizeActivities(list);
}

function finishAppServerActions(activities, status, now = Date.now()) {
  return normalizeActivities(activities).map((action) => action.status === "running"
    ? { ...action, status, endedAt: now }
    : action);
}

function getReferencePreviewPosition(anchor, preview, viewport) {
  const padding = 8;
  const width = Math.min(preview.width, Math.max(1, viewport.width - padding * 2));
  const height = Math.min(preview.height, Math.max(1, viewport.height - padding * 2));
  const left = Math.max(padding, Math.min(anchor.right - width, viewport.width - width - padding));
  const above = anchor.top - height - padding;
  const below = anchor.bottom + padding;
  const top = above >= padding ? above : below + height <= viewport.height - padding ? below
    : Math.max(padding, Math.min(above, viewport.height - height - padding));
  return { left, top };
}

function extractAppServerError(event) {
  if (!event || event.method !== "error") return "";
  const params = event.params || {};
  const error = params.error && typeof params.error === "object" ? params.error : params;
  return String(error.message || error.error || error.detail || params.message || "").trim();
}

function getAppServerTurnTimeoutMs(streamedText, hasStreamedOutput = false) {
  return hasStreamedOutput || String(streamedText || "").trim()
    ? APP_SERVER_STREAMING_TIMEOUT_MS
    : APP_SERVER_TURN_TIMEOUT_MS;
}

function getAppServerTimeoutDelayMs(startedAt, now, streamedText, hasStreamedOutput = false, lastProgressAt = null, hasProgress = false) {
  const started = Number(startedAt);
  const current = Number(now);
  const idleTimeout = getAppServerTurnTimeoutMs(streamedText, hasStreamedOutput || hasProgress);
  const reportedProgressAt = lastProgressAt === null || lastProgressAt === undefined ? NaN : Number(lastProgressAt);
  const idleSince = Number.isFinite(reportedProgressAt) ? reportedProgressAt : started;
  const idleElapsed = Number.isFinite(idleSince) && Number.isFinite(current)
    ? Math.max(0, current - idleSince)
    : 0;
  return Math.max(0, idleTimeout - idleElapsed);
}

function buildAppServerTimeoutMessage(elapsedMs, lastError, streamedText, hasStreamedOutput = false, idleElapsedMs = elapsedMs) {
  const runtimeSeconds = Math.max(1, Math.round(Number(elapsedMs || APP_SERVER_TURN_TIMEOUT_MS) / 1000));
  const idleSeconds = Math.max(1, Math.round(Number(idleElapsedMs || APP_SERVER_TURN_TIMEOUT_MS) / 1000));
  const detail = String(lastError || "").trim();
  const prefix = hasStreamedOutput || String(streamedText || "").trim()
    ? `Codex 已收到部分回答，但连续 ${idleSeconds} 秒没有新进展（本次请求已运行 ${runtimeSeconds} 秒）`
    : `Codex 连续 ${idleSeconds} 秒没有收到新进展（本次请求已运行 ${runtimeSeconds} 秒）`;
  return `${prefix}${detail ? `，最近错误：${detail}` : ""}。请检查网络连接后重试。`;
}

function normalizeAvailableModels(value) {
  const result = value && value.result ? value.result : value;
  const data = result && Array.isArray(result.data) ? result.data : [];
  return data
    .filter((item) => item && !item.hidden)
    .map((item) => {
      const model = String(item.model || item.id || "").trim();
      return {
        id: String(item.id || model),
        model,
        displayName: String(item.displayName || model || "未命名模型"),
        isDefault: Boolean(item.isDefault),
        supportedReasoningEfforts: Array.isArray(item.supportedReasoningEfforts)
          ? item.supportedReasoningEfforts.map((effort) => String(effort.reasoningEffort || effort)).filter(Boolean)
          : [],
      };
    })
    .filter((item) => item.model);
}

function normalizeProxyUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^auto$/i.test(raw)) return "auto";
  if (/^(off|none|disabled?)$/i.test(raw)) return "";
  const candidate = /^[a-z][a-z\d+.-]*:\/\//i.test(raw) ? raw : `http://${raw}`;
  try {
    const parsed = new URL(candidate);
    if (!["http:", "https:", "socks5:", "socks5h:"].includes(parsed.protocol)) return "";
    parsed.pathname = "";
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString().replace(/\/$/, "");
  } catch (error) {
    return "";
  }
}

function getEnvironmentProxy(existingEnv) {
  const env = existingEnv || {};
  return normalizeProxyUrl(
    env.HTTPS_PROXY || env.https_proxy || env.HTTP_PROXY || env.http_proxy || env.ALL_PROXY || env.all_proxy,
  );
}

function buildCodexEnvironment(existingEnv, homeDirectory, proxyUrl) {
  const env = { ...(existingEnv || {}) };
  const fallbackHome = String(env.HOME || env.USERPROFILE || homeDirectory || "").trim();
  if (fallbackHome) {
    if (!env.HOME) env.HOME = fallbackHome;
    if (!env.CODEX_HOME) env.CODEX_HOME = path.join(fallbackHome, ".codex");
  }
  const normalizedProxy = normalizeProxyUrl(proxyUrl);
  const existingProxy = getEnvironmentProxy(env);
  if (normalizedProxy && normalizedProxy !== "auto" && !existingProxy) {
    if (!env.HTTP_PROXY && !env.http_proxy) env.HTTP_PROXY = normalizedProxy;
    if (!env.HTTPS_PROXY && !env.https_proxy) env.HTTPS_PROXY = normalizedProxy;
    if (!env.ALL_PROXY && !env.all_proxy) env.ALL_PROXY = normalizedProxy;
  }
  return env;
}

function buildProxyFailureMessage(proxyUrl, detail) {
  const proxy = String(proxyUrl || "未配置").trim();
  const reason = String(detail || "HTTPS 连接失败").trim();
  return `代理 ${proxy} 无法建立 Codex 所需的 HTTPS 连接：${reason}。请检查 Clash 节点、系统代理/TUN 模式，或在插件设置中修改代理地址。`;
}

function parseHttpProxyEndpoint(proxyUrl) {
  try {
    const parsed = new URL(normalizeProxyUrl(proxyUrl));
    if (!["http:", "https:"].includes(parsed.protocol) || !parsed.hostname) return null;
    return {
      host: parsed.hostname,
      port: Number(parsed.port || (parsed.protocol === "https:" ? 443 : 80)),
      protocol: parsed.protocol,
    };
  } catch (error) {
    return null;
  }
}

function probeTcpProxy(proxyUrl, timeoutMs = PROXY_PROBE_TIMEOUT_MS) {
  const endpoint = parseHttpProxyEndpoint(proxyUrl);
  if (!endpoint) return Promise.resolve(false);
  return new Promise((resolve) => {
    let settled = false;
    const socket = net.createConnection({ host: endpoint.host, port: endpoint.port });
    const finish = (value) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(value);
    };
    socket.setTimeout(timeoutMs, () => finish(false));
    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
  });
}

function probeHttpsThroughHttpProxy(proxyUrl, targetHost = "chatgpt.com", timeoutMs = PROXY_PROBE_TIMEOUT_MS) {
  const endpoint = parseHttpProxyEndpoint(proxyUrl);
  if (!endpoint) return Promise.resolve({ ok: true, skipped: true });
  return new Promise((resolve) => {
    let settled = false;
    let secureSocket = null;
    const socket = net.createConnection({ host: endpoint.host, port: endpoint.port });
    const finish = (result) => {
      if (settled) return;
      settled = true;
      if (secureSocket) secureSocket.destroy();
      else socket.destroy();
      resolve(result);
    };
    const timer = setTimeout(() => finish({ ok: false, error: "代理 HTTPS 探测超时" }), timeoutMs);
    const clearProbeTimer = () => clearTimeout(timer);
    socket.setTimeout(timeoutMs, () => {
      clearProbeTimer();
      finish({ ok: false, error: "连接代理超时" });
    });
    socket.once("error", (error) => {
      clearProbeTimer();
      finish({ ok: false, error: error && error.message || "连接代理失败" });
    });
    socket.once("connect", () => {
      socket.write([
        `CONNECT ${targetHost}:443 HTTP/1.1`,
        `Host: ${targetHost}:443`,
        "Proxy-Connection: Keep-Alive",
        "",
        "",
      ].join("\r\n"));
    });
    let header = "";
    socket.on("data", (chunk) => {
      header += String(chunk);
      const boundary = header.indexOf("\r\n\r\n");
      if (boundary < 0) return;
      socket.removeAllListeners("data");
      const statusLine = header.slice(0, boundary).split("\r\n")[0] || "";
      const statusMatch = statusLine.match(/^HTTP\/\d(?:\.\d)?\s+(\d{3})/i);
      if (!statusMatch || Number(statusMatch[1]) !== 200) {
        clearProbeTimer();
        finish({ ok: false, error: `代理返回 ${statusLine || "未知响应"}` });
        return;
      }
      socket.pause();
      secureSocket = tls.connect({ socket, servername: targetHost });
      secureSocket.setTimeout(timeoutMs, () => {
        clearProbeTimer();
        finish({ ok: false, error: "HTTPS TLS 握手超时" });
      });
      secureSocket.once("secureConnect", () => {
        clearProbeTimer();
        finish({ ok: true });
      });
      secureSocket.once("error", (error) => {
        clearProbeTimer();
        finish({ ok: false, error: error && error.message || "HTTPS TLS 握手失败" });
      });
    });
  });
}

function createRecordId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function conversationTitle(value) {
  const title = String(value || "").replace(/\s+/g, " ").trim();
  return title ? title.slice(0, 32) : "新对话";
}

function getConversationDisplayTitle(conversation) {
  const firstUser = Array.isArray(conversation && conversation.messages)
    ? conversation.messages.find((message) => message && message.role === "user"
      && Array.isArray(message.references) && message.references.length > 0)
    : null;
  const firstReference = firstUser && Array.isArray(firstUser.references) ? firstUser.references[0] : null;
  const heading = String(firstReference && firstReference.heading || "")
    .replace(/^\s{0,3}#{1,6}\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
  return heading || String(conversation && conversation.title || "新对话");
}

function formatHistoryTime(value, nowValue = Date.now()) {
  const date = new Date(value);
  const now = new Date(nowValue);
  if (Number.isNaN(date.getTime()) || Number.isNaN(now.getTime())) return "";
  const time = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  const sameDay = date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate();
  if (sameDay) return `今天 ${time}`;
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (date.getFullYear() === yesterday.getFullYear()
    && date.getMonth() === yesterday.getMonth()
    && date.getDate() === yesterday.getDate()) return `昨天 ${time}`;
  const dateLabel = date.getFullYear() === now.getFullYear()
    ? date.toLocaleDateString([], { month: "2-digit", day: "2-digit" })
    : date.toLocaleDateString();
  return `${dateLabel} ${time}`;
}

function formatMessageTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
}

function normalizeMessageReferences(value) {
  return Array.isArray(value)
    ? value.map(normalizeExternalContext).filter(Boolean)
    : [];
}

function createConversationRecord(seed) {
  const input = seed || {};
  const now = Number.isFinite(input.now) ? input.now : Date.now();
  return {
    id: String(input.id || createRecordId("conversation")),
    threadId: String(input.threadId || ""),
    model: String(input.model || ""),
    title: String(input.title || "新对话"),
    createdAt: Number.isFinite(input.createdAt) ? input.createdAt : now,
    updatedAt: Number.isFinite(input.updatedAt) ? input.updatedAt : now,
    messages: [],
  };
}

function normalizeMessage(message) {
  if (!message || (message.role !== "user" && message.role !== "codex")) return null;
  const status = ["complete", "paused", "error"].includes(message.status)
    ? message.status
    : "complete";
  let proposal = null;
  if (message.proposal) {
    try {
      proposal = parseDocumentEditProposal(message.proposal);
    } catch (error) {
      proposal = null;
    }
  }
  return {
    id: String(message.id || createRecordId("message")),
    role: message.role,
    content: String(message.content || ""),
    status,
    createdAt: Number.isFinite(message.createdAt) ? message.createdAt : Date.now(),
    references: normalizeMessageReferences(message.references),
    activities: normalizeActivities(message.activities),
    responseError: String(message.responseError || "").slice(0, 1000),
    requestModel: String(message.requestModel || ""),
    replyToMessageId: String(message.replyToMessageId || ""),
    proposal,
    editStatus: proposal
      ? (["applied", "unchanged"].includes(message.editStatus) ? message.editStatus : "pending")
      : "",
  };
}

function normalizeConversation(value) {
  const record = createConversationRecord(value);
  const messages = Array.isArray(value && value.messages)
    ? value.messages.map(normalizeMessage).filter(Boolean)
    : [];
  const firstUser = messages.find((message) => message.role === "user");
  return {
    ...record,
    threadId: String(value && value.threadId || record.threadId),
    model: String(value && value.model || record.model),
    title: String(value && value.title || (firstUser ? conversationTitle(firstUser.content) : record.title)),
    messages,
  };
}

function normalizeChatState(value) {
  const raw = value && typeof value === "object" ? value : {};
  const conversations = Array.isArray(raw.conversations)
    ? raw.conversations.map(normalizeConversation)
    : [];
  if (conversations.length === 0) conversations.push(createConversationRecord());
  const activeConversationId = conversations.some((item) => item.id === raw.activeConversationId)
    ? raw.activeConversationId
    : conversations[0].id;
  return {
    version: 1,
    conversations,
    activeConversationId,
    historyCollapsed: Boolean(raw.historyCollapsed),
  };
}

function removeConversationFromChatState(value, conversationId, nowValue = Date.now()) {
  const chatState = normalizeChatState(value);
  const targetId = String(conversationId || "");
  const deletedConversation = chatState.conversations.find((conversation) => conversation.id === targetId);
  if (!deletedConversation) return { chatState, deleted: false, wasActive: false };

  const wasActive = chatState.activeConversationId === targetId;
  let conversations = chatState.conversations.filter((conversation) => conversation.id !== targetId);
  if (conversations.length === 0) {
    conversations = [createConversationRecord({ now: Number.isFinite(nowValue) ? nowValue : Date.now() })];
  }
  const activeConversationId = wasActive
    ? [...conversations].sort((left, right) => right.updatedAt - left.updatedAt)[0].id
    : chatState.activeConversationId;
  return {
    chatState: { ...chatState, conversations, activeConversationId },
    deleted: true,
    wasActive,
  };
}

function normalizePluginData(value) {
  const raw = value && typeof value === "object" ? value : {};
  const settings = raw.settings && typeof raw.settings === "object"
    ? raw.settings
    : raw;
  return {
    settings: { ...DEFAULT_SETTINGS, ...settings },
    chatState: normalizeChatState(raw.chatState),
  };
}

function appendConversationMessage(conversation, role, content, status, createdAt, references, activities, metadata) {
  if (!conversation || (role !== "user" && role !== "codex")) return null;
  const timestamp = Number.isFinite(createdAt) ? createdAt : Date.now();
  const extra = metadata && typeof metadata === "object" ? metadata : {};
  const message = normalizeMessage({
    role,
    content,
    status: status || "complete",
    createdAt: timestamp,
    references,
    activities,
    requestModel: extra.requestModel,
    replyToMessageId: extra.replyToMessageId,
    proposal: extra.proposal,
    editStatus: extra.editStatus,
    responseError: extra.responseError,
  });
  conversation.messages.push(message);
  conversation.updatedAt = timestamp;
  if (role === "user" && conversation.messages.filter((item) => item.role === "user").length === 1) {
    conversation.title = conversationTitle(content);
  }
  return message;
}

function buildReferenceClipboardText(reference) {
  return String(reference && reference.text || "");
}

function buildMessageClipboardText(message) {
  if (!message) return "";
  const lines = [String(message.content || "")];
  if (message.role === "user" && Array.isArray(message.references)) {
    const markers = message.references
      .map((reference) => String(reference.marker || `${reference.path || ""} ${reference.rangeLabel || ""}`).trim())
      .filter(Boolean)
      .map((marker) => `引用：${marker}`);
    if (markers.length) lines.push("", ...markers);
  }
  return lines.join("\n").trim();
}

function buildActivityClipboardText(action) {
  const label = String(action && action.label || "").trim();
  const detail = String(action && action.detail || "");
  if (!label) return detail;
  return detail ? `${label}\n\n${detail}` : label;
}

function buildActivitiesClipboardText(activities) {
  return normalizeActivities(activities)
    .map((action) => buildActivityClipboardText(action))
    .filter(Boolean)
    .join("\n\n---\n\n");
}

function buildConversationClipboardText(conversation) {
  if (!conversation || !Array.isArray(conversation.messages)) return "";
  return conversation.messages.map((message) => {
    const role = message.role === "user" ? "用户" : "Codex";
    const lines = [`${role}：${String(message.content || "")}`];
    if (message.role === "user" && Array.isArray(message.references)) {
      for (const reference of message.references) {
        const marker = String(reference.marker || `${reference.path || ""} ${reference.rangeLabel || ""}`).trim();
        if (marker) lines.push(`引用：${marker}`);
      }
    }
    return lines.join("\n");
  }).join("\n\n");
}

async function copyTextToClipboard(value) {
  const text = String(value || "");
  if (!text) return false;
  if (typeof navigator !== "undefined" && navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
    await navigator.clipboard.writeText(text);
    return true;
  }
  if (typeof document === "undefined" || typeof document.execCommand !== "function") {
    throw new Error("当前环境不支持复制到剪贴板。");
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("复制到剪贴板失败。");
  return true;
}

function buildContextBlock(context) {
  const contexts = normalizePendingContexts(context);
  if (!contexts.length) return "本轮没有附加章节正文。";
  const blocks = contexts.map((item, index) => [
      `引用 ${index + 1}`,
      `文件：${item.path}`,
      `范围：${item.rangeLabel}`,
      `标题：${item.heading || "当前选区"}`,
      "",
      "以下正文只用于本次请求，不要假设之后仍然可以访问该文件：",
      item.text,
    ].join("\n"));
  return [
    "引用材料按用户添加顺序编号。请按本轮问题决定如何使用各引用；不要默认某一条更重要，也不要自行合并、改写引用内容。",
    ...blocks,
  ].join("\n\n---\n\n");
}

function getReferenceKey(reference) {
  const item = normalizeExternalContext(reference);
  if (!item) return "";
  return `${item.path}|${item.rangeLabel}`;
}

function collectConversationReferences(messages) {
  const seen = new Set();
  const references = [];
  const historyMessages = Array.isArray(messages) ? messages : [];
  for (let messageIndex = historyMessages.length - 1; messageIndex >= 0; messageIndex -= 1) {
    const message = historyMessages[messageIndex];
    if (!message || message.role !== "user" || !Array.isArray(message.references)) continue;
    for (let referenceIndex = message.references.length - 1; referenceIndex >= 0; referenceIndex -= 1) {
      const reference = normalizeExternalContext(message.references[referenceIndex]);
      const key = getReferenceKey(reference);
      if (!reference || !key || seen.has(key)) continue;
      seen.add(key);
      references.unshift(reference);
    }
  }
  return references;
}

function buildHistoricalReferenceBlock(messages, currentContexts) {
  const currentKeys = new Set(
    normalizePendingContexts(currentContexts)
      .map(getReferenceKey)
      .filter(Boolean),
  );
  const seen = new Set(currentKeys);
  const entries = [];
  let totalLength = 0;
  let omitted = false;
  const historyMessages = Array.isArray(messages) ? messages : [];
  for (let messageIndex = historyMessages.length - 1; messageIndex >= 0; messageIndex -= 1) {
    const message = historyMessages[messageIndex];
    if (!message || message.role !== "user" || !Array.isArray(message.references)) continue;
    for (let referenceIndex = message.references.length - 1; referenceIndex >= 0; referenceIndex -= 1) {
      const reference = normalizeExternalContext(message.references[referenceIndex]);
      if (!reference || !reference.text.trim()) continue;
      const key = getReferenceKey(reference);
      if (!key || seen.has(key)) continue;
      const entry = [
        `历史引用 ${entries.length + 1}`,
        `文件：${reference.path}`,
        `范围：${reference.rangeLabel}`,
        `标题：${reference.heading || "当前选区"}`,
        "",
        reference.text,
      ].join("\n");
      const separatorLength = entries.length ? 4 : 0;
      if (totalLength + separatorLength + entry.length > MAX_PROMPT_REFERENCE_CHARS) {
        omitted = true;
        continue;
      }
      seen.add(key);
      entries.unshift(entry);
      totalLength += separatorLength + entry.length;
    }
  }
  if (entries.length === 0) return "";
  return [
    `历史引用正文${omitted ? "（较早内容已省略）" : ""}：`,
    entries.join("\n\n---\n\n"),
  ].join("\n");
}

function buildTurnPrompt(question, context) {
  const userQuestion = String(question || "").trim() || "请回答这个问题。";
  return [
    buildContextBlock(context),
    "",
    "本轮用户问题：",
    userQuestion,
  ].join("\n");
}

function buildConversationPrompt(question, context, messages, options) {
  const settings = options && typeof options === "object" ? options : {};
  const userQuestion = String(question || "").trim() || "请分析这个章节。";
  let sourceMessages = Array.isArray(messages) ? messages : [];
  if (settings.omitCurrentUserMessage && sourceMessages.length > 0) {
    const lastMessage = sourceMessages[sourceMessages.length - 1];
    if (lastMessage && lastMessage.role === "user" && String(lastMessage.content || "").trim() === userQuestion) {
      sourceMessages = sourceMessages.slice(0, -1);
    }
  }
  const historyEntries = sourceMessages
      .filter((message) => message && (message.role === "user" || message.role === "codex"))
      .map((message) => `${message.role === "user" ? "用户" : "Codex"}：\n${String(message.content || "")}`)
    ;
  const selectedHistory = [];
  let historyLength = 0;
  for (let index = historyEntries.length - 1; index >= 0; index -= 1) {
    const entry = historyEntries[index];
    const separatorLength = selectedHistory.length ? 2 : 0;
    if (historyLength + separatorLength + entry.length > MAX_PROMPT_HISTORY_CHARS) {
      if (selectedHistory.length === 0) selectedHistory.unshift(entry.slice(-MAX_PROMPT_HISTORY_CHARS));
      break;
    }
    selectedHistory.unshift(entry);
    historyLength += separatorLength + entry.length;
  }
  const omittedHistory = historyEntries.length > selectedHistory.length;
  const history = selectedHistory.join("\n\n");
  const historicalReferences = settings.includeHistoricalReferences
    ? buildHistoricalReferenceBlock(sourceMessages, context)
    : "";
  return [
    "你正在参与一个由 Obsidian Codex Section Panel 管理的对话。",
    history
      ? `历史对话（仅为问答文本${omittedHistory ? "；较早消息已省略" : ""}）：\n${history}`
      : "历史对话：无。",
    "",
    historicalReferences,
    historicalReferences ? "" : null,
    buildContextBlock(context),
    "",
    "本轮用户问题：",
    userQuestion,
  ].filter((item) => item !== null).join("\n");
}

function buildConversationRecoveryPrompt(question, context, messages) {
  return buildConversationPrompt(question, context, messages, {
    includeHistoricalReferences: true,
    omitCurrentUserMessage: true,
  });
}

function buildCodexResponseProtocol() {
  return [
    "回答协议：",
    "1. 请自行判断用户是在咨询，还是要求修改笔记。",
    "2. 只需回答时，intent 写 answer，answer 写正常的 Markdown 回答，edit 必须为 null。",
    "3. 用户要求修改笔记且有可用引用时，intent 写 edit，answer 写简短说明，edit 必须包含可应用的完整修改建议。",
    "4. 修改建议只能覆盖上下文中列出的引用范围。若本轮没有附加引用，可复用本对话历史中已发送的引用；没有可用引用时，不要猜测内容，intent 写 answer 并说明需要引用正文。",
    "5. 每个修改项用 contextIndex 指向一个引用，从 1 开始；replacement 必须是该引用范围的完整替换文本。",
    "6. 你不能直接修改或声称已修改 Obsidian 笔记；插件会在用户确认后通过 Obsidian API 应用 edit 建议。",
    "7. 只返回一个 JSON 对象，不要返回 Markdown 代码块、解释文字或其他内容。",
    "JSON 格式：",
    '{"intent":"answer","answer":"回答内容","edit":null}',
    '{"intent":"edit","answer":"修改说明","edit":{"summary":"一句话说明修改内容","edits":[{"contextIndex":1,"replacement":"完整替换文本"}]}}',
  ].join("\n");
}

function buildUnifiedConversationPrompt(question, context, messages, options) {
  return [
    buildConversationPrompt(question, context, messages, options),
    "",
    buildCodexResponseProtocol(),
  ].join("\n");
}

function buildUnifiedTurnPrompt(question, context) {
  return [
    buildTurnPrompt(question, context),
    "",
    buildCodexResponseProtocol(),
  ].join("\n");
}

function buildHistoricalTurnPrompt(question, contexts) {
  const references = normalizePendingContexts(contexts);
  const index = references.map((item, position) => [
    `${position + 1}. ${item.heading || "当前选区"}`,
    `   ${item.marker || `${item.path} ${item.rangeLabel}`}`,
  ].join("\n")).join("\n");
  return [
    "本轮没有新增正文。历史引用索引对应本对话早先发送的引用正文；正文是添加引用时的快照，不保证与笔记当前内容同步。回答时按用户本轮问题选择相关引用。",
    "如果用户明确要求修改已引用内容，edit.edits[].contextIndex 必须使用以下编号；未要求修改时 edit 为 null。",
    "历史引用索引：",
    index,
    "本轮用户问题：",
    String(question || "").trim() || "请回答这个问题。",
    "",
    buildCodexResponseProtocol(),
  ].join("\n");
}

function buildDocumentEditPrompt(question, contexts, messages, options) {
  return [
    "你正在为 Obsidian Codex Section Panel 生成文档修改建议。",
    buildConversationPrompt(question, contexts, messages, options),
    "",
    "修改协议：",
    "1. 只能修改上面列出的引用范围，不能修改引用范围之外的内容，也不能修改其他文件。",
    "2. 每个修改项用 contextIndex 指向一个引用，从 1 开始；replacement 必须是该引用范围的完整替换文本。",
    "3. 如果不需要修改，edits 返回空数组。",
    "4. 只返回一个 JSON 对象，不要返回 Markdown 代码块、解释文字或其他内容。",
    "JSON 格式：",
    '{"summary":"一句话说明修改内容","edits":[{"contextIndex":1,"replacement":"完整替换文本"}]}',
  ].join("\n");
}

function parseDocumentEditProposal(value) {
  let parsed;
  if (value && typeof value === "object" && !Array.isArray(value)) {
    parsed = value;
  } else {
    const source = String(value || "").trim();
    const fenced = source.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    const jsonText = fenced ? fenced[1].trim() : source;
    try {
      parsed = JSON.parse(jsonText);
    } catch (error) {
      throw new Error("无法解析 Codex 返回的修改建议：不是有效 JSON。 ");
    }
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("无法解析 Codex 返回的修改建议：顶层必须是 JSON 对象。 ");
  }
  if (!Array.isArray(parsed.edits)) {
    throw new Error("无法解析 Codex 返回的修改建议：缺少 edits 数组。 ");
  }
  const edits = parsed.edits.map((edit, index) => {
    const contextIndex = Number(edit && edit.contextIndex);
    if (!Number.isInteger(contextIndex) || contextIndex < 1) {
      throw new Error(`无法解析 Codex 返回的修改建议：第 ${index + 1} 项 contextIndex 无效。`);
    }
    if (!edit || typeof edit.replacement !== "string") {
      throw new Error(`无法解析 Codex 返回的修改建议：第 ${index + 1} 项缺少 replacement。`);
    }
    return { contextIndex, replacement: edit.replacement };
  });
  const seen = new Set();
  for (const edit of edits) {
    if (seen.has(edit.contextIndex)) {
      throw new Error(`无法解析 Codex 返回的修改建议：上下文 ${edit.contextIndex} 被重复修改。`);
    }
    seen.add(edit.contextIndex);
  }
  return {
    summary: String(parsed.summary || "Codex 提出了文档修改建议。").trim(),
    edits,
  };
}

function repairLooseMarkdownJsonEscapes(value) {
  const source = String(value || "");
  let output = "";
  let inString = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === '"') {
      output += character;
      inString = !inString;
      continue;
    }
    if (!inString) {
      output += character;
      continue;
    }
    if (character === "\r" || character === "\n") {
      if (character === "\r" && source[index + 1] === "\n") index += 1;
      output += "\\n";
      continue;
    }
    if (character !== "\\") {
      output += character;
      continue;
    }
    const next = source[index + 1];
    if (next == null) {
      output += "\\\\";
      continue;
    }
    if (/^["\\/bfnrtu]$/.test(next)) {
      output += `\\${next}`;
      index += 1;
      continue;
    }
    if (/^[*`_[\](){}#+!~>\-]$/.test(next)) {
      output += next;
      index += 1;
      continue;
    }
    // Preserve unknown literal backslashes, such as those in a Windows path,
    // without turning them into invalid JSON escapes.
    output += "\\\\";
  }
  return output;
}

function parseLooseJson(value) {
  const source = String(value || "");
  try {
    return JSON.parse(source);
  } catch (error) {
    const repaired = repairLooseMarkdownJsonEscapes(source);
    if (repaired === source) throw error;
    return JSON.parse(repaired);
  }
}

function parseTrailingCodexPayload(source) {
  const value = String(source || "");
  for (let start = value.indexOf("{"); start >= 0; start = value.indexOf("{", start + 1)) {
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let index = start; index < value.length; index += 1) {
      const character = value[index];
      if (inString) {
        if (escaped) escaped = false;
        else if (character === "\\") escaped = true;
        else if (character === '"') inString = false;
        continue;
      }
      if (character === '"') inString = true;
      else if (character === "{") depth += 1;
      else if (character === "}") {
        depth -= 1;
        if (depth !== 0) continue;
        const suffix = value.slice(index + 1).trim().replace(/^```\s*$/, "").trim();
        if (suffix) break;
        try {
          const parsed = parseLooseJson(value.slice(start, index + 1));
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)
            && (typeof parsed.answer === "string" || parsed.edit != null || Array.isArray(parsed.edits))) {
            return parsed;
          }
        } catch (error) {
          // Keep looking in case a later, complete protocol object follows prose.
        }
        break;
      }
    }
  }
  return null;
}

function parseCodexResponse(value, options) {
  const strict = Boolean(options && options.strict);
  const source = String(value || "").trim();
  if (!source) return { answer: "", proposal: null, error: strict ? "Codex 没有返回结构化回答。" : "" };
  const fenced = source.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const jsonText = fenced ? fenced[1].trim() : source;
  let parsed;
  try {
    parsed = parseLooseJson(jsonText);
  } catch (error) {
    parsed = parseTrailingCodexPayload(source);
    if (!parsed) return {
      answer: source,
      proposal: null,
      error: strict ? "Codex 回复不是有效的结构化 JSON。" : "",
    };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { answer: source, proposal: null, error: strict ? "Codex 回复不是有效的结构化 JSON。" : "" };
  }
  if (strict) {
    if (!["answer", "edit"].includes(parsed.intent)) {
      return { answer: String(parsed.answer || source).trim(), proposal: null, error: "Codex 回复缺少有效的 intent 声明。" };
    }
    if (typeof parsed.answer !== "string") {
      return { answer: source, proposal: null, error: "Codex 回复缺少 answer 内容。" };
    }
    if (parsed.intent === "edit" && parsed.edit == null) {
      return { answer: parsed.answer.trim() || source, proposal: null, error: "Codex 判断需要修改，但没有返回修改建议。" };
    }
    if (parsed.intent === "answer" && parsed.edit !== null) {
      return { answer: parsed.answer.trim() || source, proposal: null, error: "Codex 的 intent 与 edit 字段不一致。" };
    }
  }

  if (Array.isArray(parsed.edits)) {
    try {
      const proposal = parseDocumentEditProposal(parsed);
      return { answer: proposal.summary, proposal, error: "" };
    } catch (error) {
      return {
        answer: String(parsed.summary || source).trim(),
        proposal: null,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  const answer = typeof parsed.answer === "string" ? parsed.answer.trim() : "";
  if (parsed.edit == null) return { answer: answer || source, proposal: null, error: "" };
  try {
    const proposal = parseDocumentEditProposal(parsed.edit);
    return { answer: answer || proposal.summary, proposal, error: "" };
  } catch (error) {
    return {
      answer: answer || source,
      proposal: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function formatCodexResponseForDisplay(value) {
  const source = String(value || "");
  const parsed = parseCodexResponse(source);
  if (!parsed.proposal) return parsed.answer || source;

  const sections = [];
  const answer = String(parsed.answer || "").trim();
  const summary = String(parsed.proposal.summary || "").trim();
  if (answer) sections.push(answer);
  if (summary && summary !== answer) sections.push(`### 修改建议\n\n${summary}`);
  for (const edit of parsed.proposal.edits) {
    const replacement = String(edit.replacement || "").trim();
    const body = replacement || "建议删除此引用范围。";
    sections.push(`#### 引用 ${edit.contextIndex} 修改建议\n\n${body}`);
  }
  return sections.join("\n\n") || source;
}

function formatStreamingCodexText(value) {
  const source = String(value || "");
  if (!source.trim()) return "";
  if (/^\s*```?(?:json)?\s*\{/.test(source) || /\{\s*"answer"\s*:/.test(source)) {
    const answerMarker = source.match(/"answer"\s*:\s*"/);
    if (answerMarker && typeof answerMarker.index === "number") {
      const valueStart = answerMarker.index + answerMarker[0].length;
      if (valueStart > answerMarker.index) {
        let escaped = false;
        for (let index = valueStart; index < source.length; index += 1) {
          const character = source[index];
          if (escaped) {
            escaped = false;
            continue;
          }
          if (character === "\\") {
            escaped = true;
            continue;
          }
          if (character === "\"") {
            try {
              return JSON.parse(source.slice(valueStart - 1, index + 1));
            } catch (error) {
              break;
            }
          }
        }
      }
    }
    return "正在生成结构化回答……";
  }
  return source;
}

function normalizeLineEndings(value) {
  return String(value || "").replace(/\r\n?/g, "\n");
}

function lineStartOffsets(markdown) {
  const source = String(markdown || "");
  const offsets = [0];
  const newline = /\r\n|\r|\n/g;
  let match;
  while ((match = newline.exec(source))) offsets.push(match.index + match[0].length);
  return offsets;
}

function positionToOffset(markdown, position) {
  const source = String(markdown || "");
  const value = point(position);
  const offsets = lineStartOffsets(source);
  if (value.line < 0 || value.line >= offsets.length) {
    throw new Error("修改范围无效：行号超出当前文档。 ");
  }
  const lineStart = offsets[value.line];
  const nextLineStart = value.line + 1 < offsets.length ? offsets[value.line + 1] : source.length;
  const lineEnd = value.line + 1 < offsets.length
    ? nextLineStart - (source[nextLineStart - 2] === "\r" ? 2 : 1)
    : source.length;
  if (value.ch < 0 || lineStart + value.ch > lineEnd) {
    throw new Error("修改范围无效：列号超出当前文档。 ");
  }
  return lineStart + value.ch;
}

function adaptReplacementLineEndings(value, markdown) {
  const replacement = normalizeLineEndings(value);
  return String(markdown || "").includes("\r\n") ? replacement.replace(/\n/g, "\r\n") : replacement;
}

function buildDocumentEditPlan(contexts, edits) {
  const list = normalizePendingContexts(contexts);
  if (!Array.isArray(edits)) throw new Error("修改建议格式无效：edits 必须是数组。 ");
  const groups = new Map();
  for (const edit of edits) {
    const contextIndex = Number(edit && edit.contextIndex);
    const context = list[contextIndex - 1];
    if (!context) throw new Error(`修改建议引用了不存在的上下文：${contextIndex}。`);
    const path = String(context.path || "").trim();
    if (!path) throw new Error(`上下文 ${contextIndex} 没有目标笔记路径。`);
    if (!groups.has(path)) groups.set(path, { path, edits: [] });
    groups.get(path).edits.push(edit);
  }
  return [...groups.values()];
}

function applyDocumentEditsToMarkdown(markdown, contexts, edits) {
  const source = String(markdown || "");
  const list = normalizePendingContexts(contexts);
  if (!Array.isArray(edits)) throw new Error("修改建议格式无效：edits 必须是数组。 ");
  const changes = edits.map((edit) => {
    const contextIndex = Number(edit && edit.contextIndex);
    const context = list[contextIndex - 1];
    if (!context) throw new Error(`修改建议引用了不存在的上下文：${contextIndex}。`);
    if (!context.range) throw new Error(`上下文 ${contextIndex} 没有可写入的范围。`);
    const from = positionToOffset(source, context.range.from);
    const to = positionToOffset(source, context.range.to);
    if (from > to) throw new Error(`上下文 ${contextIndex} 的修改范围无效。`);
    const current = source.slice(from, to);
    const lineBreak = current.match(/(\r\n|\r|\n)$/);
    const contextEndsWithLineBreak = normalizeLineEndings(context.text).endsWith("\n");
    const boundaryLineBreak = context.range.to.ch === 0 && lineBreak && !contextEndsWithLineBreak
      ? lineBreak[1]
      : "";
    const comparableCurrent = boundaryLineBreak
      ? current.slice(0, -boundaryLineBreak.length)
      : current;
    if (normalizeLineEndings(comparableCurrent) !== normalizeLineEndings(context.text)) {
      throw new Error(`上下文 ${contextIndex} 的引用范围已发生变化，请重新读取后再修改。`);
    }
    let replacement = adaptReplacementLineEndings(edit.replacement, source);
    if (boundaryLineBreak && !normalizeLineEndings(replacement).endsWith("\n")) {
      replacement += boundaryLineBreak;
    }
    return {
      from,
      to,
      replacement,
    };
  });
  const ascending = changes.slice().sort((left, right) => left.from - right.from);
  for (let index = 1; index < ascending.length; index += 1) {
    if (ascending[index - 1].to > ascending[index].from) {
      throw new Error("修改建议包含重叠的引用范围，已拒绝写入。 ");
    }
  }
  return changes
    .sort((left, right) => right.from - left.from)
    .reduce((result, change) => `${result.slice(0, change.from)}${change.replacement}${result.slice(change.to)}`, source);
}

function extractCodexDelta(event, streamedText) {
  if (!event || typeof event !== "object") return "";
  const deltaTypes = new Set(["item.delta", "response.output_text.delta", "output_text.delta"]);
  if (deltaTypes.has(event.type) && typeof event.delta === "string") return event.delta;
  if (
    event.type === "item.updated"
    && event.item
    && event.item.type === "agent_message"
    && typeof event.item.text === "string"
  ) {
    if (!streamedText) return event.item.text;
    return event.item.text.startsWith(streamedText)
      ? event.item.text.slice(streamedText.length)
      : "";
  }
  if (
    event.type === "item.completed"
    && event.item
    && event.item.type === "agent_message"
    && !streamedText
    && typeof event.item.text === "string"
  ) return event.item.text;
  return "";
}

function extractCodexPhase(event) {
  if (!event || typeof event !== "object") return "";
  if (event.type === "turn.started" || event.type === "item.started") return "thinking";
  if (
    event.type === "item.delta"
    || event.type === "item.updated"
    || event.type === "response.output_text.delta"
    || event.type === "output_text.delta"
  ) return "generating";
  if (event.type === "turn.completed") return "complete";
  return "";
}

function parseCodexJsonLines(buffer) {
  const lines = String(buffer || "").split(/\r?\n/);
  const remainder = lines.pop() || "";
  const events = [];
  for (const line of lines) {
    const value = line.trim();
    if (!value) continue;
    try {
      const event = JSON.parse(value);
      if (event && typeof event === "object") events.push(event);
    } catch (error) {
      // Ignore a malformed diagnostic line and keep the stream alive.
    }
  }
  return { events, remainder };
}

function isMarkdownView(view) {
  return Boolean(view && view.file && view.editor && (
    typeof view.getViewType !== "function" || view.getViewType() === "markdown"
  ));
}

async function getCurrentSection(view, app) {
  if (!isMarkdownView(view) || !app || !app.vault || typeof app.vault.read !== "function") return null;
  const cursor = view.editor.getCursor ? view.editor.getCursor("from") : { line: 0, ch: 0 };
  const markdown = await app.vault.read(view.file);
  const section = findMarkdownSection(markdown, cursor.line);
  if (!section) return null;

  const lines = String(markdown || "").split(/\r?\n/);
  const endLine = section.to.line < lines.length && section.to.ch === 0 ? section.to.line : lines.length;
  const text = lines.slice(section.from.line, endLine).join("\n");
  return createSelectionContext({
    heading: section.heading,
    kind: "section",
    path: view.file.path,
    range: { from: section.from, to: section.to },
    text,
  });
}

function getCurrentSelection(view) {
  if (!isMarkdownView(view) || !view.editor || typeof view.editor.getSelection !== "function") return null;
  const text = String(view.editor.getSelection() || "");
  if (!text.trim()) return null;
  const from = view.editor.getCursor ? view.editor.getCursor("from") : { line: 0, ch: 0 };
  const to = view.editor.getCursor ? view.editor.getCursor("to") : from;
  return createSelectionContext({ path: view.file.path, from, to, text });
}

class CodexSectionPanelView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.contexts = [];
    this.promptInput = null;
    this.contextEl = null;
    this.messagesEl = null;
    this.historyListEl = null;
    this.historyLayoutEl = null;
    this.historyToggleButton = null;
    this.historyViewEl = null;
    this.statusEl = null;
    this.sendButton = null;
    this.pauseButton = null;
    this.modelSelect = null;
    this.modelOptions = [];
    this.newConversationButton = null;
    this.copyConversationButton = null;
    this.streamingText = null;
    this.streamingMessageId = "";
    this.streamingContentEl = null;
    this.streamingStatusEl = null;
    this.streamingWork = null;
    this.activities = [];
    this.referencePreviewCleanup = null;
    this.phase = "idle";
    this.busy = false;
    this.requestStartedAt = 0;
    this.firstDeltaAt = 0;
    this.editPreviewEl = null;
    this.pendingEdit = null;
  }

  getViewType() {
    return VIEW_TYPE;
  }

  getDisplayText() {
    return "Codex Section Panel";
  }

  async onOpen() {
    this.containerEl.empty();
    this.containerEl.addClass("codex-section-panel-view");
    const root = this.containerEl.createDiv({ cls: "view-content codex-section-panel" });
    const header = root.createDiv({ cls: "codex-section-panel__header" });
    const headerActions = header.createDiv({ cls: "codex-section-panel__actions" });
    this.newConversationButton = headerActions.createEl("button", { text: "新建对话" });
    this.newConversationButton.addEventListener("click", () => void this.startNewConversation());
    const sectionButton = headerActions.createEl("button", { text: "读取当前章节" });
    sectionButton.addEventListener("click", () => void this.loadSection());
    const selectionButton = headerActions.createEl("button", { text: "添加当前选区" });
    selectionButton.addEventListener("click", () => void this.loadSelection());
    const clearContextButton = headerActions.createEl("button", { text: "清空范围" });
    clearContextButton.addEventListener("click", () => this.clearPendingContexts());
    this.contextEl = root.createDiv({ cls: "codex-section-panel__context" });
    this.renderContexts();

    const composer = root.createDiv({ cls: "codex-section-panel__composer" });
    const promptShell = composer.createDiv({ cls: "codex-section-panel__prompt-shell" });
    this.promptInput = promptShell.createEl("textarea", {
      cls: "codex-section-panel__prompt",
      attr: {
        rows: "3",
        placeholder: "输入问题，或直接要求 Codex 修改已引用的笔记内容。",
      },
    });
    const composerToolbar = promptShell.createDiv({ cls: "codex-section-panel__composer-toolbar" });
    this.modelSelect = composerToolbar.createEl("select", {
      cls: "codex-section-panel__model-select",
      attr: { "aria-label": "Codex 模型版本" },
    });
    this.modelSelect.addEventListener("change", () => void this.changeModel());
    const composerActions = composerToolbar.createDiv({ cls: "codex-section-panel__composer-actions" });
    this.sendButton = composerActions.createEl("button", {
      cls: "codex-section-panel__send-button mod-cta",
      attr: { type: "button", "aria-label": "发送到 Codex", title: "发送到 Codex" },
    });
    setIcon(this.sendButton, "send");
    this.sendButton.addEventListener("click", () => void this.send());
    this.pauseButton = composerActions.createEl("button", {
      cls: "codex-section-panel__pause-button",
      attr: { type: "button", "aria-label": "暂停", title: "暂停" },
    });
    setIcon(this.pauseButton, "pause");
    this.pauseButton.addEventListener("click", () => void this.pause());
    this.statusEl = composer.createDiv({ cls: "codex-section-panel__status" });

    const layout = root.createDiv({ cls: "codex-section-panel__layout" });
    this.historyLayoutEl = layout;
    const history = layout.createDiv({ cls: "codex-section-panel__history" });
    this.historyViewEl = history;
    const historyHeader = history.createDiv({ cls: "codex-section-panel__history-header" });
    historyHeader.createEl("h3", { text: "历史对话" });
    this.historyToggleButton = historyHeader.createEl("button", {
      cls: "codex-section-panel__history-toggle",
      attr: { type: "button" },
    });
    this.historyToggleButton.addEventListener("click", () => void this.toggleHistorySidebar());
    this.renderHistorySidebarState();
    this.historyListEl = history.createDiv({ cls: "codex-section-panel__history-list" });

    const chat = layout.createDiv({ cls: "codex-section-panel__chat" });
    this.messagesEl = chat.createDiv({ cls: "codex-section-panel__messages" });
    this.editPreviewEl = null;
    this.renderHistory();
    this.renderConversation();
    this.setBusy(false);
    this.renderModelOptions();
    await this.loadSection();
    void this.loadModels();
  }

  async onClose() {
    if (this.referencePreviewCleanup) this.referencePreviewCleanup();
    this.contexts = [];
    this.promptInput = null;
    this.contextEl = null;
    this.messagesEl = null;
    this.historyListEl = null;
    this.historyLayoutEl = null;
    this.historyToggleButton = null;
    this.historyViewEl = null;
    this.statusEl = null;
    this.editPreviewEl = null;
    this.pendingEdit = null;
    this.newConversationButton = null;
    this.copyConversationButton = null;
    this.modelSelect = null;
    this.modelOptions = [];
    this.pauseButton = null;
    this.streamingText = null;
    this.streamingMessageId = "";
    this.streamingWork = null;
    this.activities = [];
    this.phase = "idle";
  }

  getConversation() {
    return this.plugin.getActiveConversation();
  }

  renderModelOptions() {
    if (!this.modelSelect) return;
    const conversation = this.getConversation();
    const configuredModel = String(conversation && conversation.model || this.plugin.settings.defaultModel || "").trim();
    const defaultModel = this.modelOptions.find((item) => item.isDefault);
    const selectedModel = configuredModel || (defaultModel && defaultModel.model) || "";
    this.modelSelect.empty();
    this.modelSelect.createEl("option", { text: "自动选择模型", attr: { value: "" } });
    for (const item of this.modelOptions) {
      this.modelSelect.createEl("option", {
        text: item.displayName === item.model ? item.model : `${item.displayName} (${item.model})`,
        attr: { value: item.model },
      });
    }
    if (selectedModel && !this.modelOptions.some((item) => item.model === selectedModel)) {
      this.modelSelect.createEl("option", {
        text: `手动模型 (${selectedModel})`,
        attr: { value: selectedModel },
      });
    }
    this.modelSelect.value = selectedModel;
  }

  async loadModels() {
    try {
      this.modelOptions = await this.plugin.listModels();
      this.renderModelOptions();
      this.setStatus(this.modelOptions.length
        ? `已加载 ${this.modelOptions.length} 个可用模型。`
        : "未读取到模型目录，将使用 Codex 默认模型。");
    } catch (error) {
      this.modelOptions = [];
      this.renderModelOptions();
      const message = error instanceof Error ? error.message : String(error);
      this.setStatus(`模型列表加载失败，将使用默认模型：${message}`);
    }
  }

  async changeModel() {
    if (this.busy || !this.modelSelect) return;
    const conversation = this.getConversation();
    if (!conversation) return;
    conversation.model = String(this.modelSelect.value || "").trim();
    await this.plugin.persistChatState();
    this.setStatus(conversation.model ? `已切换模型：${conversation.model}` : "已切换为 Codex 默认模型。");
  }

  renderHistory() {
    if (!this.historyListEl) return;
    this.historyListEl.empty();
    const activeId = this.plugin.chatState.activeConversationId;
    const conversations = [...this.plugin.chatState.conversations]
      .sort((left, right) => right.updatedAt - left.updatedAt);
    for (const conversation of conversations) {
      const item = this.historyListEl.createDiv({
        cls: "codex-section-panel__history-item",
      });
      if (conversation.id === activeId) item.addClass("is-active");
      const select = item.createEl("button", {
        cls: "codex-section-panel__history-select",
        attr: { type: "button" },
      });
      select.disabled = this.busy;
      const icon = select.createDiv({ cls: "codex-section-panel__history-icon" });
      icon.setAttribute("aria-hidden", "true");
      setIcon(icon, "message-square");
      const copy = select.createDiv({ cls: "codex-section-panel__history-copy" });
      const title = getConversationDisplayTitle(conversation);
      copy.createDiv({ cls: "codex-section-panel__history-title", text: title });
      copy.createDiv({
        cls: "codex-section-panel__history-time",
        text: formatHistoryTime(conversation.updatedAt),
      });
      select.setAttribute("aria-label", `${title}，${formatHistoryTime(conversation.updatedAt)}`);
      select.setAttribute("aria-current", String(conversation.id === activeId));
      select.addEventListener("click", () => void this.selectConversation(conversation.id));
      const deleteButton = item.createEl("button", {
        cls: "codex-section-panel__history-delete",
        text: "删除",
        attr: {
          type: "button",
          "aria-label": `删除历史对话：${title}`,
          title: "删除本地历史对话",
        },
      });
      deleteButton.disabled = this.busy;
      deleteButton.addEventListener("click", (event) => {
        event.stopPropagation();
        this.openDeleteConversationConfirmation(conversation);
      });
    }
  }

  openDeleteConversationConfirmation(conversation) {
    if (this.busy || !Modal) return;
    const isLastConversation = this.plugin.chatState.conversations.length === 1;
    const modal = new Modal(this.plugin.app);
    const content = modal.contentEl;
    content.empty();
    content.addClass("codex-section-panel__delete-confirm");
    content.createEl("h3", { text: "删除历史对话？" });
    content.createEl("p", {
      text: isLastConversation
        ? `将从本地删除“${conversation.title || "新对话"}”的历史，并新建空白对话。Codex 服务端线程和笔记不会删除。`
        : `将从本地删除“${conversation.title || "新对话"}”的历史。Codex 服务端线程和笔记不会删除。`,
    });
    const actions = content.createDiv({ cls: "codex-section-panel__delete-actions" });
    const cancel = actions.createEl("button", {
      cls: "codex-section-panel__delete-cancel",
      text: "取消",
      attr: { type: "button" },
    });
    cancel.addEventListener("click", () => modal.close());
    const confirm = actions.createEl("button", {
      cls: "codex-section-panel__delete-confirm-button mod-warning",
      text: "删除",
      attr: { type: "button" },
    });
    confirm.addEventListener("click", () => {
      confirm.disabled = true;
      cancel.disabled = true;
      void this.confirmDeleteConversation(conversation.id, modal);
    });
    modal.open();
  }

  async confirmDeleteConversation(conversationId, modal) {
    if (this.busy) {
      modal.close();
      this.setStatus("请求进行中，暂不能删除历史对话。");
      return;
    }
    try {
      const result = await this.plugin.deleteConversation(conversationId);
      modal.close();
      if (!result.deleted) {
        this.renderHistory();
        this.setStatus("这条历史对话已不存在。");
        return;
      }
      if (result.wasActive) {
        this.clearPendingEdit();
        this.contexts = [];
        if (this.promptInput) this.promptInput.value = "";
        this.renderContexts();
        this.renderModelOptions();
        this.renderConversation();
      }
      this.renderHistory();
      this.setStatus("历史对话已从本地删除。");
    } catch (error) {
      modal.close();
      const message = error instanceof Error ? error.message : String(error);
      this.setStatus(`删除历史对话失败：${message}`);
      new Notice(`删除历史对话失败：${message}`);
    }
  }

  renderHistorySidebarState() {
    if (!this.historyLayoutEl || !this.historyToggleButton) return;
    const collapsed = Boolean(this.plugin.chatState && this.plugin.chatState.historyCollapsed);
    this.historyLayoutEl.classList.toggle("is-history-collapsed", collapsed);
    this.historyToggleButton.empty();
    setIcon(this.historyToggleButton, collapsed ? "chevron-right" : "chevron-left");
    this.historyToggleButton.setAttribute("aria-expanded", String(!collapsed));
    this.historyToggleButton.setAttribute("aria-label", collapsed ? "展开历史对话" : "收起历史对话");
    this.historyToggleButton.setAttribute("title", collapsed ? "展开历史对话" : "收起历史对话");
  }

  async toggleHistorySidebar() {
    if (!this.plugin.chatState) return;
    this.plugin.chatState.historyCollapsed = !this.plugin.chatState.historyCollapsed;
    this.renderHistorySidebarState();
    try {
      await this.plugin.persistChatState();
    } catch (error) {
      new Notice(`历史侧栏状态保存失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  renderConversation() {
    if (!this.messagesEl) return;
    if (this.referencePreviewCleanup) this.referencePreviewCleanup();
    this.messagesEl.empty();
    this.streamingContentEl = null;
    this.streamingStatusEl = null;
    this.streamingWork = null;
    const conversation = this.getConversation();
    if (!conversation || conversation.messages.length === 0) {
      this.messagesEl.createDiv({
        cls: "codex-section-panel__empty",
        text: "新对话已准备好。可直接输入问题，也可以先添加章节或选区。",
      });
    } else {
      for (const message of conversation.messages) {
        if (message.id === this.streamingMessageId) continue;
        this.renderMessage(message);
      }
    }
    if (this.streamingText !== null) {
      const existingStreamingMessage = conversation && this.streamingMessageId
        ? conversation.messages.find((message) => message.id === this.streamingMessageId)
        : null;
      const streamingMessage = this.renderMessage({
        ...(existingStreamingMessage || {}),
        role: "codex",
        content: this.streamingText || this.currentActivityText(),
        status: "streaming",
        createdAt: existingStreamingMessage ? existingStreamingMessage.createdAt : this.requestStartedAt,
        phase: this.phase,
        activities: this.activities.length ? this.activities : existingStreamingMessage && existingStreamingMessage.activities,
      });
      this.streamingContentEl = streamingMessage.contentEl;
      this.streamingStatusEl = streamingMessage.statusEl;
      this.streamingWork = streamingMessage.work;
    }
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  }

  renderMessage(message) {
    const role = message.role === "user" ? "user" : "codex";
    const wrapper = this.messagesEl.createDiv({
      cls: `codex-section-panel__message codex-section-panel__message--${role}`,
    });
    const actions = wrapper.createDiv({ cls: "codex-section-panel__message-actions" });
    if (message.status !== "streaming") {
      const copyButton = actions.createEl("button", {
        cls: "codex-section-panel__message-copy",
        attr: {
          type: "button",
          "aria-label": `复制${role === "user" ? "用户" : "Codex"}消息`,
          title: `复制${role === "user" ? "用户" : "Codex"}消息`,
        },
      });
      setIcon(copyButton, "copy");
      copyButton.addEventListener("click", (event) => {
        event.stopPropagation();
        void this.copyMessage(message);
      });
    }
    if (role === "codex" && message.status === "error") {
      const retryButton = actions.createEl("button", {
        cls: "codex-section-panel__message-retry",
        attr: { type: "button", "aria-label": "重新发送此请求", title: "重新发送此请求" },
      });
      setIcon(retryButton, "rotate-ccw");
      retryButton.addEventListener("click", (event) => {
        event.stopPropagation();
        void this.retryFailedMessage(message.id);
      });
    }
    const meta = wrapper.createDiv({ cls: "codex-section-panel__message-meta" });
    meta.createDiv({
      cls: "codex-section-panel__message-role",
      text: role === "user" ? "我" : "Codex",
    });
    const messageTime = formatMessageTime(message.createdAt);
    if (messageTime) meta.createDiv({ cls: "codex-section-panel__message-time", text: messageTime });
    if (role === "user" && Array.isArray(message.references) && message.references.length > 0) {
      const reference = wrapper.createDiv({ cls: "codex-section-panel__reference" });
      const referenceButton = reference.createEl("button", {
        cls: "codex-section-panel__reference-button",
        text: "📎",
        attr: {
          type: "button",
          "aria-label": "查看本次发送的章节/选区引用",
        },
      });
      const preview = reference.createDiv({ cls: "codex-section-panel__reference-preview" });
      for (const item of message.references) {
        const entry = preview.createDiv({ cls: "codex-section-panel__reference-entry" });
        const entryHeader = entry.createDiv({ cls: "codex-section-panel__reference-entry-header" });
        entryHeader.createDiv({
          cls: "codex-section-panel__reference-marker",
          text: item.marker || `${item.path} ${item.rangeLabel || ""}`,
        });
        const copyReferenceButton = entryHeader.createEl("button", {
          cls: "codex-section-panel__reference-copy",
          attr: { type: "button", "aria-label": "复制引用正文", title: "复制引用正文" },
        });
        setIcon(copyReferenceButton, "copy");
        copyReferenceButton.addEventListener("click", (event) => {
          event.stopPropagation();
          void this.copyReference(item);
        });
        entry.createDiv({
          cls: "codex-section-panel__reference-text",
          text: item.text,
        });
      }
      this.bindReferencePreview(reference, referenceButton, preview);
    }
    const work = role === "codex" && (message.status === "streaming" || (message.activities && message.activities.length))
      ? this.renderActivityLog(wrapper, message.activities, message.status === "streaming")
      : null;
    const contentEl = wrapper.createDiv({
      cls: "codex-section-panel__message-content",
    });
    const rawContent = String(message.content || "");
    const parsedResponse = role === "codex" && message.status !== "streaming"
      ? parseCodexResponse(rawContent)
      : null;
    const content = parsedResponse ? parsedResponse.answer || rawContent : rawContent;
    if (role === "codex" && message.status !== "streaming" && content.trim()) this.renderMarkdownInto(contentEl, content);
    else contentEl.setText(content);
    const proposal = message.proposal || (parsedResponse && parsedResponse.proposal);
    if (role === "codex" && message.status !== "streaming" && proposal && proposal.edits.length > 0) {
      const contexts = this.resolveMessageReferences(message);
      const validProposal = proposal.edits.every((edit) => edit.contextIndex >= 1 && edit.contextIndex <= contexts.length);
      if (validProposal) this.renderEditProposal(wrapper, message, proposal, contexts);
    }
    let statusEl = null;
    if (message.status === "paused") {
      statusEl = wrapper.createDiv({ cls: "codex-section-panel__message-status", text: "已暂停" });
    } else if (message.status === "error") {
      statusEl = wrapper.createDiv({
        cls: "codex-section-panel__message-status",
        text: message.responseError || "请求失败",
      });
    } else if (message.status === "streaming") {
      statusEl = wrapper.createDiv({
        cls: "codex-section-panel__message-status",
        text: this.currentActivityText(),
      });
    }
    return { wrapper, contentEl, statusEl, work };
  }

  renderMarkdownInto(element, markdown) {
    const content = String(markdown || "");
    const activeFile = this.plugin && this.plugin.app && this.plugin.app.workspace
      && this.plugin.app.workspace.getActiveFile && this.plugin.app.workspace.getActiveFile();
    const sourcePath = activeFile && activeFile.path || "";
    try {
      const renderTask = typeof MarkdownRenderer.render === "function" && this.plugin && this.plugin.app
        ? MarkdownRenderer.render(this.plugin.app, content, element, sourcePath, this)
        : MarkdownRenderer.renderMarkdown(content, element, sourcePath, this);
      void Promise.resolve(renderTask).catch(() => element.setText(content));
    } catch (error) {
      element.setText(content);
    }
  }

  resolveMessageReferences(message) {
    const conversation = this.getConversation();
    const messages = conversation && Array.isArray(conversation.messages) ? conversation.messages : [];
    const messageIndex = messages.findIndex((item) => item.id && item.id === message.id);
    let userMessage = message.replyToMessageId
      ? messages.find((item) => item.id === message.replyToMessageId && item.role === "user")
      : null;
    if (!userMessage && messageIndex >= 0) {
      for (let index = messageIndex - 1; index >= 0; index -= 1) {
        if (messages[index].role === "user") {
          userMessage = messages[index];
          break;
        }
      }
    }
    if (userMessage && Array.isArray(userMessage.references) && userMessage.references.length > 0) {
      return normalizeMessageReferences(userMessage.references);
    }
    return collectConversationReferences(messageIndex >= 0 ? messages.slice(0, messageIndex) : messages);
  }

  renderEditProposal(wrapper, message, proposal, contexts) {
    const details = wrapper.createEl("details", { cls: "codex-section-panel__edit-proposal" });
    const summary = details.createEl("summary", {
      cls: "codex-section-panel__edit-proposal-summary",
      text: `修改建议 · ${proposal.edits.length} 处 · ${proposal.summary}`,
    });
    const body = details.createDiv({ cls: "codex-section-panel__edit-proposal-body" });
    const previews = [];
    for (const edit of proposal.edits) {
      const context = contexts[edit.contextIndex - 1];
      const change = body.createDiv({ cls: "codex-section-panel__edit-change" });
      change.createDiv({
        cls: "codex-section-panel__edit-target",
        text: context ? `引用 ${edit.contextIndex} · ${context.marker || context.path}` : `引用 ${edit.contextIndex}`,
      });
      const columns = change.createDiv({ cls: "codex-section-panel__edit-columns" });
      const before = columns.createDiv({ cls: "codex-section-panel__edit-column" });
      before.createDiv({ cls: "codex-section-panel__edit-label", text: "原内容" });
      const beforeContent = before.createDiv({ cls: "codex-section-panel__edit-original" });
      const after = columns.createDiv({ cls: "codex-section-panel__edit-column" });
      after.createDiv({ cls: "codex-section-panel__edit-label", text: "建议内容" });
      const afterContent = after.createDiv({ cls: "codex-section-panel__edit-replacement" });
      previews.push({ beforeContent, afterContent, original: context ? context.text : "引用正文不可用。", replacement: edit.replacement });
    }
    let rendered = false;
    details.addEventListener("toggle", () => {
      if (!details.open || rendered) return;
      rendered = true;
      for (const preview of previews) {
        this.renderMarkdownInto(preview.beforeContent, preview.original);
        this.renderMarkdownInto(preview.afterContent, preview.replacement);
      }
    });
    const footer = body.createDiv({ cls: "codex-section-panel__edit-proposal-footer" });
    if (message.editStatus === "applied") {
      footer.createDiv({ cls: "codex-section-panel__edit-proposal-state is-applied", text: "已写入笔记" });
    } else if (message.editStatus === "unchanged") {
      footer.createDiv({ cls: "codex-section-panel__edit-proposal-state", text: "笔记内容未变化" });
    } else {
      const applyButton = footer.createEl("button", {
        cls: "codex-section-panel__edit-apply mod-cta",
        text: "确认并写入",
        attr: { type: "button" },
      });
      applyButton.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        void this.confirmDocumentEdit({ message, proposal, contexts });
      });
    }
    return { details, summary, body };
  }

  bindReferencePreview(reference, button, preview) {
    const doc = button.ownerDocument;
    const win = doc.defaultView;
    let closeTimer = null;
    let opened = false;
    preview.id = createRecordId("reference-preview");
    button.setAttribute("aria-controls", preview.id);
    button.setAttribute("aria-expanded", "false");
    preview.setAttribute("role", "region");
    preview.setAttribute("aria-label", "本次引用正文");
    const cancelClose = () => { win.clearTimeout(closeTimer); };
    const close = () => {
      cancelClose();
      opened = false;
      preview.removeClass("is-open");
      preview.remove();
      button.setAttribute("aria-expanded", "false");
      doc.removeEventListener("scroll", reposition, true);
      win.removeEventListener("resize", reposition);
      doc.removeEventListener("keydown", onKeyDown);
      if (this.referencePreviewCleanup === close) this.referencePreviewCleanup = null;
    };
    const reposition = (event) => {
      if (!opened || (event && event.target instanceof win.Node && preview.contains(event.target))) return;
      const anchor = button.getBoundingClientRect();
      const chat = this.messagesEl && this.messagesEl.getBoundingClientRect();
      if (!button.isConnected || anchor.bottom <= 0 || anchor.top >= win.innerHeight
        || (chat && (anchor.bottom < chat.top || anchor.top > chat.bottom))) {
        close();
        return;
      }
      preview.style.width = `${Math.min(448, Math.max(1, win.innerWidth - 16))}px`;
      preview.style.maxHeight = `${Math.min(360, Math.max(1, win.innerHeight - 16))}px`;
      const position = getReferencePreviewPosition(anchor, preview.getBoundingClientRect(), { width: win.innerWidth, height: win.innerHeight });
      preview.style.left = `${position.left}px`;
      preview.style.top = `${position.top}px`;
    };
    const onKeyDown = (event) => { if (event.key === "Escape") close(); };
    const open = () => {
      cancelClose();
      if (!opened && this.referencePreviewCleanup) this.referencePreviewCleanup();
      // A body-level portal uses the same viewport coordinate system as getBoundingClientRect.
      doc.body.appendChild(preview);
      opened = true;
      this.referencePreviewCleanup = close;
      reposition();
      if (!opened) return;
      preview.addClass("is-open");
      button.setAttribute("aria-expanded", "true");
      doc.addEventListener("scroll", reposition, true);
      win.addEventListener("resize", reposition);
      doc.addEventListener("keydown", onKeyDown);
    };
    const scheduleClose = (event) => {
      if (event && event.relatedTarget && (preview.contains(event.relatedTarget) || reference.contains(event.relatedTarget))) return;
      cancelClose();
      closeTimer = win.setTimeout(() => {
        if (preview.contains(doc.activeElement) || doc.activeElement === button) return;
        close();
      }, 160);
    };
    button.addEventListener("mouseenter", open);
    button.addEventListener("focus", open);
    button.addEventListener("click", open);
    reference.addEventListener("mouseleave", scheduleClose);
    button.addEventListener("blur", scheduleClose);
    preview.addEventListener("mouseenter", cancelClose);
    preview.addEventListener("mouseleave", scheduleClose);
    preview.addEventListener("focusout", scheduleClose);
  }

  currentActivityText() {
    const latest = this.activities && this.activities[this.activities.length - 1];
    if (latest) return `${latest.label}${latest.status === "running" ? "中……" : latest.status === "failed" ? "失败" : "已结束"}`;
    return this.phase === "thinking" ? "正在处理请求……" : "正在生成回答……";
  }

  renderActivityLog(wrapper, activities, streaming) {
    const details = wrapper.createEl("details", { cls: "codex-section-panel__work" });
    details.open = true;
    const summary = details.createEl("summary", { cls: "codex-section-panel__work-summary" });
    const copyAllButton = details.createEl("button", {
      cls: "codex-section-panel__work-copy-all",
      attr: { type: "button", "aria-label": "复制全部阶段动作", title: "复制全部阶段名称和完整详情" },
    });
    setIcon(copyAllButton, "copy");
    const work = { details, summary, list: null, copyAllButton, activities: [] };
    copyAllButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      void this.copyAllActivities(work.activities);
    });
    const list = details.createEl("ol", { cls: "codex-section-panel__work-items", attr: { "aria-label": "Codex 阶段动作" } });
    work.list = list;
    this.updateActivityLog(work, activities);
    return work;
  }

  updateActivityLog(work, activities) {
    if (!work) return;
    const list = normalizeActivities(activities);
    work.activities = list;
    if (work.copyAllButton) work.copyAllButton.disabled = list.length === 0;
    const expandedIds = new Set(
      Array.from(work.list.querySelectorAll(".codex-section-panel__work-detail-expander[open]"))
        .map((details) => details.getAttribute("data-activity-id"))
        .filter(Boolean),
    );
    const expandedRawIds = new Set(
      Array.from(work.list.querySelectorAll(".codex-section-panel__work-raw-expander[open]"))
        .map((details) => details.getAttribute("data-activity-id"))
        .filter(Boolean),
    );
    const totalDuration = sumActivityDuration(list);
    const durationLabel = list.length ? ` · 累计耗时 ${this.formatElapsed(totalDuration)}` : "";
    work.summary.setText(`阶段动作 · ${list.length} 项${durationLabel}`);
    work.list.empty();
    for (const action of list) {
      const entry = work.list.createEl("li", { cls: "codex-section-panel__work-item", attr: { "data-status": action.status } });
      const header = entry.createDiv({ cls: "codex-section-panel__work-header" });
      const status = { running: "进行中", completed: "已完成", failed: "失败", interrupted: "已中断" }[action.status];
      header.createEl("span", { cls: "codex-section-panel__work-label", text: action.label });
      header.createEl("span", { cls: "codex-section-panel__work-state", text: status });
      if (action.endedAt && action.startedAt) header.createEl("span", {
        cls: "codex-section-panel__work-time", text: this.formatElapsed(action.endedAt - action.startedAt),
      });
      const copy = header.createEl("button", {
        cls: "codex-section-panel__work-copy",
        attr: { type: "button", "aria-label": `复制阶段动作：${action.label}`, title: "复制阶段名称和完整详情" },
      });
      setIcon(copy, "copy");
      copy.addEventListener("click", (event) => {
        event.stopPropagation();
        void this.copyActivity(action);
      });
      if (action.detail) {
        const isLong = action.detail.length > 600 || action.detail.split("\n").length > 6;
        if (isLong) {
          const expander = entry.createEl("details", {
            cls: "codex-section-panel__work-detail-expander",
            attr: { "data-activity-id": action.id },
          });
          expander.open = expandedIds.has(action.id);
          expander.createEl("summary", { text: `展开详情 · ${action.detail.length} 字符` });
          expander.createEl("pre", { cls: "codex-section-panel__work-detail", text: action.detail });
        } else {
          entry.createEl("pre", { cls: "codex-section-panel__work-detail", text: action.detail });
        }
      }
      if (action.rawData && action.rawData.events.length) {
        const rawExpander = entry.createEl("details", {
          cls: "codex-section-panel__work-raw-expander",
          attr: { "data-activity-id": action.id },
        });
        rawExpander.open = expandedRawIds.has(action.id);
        rawExpander.createEl("summary", { text: `原始事件 JSON · ${action.rawData.events.length} 项` });
        rawExpander.createEl("pre", {
          cls: "codex-section-panel__work-raw-data",
          text: JSON.stringify(action.rawData, null, 2),
        });
      }
    }
  }

  receiveActivities(activities) {
    this.activities = normalizeActivities(activities);
    this.updateActivityLog(this.streamingWork, this.activities);
    this.updateStreamingMessage();
  }

  updateStreamingMessage() {
    if (this.streamingContentEl) {
      this.streamingContentEl.setText(this.streamingText || this.currentActivityText());
    }
    if (this.streamingStatusEl) {
      this.streamingStatusEl.setText(this.currentActivityText());
    }
    if (this.messagesEl) this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  }

  async startNewConversation() {
    if (this.busy) {
      this.setStatus("请先暂停当前请求，再新建对话。");
      return;
    }
    await this.plugin.createConversation();
    this.clearPendingEdit();
    this.contexts = [];
    if (this.promptInput) this.promptInput.value = "";
    this.renderContexts();
    this.renderModelOptions();
    this.setStatus("已新建对话。");
    this.renderHistory();
    this.renderConversation();
  }

  async selectConversation(id) {
    if (this.busy || id === this.plugin.chatState.activeConversationId) return;
    await this.plugin.setActiveConversation(id);
    this.clearPendingEdit();
    this.contexts = [];
    if (this.promptInput) this.promptInput.value = "";
    this.renderContexts();
    this.renderModelOptions();
    this.setStatus("已切换历史对话；如需继续分析，请重新读取章节或选区。");
    this.renderHistory();
    this.renderConversation();
  }

  async loadSection(view) {
    if (this.busy) return;
    this.clearPendingEdit();
    this.setStatus("正在读取当前章节范围……");
    try {
      const context = await getCurrentSection(this.plugin.getSourceMarkdownView(view), this.plugin.app);
      if (!context) {
        this.renderContexts("当前光标所在位置没有 Markdown 章节标题。");
        this.setStatus("未找到章节范围；请先选择文本或点击“添加当前选区”。");
        return;
      }
      this.contexts = addSectionContext(this.contexts, context);
      this.renderContexts();
      this.setStatus("章节范围已添加；正文不会保存在插件中。");
    } catch (error) {
      this.renderContexts("读取章节失败。");
      this.setStatus(error instanceof Error ? error.message : String(error));
    }
  }

  async loadSelection(view) {
    if (this.busy) return;
    this.clearPendingEdit();
    this.setStatus("正在读取当前选区……");
    const context = getCurrentSelection(this.plugin.getSourceMarkdownView(view));
    if (!context) {
      this.renderContexts("当前 Markdown 编辑器没有选中文本。");
      this.setStatus("未读取到选区；请先在 Markdown 编辑器中选择文本。");
      return;
    }
    this.contexts = appendPendingContext(this.contexts, context);
    this.renderContexts();
    this.setStatus("当前选区已添加；正文不会保存在插件中。");
  }

  addContexts(values) {
    const inputs = Array.isArray(values) ? values : [values];
    this.clearPendingEdit();
    let added = 0;
    for (const input of inputs) {
      const context = normalizeExternalContext(input);
      const next = appendPendingContext(this.contexts, context);
      if (next.length > this.contexts.length) added += 1;
      this.contexts = next;
    }
    if (added > 0) {
      this.renderContexts();
      this.setStatus(`已添加 ${added} 个选区；正文不会保存在插件中。`);
    }
    return added;
  }

  async requestEdit() {
    if (this.busy) return;
    const conversation = this.getConversation();
    if (!conversation) return;
    if (this.contexts.length === 0) {
      try {
        const sourceView = this.plugin.getSourceMarkdownView();
        const selection = getCurrentSelection(sourceView);
        const section = selection ? null : await getCurrentSection(sourceView, this.plugin.app);
        this.contexts = resolveRequestContexts(this.contexts, selection, section);
        if (this.contexts.length > 0) {
          this.renderContexts();
          this.setStatus(selection
            ? "已自动读取当前选区；准备生成修改建议。"
            : "已自动读取当前章节；准备生成修改建议。");
        }
      } catch (error) {
        this.contexts = [];
        const message = error instanceof Error ? error.message : String(error);
        this.renderContexts("读取上下文失败，无法安全修改文档。");
        this.setStatus(`无法读取修改范围：${message}`);
        new Notice(`无法读取修改范围：${message}`);
      }
    }
    if (this.contexts.length === 0) {
      const historicalContexts = collectConversationReferences(conversation.messages);
      if (historicalContexts.length > 0) {
        this.contexts = historicalContexts;
        this.renderContexts();
        this.setStatus(`已从当前历史对话恢复 ${historicalContexts.length} 个引用，准备生成修改建议。`);
      }
    }
    if (this.contexts.length === 0) {
      this.setStatus("请先读取章节或选区，再发送修改请求。");
      new Notice("发送修改请求前必须先选择章节或选区。");
      return;
    }

    const contexts = this.contexts.slice();
    const question = this.promptInput ? this.promptInput.value.trim() : "";
    const effectiveQuestion = question || "请优化当前引用内容，保持原意并修正文中的明显问题。";
    const request = buildDocumentEditPrompt(effectiveQuestion, contexts, conversation.messages);
    const recoveryRequest = buildDocumentEditPrompt(
      effectiveQuestion,
      contexts,
      conversation.messages,
      { includeHistoricalReferences: true, omitCurrentUserMessage: true },
    );
    const model = String(this.modelSelect && this.modelSelect.value || conversation.model || this.plugin.settings.defaultModel || "").trim();
    conversation.model = model;
    const userMessage = appendConversationMessage(conversation, "user", effectiveQuestion, "complete", Date.now(), contexts, undefined, {
      requestModel: model,
    });
    this.contexts = [];
    this.renderContexts("本次修改范围已发送；确认后才会写入引用笔记。 ");
    if (this.promptInput) this.promptInput.value = "";
    this.streamingText = "";
    this.activities = [];
    this.phase = "thinking";
    this.requestStartedAt = Date.now();
    this.firstDeltaAt = 0;
    this.renderHistory();
    this.renderConversation();
    this.setBusy(true);
    this.setStatus(`Codex 正在生成修改建议…… ${this.formatElapsed(Date.now() - this.requestStartedAt)}`);
    const initialPersist = this.plugin.persistChatState().catch((error) => {
      new Notice(`历史保存失败：${error instanceof Error ? error.message : String(error)}`);
    });
    try {
      const result = await this.plugin.requestCodex(request, {
        conversation,
        model,
        turnPrompt: request,
        recoveryPrompt: recoveryRequest,
        onActivity: (activities) => this.receiveActivities(activities),
        onDelta: (value) => {
          this.phase = "generating";
          this.streamingText = value;
          if (!this.firstDeltaAt) this.firstDeltaAt = Date.now();
          this.setStatus(`Codex 正在生成修改建议……（首段输出 ${this.formatElapsed(this.firstDeltaAt - this.requestStartedAt)}）`);
          this.updateStreamingMessage();
        },
        onPhase: (phase, detail, activity) => {
          if (phase) this.phase = phase;
          if (phase === "thinking") {
            this.setStatus(`${activity || "Codex 正在思考修改方案……"} ${this.formatElapsed(Date.now() - this.requestStartedAt)}`);
          } else if (phase === "retrying") {
            const suffix = detail ? `（${detail}）` : "";
            this.setStatus(`Codex 正在重试连接……${suffix} ${this.formatElapsed(Date.now() - this.requestStartedAt)}`);
          } else if (activity) {
            this.setStatus(`${activity} ${this.formatElapsed(Date.now() - this.requestStartedAt)}`);
          }
          this.updateStreamingMessage();
        },
      });
      if (result.cancelled) {
        appendConversationMessage(conversation, "codex", result.text || "请求已暂停。", "paused", undefined, undefined, this.activities, {
          replyToMessageId: userMessage.id,
        });
        this.setStatus("修改建议请求已暂停；未写入文档。");
      } else {
        const proposal = parseDocumentEditProposal(result.text);
        const validProposal = proposal.edits.length > 0 && proposal.edits.every(
          (edit) => edit.contextIndex >= 1 && edit.contextIndex <= contexts.length,
        );
        appendConversationMessage(
          conversation,
          "codex",
          `修改建议：${proposal.summary || "请查看下方差异并确认写入。"}`,
          "complete",
          undefined,
          undefined,
          this.activities,
          { replyToMessageId: userMessage.id, proposal: validProposal ? proposal : null },
        );
        this.setStatus(validProposal
          ? `已生成 ${proposal.edits.length} 项修改建议，请确认写入。`
          : proposal.edits.length
            ? "Codex 返回的修改范围无法对应本次引用，未提供写入操作。"
            : "Codex 判断当前内容无需修改。 ");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      appendConversationMessage(conversation, "codex", message, "error", undefined, undefined, this.activities, {
        replyToMessageId: userMessage.id,
      });
      this.setStatus(`修改建议失败：${message}`);
      new Notice(`修改建议失败：${message}`);
    } finally {
      this.streamingText = null;
      this.activities = [];
      this.phase = "idle";
      await initialPersist;
      await this.plugin.persistChatState();
      this.setBusy(false);
      this.renderHistory();
      this.renderConversation();
      this.requestStartedAt = 0;
      this.firstDeltaAt = 0;
    }
  }

  async retryFailedMessage(messageId) {
    if (this.busy) return;
    return this.send({ retryMessageId: String(messageId || "") });
  }

  async send(options) {
    if (this.busy) return;
    this.clearPendingEdit();
    const conversation = this.getConversation();
    if (!conversation) return;
    const requestOptions = options && typeof options === "object" ? options : {};
    const retryMessageId = String(requestOptions.retryMessageId || "");
    let retryMessage = null;
    let userMessage = null;
    let historyMessages = conversation.messages;
    if (retryMessageId) {
      const failureIndex = conversation.messages.findIndex((message) => message.id === retryMessageId);
      retryMessage = failureIndex >= 0 ? conversation.messages[failureIndex] : null;
      if (!retryMessage || retryMessage.role !== "codex" || retryMessage.status !== "error") {
        this.setStatus("这条 Codex 消息当前不能重新发送。");
        return;
      }
      userMessage = retryMessage.replyToMessageId
        ? conversation.messages.find((message) => message.id === retryMessage.replyToMessageId && message.role === "user")
        : null;
      if (!userMessage) {
        for (let index = failureIndex - 1; index >= 0; index -= 1) {
          if (conversation.messages[index].role === "user") {
            userMessage = conversation.messages[index];
            break;
          }
        }
      }
      if (!userMessage) {
        this.setStatus("找不到这条失败请求对应的用户消息，无法安全重试。");
        return;
      }
      const userIndex = conversation.messages.indexOf(userMessage);
      historyMessages = conversation.messages.slice(0, userIndex);
    }
    const attachedContexts = retryMessage
      ? normalizeMessageReferences(userMessage.references)
      : this.contexts.slice();
    const historicalContexts = attachedContexts.length
      ? []
      : collectConversationReferences(historyMessages);
    const contexts = attachedContexts.length ? attachedContexts : historicalContexts;
    const question = retryMessage
      ? String(userMessage.content || "").trim()
      : this.promptInput ? this.promptInput.value.trim() : "";
    const effectiveQuestion = question || (contexts.length ? "请分析这个章节。" : "请回答这个问题。");
    const request = buildUnifiedConversationPrompt(effectiveQuestion, contexts, historyMessages);
    const recoveryRequest = buildUnifiedConversationPrompt(
      effectiveQuestion,
      contexts,
      historyMessages,
      retryMessage
        ? { includeHistoricalReferences: true }
        : { includeHistoricalReferences: true, omitCurrentUserMessage: true },
    );
    // 沿用线程里已有的正文，仅重新列出稳定的引用编号，避免编号与本地可写范围错位。
    const turnRequest = attachedContexts.length
      ? buildUnifiedTurnPrompt(effectiveQuestion, attachedContexts)
      : historicalContexts.length
        ? buildHistoricalTurnPrompt(effectiveQuestion, historicalContexts)
        : buildUnifiedTurnPrompt(effectiveQuestion, []);
    const model = retryMessage
      ? String(userMessage.requestModel || conversation.model || this.plugin.settings.defaultModel || "").trim()
      : String(this.modelSelect && this.modelSelect.value || conversation.model || this.plugin.settings.defaultModel || "").trim();
    if (retryMessage) {
      retryMessage.content = "";
      retryMessage.status = "streaming";
      retryMessage.createdAt = Date.now();
      retryMessage.activities = [];
      retryMessage.proposal = null;
      retryMessage.editStatus = "";
      retryMessage.responseError = "";
      retryMessage.replyToMessageId = userMessage.id;
    } else {
      conversation.model = model;
      userMessage = appendConversationMessage(conversation, "user", effectiveQuestion, "complete", Date.now(), contexts, undefined, {
        requestModel: model,
      });
      this.contexts = [];
      this.renderContexts(attachedContexts.length
        ? "本次上下文已发送并释放；引用正文保存在该条消息中。"
        : historicalContexts.length
          ? "已复用当前对话的引用索引；正文与当前请求关联保存。"
          : "本次只发送问题，没有附加章节或选区正文。");
      if (this.promptInput) this.promptInput.value = "";
    }
    this.streamingMessageId = retryMessage ? retryMessage.id : "";
    this.streamingText = "";
    this.activities = [];
    this.phase = "thinking";
    this.requestStartedAt = Date.now();
    this.firstDeltaAt = 0;
    this.renderHistory();
    this.renderConversation();
    this.setBusy(true);
    this.setStatus(`Codex 正在思考…… ${this.formatElapsed(Date.now() - this.requestStartedAt)}`);
    const initialPersist = this.plugin.persistChatState().catch((error) => {
      new Notice(`历史保存失败：${error instanceof Error ? error.message : String(error)}`);
    });
    try {
      const result = await this.plugin.requestCodex(request, {
        conversation,
        model,
        turnPrompt: turnRequest,
        recoveryPrompt: recoveryRequest,
        onActivity: (activities) => this.receiveActivities(activities),
        onDelta: (value) => {
          this.phase = "generating";
          this.streamingText = formatStreamingCodexText(value);
          if (!this.firstDeltaAt) this.firstDeltaAt = Date.now();
          this.setStatus(`Codex 正在生成……（首段输出 ${this.formatElapsed(this.firstDeltaAt - this.requestStartedAt)}）`);
          this.updateStreamingMessage();
        },
        onPhase: (phase, detail, activity) => {
          if (phase) this.phase = phase;
          if (phase === "thinking") {
            this.setStatus(`${activity || "Codex 正在思考……"} ${this.formatElapsed(Date.now() - this.requestStartedAt)}`);
          } else if (phase === "generating") {
            const firstOutput = this.firstDeltaAt
              ? `，首段输出 ${this.formatElapsed(this.firstDeltaAt - this.requestStartedAt)}`
              : "";
            this.setStatus(`Codex 正在生成……（已等待 ${this.formatElapsed(Date.now() - this.requestStartedAt)}${firstOutput}）`);
          } else if (phase === "retrying") {
            const suffix = detail ? `（${detail}）` : "";
            this.setStatus(`Codex 正在重试连接……${suffix} ${this.formatElapsed(Date.now() - this.requestStartedAt)}`);
          } else if (activity) {
            this.setStatus(`${activity} ${this.formatElapsed(Date.now() - this.requestStartedAt)}`);
          }
          this.updateStreamingMessage();
        },
      });
      if (result.cancelled) {
        if (retryMessage) {
          retryMessage.content = result.text || "请求已暂停。";
          retryMessage.status = "paused";
          retryMessage.activities = normalizeActivities(this.activities);
        } else {
          appendConversationMessage(conversation, "codex", result.text || "请求已暂停。", "paused", undefined, undefined, this.activities, {
            replyToMessageId: userMessage.id,
          });
        }
        this.setStatus("请求已暂停；已收到的回答已保存。");
      } else {
        const parsedResponse = parseCodexResponse(result.text, { strict: true });
        const answer = parsedResponse.answer || result.text || "Codex 没有返回文本。";
        let storedProposal = null;
        let responseError = parsedResponse.error
          ? `Codex 回复未通过结构校验：${parsedResponse.error} 未应用任何笔记修改；可点击消息上的重试图标。`
          : "";
        if (parsedResponse.proposal && parsedResponse.proposal.edits.length > 0) {
          const hasValidContexts = parsedResponse.proposal.edits.every(
            (edit) => edit.contextIndex >= 1 && edit.contextIndex <= contexts.length,
          );
          if (hasValidContexts) {
            storedProposal = parsedResponse.proposal;
          } else {
            responseError = "Codex 返回的修改建议无法对应当前引用范围；未应用任何笔记修改。请点击消息上的重试图标。";
          }
        }
        const responseStatus = responseError ? "error" : "complete";
        if (retryMessage) {
          retryMessage.content = answer;
          retryMessage.status = responseStatus;
          retryMessage.createdAt = Date.now();
          retryMessage.activities = normalizeActivities(this.activities);
          retryMessage.proposal = storedProposal;
          retryMessage.editStatus = storedProposal ? "pending" : "";
          retryMessage.responseError = responseError;
        } else {
          appendConversationMessage(conversation, "codex", answer, responseStatus, undefined, undefined, this.activities, {
            replyToMessageId: userMessage.id,
            proposal: storedProposal,
            responseError,
          });
        }
        if (responseError) {
          this.setStatus(responseError);
        } else {
          const firstOutput = this.firstDeltaAt
            ? `，首段输出 ${this.formatElapsed(this.firstDeltaAt - this.requestStartedAt)}`
            : "，未收到可流式展示的首段输出";
          const editSuffix = storedProposal ? "；已生成修改建议，展开后可确认写入" : "";
          this.setStatus(`请求完成（总计 ${this.formatElapsed(Date.now() - this.requestStartedAt)}${firstOutput}）${editSuffix}。`);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (retryMessage) {
        retryMessage.content = message;
        retryMessage.status = "error";
        retryMessage.createdAt = Date.now();
        retryMessage.activities = normalizeActivities(this.activities);
        retryMessage.proposal = null;
        retryMessage.editStatus = "";
      } else {
        appendConversationMessage(conversation, "codex", message, "error", undefined, undefined, this.activities, {
          replyToMessageId: userMessage.id,
        });
      }
      this.setStatus(`请求失败：${message}`);
      new Notice(`Codex 请求失败：${message}`);
    } finally {
      this.streamingText = null;
      this.streamingMessageId = "";
      this.activities = [];
      this.phase = "idle";
      await initialPersist;
      await this.plugin.persistChatState();
      this.setBusy(false);
      this.renderHistory();
      this.renderConversation();
      this.requestStartedAt = 0;
      this.firstDeltaAt = 0;
    }
  }

  async pause() {
    if (!this.busy) return;
    if (this.plugin.cancelActiveRequest()) {
      this.setStatus("正在暂停 Codex……");
    } else {
      this.setStatus("当前请求尚未启动进程，暂时无法暂停。");
    }
  }

  async copyConversation() {
    const conversation = this.getConversation();
    const text = buildConversationClipboardText(conversation);
    if (!text) {
      this.setStatus("当前对话没有可复制的内容。");
      return;
    }
    try {
      await copyTextToClipboard(text);
      this.setStatus("当前对话已复制。");
      new Notice("当前对话已复制到剪贴板。");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.setStatus(`复制失败：${message}`);
      new Notice(`复制失败：${message}`);
    }
  }

  async copyReference(reference) {
    const text = buildReferenceClipboardText(reference);
    if (!text) {
      this.setStatus("该引用没有可复制的正文。");
      return;
    }
    try {
      await copyTextToClipboard(text);
      this.setStatus("引用正文已复制。");
      new Notice("引用正文已复制到剪贴板。");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.setStatus(`复制失败：${message}`);
      new Notice(`复制失败：${message}`);
    }
  }

  async copyMessage(message) {
    const text = buildMessageClipboardText(message);
    if (!text) {
      this.setStatus("该消息没有可复制的内容。");
      return;
    }
    try {
      await copyTextToClipboard(text);
      this.setStatus("这条消息已复制。");
      new Notice("这条消息已复制到剪贴板。");
    } catch (error) {
      const messageText = error instanceof Error ? error.message : String(error);
      this.setStatus(`复制失败：${messageText}`);
      new Notice(`复制失败：${messageText}`);
    }
  }

  async copyActivity(action) {
    const text = buildActivityClipboardText(action);
    if (!text) {
      this.setStatus("该阶段没有可复制的内容。");
      return;
    }
    try {
      await copyTextToClipboard(text);
      this.setStatus("阶段动作已复制。");
      new Notice("阶段动作已复制到剪贴板。");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.setStatus(`复制失败：${message}`);
      new Notice(`复制失败：${message}`);
    }
  }

  async copyAllActivities(activities) {
    const text = buildActivitiesClipboardText(activities);
    if (!text) {
      this.setStatus("当前没有可复制的阶段动作。");
      return;
    }
    try {
      await copyTextToClipboard(text);
      this.setStatus("全部阶段动作已复制。");
      new Notice("全部阶段动作已复制到剪贴板。");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.setStatus(`复制失败：${message}`);
      new Notice(`复制失败：${message}`);
    }
  }

  renderContexts(emptyHint) {
    if (!this.contextEl) return;
    this.contextEl.empty();
    if (this.contexts.length === 0) {
      this.contextEl.createDiv({
        cls: "codex-section-panel__context-empty",
        text: emptyHint || "尚未读取章节或选区范围。",
      });
      return;
    }
    const list = this.contextEl.createDiv({ cls: "codex-section-panel__context-list" });
    this.contexts.forEach((context, index) => {
      const item = list.createDiv({ cls: "codex-section-panel__context-item" });
      const label = item.createDiv({ cls: "codex-section-panel__context-label" });
      label.createDiv({ cls: "codex-section-panel__context-marker", text: context.marker });
      label.createDiv({
        cls: "codex-section-panel__context-heading",
        text: context.heading || (context.kind === "section" ? "当前章节" : "当前选区"),
      });
      const removeButton = item.createEl("button", {
        cls: "codex-section-panel__context-remove",
        text: "×",
        attr: { "aria-label": `移除上下文 ${index + 1}` },
      });
      removeButton.addEventListener("click", () => this.removeContext(index));
    });
  }

  removeContext(index) {
    if (this.busy) return;
    this.clearPendingEdit();
    this.contexts = removePendingContext(this.contexts, index);
    this.renderContexts();
    this.setStatus(this.contexts.length ? "已移除一个上下文范围。" : "已清空上下文范围。");
  }

  clearPendingContexts() {
    if (this.busy) return;
    this.clearPendingEdit();
    this.contexts = [];
    this.renderContexts();
    this.setStatus("已清空上下文范围。");
  }

  setStatus(value) {
    if (this.statusEl) this.statusEl.setText(value || "");
  }

  clearPendingEdit() {
    this.pendingEdit = null;
    this.renderEditPreview();
  }

  renderEditPreview() {
    if (!this.editPreviewEl) return;
    this.editPreviewEl.empty();
    if (!this.pendingEdit) return;
    const { proposal, contexts } = this.pendingEdit;
    const card = this.editPreviewEl.createDiv({ cls: "codex-section-panel__edit-card" });
    card.createDiv({
      cls: "codex-section-panel__edit-title",
      text: `待确认修改：${proposal.summary || "Codex 修改建议"}`,
    });
    const changes = card.createDiv({ cls: "codex-section-panel__edit-changes" });
    for (const edit of proposal.edits) {
      const context = contexts[edit.contextIndex - 1];
      const change = changes.createDiv({ cls: "codex-section-panel__edit-change" });
      change.createDiv({
        cls: "codex-section-panel__edit-target",
        text: context
          ? `上下文 ${edit.contextIndex}：${context.marker || context.path}`
          : `上下文 ${edit.contextIndex}`,
      });
      const columns = change.createDiv({ cls: "codex-section-panel__edit-columns" });
      const before = columns.createDiv({ cls: "codex-section-panel__edit-column" });
      before.createDiv({ cls: "codex-section-panel__edit-label", text: "原内容" });
      before.createEl("pre", { text: context ? context.text : "（引用不存在）" });
      const after = columns.createDiv({ cls: "codex-section-panel__edit-column" });
      after.createDiv({ cls: "codex-section-panel__edit-label", text: "建议内容" });
      after.createEl("pre", { text: edit.replacement });
    }
    if (proposal.edits.length === 0) {
      card.createDiv({ cls: "codex-section-panel__edit-empty", text: "Codex 判断当前内容无需修改。" });
    }
    const actions = card.createDiv({ cls: "codex-section-panel__edit-actions" });
    const confirm = actions.createEl("button", {
      cls: "codex-section-panel__edit-confirm mod-cta",
      text: proposal.edits.length ? "确认写入引用笔记" : "关闭建议",
      attr: { type: "button" },
    });
    confirm.disabled = proposal.edits.length === 0;
    confirm.addEventListener("click", () => void this.confirmDocumentEdit());
    const cancel = actions.createEl("button", {
      cls: "codex-section-panel__edit-cancel",
      text: "取消",
      attr: { type: "button" },
    });
    cancel.addEventListener("click", () => {
      this.clearPendingEdit();
      this.setStatus("已取消文档修改建议。");
    });
  }

  async confirmDocumentEdit(messagePending) {
    if (this.busy) return;
    const pending = messagePending && messagePending.message
      ? messagePending
      : this.pendingEdit;
    if (!pending) return;
    try {
      const result = await this.plugin.applyDocumentEdits(pending.contexts, pending.proposal.edits);
      if (pending.message) {
        pending.message.editStatus = result.changed ? "applied" : "unchanged";
        this.pendingEdit = null;
        try {
          await this.plugin.persistChatState();
        } catch (persistError) {
          new Notice(`修改已应用，但历史状态保存失败：${persistError instanceof Error ? persistError.message : String(persistError)}`);
        }
        this.renderConversation();
      } else {
        this.clearPendingEdit();
      }
      const targetLabel = result.paths && result.paths.length > 1
        ? `${result.paths.length} 篇引用笔记`
        : result.paths && result.paths.length === 1
          ? `引用笔记 ${result.paths[0]}`
          : "引用笔记";
      this.setStatus(result.changed
        ? `已写入${targetLabel}。`
        : "引用笔记内容没有变化，无需写入。");
      new Notice(result.changed ? `修改已写入${targetLabel}。` : "没有需要写入的变化。");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.setStatus(`写入失败：${message}`);
      new Notice(`写入失败：${message}`);
    }
  }

  formatElapsed(milliseconds) {
    const seconds = Math.max(0, Number(milliseconds) || 0) / 1000;
    return `${seconds.toFixed(1)} 秒`;
  }

  setBusy(value) {
    this.busy = value;
    if (this.sendButton) this.sendButton.disabled = value;
    if (this.pauseButton) this.pauseButton.disabled = !value;
    if (this.modelSelect) this.modelSelect.disabled = value;
    if (this.newConversationButton) this.newConversationButton.disabled = value;
    if (this.copyConversationButton) this.copyConversationButton.disabled = value;
    this.renderHistory();
  }
}

class CodexSectionPanelSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();
    new Setting(containerEl)
      .setName("Codex CLI 路径")
      .setDesc("填写 codex.exe 的完整路径；默认使用当前电脑上的 Codex CLI。")
      .addText((text) => text
        .setPlaceholder("codex")
        .setValue(this.plugin.settings.codexPath)
        .onChange(async (value) => {
          this.plugin.settings.codexPath = value.trim();
          await this.plugin.persistData();
        }));
    new Setting(containerEl)
      .setName("默认模型 ID")
      .setDesc("可填写 model/list 中的模型 ID；留空时使用 Codex 默认模型。面板打开后会自动加载可选模型。")
      .addText((text) => text
        .setPlaceholder("留空使用默认模型")
        .setValue(this.plugin.settings.defaultModel)
        .onChange(async (value) => {
          this.plugin.settings.defaultModel = value.trim();
          await this.plugin.persistData();
        }));
    new Setting(containerEl)
      .setName("Codex 网络代理")
      .setDesc("默认自动探测 Clash 的 127.0.0.1:7890；可填写 http://host:port 覆盖，输入 off 禁用。")
      .addText((text) => text
        .setPlaceholder("auto")
        .setValue(this.plugin.settings.proxyUrl)
        .onChange(async (value) => {
          this.plugin.settings.proxyUrl = value.trim() || "auto";
          this.plugin.proxyProbe = null;
          this.plugin.appServer.stop();
          await this.plugin.persistData();
        }));
  }
}

class CodexAppServerClient {
  constructor(plugin) {
    this.plugin = plugin;
    this.child = null;
    this.buffer = "";
    this.nextRequestId = 1;
    this.pending = new Map();
    this.subscribers = new Set();
    this.startPromise = null;
    this.initialized = false;
    this.stopping = false;
    this.activeThreads = new Set();
    this.stderr = "";
  }

  basePath() {
    return this.plugin.app.vault && this.plugin.app.vault.adapter && this.plugin.app.vault.adapter.getBasePath
      ? this.plugin.app.vault.adapter.getBasePath()
      : process.cwd();
  }

  async ensureStarted() {
    if (this.initialized && this.child && !this.child.killed) return;
    if (this.startPromise) return this.startPromise;
    this.startPromise = this.start().finally(() => {
      this.startPromise = null;
    });
    return this.startPromise;
  }

  async start() {
    this.stopping = false;
    this.buffer = "";
    this.stderr = "";
    const executable = this.plugin.settings.codexPath.trim() || "codex";
    const proxyUrl = await this.plugin.resolveCodexProxy();
    await this.plugin.ensureCodexProxy(proxyUrl);
    const child = childProcess.spawn(executable, buildAppServerArgs(), {
      cwd: this.basePath(),
      env: buildCodexEnvironment(process.env, os.homedir(), proxyUrl),
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    this.child = child;
    this.plugin.processes.add(child);
    child.stdout.on("data", (value) => this.consume(value));
    child.stderr.on("data", (value) => { this.stderr += String(value); });
    child.once("error", (error) => this.handleClosed(error));
    child.once("close", (code) => {
      if (!this.stopping && code !== 0) {
        this.handleClosed(new Error(String(this.stderr || `codex app-server 退出码 ${code}`).trim()));
      } else if (!this.stopping) {
        this.handleClosed(new Error("codex app-server 已退出。"));
      }
    });

    try {
      await this.requestRaw("initialize", {
        clientInfo: {
          name: "obsidian-codex-section-panel",
          title: "Obsidian Codex Section Panel",
          version: String(this.plugin.manifest && this.plugin.manifest.version || "0.4.7"),
        },
        capabilities: { experimentalApi: false },
      });
      this.notifyRaw("initialized", {});
      this.initialized = true;
    } catch (error) {
      this.stop();
      throw error;
    }
  }

  consume(value) {
    this.buffer += String(value || "");
    const parsed = parseAppServerJsonLines(this.buffer);
    this.buffer = parsed.remainder;
    for (const message of parsed.events) this.handleMessage(message);
  }

  handleMessage(message) {
    if (Object.prototype.hasOwnProperty.call(message, "id") && !message.method) {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      clearTimeout(pending.timer);
      if (message.error) {
        const error = new Error(String(message.error.message || "Codex app-server 请求失败。"));
        if (message.error.code !== undefined) error.code = message.error.code;
        if (message.error.data !== undefined) error.data = message.error.data;
        pending.reject(error);
      } else {
        pending.resolve(message.result);
      }
      return;
    }
    if (message.method && Object.prototype.hasOwnProperty.call(message, "id")) {
      try {
        this.sendRaw({
          jsonrpc: "2.0",
          id: message.id,
          error: { code: -32601, message: "此 Obsidian 面板不支持该 app-server 请求。" },
        });
      } catch (error) {
        // The process may be closing while a server request is being delivered.
      }
      return;
    }
    if (message.method) {
      for (const subscriber of this.subscribers) subscriber(message);
    }
  }

  handleClosed(error) {
    if (this.stopping && !this.child) return;
    const message = error instanceof Error ? error : new Error(String(error || "Codex app-server 已断开。"));
    this.initialized = false;
    this.activeThreads.clear();
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(message);
    }
    this.pending.clear();
    const child = this.child;
    this.child = null;
    if (child) this.plugin.processes.delete(child);
    for (const subscriber of this.subscribers) subscriber({
      method: "app-server/closed",
      params: { message: message.message },
    });
  }

  sendRaw(value) {
    if (!this.child || !this.child.stdin || this.child.stdin.destroyed) {
      throw new Error("Codex app-server 尚未启动。 ");
    }
    this.child.stdin.write(`${JSON.stringify(value)}\n`, "utf8");
  }

  notifyRaw(method, params) {
    this.sendRaw({ jsonrpc: "2.0", method, params: params || {} });
  }

  requestRaw(method, params, timeoutMs = 30000) {
    const id = this.nextRequestId++;
    const request = createJsonRpcRequest(id, method, params);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Codex app-server 请求超时：${method}`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      try {
        this.sendRaw(request);
      } catch (error) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(error);
      }
    });
  }

  async request(method, params, timeoutMs = 30000) {
    await this.ensureStarted();
    return this.requestRaw(method, params, timeoutMs);
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  async listModels() {
    return normalizeAvailableModels(await this.request("model/list", { includeHidden: false, limit: 100 }));
  }

  async startThread(model) {
    const result = await this.request("thread/start", {
      cwd: this.basePath(),
      model: model || null,
      approvalPolicy: "never",
      sandbox: "read-only",
      ephemeral: false,
    });
    const threadId = String(result && result.thread && result.thread.id || "");
    if (!threadId) throw new Error("Codex app-server 没有返回 threadId。 ");
    this.activeThreads.add(threadId);
    return { result, threadId, resumed: false };
  }

  async resumeThread(threadId, model) {
    const result = await this.request("thread/resume", {
      threadId,
      cwd: this.basePath(),
      model: model || null,
      approvalPolicy: "never",
      sandbox: "read-only",
    });
    this.activeThreads.add(threadId);
    return { result, threadId, resumed: true };
  }

  async startTurn(threadId, prompt, model) {
    return this.request("turn/start", {
      threadId,
      input: [{ type: "text", text: String(prompt || "") }],
      model: model || null,
    });
  }

  async interruptTurn(threadId, turnId) {
    return this.request("turn/interrupt", { threadId, turnId }, APP_SERVER_INTERRUPT_TIMEOUT_MS);
  }

  isRunning() {
    return Boolean(this.child && this.child.stdin && !this.child.stdin.destroyed);
  }

  stop() {
    this.stopping = true;
    const child = this.child;
    this.child = null;
    this.initialized = false;
    this.activeThreads.clear();
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(new Error("Codex app-server 已停止。"));
    }
    this.pending.clear();
    if (child) {
      this.plugin.processes.delete(child);
      try {
        if (child.stdin && !child.stdin.destroyed) child.stdin.destroy();
        child.kill();
      } catch (error) {
        // Process cleanup is best effort during plugin unload.
      }
    }
  }
}

class CodexSectionPanelPlugin extends Plugin {
  constructor(app, manifest) {
    super(app, manifest);
    this.settings = { ...DEFAULT_SETTINGS };
    this.chatState = normalizeChatState();
    this.processes = new Set();
    this.activeRequest = null;
    this.sourceView = null;
    this.models = [];
    this.proxyProbe = null;
    this.appServer = new CodexAppServerClient(this);
    this.api = {
      selectionContext: {
        addSelections: async (selections) => {
          const panel = await this.activateView();
          return panel && typeof panel.addContexts === "function"
            ? panel.addContexts(selections)
            : 0;
        },
        clear: async () => {
          const panel = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0];
          if (!panel || !panel.view || typeof panel.view.clearPendingContexts !== "function") return false;
          panel.view.clearPendingContexts();
          return true;
        },
      },
    };
  }

  async onload() {
    const data = normalizePluginData(await this.loadData());
    this.settings = data.settings;
    this.chatState = data.chatState;
    this.registerView(VIEW_TYPE, (leaf) => new CodexSectionPanelView(leaf, this));
    this.registerEvent(this.app.workspace.on("active-leaf-change", (leaf) => {
      this.rememberMarkdownView(leaf && leaf.view);
    }));
    this.registerEvent(this.app.workspace.on("editor-menu", (menu, editor, view) => {
      if (!isMarkdownView(view)) return;
      menu.addItem((item) => item
        .setTitle("读取当前章节到 Codex Section Panel")
        .setIcon("heading")
        .onClick(async () => {
          const panel = await this.activateView(view);
          if (panel) await panel.loadSection(view);
        }));
      if (String(editor.getSelection && editor.getSelection() || "").trim()) {
        menu.addItem((item) => item
          .setTitle("添加当前选区到 Codex Section Panel")
          .setIcon("text-select")
          .onClick(async () => {
            const panel = await this.activateView(view);
            if (panel) await panel.loadSelection(view);
          }));
      }
    }));
    this.rememberMarkdownView(this.app.workspace.activeLeaf && this.app.workspace.activeLeaf.view);
    this.addRibbonIcon("message-square", "打开 Codex Section Panel", () => void this.activateView());
    this.addCommand({
      id: "open-panel",
      name: "打开 Codex Section Panel",
      callback: () => void this.activateView(),
    });
    this.addCommand({
      id: "read-current-section",
      name: "读取当前章节到 Codex Section Panel",
      callback: async () => {
        const view = await this.activateView();
        if (view) await view.loadSection();
      },
    });
    this.addCommand({
      id: "read-current-selection",
      name: "添加当前选区到 Codex Section Panel",
      callback: async () => {
        const view = this.getSourceMarkdownView();
        const panel = await this.activateView(view);
        if (panel) await panel.loadSelection(view);
      },
    });
    this.addSettingTab(new CodexSectionPanelSettingTab(this.app, this));
  }

  async persistData() {
    await this.saveData({ settings: this.settings, chatState: this.chatState });
  }

  async persistChatState() {
    await this.persistData();
  }

  async applyDocumentEdits(contexts, edits) {
    const list = normalizePendingContexts(contexts);
    const plan = buildDocumentEditPlan(list, edits);
    const paths = plan.map((group) => group.path);
    if (!plan.length) return { path: "", paths: [], changedPaths: [], changed: false };
    if (!this.app.vault || typeof this.app.vault.getAbstractFileByPath !== "function") {
      throw new Error("当前 Obsidian 环境不支持定位目标笔记。 ");
    }
    if (typeof this.app.vault.read !== "function" || typeof this.app.vault.modify !== "function") {
      throw new Error("当前 Obsidian 环境不支持读取或写入笔记。 ");
    }
    const prepared = [];
    for (const group of plan) {
      const file = this.app.vault.getAbstractFileByPath(group.path);
      if (!file) throw new Error(`找不到可写入的笔记：${group.path}`);
      const current = await this.app.vault.read(file);
      const updated = applyDocumentEditsToMarkdown(current, list, group.edits);
      prepared.push({ file, path: group.path, current, updated });
    }

    const changed = prepared.filter((entry) => entry.updated !== entry.current);
    const applied = [];
    try {
      for (const entry of changed) {
        applied.push(entry);
        await this.app.vault.modify(entry.file, entry.updated);
      }
    } catch (error) {
      const rollbackErrors = [];
      for (const entry of applied.reverse()) {
        try {
          await this.app.vault.modify(entry.file, entry.current);
        } catch (rollbackError) {
          rollbackErrors.push(`${entry.path}: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`);
        }
      }
      const reason = error instanceof Error ? error.message : String(error);
      const rollbackMessage = rollbackErrors.length
        ? ` 回滚失败：${rollbackErrors.join("；")}`
        : " 已回滚已写入的笔记。";
      throw new Error(`跨笔记写入失败：${reason}。${rollbackMessage}`);
    }
    const changedPaths = changed.map((entry) => entry.path);
    return {
      path: paths.join("、"),
      paths,
      changedPaths,
      changed: changedPaths.length > 0,
    };
  }

  getActiveConversation() {
    return this.chatState.conversations.find(
      (conversation) => conversation.id === this.chatState.activeConversationId,
    ) || this.chatState.conversations[0];
  }

  async createConversation() {
    const conversation = createConversationRecord();
    this.chatState.conversations.unshift(conversation);
    this.chatState.activeConversationId = conversation.id;
    await this.persistChatState();
    return conversation;
  }

  async setActiveConversation(id) {
    if (!this.chatState.conversations.some((conversation) => conversation.id === id)) return false;
    this.chatState.activeConversationId = id;
    await this.persistChatState();
    return true;
  }

  async deleteConversation(id) {
    const previousState = this.chatState;
    const result = removeConversationFromChatState(previousState, id);
    if (!result.deleted) return result;
    this.chatState = result.chatState;
    try {
      await this.persistChatState();
    } catch (error) {
      this.chatState = previousState;
      throw error;
    }
    return result;
  }

  async onunload() {
    if (this.activeRequest) this.cancelActiveRequest();
    this.appServer.stop();
    for (const process of this.processes) process.kill();
    this.processes.clear();
  }

  rememberMarkdownView(view) {
    if (isMarkdownView(view)) this.sourceView = view;
    return this.sourceView;
  }

  getSourceMarkdownView(preferred) {
    if (isMarkdownView(preferred)) return this.rememberMarkdownView(preferred);
    if (isMarkdownView(this.sourceView)) return this.sourceView;
    const active = this.app.workspace.activeLeaf && this.app.workspace.activeLeaf.view;
    if (isMarkdownView(active)) return this.rememberMarkdownView(active);
    const leaves = typeof this.app.workspace.getLeavesOfType === "function"
      ? this.app.workspace.getLeavesOfType("markdown")
      : [];
    const view = Array.isArray(leaves) && leaves.length ? leaves[0].view : null;
    return this.rememberMarkdownView(view);
  }

  async activateView(sourceView) {
    this.rememberMarkdownView(sourceView);
    let leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0];
    if (!leaf) {
      leaf = this.app.workspace.getRightLeaf(false) || this.app.workspace.getLeaf(true);
      await leaf.setViewState({ type: VIEW_TYPE, active: true });
    }
    await this.app.workspace.revealLeaf(leaf);
    return leaf.view;
  }

  async listModels() {
    this.models = await this.appServer.listModels();
    return this.models;
  }

  async resolveCodexProxy() {
    const configured = normalizeProxyUrl(this.settings.proxyUrl);
    if (!configured) return "";
    if (configured !== "auto") return configured;
    if (getEnvironmentProxy(process.env)) return "";
    for (const candidate of AUTO_PROXY_CANDIDATES) {
      if (await probeTcpProxy(candidate, 800)) return candidate;
    }
    return "";
  }

  async ensureCodexProxy(proxyUrl) {
    if (!proxyUrl) return;
    const now = Date.now();
    if (this.proxyProbe && this.proxyProbe.url === proxyUrl && now - this.proxyProbe.checkedAt < PROXY_CACHE_TTL_MS) {
      if (!this.proxyProbe.ok) throw new Error(this.proxyProbe.message);
      return;
    }
    const result = await probeHttpsThroughHttpProxy(proxyUrl);
    const message = result.ok ? "" : buildProxyFailureMessage(proxyUrl, result.error);
    this.proxyProbe = { url: proxyUrl, checkedAt: now, ok: Boolean(result.ok), message };
    if (!result.ok) throw new Error(message);
  }

  async ensureConversationThread(conversation, model) {
    if (!conversation) throw new Error("没有可用的当前对话。");
    const hasPriorHistory = Array.isArray(conversation.messages) && conversation.messages.length > 1;
    const persistedThreadId = String(conversation.threadId || "");
    if (conversation.threadId && this.appServer.activeThreads.has(conversation.threadId)) {
      return { threadId: conversation.threadId, resumed: true, rehydrate: false };
    }
    if (conversation.threadId) {
      try {
        await this.appServer.resumeThread(conversation.threadId, model);
        return { threadId: conversation.threadId, resumed: true, rehydrate: false };
      } catch (error) {
        if (!isDefinitiveThreadLossError(error)) throw error;
        clearFailedConversationThread(conversation, persistedThreadId);
      }
    }
    const started = await this.appServer.startThread(model);
    conversation.threadId = started.threadId;
    await this.persistChatState();
    return {
      ...started,
      rehydrate: Boolean(persistedThreadId || hasPriorHistory),
    };
  }

  async recoverConversationAfterFailure(conversation, threadId, turnId) {
    if (!conversation || !threadId || conversation.threadId !== threadId) return false;
    const canInterrupt = typeof this.appServer.interruptTurn === "function"
      && (typeof this.appServer.isRunning !== "function" || this.appServer.isRunning());
    if (canInterrupt && turnId) {
      try {
        await this.appServer.interruptTurn(threadId, turnId);
      } catch (error) {
        // Transport failures are already being recovered; stopping the process is the fallback.
      }
    }
    this.appServer.stop();
    void this.persistChatState().catch(() => {});
    return true;
  }

  cancelActiveRequest() {
    if (!this.activeRequest) return false;
    this.activeRequest.cancelled = true;
    if (this.activeRequest.recordAction) this.activeRequest.recordAction({
      id: "interrupt", kind: "turn", label: "中断请求", status: "running", startedAt: Date.now(), endedAt: 0,
    });
    if (this.activeRequest.threadId && this.activeRequest.turnId) {
      if (!this.activeRequest.interruptPromise) {
        this.activeRequest.interruptPromise = this.appServer
          .interruptTurn(this.activeRequest.threadId, this.activeRequest.turnId)
          .catch(() => {});
      }
    }
    return true;
  }

  async requestCodex(prompt, options) {
    const onDelta = options && typeof options.onDelta === "function" ? options.onDelta : () => {};
    const onPhase = options && typeof options.onPhase === "function" ? options.onPhase : () => {};
    const onActivity = options && typeof options.onActivity === "function" ? options.onActivity : () => {};
    const conversation = options && options.conversation;
    const model = String(options && options.model || conversation && conversation.model || this.settings.defaultModel || "").trim();
    const turnPrompt = String(options && options.turnPrompt || prompt || "");
    const recoveryPrompt = String(options && options.recoveryPrompt || prompt || "");
    if (this.activeRequest) {
      throw new Error("当前已有 Codex 请求正在运行，请等待它结束或先暂停。 ");
    }
    const requestState = {
      threadId: "",
      turnId: "",
      cancelled: false,
      streamedText: "",
      hasStreamedOutput: false,
      startedAt: Date.now(),
      lastProgressAt: Date.now(),
      hasProgress: false,
      lastError: "",
      recoveryPending: false,
      activities: [],
    };
    const recordAction = (action, sourceEvent) => {
      if (!action) return;
      const previous = requestState.activities.find((entry) => entry.id === action.id);
      if (action.kind === "answer" && action.status === "running" && !action.detail && previous && previous.label === "Codex 进度") {
        const delta = String((sourceEvent && sourceEvent.params && sourceEvent.params.delta) || "");
        if (delta) action = { ...action, label: previous.label, detail: delta, appendDetail: true };
      }
      if (previous && action.kind === "answer" && action.status === "running" && !action.detail) return;
      requestState.activities = applyAppServerAction(requestState.activities, action);
      onActivity(requestState.activities);
    };
    requestState.recordAction = recordAction;
    this.activeRequest = requestState;
    recordAction({ id: "connection", kind: "connection", label: "连接会话", status: "running", startedAt: requestState.startedAt });
    let thread;
    try {
      thread = await this.ensureConversationThread(conversation, model);
      requestState.threadId = thread.threadId;
      recordAction({ id: "connection", kind: "connection", label: "连接会话", status: "completed", startedAt: requestState.startedAt, endedAt: Date.now() });
    } catch (error) {
      requestState.activities = finishAppServerActions(requestState.activities, "failed");
      onActivity(requestState.activities);
      error.activities = requestState.activities;
      if (this.activeRequest === requestState) this.activeRequest = null;
      throw error;
    }

    return new Promise((resolve, reject) => {
      let settled = false;
      let timeoutTimer = null;
      const unsubscribe = this.appServer.subscribe((event) => {
        if (event.method === "app-server/closed") {
          const error = new Error(String(event.params && event.params.message || "Codex app-server 已断开。"));
          requestState.recoveryPending = true;
          void (async () => {
            try {
              await this.recoverConversationAfterFailure(conversation, requestState.threadId, requestState.turnId);
            } finally {
              requestState.recoveryPending = false;
              finish(error);
            }
          })();
          return;
        }
        const params = event.params || {};
        if (params.threadId && params.threadId !== requestState.threadId) return;
        if (event.method === "turn/started") {
          const startedTurnId = String(params.turn && params.turn.id || "");
          if (startedTurnId) requestState.turnId = startedTurnId;
        }
        if (params.turnId && requestState.turnId && params.turnId !== requestState.turnId) return;
        if (params.turn && requestState.turnId && params.turn.id && params.turn.id !== requestState.turnId) return;
        const errorMessage = extractAppServerError(event);
        if (errorMessage) requestState.lastError = errorMessage;
        const action = extractAppServerAction(event);
        recordAction(action, event);
        const phase = extractAppServerPhase(event);
        const activity = extractAppServerActivity(event);
        if (phase || activity) onPhase(phase, errorMessage, activity);
        if (phase || activity || action) {
          requestState.lastProgressAt = Date.now();
          requestState.hasProgress = true;
          armTimeout();
        }
        const delta = extractAppServerDelta(event);
        if (delta) {
          requestState.hasStreamedOutput = true;
          requestState.hasProgress = true;
          requestState.lastProgressAt = Date.now();
          requestState.streamedText += delta;
          onDelta(requestState.streamedText);
          armTimeout();
        }
        if (event.method === "turn/completed") {
          if (requestState.recoveryPending) return;
          const turnStatus = String(params.turn && params.turn.status || "");
          if (turnStatus === "completed") {
            finish(null, false);
          } else if (turnStatus === "interrupted" || requestState.cancelled) {
            finish(null, true);
          } else {
            finish(new Error(String(
              params.turn && params.turn.error && params.turn.error.message
                || `Codex turn ${turnStatus || "failed"}`,
            )));
          }
        }
      });
      const cleanup = () => {
        clearTimeout(timeoutTimer);
        unsubscribe();
        if (this.activeRequest === requestState) this.activeRequest = null;
      };
      const finish = (error, cancelled) => {
        if (settled) return;
        settled = true;
        requestState.activities = finishAppServerActions(requestState.activities, error ? "failed" : cancelled ? "interrupted" : "completed");
        onActivity(requestState.activities);
        cleanup();
        try {
          if (error) {
            error.activities = requestState.activities;
            reject(error);
            return;
          }
          resolve({ cancelled: Boolean(cancelled), text: requestState.streamedText.trim(), activities: requestState.activities });
        } catch (finishError) {
          reject(finishError);
        }
      };
      const armTimeout = () => {
        clearTimeout(timeoutTimer);
        timeoutTimer = setTimeout(() => {
        const timedOutAt = Date.now();
        const timeoutError = new Error(
          buildAppServerTimeoutMessage(
            timedOutAt - requestState.startedAt,
            requestState.lastError,
            requestState.streamedText,
            requestState.hasStreamedOutput,
            timedOutAt - requestState.lastProgressAt,
          ),
        );
        requestState.cancelled = true;
        requestState.recoveryPending = true;
        void (async () => {
          try {
            await this.recoverConversationAfterFailure(
              conversation,
              requestState.threadId,
              requestState.turnId,
            );
          } finally {
            requestState.recoveryPending = false;
            finish(timeoutError);
          }
        })();
        }, getAppServerTimeoutDelayMs(
          requestState.startedAt,
          Date.now(),
          requestState.streamedText,
          requestState.hasStreamedOutput,
          requestState.lastProgressAt,
          requestState.hasProgress,
        ));
      };
      armTimeout();
      void this.appServer.startTurn(
        requestState.threadId,
        thread.rehydrate ? recoveryPrompt : (thread.resumed ? turnPrompt : prompt),
        model,
      ).then((result) => {
        requestState.turnId = String(result && result.turn && result.turn.id || "");
        if (!requestState.turnId) {
          finish(new Error("Codex app-server 没有返回 turnId。"));
          return;
        }
        if (requestState.cancelled) {
          void this.appServer.interruptTurn(requestState.threadId, requestState.turnId).catch((error) => {
            finish(error);
          });
        }
      }).catch((error) => {
        requestState.recoveryPending = true;
        void (async () => {
          try {
            await this.recoverConversationAfterFailure(
              conversation,
              requestState.threadId,
              requestState.turnId,
            );
          } finally {
            requestState.recoveryPending = false;
            finish(error);
          }
        })();
      });
    });
  }
}

var CodexSectionPanelTestAPI = {
  appendConversationMessage,
  buildAppServerArgs,
  buildCodexArgs,
  buildCodexEnvironment,
  buildProxyFailureMessage,
  probeHttpsThroughHttpProxy,
  buildConversationPrompt,
  buildConversationRecoveryPrompt,
  buildUnifiedConversationPrompt,
  buildUnifiedTurnPrompt,
  buildHistoricalTurnPrompt,
  collectConversationReferences,
  buildDocumentEditPrompt,
  parseDocumentEditProposal,
  parseCodexResponse,
  formatCodexResponseForDisplay,
  formatStreamingCodexText,
  buildDocumentEditPlan,
  applyDocumentEditsToMarkdown,
  buildConversationClipboardText,
  buildActivitiesClipboardText,
  buildActivityClipboardText,
  buildMessageClipboardText,
  buildReferenceClipboardText,
  buildTurnPrompt,
  buildOneShotPrompt,
  createConversationRecord,
  createJsonRpcRequest,
  createSelectionContext,
  extractAppServerDelta,
  extractAppServerActivity,
  extractAppServerAction,
  applyAppServerAction,
  finishAppServerActions,
  getReferencePreviewPosition,
  extractAppServerError,
  extractAppServerPhase,
  buildAppServerTimeoutMessage,
  getAppServerTurnTimeoutMs,
  getAppServerTimeoutDelayMs,
  clearFailedConversationThread,
  isDefinitiveThreadLossError,
  extractCodexDelta,
  extractCodexPhase,
  findMarkdownSection,
  normalizeChatState,
  removeConversationFromChatState,
  normalizePluginData,
  normalizeAvailableModels,
  normalizeProxyUrl,
  normalizeExternalContext,
  appendPendingContext,
  removePendingContext,
  addSectionContext,
  getConversationDisplayTitle,
  formatHistoryTime,
  formatMessageTime,
  sumActivityDuration,
  resolveRequestContexts,
  parseAppServerJsonLines,
  parseCodexJsonLines,
};

if (typeof module !== "undefined" && module && module.exports) module.exports = CodexSectionPanelPlugin;
