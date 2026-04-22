# Task 11: 主聊天页面（三栏布局 + E2EE 集成）

**Files:**
- Create: `client/src/pages/Chat.tsx`
- Create: `client/src/pages/Chat.module.css`
- Create: `client/src/components/UserList.tsx`
- Create: `client/src/components/UserList.module.css`
- Create: `client/src/components/MessageList.tsx`
- Create: `client/src/components/MessageList.module.css`
- Create: `client/src/components/MessageInput.tsx`
- Create: `client/src/components/MessageInput.module.css`
- Create: `client/src/components/PrivatePanel.tsx`
- Create: `client/src/components/PrivatePanel.module.css`
- Modify: `client/src/App.tsx`

---

- [ ] **Step 1: 创建 `client/src/pages/Chat.module.css`**

```css
.layout {
  height: 100%;
  display: grid;
  grid-template-rows: 48px 1fr;
  grid-template-columns: 200px 1fr 280px;
  grid-template-areas:
    "header header header"
    "sidebar main private";
}

.header {
  grid-area: header;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border-subtle);
}

.headerLeft {
  display: flex;
  align-items: center;
  gap: 16px;
}

.logo {
  font-family: var(--font-display);
  font-size: 18px;
  color: var(--gold);
}

.roomName {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-secondary);
}

.headerRight {
  display: flex;
  align-items: center;
  gap: 16px;
}

.username {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-secondary);
}

.username span {
  color: var(--gold);
}

.inviteBtn {
  font-size: 12px;
  color: var(--text-secondary);
  padding: 4px 10px;
  border: 1px solid var(--border-gold);
  border-radius: var(--radius-sm);
  transition: color var(--transition), border-color var(--transition);
}

.inviteBtn:hover {
  color: var(--gold);
  border-color: var(--gold);
}

.logoutBtn {
  font-size: 12px;
  color: var(--text-muted);
  transition: color var(--transition);
}

.logoutBtn:hover {
  color: var(--danger);
}

.sidebar {
  grid-area: sidebar;
  background: var(--bg-sidebar);
  border-right: 1px solid var(--border-subtle);
  overflow-y: auto;
}

.main {
  grid-area: main;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.private {
  grid-area: private;
  background: var(--bg-sidebar);
  border-left: 1px solid var(--border-subtle);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
```

- [ ] **Step 2: 创建 `client/src/components/UserList.module.css`**

```css
.container {
  padding: 16px 0;
}

.title {
  font-size: 10px;
  font-family: var(--font-mono);
  color: var(--text-muted);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 0 16px 10px;
}

.user {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 16px;
  cursor: pointer;
  transition: background var(--transition);
}

.user:hover {
  background: var(--border-subtle);
}

.user.active {
  background: var(--gold-glow);
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--online-dot);
  flex-shrink: 0;
}

.name {
  font-size: 13px;
  color: var(--text-primary);
  font-family: var(--font-mono);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.name.self {
  color: var(--gold);
}
```

- [ ] **Step 3: 创建 `client/src/components/UserList.tsx`**

