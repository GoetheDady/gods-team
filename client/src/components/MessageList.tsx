import { useEffect, useRef } from 'react';
import styles from './MessageList.module.css';

export interface ImageMeta {
  url: string;
  width: number;
  height: number;
}

export interface Message {
  id: string;
  from_id: string;
  from_username: string;
  content: string;
  images?: ImageMeta[];
  timestamp: number;
}

interface Props {
  messages: Message[];
  currentUserId: string;
  typingUsernames: string[];
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

export default function MessageList({ messages, currentUserId, typingUsernames }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUsernames]);

  return (
    <div className={styles.container}>
      {messages.map(msg => (
        <div
          key={msg.id}
          className={`${styles.message} ${msg.from_id === currentUserId ? styles.self : styles.other}`}
        >
          <div className={styles.meta}>
            <span className={styles.sender}>{msg.from_username}</span>
            <span className={styles.time}>{formatTime(msg.timestamp)}</span>
          </div>
          <div className={styles.bubble}>{msg.content}</div>
        </div>
      ))}
      <div
        className={styles.typing}
        style={{ visibility: typingUsernames.length > 0 ? 'visible' : 'hidden' }}
      >
        {typingUsernames.join('、')} 正在输入...
      </div>
      <div ref={bottomRef} />
    </div>
  );
}
