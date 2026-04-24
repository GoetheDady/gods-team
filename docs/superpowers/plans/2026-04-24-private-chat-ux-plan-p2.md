# 私聊体验重构 Implementation Plan — Part 2

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> Part 1: `docs/superpowers/plans/2026-04-24-private-chat-ux-plan-p1.md` (Tasks 1-4，必须先完成)

**Goal:** Chat.tsx + Chat.module.css 完整重构：两列布局、纵向分屏、拖拽分隔、共用输入框、未读计数、浏览器通知。

---

## 文件改动总览

| 文件 | 操作 |
|---|---|
| `client/src/pages/Chat.module.css` | 重写布局部分，新增分屏 CSS |
| `client/src/pages/Chat.tsx` | 重写：移除右列、分屏、拖拽、allUsers、activePanel、未读、通知 |

---

## Task 5: Chat.module.css — 新布局

**Files:**
- Modify: `client/src/pages/Chat.module.css`

- [ ] **Step 1: 替换 `client/src/pages/Chat.module.css` 中的布局部分**

将文件中从 `.layout {` 到 `.private { ... }` 的全部内容替换为以下内容（保留文件顶部 `.loading`、`.loadingInner`、`.spinner`、`@keyframes spin` 不变）：

```css
.layout {
  height: 100%;
  display: grid;
  grid-template-rows: 48px 1fr;
  grid-template-columns: 200px 1fr;
  grid-template-areas:
    "header header"
    "sidebar main";
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

/* 大厅 + 私聊分屏容器 */
.mainInner {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.hallPane {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 80px;
  outline: 1px solid transparent;
  transition: outline-color var(--transition);
}

.hallPane.paneActive {
  outline-color: var(--gold);
  outline-offset: -1px;
}

.divider {
  height: 5px;
  cursor: row-resize;
  background: transparent;
  flex-shrink: 0;
  transition: background var(--transition);
}

.divider:hover,
.divider.dragging {
  background: var(--gold);
}

.privatePane {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 80px;
  border-top: 1px solid var(--border-subtle);
  outline: 1px solid transparent;
  transition: outline-color var(--transition);
}

.privatePane.paneActive {
  outline-color: var(--gold);
  outline-offset: -1px;
}

.paneHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 16px;
  font-size: 12px;
  font-family: var(--font-mono);
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border-subtle);
  flex-shrink: 0;
}

.paneCloseBtn {
  font-size: 16px;
  color: var(--text-muted);
  line-height: 1;
  transition: color var(--transition);
}

.paneCloseBtn:hover {
  color: var(--text-primary);
}

/* 输入区域：目标标签 + 输入框 */
.inputArea {
  flex-shrink: 0;
}

.panelTabs {
  display: flex;
  gap: 4px;
  padding: 6px 16px 0;
}

.tab {
  font-size: 11px;
  font-family: var(--font-mono);
  padding: 3px 10px;
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  border: 1px solid transparent;
  transition: color var(--transition), border-color var(--transition);
}

.tabActive {
  color: var(--gold);
  border-color: var(--border-gold);
}
```

- [ ] **Step 2: 确认编译**

```bash
cd client && pnpm exec tsc --noEmit 2>&1 | grep "Chat.module" || echo "CSS OK"
```

Expected: `CSS OK`

- [ ] **Step 3: 提交**

```bash
git add client/src/pages/Chat.module.css
git commit -m "refactor(client): Chat layout — 2-column grid, split pane CSS"
```

---

## Task 6: Chat.tsx — 完整重写

**Files:**
- Modify: `client/src/pages/Chat.tsx`

**前置要求：** Tasks 1-5 已全部完成。

- [ ] **Step 1: 用以下内容完整替换 `client/src/pages/Chat.tsx`**