```typescript
import styles from './UserList.module.css';

interface OnlineUser {
  id: string;
  username: string;
}

interface Props {
  users: OnlineUser[];
  currentUserId: string;
  activePrivateId: string | null;
  onSelectUser: (userId: string) => void;
}

export default function UserList({ users, currentUserId, activePrivateId, onSelectUser }: Props) {
  return (
    <div className={styles.container}>
      <div className={styles.title}>在线 · {users.length}</div>
      {users.map(user => (
        <div
          key={user.id}
          className={`${styles.user} ${activePrivateId === user.id ? styles.active : ''}`}
          onClick={() => user.id !== currentUserId && onSelectUser(user.id)}
        >
          <span className={styles.dot} />
          <span className={`${styles.name} ${user.id === currentUserId ? styles.self : ''}`}>
            {user.username}{user.id === currentUserId ? ' (我)' : ''}
          </span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: 创建 `client/src/components/MessageList.module.css`**

```css
.container {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.message {
  display: flex;
  flex-direction: column;
  max-width: 70%;
  animation: fadeSlideUp 200ms ease forwards;
}

.message.self {
  align-self: flex-end;
}

.message.other {
  align-self: flex-start;
}

.meta {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 3px;
}

.message.self .meta {
  flex-direction: row-reverse;
}

.sender {
  font-size: 11px;
  font-family: var(--font-mono);
  color: var(--gold);
}

.time {
  font-size: 10px;
  font-family: var(--font-mono);
  color: var(--text-muted);
}

.bubble {
  padding: 8px 12px;
  background: var(--bg-message);
  border-radius: var(--radius-md);
  font-size: 14px;
  line-height: 1.5;
  word-break: break-word;
}

.message.self .bubble {
  background: var(--gold-glow);
  border: 1px solid var(--border-gold);
}

.typing {
  font-size: 12px;
  color: var(--text-muted);
  font-family: var(--font-mono);
  padding: 4px 16px;
  font-style: italic;
}
```

- [ ] **Step 5: 创建 `client/src/components/MessageList.tsx`**

```typescript
import { useEffect, useRef } from 'react';
import styles from './MessageList.module.css';

export interface Message {
  id: string;
  from_id: string;
  from_username: string;
  content: string;
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
      {typingUsernames.length > 0 && (
        <div className={styles.typing}>
          {typingUsernames.join('、')} 正在输入...
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
```

- [ ] **Step 6: 创建 `client/src/components/MessageInput.module.css`**

```css
.container {
  display: flex;
  align-items: flex-end;
  gap: 12px;
  padding: 12px 16px;
  border-top: 1px solid var(--border-subtle);
  background: var(--bg-input);
}

.input {
  flex: 1;
  padding: 8px 0;
  border-bottom: 1px solid var(--border-gold);
  resize: none;
  min-height: 36px;
  max-height: 120px;
  line-height: 1.5;
  transition: border-color var(--transition);
}

.input:focus {
  border-color: var(--gold);
}

.input::placeholder {
  color: var(--text-muted);
}

.send {
  padding: 8px 18px;
  background: var(--gold);
  color: #0f1014;
  font-family: var(--font-display);
  font-size: 14px;
  border-radius: var(--radius-sm);
  transition: opacity var(--transition), transform var(--transition);
  flex-shrink: 0;
  /* 墨水涟漪 */
  position: relative;
  overflow: hidden;
}

.send:hover:not(:disabled) {
  opacity: 0.9;
  transform: translateY(-1px);
}

.send:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
```

- [ ] **Step 7: 创建 `client/src/components/MessageInput.tsx`**

```typescript
import { useState, KeyboardEvent, ChangeEvent, useRef } from 'react';
import styles from './MessageInput.module.css';

interface Props {
  onSend: (text: string) => void;
  onTyping: () => void;
  disabled?: boolean;
  placeholder?: string;
}

export default function MessageInput({ onSend, onTyping, disabled, placeholder }: Props) {
  const [text, setText] = useState('');
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleChange(e: ChangeEvent<HTMLTextAreaElement>) {
    setText(e.target.value);
    onTyping();
    if (typingTimer.current) clearTimeout(typingTimer.current);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  function submit() {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText('');
  }

  return (
    <div className={styles.container}>
      <textarea
        className={styles.input}
        value={text}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder || '输入消息，Enter 发送，Shift+Enter 换行'}
        disabled={disabled}
        rows={1}
      />
      <button className={styles.send} onClick={submit} disabled={disabled || !text.trim()}>
        发送
      </button>
    </div>
  );
}
```

- [ ] **Step 8: 创建 `client/src/components/PrivatePanel.module.css`**

```css
.empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--text-muted);
  font-size: 13px;
  font-family: var(--font-mono);
}

.emptyIcon {
  font-size: 32px;
  opacity: 0.3;
}

.header {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-subtle);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.peerName {
  font-family: var(--font-mono);
  font-size: 13px;
  color: var(--gold);
}

.closeBtn {
  font-size: 16px;
  color: var(--text-muted);
  line-height: 1;
  transition: color var(--transition);
}

.closeBtn:hover {
  color: var(--text-primary);
}

.messages {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
```

- [ ] **Step 9: 创建 `client/src/components/PrivatePanel.tsx`**

```typescript
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
```

- [ ] **Step 10: 创建 `client/src/pages/Chat.tsx`**

这是主聊天页，整合 WebSocket、E2EE、本地存储。

```typescript
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { wsClient, WsMessage } from '../services/ws';
import { saveMessage, getMessages, LocalMessage } from '../services/localDb';
import {
  generateKeyPair,
  exportPublicKey,
  importPublicKey,
  deriveSharedKey,
  generateAesKey,
  encrypt,
  decrypt,
  wrapAesKey,
  unwrapAesKey,
  EncryptedPayload,
} from '../services/crypto';
import UserList from '../components/UserList';
import MessageList, { Message } from '../components/MessageList';
import MessageInput from '../components/MessageInput';
import PrivatePanel from '../components/PrivatePanel';
import styles from './Chat.module.css';

interface OnlineUser {
  id: string;
  username: string;
}

interface Props {
  userId: string;
  username: string;
  onLogout: () => void;
}

export default function Chat({ userId, username, onLogout }: Props) {
  const navigate = useNavigate();
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [hallMessages, setHallMessages] = useState<Message[]>([]);
  const [hallTyping, setHallTyping] = useState<string[]>([]);
  const [privateMessages, setPrivateMessages] = useState<Message[]>([]);
  const [privateTyping, setPrivateTyping] = useState<string[]>([]);
  const [activePeerId, setActivePeerId] = useState<string | null>(null);
  const [activePeerUsername, setActivePeerUsername] = useState('');

  // 密钥状态（存在 ref 中避免触发重渲染）
  const myKeyPair = useRef<CryptoKeyPair | null>(null);
  const hallKey = useRef<CryptoKey | null>(null);
  const sessionKeys = useRef<Map<string, CryptoKey>>(new Map());
  const usernameMap = useRef<Map<string, string>>(new Map([[userId, username]]));

  // 获取或协商私聊会话密钥
  const getSessionKey = useCallback(async (peerId: string): Promise<CryptoKey | null> => {
    if (sessionKeys.current.has(peerId)) return sessionKeys.current.get(peerId)!;
    if (!myKeyPair.current) return null;
    try {
      const { key_data } = await api.getPubkey(peerId);
      const peerPubKey = await importPublicKey(key_data);
      const sharedKey = await deriveSharedKey(myKeyPair.current.privateKey, peerPubKey);
      sessionKeys.current.set(peerId, sharedKey);
      return sharedKey;
    } catch {
      return null;
    }
  }, []);

  // 初始化：生成密钥对，上传公钥，连接 WebSocket
  useEffect(() => {
    let cleanup: (() => void) | undefined;

    async function init() {
      // 生成 ECDH 密钥对
      const keyPair = await generateKeyPair();
      myKeyPair.current = keyPair;
      const pubKeyB64 = await exportPublicKey(keyPair.publicKey);
      await api.uploadPubkey(pubKeyB64);

      // 获取 token，连接 WebSocket
      const { token } = await api.getToken();
      wsClient.connect(token);

      // 加载大厅历史消息
      const history = await getMessages('hall', 200);
      setHallMessages(history.map(m => ({
        id: m.id,
        from_id: m.from_id,
        from_username: usernameMap.current.get(m.from_id) || m.from_id,
        content: m.content,
        timestamp: m.timestamp,
      })));

      // 监听 WebSocket 消息
      cleanup = wsClient.on(async (msg: WsMessage) => {
        if (msg.type === 'online_users' && msg.users) {
          const users = msg.users as OnlineUser[];
          users.forEach(u => usernameMap.current.set(u.id, u.username));
          setOnlineUsers(users);

          // 如果我们没有大厅密钥，生成一个并分发给在线用户
          if (!hallKey.current) {
            const key = await generateAesKey();
            hallKey.current = key;
            // 分发给其他在线用户
            for (const user of users) {
              if (user.id === userId) continue;
              const sessionKey = await getSessionKey(user.id);
              if (!sessionKey) continue;
              const wrapped = await wrapAesKey(key, sessionKey);
              wsClient.send({
                type: 'hall_key_distribution',
                payload: { to: user.id, wrapped },
              });
            }
          }
        } else if (msg.type === 'user_joined') {
          const u = { id: msg.userId!, username: msg.username! };
          usernameMap.current.set(u.id, u.username);
          setOnlineUsers(prev => [...prev.filter(x => x.id !== u.id), u]);

          // 分发大厅密钥给新用户
          if (hallKey.current) {
            const sessionKey = await getSessionKey(u.id);
            if (sessionKey) {
              const wrapped = await wrapAesKey(hallKey.current, sessionKey);
              wsClient.send({
                type: 'hall_key_distribution',
                payload: { to: u.id, wrapped },
              });
            }
          }
        } else if (msg.type === 'user_left') {
          setOnlineUsers(prev => prev.filter(u => u.id !== msg.userId));
        } else if (msg.type === 'hall_key_distribution') {
          // 收到大厅密钥分发
          if (!myKeyPair.current || !msg.from) return;
          const sessionKey = await getSessionKey(msg.from);
          if (!sessionKey) return;
          const wrapped = msg.payload?.wrapped as EncryptedPayload;
          hallKey.current = await unwrapAesKey(wrapped, sessionKey);
        } else if (msg.type === 'hall_message') {
          if (!hallKey.current || !msg.from || !msg.payload) return;
          const payload = msg.payload as unknown as EncryptedPayload;
          const content = await decrypt(payload, hallKey.current);
          const fromUsername = usernameMap.current.get(msg.from) || msg.from;
          const newMsg: Message = {
            id: `${msg.from}-${msg.timestamp}`,
            from_id: msg.from,
            from_username: fromUsername,
            content,
            timestamp: msg.timestamp!,
          };
          setHallMessages(prev => [...prev, newMsg]);
          await saveMessage({ ...newMsg, chat_id: 'hall' } as LocalMessage);
        } else if (msg.type === 'private_message') {
          if (!msg.from || !msg.payload) return;
          const peerId = msg.from === userId ? activePeerId || msg.from : msg.from;
          const sessionKey = await getSessionKey(peerId);
          if (!sessionKey) return;
          const payload = msg.payload as unknown as EncryptedPayload;
          const content = await decrypt(payload, sessionKey);
          const fromUsername = usernameMap.current.get(msg.from) || msg.from;
          const newMsg: Message = {
            id: `${msg.from}-${msg.timestamp}`,
            from_id: msg.from,
            from_username: fromUsername,
            content,
            timestamp: msg.timestamp!,
          };
          const chatId = [userId, peerId].sort().join('-');
          setPrivateMessages(prev => [...prev, newMsg]);
          await saveMessage({ ...newMsg, chat_id: chatId } as LocalMessage);
        } else if (msg.type === 'typing') {
          const fromUsername = usernameMap.current.get(msg.from || '') || msg.from || '';
          // 简单实现：3秒后清除打字状态
          setHallTyping(prev => [...new Set([...prev, fromUsername])]);
          setTimeout(() => setHallTyping(prev => prev.filter(n => n !== fromUsername)), 3000);
        }
      });
    }

    init().catch(console.error);
    return () => {
      cleanup?.();
      wsClient.disconnect();
    };
  }, [userId, getSessionKey]);

  async function sendHallMessage(text: string) {
    if (!hallKey.current) return;
    const payload = await encrypt(text, hallKey.current);
    wsClient.send({ type: 'hall_message', payload });
  }

  async function sendPrivateMessage(text: string) {
    if (!activePeerId) return;
    const sessionKey = await getSessionKey(activePeerId);
    if (!sessionKey) return;
    const payload = await encrypt(text, sessionKey);
    wsClient.send({ type: 'private_message', payload: { to: activePeerId, ...payload } });
  }

  function sendTyping() {
    wsClient.send({ type: 'typing', payload: {} });
  }

  function sendPrivateTyping() {
    if (activePeerId) wsClient.send({ type: 'typing', payload: { to: activePeerId } });
  }

  async function selectUser(peerId: string) {
    if (peerId === userId) return;
    const peerName = usernameMap.current.get(peerId) || peerId;
    setActivePeerId(peerId);
    setActivePeerUsername(peerName);
    // 加载私聊历史
    const chatId = [userId, peerId].sort().join('-');
    const history = await getMessages(chatId, 200);
    setPrivateMessages(history.map(m => ({
      id: m.id,
      from_id: m.from_id,
      from_username: usernameMap.current.get(m.from_id) || m.from_id,
      content: m.content,
      timestamp: m.timestamp,
    })));
  }

  async function handleLogout() {
    await api.logout();
    onLogout();
    navigate('/login');
  }

  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.logo}>江湖</span>
          <span className={styles.roomName}># 公共大厅</span>
        </div>
        <div className={styles.headerRight}>
          <span className={styles.username}>
            <span>{username}</span>
          </span>
          <button className={styles.inviteBtn} onClick={() => navigate('/settings')}>
            邀请码
          </button>
          <button className={styles.logoutBtn} onClick={handleLogout}>
            退出
          </button>
        </div>
      </header>

      <aside className={styles.sidebar}>
        <UserList
          users={onlineUsers}
          currentUserId={userId}
          activePrivateId={activePeerId}
          onSelectUser={selectUser}
        />
      </aside>

      <main className={styles.main}>
        <MessageList
          messages={hallMessages}
          currentUserId={userId}
          typingUsernames={hallTyping}
        />
        <MessageInput
          onSend={sendHallMessage}
          onTyping={sendTyping}
          disabled={!hallKey.current}
          placeholder={hallKey.current ? '发言于大厅...' : '正在建立加密连接...'}
        />
      </main>

      <aside className={styles.private}>
        <PrivatePanel
          peerId={activePeerId}
          peerUsername={activePeerUsername}
          messages={privateMessages}
          currentUserId={userId}
          typingUsernames={privateTyping}
          onSend={sendPrivateMessage}
          onTyping={sendPrivateTyping}
          onClose={() => setActivePeerId(null)}
        />
      </aside>
    </div>
  );
}
```

- [ ] **Step 11: 更新 `client/src/App.tsx` 传入 Chat 所需 props**

将 `App.tsx` 中的 `/chat` 路由替换为：

```typescript
import Chat from './pages/Chat';

// 在 Routes 中：
<Route
  path="/chat"
  element={
    auth ? (
      <Chat
        userId={auth.userId}
        username={auth.username}
        onLogout={() => setAuth(null)}
      />
    ) : (
      <Navigate to="/login" />
    )
  }
/>
```

- [ ] **Step 12: 验证完整聊天流程**

用两个浏览器标签（或隐身窗口）分别以 alice 和 bob 登录：

1. 两人都应看到对方在在线用户列表中
2. alice 在大厅发送消息，bob 应能看到（E2EE 正常则消息可读）
3. alice 点击 bob 发起私聊，发送消息，bob 应在右侧私聊面板看到
4. 刷新页面，历史消息应从本地 SQLite 恢复

- [ ] **Step 13: 提交**

```bash
git add client/src/pages/Chat.tsx client/src/pages/Chat.module.css \
  client/src/components/ client/src/App.tsx
git commit -m "feat: add main chat page with E2EE hall and private messaging"
```
