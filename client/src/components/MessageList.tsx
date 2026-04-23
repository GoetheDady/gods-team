import { useEffect, useRef, useState } from 'react';
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
  imageUrls: Map<string, string[]>;
  onLoadImage: (msgId: string, meta: ImageMeta) => void;
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

export default function MessageList({ messages, currentUserId, typingUsernames, imageUrls, onLoadImage }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUsernames]);

  useEffect(() => {
    for (const msg of messages) {
      if (msg.images?.length && !imageUrls.has(msg.id)) {
        for (const img of msg.images) {
          onLoadImage(msg.id, img);
        }
      }
    }
  }, [messages]);

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
          <div className={styles.bubble}>
            {msg.content && <p className={styles.text}>{msg.content}</p>}
            {msg.images?.map((img, i) => {
              const urls = imageUrls.get(msg.id);
              if (urls?.[i]) {
                return (
                  <img
                    key={i}
                    src={urls[i]}
                    alt=""
                    className={styles.image}
                    onClick={() => setLightbox(urls[i])}
                  />
                );
              }
              return <div key={i} className={styles.imageExpired}>图片加载中…</div>;
            })}
          </div>
        </div>
      ))}
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
