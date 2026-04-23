import MessageList from './MessageList';
import type { Message } from './MessageList';
import MessageInput from './MessageInput';
import styles from './PrivatePanel.module.css';

interface Props {
  peerId: string | null;
  peerUsername: string;
  messages: Message[];
  currentUserId: string;
  typingUsernames: string[];
  onSend: (text: string, imageUrl?: string) => void;
  onTyping: () => void;
  onClose: () => void;
  hasMore: boolean;
  onLoadMore: () => void;
}

export default function PrivatePanel({
  peerId, peerUsername, messages, currentUserId,
  typingUsernames, onSend, onTyping, onClose, hasMore, onLoadMore,
}: Props) {
  if (!peerId) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyIcon}>✦</div>
        <span>点击用户发起私聊</span>
      </div>
    );
  }

  return (
    <>
      <div className={styles.header}>
        <span className={styles.peerName}>{peerUsername}</span>
        <button className={styles.closeBtn} onClick={onClose}>×</button>
      </div>
      <div className={styles.messages}>
        <MessageList
          messages={messages}
          currentUserId={currentUserId}
          typingUsernames={typingUsernames}
          hasMore={hasMore}
          onLoadMore={onLoadMore}
        />
      </div>
      <MessageInput onSend={onSend} onTyping={onTyping} placeholder={`私聊 ${peerUsername}...`} />
    </>
  );
}
