import { useChatStore } from '@/stores/useChatStore';
import ChatMessageList from '@/components/ChatMessageList';
import ChatComposer from '@/components/ChatComposer';

export default function ChatShell() {
  const messages = useChatStore((s) => s.messages);
  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col h-screen bg-white">
      {isEmpty ? (
        /* 空态 */
        <div className="flex-1 flex flex-col items-center justify-center px-4">
          <h1 className="text-2xl font-semibold text-gray-800 mb-2">
            Hi，我是 AI 助手
          </h1>
          <p className="text-gray-400 text-sm mb-8">
            可以问我编程、文档和知识库问题
          </p>
          <div className="w-full max-w-2xl">
            <ChatComposer />
          </div>
        </div>
      ) : (
        /* 聊天态 */
        <>
          <ChatMessageList />
          <ChatComposer />
        </>
      )}
    </div>
  );
}
