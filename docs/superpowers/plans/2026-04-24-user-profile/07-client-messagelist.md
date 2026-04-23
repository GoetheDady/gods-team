### Task 7：MessageList 消息气泡展示 Avatar

**Files:**
- Modify: `client/src/components/MessageList.tsx`

---

#### Step 1：修改 `client/src/components/MessageList.tsx` — 在消息气泡旁展示 Avatar

`Message` 接口不变（`from_id`/`from_username` 保持不变，因为 messages.ts 已经将 nickname 作为 sender_name 写入 DB，服务端返回的 senderName 就已经是 nickname）。

完整替换 `client/src/components/MessageList.tsx`：

```typescript
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
```

然后更新 `client/src/components/MessageList.module.css`，在保留现有样式的基础上添加 `.avatar` 和 `.body` 样式，并调整 `.message` 布局：

将 `.message` 样式从（原内容见文件）改为：

```css
.message {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.message.self {
  flex-direction: row-reverse;
}

.avatar {
  flex-shrink: 0;
  margin-top: 2px;
}

.body {
  max-width: 60%;
}
```

**注意：** `MessageList.module.css` 中现有的 `.meta`、`.sender`、`.time`、`.bubble`、`.text`、`.image`、`.lightbox`、`.loadMore`、`.typing` 样式保持不变，只需在文件中新增 `.avatar` 和 `.body` 规则，并更新 `.message` 规则。

- [ ] 完成上述修改。

---

#### Step 2：类型检查

```bash
cd client && npx tsc --noEmit
```

Expected: 无错误

- [ ] 完成。

---

#### Step 3：提交

```bash
git add client/src/components/MessageList.tsx client/src/components/MessageList.module.css
git commit -m "feat(client): MessageList shows Avatar next to each message bubble"
```

- [ ] 完成。
