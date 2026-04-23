# PostgreSQL + OSS + 去加密改造 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将江湖聊天室从 SQLite + 本地加密文件存储迁移到 PostgreSQL + 阿里云 OSS，完全去除 E2EE 加密。

**Architecture:** 服务端 Express + PostgreSQL（postgres.js）存储用户、邀请码、消息；阿里云 OSS 存储图片（客户端直传）；消息明文传输，传输层安全依赖 HTTPS。

**Tech Stack:** postgres.js、阿里云 OSS PostPolicy 签名、React + CSS Modules、pnpm

---

## 文件变更总览

### 服务端

| 操作 | 文件 |
|------|------|
| 新建 | `server/src/pg.ts` |
| 新建 | `server/src/messages.ts` |
| 新建 | `server/src/oss.ts` |
| 重写 | `server/src/auth.ts` |
| 重写 | `server/src/invite.ts` |
| 重写 | `server/src/ws.ts` |
| 更新 | `server/src/index.ts` |
| 删除 | `server/src/db.ts` |
| 删除 | `server/src/pubkey.ts` |
| 删除 | `server/src/upload.ts` |
| 删除 | `server/src/cleanup.ts` |

### 客户端

| 操作 | 文件 |
|------|------|
| 重写 | `client/src/pages/Chat.tsx` |
| 重写 | `client/src/components/MessageList.tsx` |
| 重写 | `client/src/components/MessageInput.tsx` |
| 重写 | `client/src/components/PrivatePanel.tsx` |
| 更新 | `client/src/services/api.ts` |
| 删除 | `client/src/services/crypto.ts` |
| 删除 | `client/src/services/localDb.ts` |
| 删除 | `client/src/services/imageUtils.ts` |

---

## 阶段一：SQLite → PostgreSQL

### Task 1：安装 postgres.js，创建 src/pg.ts

**Files:**
- Create: `server/src/pg.ts`
- Modify: `server/package.json`

- [ ] **Step 1：安装 postgres.js**

```bash
cd server && pnpm add postgres
```

- [ ] **Step 2：创建 server/src/pg.ts**

```typescript
import postgres from 'postgres';

const sql = postgres(
  process.env.NODE_ENV === 'test'
    ? 'postgresql://gods:gods123@localhost:5433/gods_team_dev'
    : (process.env.DATABASE_URL ?? 'postgresql://gods:gods123@localhost:5433/gods_team_dev')
);

export async function initDb() {
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id          TEXT PRIMARY KEY,
      username    TEXT UNIQUE NOT NULL,
      password    TEXT NOT NULL,
      is_admin    BOOLEAN DEFAULT FALSE,
      created_at  BIGINT NOT NULL
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS invite_codes (
      code        TEXT PRIMARY KEY,
      created_by  TEXT REFERENCES users(id),
      used_by     TEXT REFERENCES users(id),
      created_at  BIGINT NOT NULL,
      used_at     BIGINT
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS messages (
      id          TEXT PRIMARY KEY,
      chat_id     TEXT NOT NULL,
      sender_id   TEXT REFERENCES users(id),
      sender_name TEXT NOT NULL,
      content     TEXT,
      images      JSONB,
      created_at  BIGINT NOT NULL
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_messages_chat
      ON messages(chat_id, created_at DESC)
  `;
  await sql`
    INSERT INTO invite_codes (code, created_by, created_at)
    VALUES ('ADMIN0001', NULL, 0)
    ON CONFLICT DO NOTHING
  `;
}

export default sql;
```

- [ ] **Step 3：验证类型检查通过**

```bash
cd server && npx tsc --noEmit
```

Expected: 无输出（无错误）

- [ ] **Step 4：提交**

```bash
git add server/src/pg.ts server/package.json server/pnpm-lock.yaml
git commit -m "feat(server): add postgres.js connection and schema init"
```

---

### Task 2：重写 server/src/auth.ts

**Files:**
- Modify: `server/src/auth.ts`

- [ ] **Step 1：完整替换 server/src/auth.ts**

```typescript
import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import bcrypt from 'bcrypt';
import sql from './pg';
import { signToken, requireAuth, AuthRequest } from './middleware/auth';

const router = Router();

