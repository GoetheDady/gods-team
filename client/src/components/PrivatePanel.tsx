import MessageList from './MessageList';
import type { Message } from './MessageList';
import styles from './PrivatePanel.module.css';

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
    <div className={styles.messages}>
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
