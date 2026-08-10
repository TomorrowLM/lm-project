import { useChatStore } from '@/stores/useChatStore';
import { useAutoScroll } from '@/hooks/useAutoScroll';
import MessageRenderer from '@/components/MessageRenderer';

export default function ChatMessageList() {
  const messages = useChatStore((s) => s.messages);
  const containerRef = useAutoScroll([messages]);

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto px-4 py-6"
    >
      <div className="max-w-3xl mx-auto">
        {messages.map((msg) => (
          <MessageRenderer key={msg.id} message={msg} />
        ))}
      </div>
    </div>
  );
}
