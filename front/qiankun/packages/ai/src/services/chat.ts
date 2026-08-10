import { EventSourceMessage, fetchEventSource } from '@microsoft/fetch-event-source';

/** SSE 请求参数 */
export interface ChatStreamParams {
  message: string;
  model?: string;
  onMessage: (event: EventSourceMessage) => void;
  onError: (error: unknown) => void;
  signal: AbortSignal;
}

/** 发起 SSE 流式聊天请求 */
export async function chatStream(params: ChatStreamParams): Promise<void> {
  const { message, model = 'deepseek-chat', onMessage, onError, signal } = params;

  await fetchEventSource('/api/v1/chat/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, model }),
    signal,
    onmessage: onMessage,
    onerror: (err) => {
      onError(err);
      throw err; // 不重试
    },
    openWhenHidden: true,
  });
}
