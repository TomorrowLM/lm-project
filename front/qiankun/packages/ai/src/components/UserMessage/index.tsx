import type { UnifiedMessage } from '@/types/chat';
import MarkdownBlock from '@/components/ChatBlocks/MarkdownBlock';

interface UserMessageProps {
  message: UnifiedMessage;
}

export default function UserMessage({ message }: UserMessageProps) {
  const text = message.blocks[0]?.content ?? '';

  return (
    <div className="flex justify-end mb-4">
      <div className="max-w-[80%] rounded-2xl px-4 py-2.5 bg-gray-100 text-gray-900 text-sm leading-relaxed">
        {text}
      </div>
    </div>
  );
}