router.post('/register', async (req: Request, res: Response) => {
  const { username, password, invite_code } = req.body as {
    username?: string;
    password?: string;
    invite_code?: string;
  };

  if (!username || !password || !invite_code) {
    res.status(400).json({ error: 'username, password, invite_code required' });
    return;
  }

  const [code] = await sql<{ code: string; used_by: string | null }[]>`
    SELECT code, used_by FROM invite_codes WHERE code = ${invite_code}
  `;
  if (!code || code.used_by !== null) {
    res.status(400).json({ error: 'Invalid or already used invite code' });
    return;
  }

  const [existing] = await sql`SELECT id FROM users WHERE username = ${username}`;
  if (existing) {
    res.status(400).json({ error: 'Username already taken' });
    return;
  }

  const hash = await bcrypt.hash(password, 12);
  const userId = randomUUID();
  const now = Date.now();

  await sql.begin(async (tx) => {
    await tx`
      INSERT INTO users (id, username, password, is_admin, created_at)
      VALUES (${userId}, ${username}, ${hash}, FALSE, ${now})
    `;
    await tx`
      UPDATE invite_codes SET used_by = ${userId}, used_at = ${now}
      WHERE code = ${invite_code}
    `;
  });

  const token = signToken(userId, username);
  res.cookie('token', token, { httpOnly: true, sameSite: 'strict', maxAge: 7 * 24 * 3600 * 1000 });
  res.json({ userId, username });
});

router.post('/login', async (req: Request, res: Response) => {
  const { username, password } = req.body as { username?: string; password?: string };

  if (!username || !password) {
    res.status(400).json({ error: 'username and password required' });
    return;
  }

  const [user] = await sql<{ id: string; username: string; password: string }[]>`
    SELECT id, username, password FROM users WHERE username = ${username}
  `;
  if (!user || !(await bcrypt.compare(password, user.password))) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const token = signToken(user.id, user.username);
  res.cookie('token', token, { httpOnly: true, sameSite: 'strict', maxAge: 7 * 24 * 3600 * 1000 });
  res.json({ userId: user.id, username: user.username });
});

router.post('/logout', (_req, res: Response) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req: AuthRequest, res: Response) => {
  res.json({ userId: req.userId, username: req.username });
});

router.get('/token', requireAuth, (req: AuthRequest, res: Response) => {
  const token = signToken(req.userId!, req.username!);
  res.json({ token });
});

export default router;
```

- [ ] **Step 2：类型检查**

```bash
cd server && npx tsc --noEmit
```

Expected: 无输出

- [ ] **Step 3：提交**

```bash
git add server/src/auth.ts
git commit -m "feat(server): migrate auth routes to postgres"
```

---

### Task 3：重写 server/src/invite.ts

**Files:**
- Modify: `server/src/invite.ts`

- [ ] **Step 1：完整替换 server/src/invite.ts**

```typescript
import { Router, Response } from 'express';
import { randomBytes } from 'crypto';
import sql from './pg';
import { requireAuth, AuthRequest } from './middleware/auth';

const router = Router();

router.post('/generate', requireAuth, async (req: AuthRequest, res: Response) => {
  const code = randomBytes(4).toString('hex').toUpperCase();
  const now = Date.now();

  await sql`
    INSERT INTO invite_codes (code, created_by, created_at)
    VALUES (${code}, ${req.userId!}, ${now})
  `;

  res.json({ code });
});

router.get('/mine', requireAuth, async (req: AuthRequest, res: Response) => {
  const codes = await sql<{
    code: string;
    created_at: number;
    used_by: string | null;
    used_at: number | null;
  }[]>`
    SELECT code, created_at, used_by, used_at
    FROM invite_codes
    WHERE created_by = ${req.userId!}
    ORDER BY created_at DESC
  `;

  res.json({ codes });
});

export default router;
```

- [ ] **Step 2：类型检查**

```bash
cd server && npx tsc --noEmit
```

- [ ] **Step 3：提交**

```bash
git add server/src/invite.ts
git commit -m "feat(server): migrate invite routes to postgres"
```

---

### Task 4：更新 server/src/index.ts，删除 SQLite 文件，验证阶段一

**Files:**
- Modify: `server/src/index.ts`
- Delete: `server/src/db.ts`, `server/src/pubkey.ts`, `server/src/upload.ts`, `server/src/cleanup.ts`

- [ ] **Step 1：完整替换 server/src/index.ts**

```typescript
import express from 'express';
import cors from 'cors';
import http from 'http';
import path from 'path';
import cookieParser from 'cookie-parser';
import { initDb } from './pg';
import authRouter from './auth';
import inviteRouter from './invite';
import { setupWebSocket } from './ws';

const app = express();
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? false
    : (process.env.CORS_ORIGIN || 'http://localhost:5173'),
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

