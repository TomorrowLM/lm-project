import type { UnifiedMessage } from '@/types/chat';
import MarkdownBlock from '@/components/ChatBlocks/MarkdownBlock';

interface AssistantMessageProps {
  message: UnifiedMessage;
}

export default function AssistantMessage({ message }: AssistantMessageProps) {
  if (message.status === 'pending') {
    return (
      <div className="mb-4 text-gray-400 text-sm">思考中...</div>
    );
  }

  if (message.status === 'error') {
    return (
      <div className="mb-4 text-red-500 text-sm">
        回复失败，请重试
      </div>
    );
  }

  return (
    <div className="mb-4">
      {message.blocks.map((block) => (
        <div key={block.id} className="text-gray-900 text-sm leading-relaxed">
          <MarkdownBlock content={block.content} />
        </div>
      ))}
    </div>
  );
}
