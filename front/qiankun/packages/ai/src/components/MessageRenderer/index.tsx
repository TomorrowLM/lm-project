import type { UnifiedMessage } from '@/types/chat';
import UserMessage from '@/components/UserMessage';
import AssistantMessage from '@/components/AssistantMessage';

interface MessageRendererProps {
  message: UnifiedMessage;
}

export default function MessageRenderer({ message }: MessageRendererProps) {
  switch (message.role) {
    case 'user':
      return <UserMessage message={message} />;
    case 'assistant':
      return <AssistantMessage message={message} />;
    case 'system':
      return (
        <div className="text-center text-gray-400 text-xs my-3">
          {message.blocks[0]?.content ?? ''}
        </div>
      );
    default:
      return null;
  }
}
