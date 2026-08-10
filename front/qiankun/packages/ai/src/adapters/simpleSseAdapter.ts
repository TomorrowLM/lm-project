import type { EventSourceMessage } from '@microsoft/fetch-event-source';
import type {
  SSEData,
  UnifiedContentBlock,
  UnifiedMessage,
} from '@/types/chat';

/**
 * 将一条 SSE 事件消息应用到消息列表中
 * 返回更新后的消息列表
 */
export function applySSEEvent(
  msg: EventSourceMessage,
  messages: UnifiedMessage[],
  assistantMsgId: string,
): UnifiedMessage[] {
  const data: SSEData = JSON.parse(msg.data);

  return messages.map((m) => {
    if (m.id !== assistantMsgId) return m;

    switch (data.eventType) {
      case 'MESSAGE_STARTED':
        return { ...m, status: 'streaming' as const };

      case 'ANSWER_DELTA': {
        const payload = data.payload;
        if (!payload) return m;
        return {
          ...m,
          blocks: upsertBlock(m.blocks, payload),
        };
      }

      case 'STREAM_COMPLETED':
        return {
          ...m,
          status: 'done' as const,
          blocks: m.blocks.map((b) =>
            b.status === 'streaming' ? { ...b, status: 'done' as const } : b,
          ),
        };

      default:
        return m;
    }
  });
}

/** 追加或创建内容块 */
function upsertBlock(
  blocks: UnifiedContentBlock[],
  payload: { blockId: string; type: 'answer'; content: string; status: 'streaming' },
): UnifiedContentBlock[] {
  const existing = blocks.find((b) => b.id === payload.blockId);

  if (existing) {
    return blocks.map((b) =>
      b.id === payload.blockId
        ? { ...b, content: b.content + payload.content }
        : b,
    );
  }

  return [
    ...blocks,
    {
      id: payload.blockId,
      type: payload.type,
      content: payload.content,
      status: payload.status,
    },
  ];
}

/** 生成简易 ID */
export function genId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
