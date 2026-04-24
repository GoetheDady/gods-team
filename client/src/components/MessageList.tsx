import { useEffect, useRef, useState } from 'react';
import Avatar from './Avatar';

export interface ImageMeta {
  url: string;
}

export interface Message {
  id: string;
  from_id: string;
  from_username: string;
  avatar_url?: string | null;
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
    <div className="m-px flex flex-1 flex-col gap-1 overflow-y-auto py-4 pl-4 pr-6" ref={containerRef} onScroll={handleScroll}>
      {hasMore && (
        <div className="cursor-pointer p-2 text-center text-[13px] text-jianghu-muted hover:text-jianghu-gold" onClick={onLoadMore}>加载更多</div>
      )}
      {messages.map(msg => {
        const isSelf = msg.from_id === currentUserId;
        return (
          <div
            key={msg.id}
            className={`flex animate-[fade-slide-up_200ms_ease_forwards] items-start gap-2.5 ${isSelf ? 'flex-row-reverse' : ''}`}
          >
            <div className="mt-0.5 shrink-0">
              <Avatar src={msg.avatar_url ?? null} name={msg.from_username} size={34} />
            </div>
            <div className="max-w-[60%]">
              <div className={`mb-[3px] flex items-baseline gap-2 ${isSelf ? 'flex-row-reverse' : ''}`}>
                {!isSelf && <span className="font-mono text-[11px] text-jianghu-gold">{msg.from_username}</span>}
                <span className="font-mono text-[10px] text-jianghu-muted">{formatTime(msg.timestamp)}</span>
              </div>
              <div className={`w-fit max-w-full break-words rounded-lg bg-jianghu-message px-3 py-2 text-sm leading-normal ${isSelf ? 'border border-jianghu-border-gold bg-jianghu-gold-glow' : ''} ${msg.images?.length ? 'w-full max-w-[304px]' : ''}`}>
                {msg.content && <p>{msg.content}</p>}
                {msg.images?.map((img, i) => (
                  <img
                    key={i}
                    src={`${img.url}?x-oss-process=image/resize,w_300`}
                    alt=""
                    className="mt-1 block h-auto max-h-[200px] w-full cursor-pointer rounded object-contain"
                    onClick={() => setLightbox(`${img.url}?x-oss-process=image/resize,w_1200`)}
                  />
                ))}
              </div>
            </div>
          </div>
        );
      })}
      <div
        className="px-4 py-1 font-mono text-xs italic text-jianghu-muted"
        style={{ visibility: typingUsernames.length > 0 ? 'visible' : 'hidden' }}
      >
        {typingUsernames.join('、')} 正在输入...
      </div>
      <div ref={bottomRef} />
      {lightbox && (
        <div className="fixed inset-0 z-[1000] flex cursor-pointer items-center justify-center bg-black/85" onClick={() => setLightbox(null)}>
          <img className="max-h-[90vh] max-w-[90vw] object-contain" src={lightbox} alt="" />
        </div>
      )}
    </div>
  );
}
