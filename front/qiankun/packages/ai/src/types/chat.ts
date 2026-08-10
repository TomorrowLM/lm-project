/** 统一消息角色 */
export type UnifiedMessageRole = 'user' | 'assistant' | 'system';

/** 内容块类型 — 当前只用 answer，预留扩展 */
export type BlockType = 'answer' | 'think' | 'plan' | 'tool' | 'quote';

/** 内容块状态 */
export type BlockStatus = 'streaming' | 'done' | 'error';

/** 消息状态 */
export type MessageStatus = 'pending' | 'streaming' | 'done' | 'error';

/** 统一内容块 */
export interface UnifiedContentBlock {
  id: string;
  type: BlockType;
  content: string;
  status: BlockStatus;
}

/** 统一消息 */
export interface UnifiedMessage {
  id: string;
  role: UnifiedMessageRole;
  status: MessageStatus;
  blocks: UnifiedContentBlock[];
  createdAt: number;
}

/** 后端 SSE 事件类型 */
export type SSEEventType =
  | 'MESSAGE_STARTED'
  | 'ANSWER_DELTA'
  | 'STREAM_COMPLETED';

/** ANSWER_DELTA payload */
export interface AnswerDeltaPayload {
  blockId: string;
  type: 'answer';
  content: string;
  status: 'streaming';
}

/** SSE 事件数据 */
export interface SSEData {
  eventType: SSEEventType;
  messageId?: string;
  payload?: AnswerDeltaPayload;
}