app.use('/api/auth', authRouter);
app.use('/api/invite', inviteRouter);
app.get('/api/health', (_req, res) => res.json({ ok: true }));

if (process.env.NODE_ENV === 'production') {
  const clientDist = '/app/client/dist';
  app.use(express.static(clientDist));
  app.use((_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

const server = http.createServer(app);
setupWebSocket(server);

if (process.env.NODE_ENV !== 'test') {
  (async () => {
    await initDb();
    const port = Number(process.env.PORT) || 3000;
    server.listen(port, () => {
      console.log(`Server running on http://localhost:${port}`);
    });
  })();
}

export { app, server };
```

- [ ] **Step 2：删除 SQLite 相关文件**

```bash
rm server/src/db.ts server/src/pubkey.ts server/src/upload.ts server/src/cleanup.ts
```

- [ ] **Step 3：卸载 better-sqlite3**

```bash
cd server && pnpm remove better-sqlite3 @types/better-sqlite3
```

- [ ] **Step 4：类型检查**

```bash
cd server && npx tsc --noEmit
```

- [ ] **Step 5：启动开发服务器验证**

```bash
cd server && DATABASE_URL=postgresql://gods:gods123@localhost:5433/gods_team_dev pnpm dev
```

Expected: `Server running on http://localhost:3000`，无报错

- [ ] **Step 6：测试登录注册**

```bash
# 注册
curl -s -c /tmp/jar -X POST http://localhost:3000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"username":"test01","password":"test123","invite_code":"ADMIN0001"}'
# Expected: {"userId":"...","username":"test01"}

# 登录
curl -s -c /tmp/jar -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"test01","password":"test123"}'
# Expected: {"userId":"...","username":"test01"}
```

- [ ] **Step 7：提交**

```bash
git add server/src/index.ts server/package.json server/pnpm-lock.yaml
git commit -m "feat(server): complete phase 1 - replace sqlite with postgres"
```

---

## 阶段二：去除 E2EE 加密

### Task 5：重写 server/src/ws.ts

**Files:**
- Modify: `server/src/ws.ts`

- [ ] **Step 1：完整替换 server/src/ws.ts**

```typescript
import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';
import type { Server } from 'http';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import sql from './pg';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-prod';

interface Client {
  ws: WebSocket;
  userId: string;
  username: string;
}

const clients = new Map<string, Client>();

function broadcast(data: object, excludeUserId?: string) {
  const msg = JSON.stringify(data);
  for (const [uid, client] of clients) {
    if (uid !== excludeUserId && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(msg);
    }
  }
}

function send(userId: string, data: object) {
  const client = clients.get(userId);
  if (client && client.ws.readyState === WebSocket.OPEN) {
    client.ws.send(JSON.stringify(data));
  }
}

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const url = new URL(req.url || '', 'http://localhost');
    const token = url.searchParams.get('token');

    if (!token) { ws.close(4001, 'Token required'); return; }

    let userId: string, username: string;
    try {
      const payload = jwt.verify(token, JWT_SECRET) as { userId: string; username: string };
      userId = payload.userId;
      username = payload.username;
    } catch {
      ws.close(4001, 'Invalid token');
      return;
    }

    clients.set(userId, { ws, userId, username });

    const onlineUsers = Array.from(clients.values()).map(c => ({ id: c.userId, username: c.username }));
    ws.send(JSON.stringify({ type: 'online_users', users: onlineUsers }));
    broadcast({ type: 'user_joined', userId, username }, userId);

    ws.on('message', async (raw) => {
      let msg: { type: string; content?: string; images?: { url: string }[]; to?: string };
      try { msg = JSON.parse(raw.toString()); } catch { return; }

      if (msg.type === 'hall_message') {
        const id = randomUUID();
        const timestamp = Date.now();
        const content = msg.content ?? null;
        const images = msg.images ?? null;

        await sql`
          INSERT INTO messages (id, chat_id, sender_id, sender_name, content, images, created_at)
          VALUES (${id}, 'hall', ${userId}, ${username}, ${content}, ${images ? sql.json(images) : null}, ${timestamp})
        `;

        broadcast({ type: 'hall_message', id, from: userId, fromName: username, content, images, timestamp });

      } else if (msg.type === 'private_message') {
        const to = msg.to;
        if (!to) return;

        const id = randomUUID();
        const timestamp = Date.now();
        const content = msg.content ?? null;
        const images = msg.images ?? null;
        const chatId = [userId, to].sort().join(':');

        await sql`
          INSERT INTO messages (id, chat_id, sender_id, sender_name, content, images, created_at)
          VALUES (${id}, ${chatId}, ${userId}, ${username}, ${content}, ${images ? sql.json(images) : null}, ${timestamp})
        `;

        const outMsg = { type: 'private_message', id, from: userId, fromName: username, to, content, images, timestamp };
        send(to, outMsg);
        send(userId, outMsg);

      } else if (msg.type === 'typing') {
        const to = msg.to;
        if (to) {
          send(to, { type: 'typing', from: userId });
        } else {
          broadcast({ type: 'typing', from: userId }, userId);
        }
      }
    });

    ws.on('close', () => {
      clients.delete(userId);
      broadcast({ type: 'user_left', userId, username });
    });
  });
}
```

- [ ] **Step 2：类型检查**

```bash
cd server && npx tsc --noEmit
```

- [ ] **Step 3：提交**

```bash
git add server/src/ws.ts
git commit -m "feat(server): store messages in postgres, remove E2EE ws types"
```

---

### Task 6：创建 server/src/messages.ts，更新 index.ts

**Files:**
- Create: `server/src/messages.ts`
- Modify: `server/src/index.ts`

- [ ] **Step 1：创建 server/src/messages.ts**

```typescript
import { Router } from 'express';
import { requireAuth } from './middleware/auth';
import type { AuthRequest } from './middleware/auth';
import sql from './pg';

const router = Router();

router.get('/:chatId', requireAuth, async (req: AuthRequest, res) => {
  const { chatId } = req.params;
  const before = req.query.before ? Number(req.query.before) : Date.now() + 1;
  const limit = 50;

  const rows = await sql<{
    id: string;
    sender_id: string;
    sender_name: string;
    content: string | null;
    images: { url: string }[] | null;
    created_at: number;
  }[]>`
    SELECT id, sender_id, sender_name, content, images, created_at
    FROM messages
    WHERE chat_id = ${chatId}
      AND created_at < ${before}
    ORDER BY created_at DESC
    LIMIT ${limit + 1}
  `;

  const hasMore = rows.length > limit;
  const messages = rows.slice(0, limit).reverse().map(r => ({
    id: r.id,
    senderId: r.sender_id,
    senderName: r.sender_name,
    content: r.content ?? '',
    images: r.images,
    createdAt: Number(r.created_at),
  }));

  res.json({ messages, hasMore });
});

export default router;
```

- [ ] **Step 2：在 server/src/index.ts 中加入 messages 路由**

在 `app.use('/api/invite', inviteRouter);` 后添加：

```typescript
import messagesRouter from './messages';
// ...
app.use('/api/messages', messagesRouter);
```

- [ ] **Step 3：类型检查**

```bash
cd server && npx tsc --noEmit
```

- [ ] **Step 4：提交**

```bash
git add server/src/messages.ts server/src/index.ts
git commit -m "feat(server): add message history REST API"
```

---

### Task 7：更新 client/src/services/api.ts

**Files:**
- Modify: `client/src/services/api.ts`

- [ ] **Step 1：完整替换 client/src/services/api.ts**

```typescript
const BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data as T;
}

export interface User {
  userId: string;
  username: string;
}

export interface ServerMessage {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  images: { url: string }[] | null;
  createdAt: number;
}

export const api = {
  register(username: string, password: string, invite_code: string) {
    return request<User>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password, invite_code }),
    });
  },

  login(username: string, password: string) {
    return request<User>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  },

  logout() {
    return request<{ ok: boolean }>('/auth/logout', { method: 'POST' });
  },

  me() {
    return request<User>('/auth/me');
  },

  getToken() {
    return request<{ token: string }>('/auth/token');
  },

  generateInvite() {
    return request<{ code: string }>('/invite/generate', { method: 'POST' });
  },

  myInvites() {
    return request<{
      codes: Array<{
        code: string;
        created_at: number;
        used_by: string | null;
        used_at: number | null;
      }>;
    }>('/invite/mine');
  },

  getMessages(chatId: string, before?: number): Promise<{ messages: ServerMessage[]; hasMore: boolean }> {
    const qs = before ? `?before=${before}` : '';
    return request(`/messages/${encodeURIComponent(chatId)}${qs}`);
  },

  getOssSign(): Promise<{ url: string; fields: Record<string, string> }> {
    return request('/oss/sign');
  },
};
```

- [ ] **Step 2：类型检查**

```bash
cd client && npx tsc --noEmit
```

- [ ] **Step 3：提交**

```bash
git add client/src/services/api.ts
git commit -m "feat(client): update api.ts - add getMessages/getOssSign, remove E2EE methods"
```

---

### Task 8：重写 MessageList.tsx

**Files:**
- Modify: `client/src/components/MessageList.tsx`

- [ ] **Step 1：完整替换 client/src/components/MessageList.tsx**

```tsx
import { useEffect, useRef, useState } from 'react';
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
```

- [ ] **Step 2：在 MessageList.module.css 末尾添加 loadMore 样式**

```css
.loadMore {
  text-align: center;
  padding: 8px;
  color: var(--text-muted);
  font-size: 13px;
  cursor: pointer;
}

.loadMore:hover {
  color: var(--gold);
}
```

- [ ] **Step 3：类型检查**

```bash
cd client && npx tsc --noEmit
```

- [ ] **Step 4：提交**

```bash
git add client/src/components/MessageList.tsx client/src/components/MessageList.module.css
git commit -m "feat(client): simplify MessageList - remove E2EE, add pagination, OSS image URLs"
```

---

### Task 9：重写 PrivatePanel.tsx 和 MessageInput.tsx

**Files:**
- Modify: `client/src/components/PrivatePanel.tsx`
- Modify: `client/src/components/MessageInput.tsx`

- [ ] **Step 1：完整替换 client/src/components/PrivatePanel.tsx**

```tsx
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
```

- [ ] **Step 2：更新 MessageInput.tsx 的 onSend 签名**

将 `client/src/components/MessageInput.tsx` 中的 Props interface 改为：

```typescript
interface Props {
  onSend: (text: string, imageUrl?: string) => void;
  onTyping: () => void;
  disabled?: boolean;
  placeholder?: string;
}
```

将 `submit` 函数改为：

```typescript
function submit() {
  const trimmed = text.trim();
  if ((!trimmed && !pendingImageUrl) || disabled) return;
  onSend(trimmed, pendingImageUrl || undefined);
  setText('');
  removeImage();
  if (textareaRef.current) textareaRef.current.style.height = 'auto';
}
```

将 state 中的 `pendingFile` 改为 `pendingImageUrl`（暂时置空，Phase 3 实现 OSS 上传）：

```typescript
const [pendingImageUrl, setPendingImageUrl] = useState<string | null>(null);
const [preview, setPreview] = useState<string | null>(null);

function addImage(file: File) {
  if (preview) URL.revokeObjectURL(preview);
  // OSS 上传在 Phase 3 实现，暂存本地预览
  setPendingImageUrl(null);
  setPreview(URL.createObjectURL(file));
}

function removeImage() {
  if (preview) URL.revokeObjectURL(preview);
  setPendingImageUrl(null);
  setPreview(null);
}
```

发送按钮 disabled 条件：

```tsx
<button className={styles.send} onClick={submit} disabled={disabled || (!text.trim() && !pendingImageUrl)}>
  发送
</button>
```

- [ ] **Step 3：类型检查**

```bash
cd client && npx tsc --noEmit
```

- [ ] **Step 4：提交**

```bash
git add client/src/components/PrivatePanel.tsx client/src/components/MessageInput.tsx
git commit -m "feat(client): update PrivatePanel and MessageInput for no-E2EE"
```

---

### Task 10：重写 client/src/pages/Chat.tsx

**Files:**
- Modify: `client/src/pages/Chat.tsx`

- [ ] **Step 1：完整替换 client/src/pages/Chat.tsx**

```tsx
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import type { ServerMessage } from '../services/api';
import { wsClient } from '../services/ws';
import type { WsMessage } from '../services/ws';
import type { Message } from '../components/MessageList';
import UserList from '../components/UserList';
import MessageList from '../components/MessageList';
import MessageInput from '../components/MessageInput';
import PrivatePanel from '../components/PrivatePanel';
import styles from './Chat.module.css';

interface OnlineUser { id: string; username: string; }

interface Props {
  userId: string;
  username: string;
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

export default function Chat({ userId, username, onLogout }: Props) {
  const navigate = useNavigate();
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [hallMessages, setHallMessages] = useState<Message[]>([]);
  const [hallTyping, setHallTyping] = useState<string[]>([]);
  const [hallHasMore, setHallHasMore] = useState(false);
  const [privateMessages, setPrivateMessages] = useState<Message[]>([]);
  const [privateTyping, setPrivateTyping] = useState<string[]>([]);
  const [privateHasMore, setPrivateHasMore] = useState(false);
  const [activePeerId, setActivePeerId] = useState<string | null>(null);
  const [activePeerUsername, setActivePeerUsername] = useState('');

  const usernameMap = useRef<Map<string, string>>(new Map([[userId, username]]));
  const activePeerIdRef = useRef<string | null>(null);
  const hallTypingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const privateTypingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const unsub = wsClient.on((msg: WsMessage) => {
      if (msg.type === 'online_users' && msg.users) {
        const users = msg.users as OnlineUser[];
        users.forEach(u => usernameMap.current.set(u.id, u.username));
        setOnlineUsers(users);
      } else if (msg.type === 'user_joined') {
        usernameMap.current.set(msg.userId!, msg.username!);
        setOnlineUsers(prev => {
          if (prev.some(u => u.id === msg.userId)) return prev;
          return [...prev, { id: msg.userId!, username: msg.username! }];
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
        if (peer === activePeerIdRef.current) {
          setPrivateMessages(prev => [...prev, {
            id: m.id, from_id: m.from,
            from_username: usernameMap.current.get(m.from) || m.from,
            content: m.content ?? '', images: m.images ?? undefined, timestamp: m.timestamp,
          }]);
        }
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
      const { token } = await api.getToken();
      wsClient.connect(token);
      const { messages, hasMore } = await api.getMessages('hall');
      setHallHasMore(hasMore);
      setHallMessages(messages.map(toMessage));
    }

    init().catch(console.error);

    return () => {
      unsub();
      wsClient.disconnect();
      setOnlineUsers([]);
      setHallMessages([]);
    };
  }, [userId]);

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
    wsClient.send({
      type: 'hall_message',
      content: text,
      images: imageUrl ? [{ url: imageUrl }] : undefined,
    });
  }

  function sendPrivateMessage(text: string, imageUrl?: string) {
    if (!activePeerId) return;
    wsClient.send({
      type: 'private_message',
      to: activePeerId,
      content: text,
      images: imageUrl ? [{ url: imageUrl }] : undefined,
    });
  }

  function sendTyping() { wsClient.send({ type: 'typing' }); }
  function sendPrivateTyping() {
    if (activePeerId) wsClient.send({ type: 'typing', to: activePeerId });
  }

  async function selectUser(peerId: string) {
    if (peerId === userId) return;
    const peerName = usernameMap.current.get(peerId) || peerId;
    activePeerIdRef.current = peerId;
    setActivePeerId(peerId);
    setActivePeerUsername(peerName);
    const chatId = [userId, peerId].sort().join(':');
    const { messages, hasMore } = await api.getMessages(chatId);
    setPrivateHasMore(hasMore);
    setPrivateMessages(messages.map(toMessage));
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
          <span className={styles.username}>{username}</span>
          <button className={styles.inviteBtn} onClick={() => navigate('/settings')}>邀请码</button>
          <button className={styles.logoutBtn} onClick={handleLogout}>退出</button>
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
          hasMore={hallHasMore}
          onLoadMore={loadMoreHall}
        />
        <MessageInput
          onSend={sendHallMessage}
          onTyping={sendTyping}
          placeholder="发言于大厅..."
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
          onClose={() => { activePeerIdRef.current = null; setActivePeerId(null); }}
          hasMore={privateHasMore}
          onLoadMore={loadMorePrivate}
        />
      </aside>
    </div>
  );
}
```

- [ ] **Step 2：类型检查**

```bash
cd client && npx tsc --noEmit
```

- [ ] **Step 3：删除 E2EE 文件**

```bash
rm client/src/services/crypto.ts client/src/services/localDb.ts client/src/services/imageUtils.ts
```

- [ ] **Step 4：再次类型检查确认无残留引用**

```bash
cd client && npx tsc --noEmit
```

- [ ] **Step 5：提交**

```bash
git add client/src/pages/Chat.tsx client/src/services/
git commit -m "feat(client): rewrite Chat.tsx - remove E2EE, add message history"
```

---

### Task 11：验证阶段二

- [ ] **Step 1：启动服务端**

```bash
cd server && DATABASE_URL=postgresql://gods:gods123@localhost:5433/gods_team_dev pnpm dev
```

- [ ] **Step 2：启动客户端**

```bash
cd client && pnpm dev
```

- [ ] **Step 3：浏览器验证**

打开 http://localhost:5173，验证：
- 登录成功后直接进入聊天室（无"建立加密连接"等待）
- 大厅发消息正常显示
- 刷新页面后历史消息仍然存在（从数据库加载）
- 私聊发消息正常，历史记录正常

- [ ] **Step 4：提交**

```bash
git add -A
git commit -m "feat: phase 2 complete - remove E2EE, postgres messages, history API"
```

---

## 阶段三：图片上传切换到阿里云 OSS

### Task 12：创建 server/src/oss.ts，更新 index.ts

**Files:**
- Create: `server/src/oss.ts`
- Modify: `server/src/index.ts`

- [ ] **Step 1：创建 server/src/oss.ts**

```typescript
import { Router } from 'express';
import crypto from 'crypto';
import { requireAuth } from './middleware/auth';
import type { AuthRequest } from './middleware/auth';

const router = Router();

router.get('/sign', requireAuth, (_req: AuthRequest, res) => {
  const bucket = process.env.OSS_BUCKET!;
  const endpoint = process.env.OSS_ENDPOINT!;
  const accessKeyId = process.env.OSS_ACCESS_KEY_ID!;
  const accessKeySecret = process.env.OSS_ACCESS_KEY_SECRET!;
  const dirPrefix = process.env.OSS_DIR_PREFIX || 'gods-team-dev';

  const expiration = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  const key = `${dirPrefix}/${crypto.randomUUID()}`;

  const policy = {
    expiration,
    conditions: [
      ['content-length-range', 0, 50 * 1024 * 1024],
      ['starts-with', '$key', dirPrefix],
    ],
  };

  const policyBase64 = Buffer.from(JSON.stringify(policy)).toString('base64');
  const signature = crypto
    .createHmac('sha1', accessKeySecret)
    .update(policyBase64)
    .digest('base64');

  res.json({
    url: `https://${bucket}.${endpoint}`,
    fields: {
      key,
      policy: policyBase64,
      OSSAccessKeyId: accessKeyId,
      signature,
    },
  });
});

