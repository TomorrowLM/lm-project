import { useCallback, useRef } from 'react';
import { chatStream } from '@/services/chat';
import { applySSEEvent } from '@/adapters/simpleSseAdapter';
import { useChatStore } from '@/stores/useChatStore';

export function useChatStream() {
  const abortRef = useRef<AbortController | null>(null);
  const { updateMessage, startStreaming, stopStreaming } = useChatStore();

  const send = useCallback(
    async (text: string) => {
      const store = useChatStore.getState();

      // 添加用户消息和空的 assistant 消息
      store.addUserMessage(text);
      const assistantId = store.addAssistantMessage();

      startStreaming();

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        await chatStream({
          message: text,
          signal: controller.signal,
          onMessage: (event) => {
            const updated = applySSEEvent(
              event,
              useChatStore.getState().messages,
              assistantId,
            );
            useChatStore.setState({ messages: updated });
          },
          onError: (err) => {
            if ((err as Error).name !== 'AbortError') {
              updateMessage(assistantId, (msg) => ({
                ...msg,
                status: 'error',
              }));
            }
          },
        });
      } catch {
        // 连接失败或用户主动中断
        updateMessage(assistantId, (msg) => ({
          ...msg,
          status: msg.status === 'streaming' ? 'error' : msg.status,
        }));
      } finally {
        stopStreaming();
      }
    },
    [updateMessage, startStreaming, stopStreaming],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    stopStreaming();
  }, [stopStreaming]);

  return { send, stop };
}
