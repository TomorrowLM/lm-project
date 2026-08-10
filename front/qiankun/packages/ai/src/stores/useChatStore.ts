import { create } from 'zustand';
import type { UnifiedMessage, UnifiedMessageRole } from '@/types/chat';
import { genId } from '@/adapters/simpleSseAdapter';

interface ChatState {
  messages: UnifiedMessage[];
  isStreaming: boolean;

  /** 添加一条用户消息并返回其 ID */
  addUserMessage: (text: string) => string;

  /** 添加一条空的 assistant 消息并返回其 ID（供 SSE 写入） */
  addAssistantMessage: () => string;

  /** 更新指定消息 */
  updateMessage: (id: string, updater: (msg: UnifiedMessage) => UnifiedMessage) => void;

  /** 标记 streaming 开始 */
  startStreaming: () => void;

  /** 标记 streaming 结束 */
  stopStreaming: () => void;

  /** 清空消息 */
  clearMessages: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isStreaming: false,

  addUserMessage: (text) => {
    const id = genId('user');
    const msg: UnifiedMessage = {
      id,
      role: 'user',
      status: 'done',
      blocks: [{ id: genId('block'), type: 'answer', content: text, status: 'done' }],
      createdAt: Date.now(),
    };
    set((s) => ({ messages: [...s.messages, msg] }));
    return id;
  },

  addAssistantMessage: () => {
    const id = genId('assistant');
    const msg: UnifiedMessage = {
      id,
      role: 'assistant',
      status: 'pending',
      blocks: [],
      createdAt: Date.now(),
    };
    set((s) => ({ messages: [...s.messages, msg] }));
    return id;
  },

  updateMessage: (id, updater) => {
    set((s) => ({
      messages: s.messages.map((m) => (m.id === id ? updater(m) : m)),
    }));
  },

  startStreaming: () => set({ isStreaming: true }),
  stopStreaming: () => set({ isStreaming: false }),

  clearMessages: () => set({ messages: [], isStreaming: false }),
}));