```typescript
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, clearTokens } from '../services/api';
import type { ServerMessage, AllUser } from '../services/api';
import { wsClient } from '../services/ws';
import type { WsMessage } from '../services/ws';
import type { Message } from '../components/MessageList';
import UserList from '../components/UserList';
import MessageList from '../components/MessageList';
import MessageInput from '../components/MessageInput';
import PrivatePanel from '../components/PrivatePanel';
import styles from './Chat.module.css';

interface OnlineUser {
  id: string;
  username: string;
  nickname: string | null;
  avatar_url: string | null;
}

interface Props {
  userId: string;
  username: string;
  nickname: string | null;
  avatarUrl: string | null;
  onLogout: () => void;
}

function toMessage(m: ServerMessage): Message {
  return {
    id: m.id,
    from_id: m.senderId,
    from_username: m.senderName,
    content: m.content,
    images: m.images ?? undefined,
    timestamp: m.createdAt,
  };
}

export default function Chat({ userId, username, nickname, avatarUrl, onLogout }: Props) {
  const navigate = useNavigate();

  // 在线用户（WS 实时）
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  // 全量用户（HTTP 一次性拉取）
  const [allUsers, setAllUsers] = useState<AllUser[]>([]);

  const [hallMessages, setHallMessages] = useState<Message[]>([]);
  const [hallTyping, setHallTyping] = useState<string[]>([]);
  const [hallHasMore, setHallHasMore] = useState(false);

  const [privateMessages, setPrivateMessages] = useState<Message[]>([]);
  const [privateTyping, setPrivateTyping] = useState<string[]>([]);
  const [privateHasMore, setPrivateHasMore] = useState(false);

  const [activePeerId, setActivePeerId] = useState<string | null>(null);
  const [activePeerUsername, setActivePeerUsername] = useState('');

  // 当前输入框目标：hall 或 private
  const [activePanel, setActivePanel] = useState<'hall' | 'private'>('hall');

  // 私聊面板高度（px），可拖拽调整
  const [privatePaneHeight, setPrivatePaneHeight] = useState(300);
  const [isDragging, setIsDragging] = useState(false);

  // 每个 peer 的未读消息数
  const [unread, setUnread] = useState<Map<string, number>>(new Map());

  const usernameMap = useRef<Map<string, string>>(new Map([[userId, username]]));
  const activePeerIdRef = useRef<string | null>(null);
  const hallTypingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const privateTypingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragRef = useRef({ startY: 0, startHeight: 0 });

  useEffect(() => {
    const unsub = wsClient.on((msg: WsMessage) => {
      if (msg.type === 'online_users' && msg.users) {
        const users = msg.users as OnlineUser[];
        users.forEach(u => usernameMap.current.set(u.id, u.nickname ?? u.username));
        setOnlineUsers(users);
      } else if (msg.type === 'user_joined') {
        usernameMap.current.set(msg.userId!, msg.nickname ?? msg.username!);
        setOnlineUsers(prev => {
          if (prev.some(u => u.id === msg.userId)) return prev;
          return [...prev, {
            id: msg.userId!,
            username: msg.username!,
            nickname: msg.nickname ?? null,
            avatar_url: msg.avatar_url ?? null,
          }];
        });
        // 新用户上线时同步到全量列表（若尚未存在）
        setAllUsers(prev => {
          if (prev.some(u => u.id === msg.userId)) return prev;
          return [...prev, {
            id: msg.userId!,
            username: msg.username!,
            nickname: msg.nickname ?? null,
            avatar_url: msg.avatar_url ?? null,
          }];
        });
      } else if (msg.type === 'user_left') {
        setOnlineUsers(prev => prev.filter(u => u.id !== msg.userId));
      } else if (msg.type === 'hall_message') {
        const m = msg as any;
        setHallMessages(prev => [...prev, {
          id: m.id, from_id: m.from, from_username: m.fromName,
          content: m.content ?? '', images: m.images ?? undefined, timestamp: m.timestamp,
        }]);
      } else if (msg.type === 'private_message') {
        const m = msg as any;
        const peer = m.from === userId ? m.to : m.from;
        const isCurrentlyOpen = peer === activePeerIdRef.current;

        if (isCurrentlyOpen) {
          setPrivateMessages(prev => [...prev, {
            id: m.id, from_id: m.from,
            from_username: usernameMap.current.get(m.from) || m.from,
            content: m.content ?? '', images: m.images ?? undefined, timestamp: m.timestamp,
          }]);
        } else {
          // 未读 +1
          setUnread(prev => {
            const next = new Map(prev);
            next.set(peer, (next.get(peer) ?? 0) + 1);
            return next;
          });
        }

        // 浏览器通知
        const peerName = usernameMap.current.get(peer) || peer;
        const content = m.content || '[图片]';
        maybeNotify(peerName, content, peer, isCurrentlyOpen);
      } else if (msg.type === 'typing') {
        const m = msg as any;
        const name = usernameMap.current.get(m.from) || m.from;
        if (m.to) {
          setPrivateTyping([name]);
          if (privateTypingTimer.current) clearTimeout(privateTypingTimer.current);
          privateTypingTimer.current = setTimeout(() => setPrivateTyping([]), 2000);
        } else {
          setHallTyping([name]);
          if (hallTypingTimer.current) clearTimeout(hallTypingTimer.current);
          hallTypingTimer.current = setTimeout(() => setHallTyping([]), 2000);
        }
      }
    });

    async function init() {
      wsClient.connect();
      const [{ messages, hasMore }, { users }] = await Promise.all([
        api.getMessages('hall'),
        api.getAllUsers(),
      ]);
      setHallHasMore(hasMore);
      setHallMessages(messages.map(toMessage));
      setAllUsers(users);
    }

    init().catch(console.error);

    return () => {
      unsub();
      wsClient.disconnect();
      setOnlineUsers([]);
      setHallMessages([]);
    };
  }, [userId]);

  // 浏览器通知：仅在页面失焦或私聊面板未打开时弹出
  async function maybeNotify(
    peerName: string,
    content: string,
    peer: string,
    isCurrentlyOpen: boolean,
  ) {
    if (Notification.permission === 'default') {
      await Notification.requestPermission();
    }
    if (Notification.permission !== 'granted') return;
    const shouldNotify = !document.hasFocus() || !isCurrentlyOpen;
    if (!shouldNotify) return;
    new Notification(peerName, {
      body: content.slice(0, 80),
      icon: '/favicon.ico',
    });
  }

  // 拖拽分隔条
  function onDividerMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    dragRef.current = { startY: e.clientY, startHeight: privatePaneHeight };
    setIsDragging(true);

    function onMouseMove(ev: MouseEvent) {
      const delta = dragRef.current.startY - ev.clientY;
      setPrivatePaneHeight(h =>
        Math.max(80, Math.min(dragRef.current.startHeight + delta, window.innerHeight - 200))
      );
    }

    function onMouseUp() {
      setIsDragging(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    }

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }

  async function loadMoreHall() {
    if (!hallHasMore || hallMessages.length === 0) return;
    const before = hallMessages[0].timestamp;
    const { messages, hasMore } = await api.getMessages('hall', before);
    setHallHasMore(hasMore);
    setHallMessages(prev => [...messages.map(toMessage), ...prev]);
  }

  async function loadMorePrivate() {
    if (!privateHasMore || privateMessages.length === 0 || !activePeerIdRef.current) return;
    const chatId = [userId, activePeerIdRef.current].sort().join(':');
    const before = privateMessages[0].timestamp;
    const { messages, hasMore } = await api.getMessages(chatId, before);
    setPrivateHasMore(hasMore);
    setPrivateMessages(prev => [...messages.map(toMessage), ...prev]);
  }

  function sendHallMessage(text: string, imageUrl?: string) {
    api.sendMessage('hall', text, imageUrl ? [{ url: imageUrl }] : undefined).catch(console.error);
  }

  function sendPrivateMessage(text: string, imageUrl?: string) {
    if (!activePeerId) return;
    const chatId = [userId, activePeerId].sort().join(':');
    api.sendMessage(chatId, text, imageUrl ? [{ url: imageUrl }] : undefined, activePeerId).catch(console.error);
  }

  function handleSend(text: string, imageUrl?: string) {
    if (activePanel === 'hall') sendHallMessage(text, imageUrl);
    else sendPrivateMessage(text, imageUrl);
  }

  function sendTyping() { wsClient.send({ type: 'typing' }); }
  function sendPrivateTyping() {
    if (activePeerId) wsClient.send({ type: 'typing', to: activePeerId });
  }

  function handleTyping() {
    if (activePanel === 'hall') sendTyping();
    else sendPrivateTyping();
  }

  async function selectUser(peerId: string) {
    if (peerId === userId) return;
    const peerName = usernameMap.current.get(peerId) || peerId;
    activePeerIdRef.current = peerId;
    setActivePeerId(peerId);
    setActivePeerUsername(peerName);
    setActivePanel('private');
    // 清零该 peer 的未读计数
    setUnread(prev => {
      const next = new Map(prev);
      next.delete(peerId);
      return next;
    });
    const chatId = [userId, peerId].sort().join(':');
    const { messages, hasMore } = await api.getMessages(chatId);
    setPrivateHasMore(hasMore);
    setPrivateMessages(messages.map(toMessage));
  }

  function closePrivate() {
    activePeerIdRef.current = null;
    setActivePeerId(null);
    setActivePanel('hall');
  }

  async function handleLogout() {
    await api.logout();
    clearTokens();
    onLogout();
    navigate('/login');
  }

  const onlineUserIds = new Set(onlineUsers.map(u => u.id));
  const inputPlaceholder = activePeerId
    ? (activePanel === 'hall' ? '发言于大厅...' : `私聊 ${activePeerUsername}...`)
    : '发言于大厅...';

  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.logo}>江湖</span>
          <span className={styles.roomName}># 公共大厅</span>
        </div>
        <div className={styles.headerRight}>
          <span className={styles.username}>{nickname ?? username}</span>
          <button className={styles.inviteBtn} onClick={() => navigate('/settings')}>设置</button>
          <button className={styles.logoutBtn} onClick={handleLogout}>退出</button>
        </div>
      </header>

      <aside className={styles.sidebar}>
        <UserList
          allUsers={allUsers}
          onlineUserIds={onlineUserIds}
          currentUserId={userId}
          currentUserNickname={nickname}
          currentUserAvatarUrl={avatarUrl}
          activePrivateId={activePeerId}
          unread={unread}
          onSelectUser={selectUser}
        />
      </aside>

      <main className={styles.main}>
        <div className={styles.mainInner}>
          <div
            className={`${styles.hallPane} ${activePanel === 'hall' ? styles.paneActive : ''}`}
            onClick={() => setActivePanel('hall')}
          >
            <MessageList
              messages={hallMessages}
              currentUserId={userId}
              typingUsernames={hallTyping}
              hasMore={hallHasMore}
              onLoadMore={loadMoreHall}
            />
          </div>

          {activePeerId && (
            <>
              <div
                className={`${styles.divider} ${isDragging ? styles.dragging : ''}`}
                onMouseDown={onDividerMouseDown}
              />
              <div
                className={`${styles.privatePane} ${activePanel === 'private' ? styles.paneActive : ''}`}
                style={{ height: privatePaneHeight }}
                onClick={() => setActivePanel('private')}
              >
                <div className={styles.paneHeader}>
                  <span>私聊 · {activePeerUsername}</span>
                  <button
                    className={styles.paneCloseBtn}
                    onClick={e => { e.stopPropagation(); closePrivate(); }}
                  >×</button>
                </div>
                <PrivatePanel
                  messages={privateMessages}
                  currentUserId={userId}
                  typingUsernames={privateTyping}
                  hasMore={privateHasMore}
                  onLoadMore={loadMorePrivate}
                />
              </div>
            </>
          )}
        </div>

        <div className={styles.inputArea}>
          {activePeerId && (
            <div className={styles.panelTabs}>
              <button
                className={`${styles.tab} ${activePanel === 'hall' ? styles.tabActive : ''}`}
                onClick={() => setActivePanel('hall')}
              >大厅</button>
              <button
                className={`${styles.tab} ${activePanel === 'private' ? styles.tabActive : ''}`}
                onClick={() => setActivePanel('private')}
              >私聊 · {activePeerUsername}</button>
            </div>
          )}
          <MessageInput
            onSend={handleSend}
            onTyping={handleTyping}
            placeholder={inputPlaceholder}
          />
        </div>
      </main>
    </div>
  );
}
```

- [ ] **Step 2: 确认 TypeScript 编译无错误**

```bash
cd client && pnpm exec tsc --noEmit
```

Expected: 无错误

- [ ] **Step 3: 启动开发服务器，手动验证以下场景**

```bash
cd client && pnpm dev
```

验证清单：
1. 首次加载：只显示两列（左侧用户列表 + 右侧大厅），无私聊面板
2. 用户列表显示所有用户，离线用户置灰，在线用户排前面
3. 点击在线用户：大厅下方弹出私聊面板，输入框上方出现标签栏
4. 点击大厅区域 → 标签切到「大厅」，发送消息到大厅；点击私聊区域 → 标签切到「私聊」，发送消息到私聊
5. 拖拽分隔条可调整私聊面板高度，最小 80px
6. 点击 × 关闭私聊面板，恢复单区大厅，标签栏消失
7. 收到私聊消息时，若面板未打开，用户头像右上角出现红色未读数字
8. 打开该用户私聊后，未读数字消失
9. 页面失焦时收到私聊消息，弹出浏览器通知（首次会请求权限）

- [ ] **Step 4: 提交**

```bash
git add client/src/pages/Chat.tsx
git commit -m "feat(client): private chat split pane, shared input, unread badge, browser notifications"
```
