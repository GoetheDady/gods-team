import MessageList, { Message } from './MessageList';
import MessageInput from './MessageInput';
import styles from './PrivatePanel.module.css';

interface Props {
  peerId: string | null;
  peerUsername: string;
  messages: Message[];
  currentUserId: string;
  typingUsernames: string[];
  onSend: (text: string) => void;
  onTyping: () => void;
  onClose: () => void;
}

export default function PrivatePanel({
  peerId,
  peerUsername,
  messages,
  currentUserId,
  typingUsernames,
  onSend,
  onTyping,
  onClose,
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
        />
      </div>
      <MessageInput onSend={onSend} onTyping={onTyping} placeholder={`私聊 ${peerUsername}...`} />
    </>
  );
}