export default router;
```

- [ ] **Step 2：在 server/src/index.ts 中加入 oss 路由，删除 /files 静态路由**

```typescript
import ossRouter from './oss';
// ...
app.use('/api/oss', ossRouter);
// 删除：app.use('/files', express.static(FILES_DIR));
```

- [ ] **Step 3：类型检查**

```bash
cd server && npx tsc --noEmit
```

- [ ] **Step 4：提交**

```bash
git add server/src/oss.ts server/src/index.ts
git commit -m "feat(server): add OSS signature endpoint"
```

---

### Task 13：更新 MessageInput.tsx 实现 OSS 直传

**Files:**
- Modify: `client/src/components/MessageInput.tsx`

- [ ] **Step 1：完整替换 client/src/components/MessageInput.tsx**

```tsx
import { useState, useRef } from 'react';
import type { KeyboardEvent, ChangeEvent, ClipboardEvent } from 'react';
import { Paperclip, X } from 'lucide-react';
import { api } from '../services/api';
import styles from './MessageInput.module.css';

interface Props {
  onSend: (text: string, imageUrl?: string) => void;
  onTyping: () => void;
  disabled?: boolean;
  placeholder?: string;
}

export default function MessageInput({ onSend, onTyping, disabled, placeholder }: Props) {
  const [text, setText] = useState('');
  const [pendingImageUrl, setPendingImageUrl] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const composing = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function autoResize() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }

  function handleChange(e: ChangeEvent<HTMLTextAreaElement>) {
    setText(e.target.value);
    autoResize();
    onTyping();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !composing.current) {
      e.preventDefault();
      submit();
    }
  }

  function handlePaste(e: ClipboardEvent<HTMLTextAreaElement>) {
    for (const item of e.clipboardData.items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) uploadImage(file);
        break;
      }
    }
  }

  function handleFileSelect(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadImage(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function uploadImage(file: File) {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(file));
    setPendingImageUrl(null);
    setUploading(true);
    try {
      const { url, fields } = await api.getOssSign();
      const form = new FormData();
      Object.entries(fields).forEach(([k, v]) => form.append(k, v));
      form.append('file', file);
      const ossRes = await fetch(url, { method: 'POST', body: form });
      if (!ossRes.ok) throw new Error('OSS 上传失败');
      setPendingImageUrl(`${url}/${fields.key}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : '上传失败');
      removeImage();
    } finally {
      setUploading(false);
    }
  }

  function removeImage() {
    if (preview) URL.revokeObjectURL(preview);
    setPendingImageUrl(null);
    setPreview(null);
  }

  function submit() {
    const trimmed = text.trim();
    if ((!trimmed && !pendingImageUrl) || disabled || uploading) return;
    onSend(trimmed, pendingImageUrl || undefined);
    setText('');
    removeImage();
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  }

  return (
    <div className={styles.container}>
      {preview && (
        <div className={styles.preview}>
          <img src={preview} alt="preview" className={styles.previewImg} />
          {uploading && <div className={styles.uploadingOverlay}>上传中...</div>}
          <button className={styles.removeBtn} onClick={removeImage}><X size={10} strokeWidth={3} /></button>
        </div>
      )}
      <div className={styles.row}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className={styles.fileInput}
          onChange={handleFileSelect}
        />
        <button
          className={styles.attachBtn}
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || uploading}
          title="发送图片"
        >
          <Paperclip size={16} />
        </button>
        <textarea
          ref={textareaRef}
          className={styles.input}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onCompositionStart={() => { composing.current = true; }}
          onCompositionEnd={() => { composing.current = false; }}
          placeholder={placeholder || '输入消息，Enter 发送，Shift+Enter 换行'}
          disabled={disabled}
          rows={1}
        />
        <button
          className={styles.send}
          onClick={submit}
          disabled={disabled || uploading || (!text.trim() && !pendingImageUrl)}
        >
          发送
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2：在 MessageInput.module.css 添加 uploadingOverlay 样式**

```css
.uploadingOverlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  color: white;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
}
```

- [ ] **Step 3：类型检查**

```bash
cd client && npx tsc --noEmit
```

- [ ] **Step 4：提交**

```bash
git add client/src/components/MessageInput.tsx client/src/components/MessageInput.module.css
git commit -m "feat(client): implement OSS direct upload in MessageInput"
```

---

### Task 14：更新 docker-compose.yml，删除 imageUtils，最终验证

**Files:**
- Modify: `docker-compose.yml`
- Modify: `Dockerfile`

- [ ] **Step 1：更新 docker-compose.yml**

```yaml
services:
  gods-team:
    build: .
    container_name: gods-team
    restart: unless-stopped
    ports:
      - "3000:3000"
    volumes:
      - gods-team-data:/app/data
    networks:
      - gods-net
    environment:
      - NODE_ENV=production
      - JWT_SECRET=${JWT_SECRET:-change-me-in-prod}
      - DATABASE_URL=postgresql://gods:gods123@gods-team-db:5432/gods_team_prod
      - OSS_ENDPOINT=oss-cn-beijing.aliyuncs.com
      - OSS_BUCKET=gdsw-ai-web-chat
      - OSS_ACCESS_KEY_ID=${OSS_ACCESS_KEY_ID}
      - OSS_ACCESS_KEY_SECRET=${OSS_ACCESS_KEY_SECRET}
      - OSS_DIR_PREFIX=gods-team-prod

networks:
  gods-net:
    name: gods-net

volumes:
  gods-team-data:
```

- [ ] **Step 2：将 gods-team-db 容器加入同一网络**

```bash
docker network create gods-net 2>/dev/null || true
docker network connect gods-net gods-team-db
```

- [ ] **Step 3：删除 imageUtils.ts**

```bash
rm client/src/services/imageUtils.ts
```

- [ ] **Step 4：类型检查**

```bash
cd client && npx tsc --noEmit && cd ../server && npx tsc --noEmit
```

- [ ] **Step 5：本地验证图片上传**

启动服务：
```bash
# 服务端（需要设置 OSS 环境变量）
cd server && \
  DATABASE_URL=postgresql://gods:gods123@localhost:5433/gods_team_dev \
  OSS_ENDPOINT=oss-cn-beijing.aliyuncs.com \
  OSS_BUCKET=gdsw-ai-web-chat \
  OSS_ACCESS_KEY_ID=<your_key> \
  OSS_ACCESS_KEY_SECRET=<your_secret> \
  OSS_DIR_PREFIX=gods-team-dev \
  pnpm dev
```

验证：
- 在聊天室点击 Paperclip 选择图片
- 图片上传期间预览显示"上传中..."
- 上传完成后可正常发送，消息气泡中显示图片缩略图
- 点击图片显示灯箱大图

- [ ] **Step 6：提交所有变更**

```bash
git add docker-compose.yml Dockerfile client/src/services/
git commit -m "feat: phase 3 complete - OSS image upload"
```

---

### Task 15：生产部署

- [ ] **Step 1：推送到远程**

```bash
git push origin fix/misc
```

- [ ] **Step 2：重新部署**

```bash
docker compose up -d --build
```

- [ ] **Step 3：验证生产环境**

访问 https://gods-team.tangyuan.art，验证：
- 登录正常
- 发消息正常，刷新后历史记录保留
- 发图片正常，图片存储在 OSS `gods-team-prod/` 目录下
