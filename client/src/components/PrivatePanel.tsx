import MessageList from './MessageList';
import type { Message } from './MessageList';

interface Props {
  messages: Message[];
  currentUserId: string;
  typingUsernames: string[];
  hasMore: boolean;
  onLoadMore: () => void;
}

export default function PrivatePanel({
  messages, currentUserId, typingUsernames, hasMore, onLoadMore,
}: Props) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <MessageList
        messages={messages}
        currentUserId={currentUserId}
        typingUsernames={typingUsernames}
        hasMore={hasMore}
        onLoadMore={onLoadMore}
      />
    </div>
  );
}
