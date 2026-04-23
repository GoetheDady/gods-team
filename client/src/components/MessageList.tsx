import { useEffect, useRef, useState } from 'react';
import Avatar from './Avatar';
import styles from './MessageList.module.css';

export interface ImageMeta {
  url: string;
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
  hasMore: boolean;
  onLoadMore: () => void;
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

export default function MessageList({ messages, currentUserId, typingUsernames, hasMore, onLoadMore }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, typingUsernames.length]);

  function handleScroll() {
    if (containerRef.current && containerRef.current.scrollTop === 0 && hasMore) {
      onLoadMore();
    }
  }

  return (
    <div className={styles.container} ref={containerRef} onScroll={handleScroll}>
      {hasMore && (
        <div className={styles.loadMore} onClick={onLoadMore}>加载更多</div>
      )}
      {messages.map(msg => {
        const isSelf = msg.from_id === currentUserId;
        return (
          <div
            key={msg.id}
            className={`${styles.message} ${isSelf ? styles.self : styles.other}`}
          >
            {!isSelf && (
              <div className={styles.avatar}>
                <Avatar src={null} name={msg.from_username} size={34} />
              </div>
            )}
            <div className={styles.body}>
              <div className={styles.meta}>
                {!isSelf && <span className={styles.sender}>{msg.from_username}</span>}
                <span className={styles.time}>{formatTime(msg.timestamp)}</span>
              </div>
              <div className={styles.bubble}>
                {msg.content && <p className={styles.text}>{msg.content}</p>}
                {msg.images?.map((img, i) => (
                  <img
                    key={i}
                    src={`${img.url}?x-oss-process=image/resize,w_300`}
                    alt=""
                    className={styles.image}
                    onClick={() => setLightbox(`${img.url}?x-oss-process=image/resize,w_1200`)}
                  />
                ))}
              </div>
            </div>
            {isSelf && (
              <div className={styles.avatar}>
                <Avatar src={null} name={msg.from_username} size={34} />
              </div>
            )}
          </div>
        );
      })}
      <div
        className={styles.typing}
        style={{ visibility: typingUsernames.length > 0 ? 'visible' : 'hidden' }}
      >
        {typingUsernames.join('、')} 正在输入...
      </div>
      <div ref={bottomRef} />
      {lightbox && (
        <div className={styles.lightbox} onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="" />
        </div>
      )}
    </div>
  );
}
