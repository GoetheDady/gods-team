### Task 3：更新 /me 返回值、WS 事件、发消息时用 nickname

**Files:**
- Modify: `server/src/auth.ts`
- Modify: `server/src/ws.ts`
- Modify: `server/src/messages.ts`

---

#### Step 1：修改 `server/src/auth.ts` — `/me` 返回 nickname + avatar_url

将 `GET /me` handler 从：
```typescript
router.get('/me', requireAuth, (req: AuthRequest, res: Response) => {
  res.json({ userId: req.userId, username: req.username });
});
```

改为（从 DB 查当前用户的 nickname 和 avatar_url）：
```typescript
router.get('/me', requireAuth, async (req: AuthRequest, res: Response) => {
  const [user] = await sql<{ nickname: string | null; avatar_url: string | null }[]>`
    SELECT nickname, avatar_url FROM users WHERE id = ${req.userId!}
  `;
  res.json({
    userId: req.userId,
    username: req.username,
    nickname: user?.nickname ?? null,
    avatar_url: user?.avatar_url ?? null,
  });
});
```

- [ ] 完成上述修改。

---

#### Step 2：修改 `server/src/ws.ts` — auth 鉴权后从 DB 读 nickname/avatar_url，WS 事件携带这两个字段

当前 `Client` 接口只有 `ws / userId / username`，需要扩展：

```typescript
interface Client {
  ws: WebSocket;
  userId: string;
  username: string;
  nickname: string | null;
  avatarUrl: string | null;
}
```

在 auth 消息处理的 JWT 验证通过后，原来直接 `clients.set`，现在先查 DB 拿 profile：

```typescript
// 将：
authenticated = true;
clients.set(userId, { ws, userId, username });
const onlineUsers = Array.from(clients.values()).map(c => ({ id: c.userId, username: c.username }));
ws.send(JSON.stringify({ type: 'online_users', users: onlineUsers }));
wsBroadcast({ type: 'user_joined', userId, username }, userId);

// 改为：
const [profile] = await sql<{ nickname: string | null; avatar_url: string | null }[]>`
  SELECT nickname, avatar_url FROM users WHERE id = ${userId}
`;
const nickname = profile?.nickname ?? null;
const avatarUrl = profile?.avatar_url ?? null;

authenticated = true;
clients.set(userId, { ws, userId, username, nickname, avatarUrl });

const onlineUsers = Array.from(clients.values()).map(c => ({
  id: c.userId,
  username: c.username,
  nickname: c.nickname,
  avatar_url: c.avatarUrl,
}));
ws.send(JSON.stringify({ type: 'online_users', users: onlineUsers }));
wsBroadcast({ type: 'user_joined', userId, username, nickname, avatar_url: avatarUrl }, userId);
```

同时需要在文件顶部 import sql：
```typescript
import sql from './pg';
```

完整替换后的 `server/src/ws.ts`：

```typescript
import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';
import type { Server } from 'http';
import jwt from 'jsonwebtoken';
import sql from './pg';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-prod';

interface Client {
  ws: WebSocket;
  userId: string;
  username: string;
  nickname: string | null;
  avatarUrl: string | null;
}

// 所有已连接的客户端，key 为 userId
// 同一用户重连时会覆盖旧的 ws 引用
const clients = new Map<string, Client>();

// 广播消息给所有在线用户（可排除发送者）
export function wsBroadcast(data: object, excludeUserId?: string) {
  const msg = JSON.stringify(data);
  for (const [uid, client] of clients) {
    if (uid !== excludeUserId && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(msg);
    }
  }
}

// 点对点发送消息给指定用户
export function wsSend(userId: string, data: object) {
  const client = clients.get(userId);
  if (client && client.ws.readyState === WebSocket.OPEN) {
    client.ws.send(JSON.stringify(data));
  }
}

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: WebSocket, _req: IncomingMessage) => {
    // 未认证状态下只处理 'auth' 类型消息，其他消息一律忽略
    let authenticated = false;

    ws.on('message', async (raw) => {
      try {
        let msg: { type: string; token?: string; to?: string };
        try { msg = JSON.parse(raw.toString()); } catch { return; }

        if (!authenticated) {
          if (msg.type !== 'auth' || !msg.token) return;

          try {
            const payload = jwt.verify(msg.token, JWT_SECRET) as { userId: string; username: string };
            const userId = payload.userId;
            const username = payload.username;

            // 从 DB 读取最新的 nickname 和 avatar_url
            const [profile] = await sql<{ nickname: string | null; avatar_url: string | null }[]>`
              SELECT nickname, avatar_url FROM users WHERE id = ${userId}
            `;
            const nickname = profile?.nickname ?? null;
            const avatarUrl = profile?.avatar_url ?? null;

            authenticated = true;
            clients.set(userId, { ws, userId, username, nickname, avatarUrl });

            // 发送在线用户列表（含 nickname + avatar_url）
            const onlineUsers = Array.from(clients.values()).map(c => ({
              id: c.userId,
              username: c.username,
              nickname: c.nickname,
              avatar_url: c.avatarUrl,
            }));
            ws.send(JSON.stringify({ type: 'online_users', users: onlineUsers }));
            wsBroadcast({ type: 'user_joined', userId, username, nickname, avatar_url: avatarUrl }, userId);
          } catch {
            ws.close(4001, 'Invalid token');
          }
          return;
        }

        // 已认证：处理 typing 消息
        if (msg.type === 'typing') {
          const client = Array.from(clients.values()).find(c => c.ws === ws);
          if (!client) return;
          const to = msg.to;
          if (to) {
            wsSend(to, { type: 'typing', from: client.userId });
          } else {
            wsBroadcast({ type: 'typing', from: client.userId }, client.userId);
          }
        }
      } catch (err) {
        console.error('WS message handler error:', err);
      }
    });

    ws.on('close', () => {
      const client = Array.from(clients.values()).find(c => c.ws === ws);
      if (client) {
        clients.delete(client.userId);
        wsBroadcast({ type: 'user_left', userId: client.userId, username: client.username });
      }
    });
  });
}
```

- [ ] 完成上述修改。

---

#### Step 3：修改 `server/src/messages.ts` — 发消息时用 nickname 作为 sender_name

将 POST `/` handler 中的 sender_name 逻辑从直接用 `username` 改为查 nickname：

```typescript
// 将：
const userId = req.userId!;
const username = req.username!;
const id = randomUUID();
const timestamp = Date.now();
const msgContent = content ?? null;
const msgImages = images ?? null;

// 改为（查 nickname，有则用，无则回退 username）：
const userId = req.userId!;
const username = req.username!;
const id = randomUUID();
const timestamp = Date.now();
const msgContent = content ?? null;
const msgImages = images ?? null;

const [userProfile] = await sql<{ nickname: string | null }[]>`
  SELECT nickname FROM users WHERE id = ${userId}
`;
const senderName = userProfile?.nickname ?? username;
```

然后把后续 INSERT 和 WS 广播中所有用到 `username` 作为发送者名称的地方改为 `senderName`：

```typescript
// INSERT 改为：
await sql`
  INSERT INTO messages (id, chat_id, sender_id, sender_name, content, images, created_at)
  VALUES (${id}, ${chatId}, ${userId}, ${senderName}, ${msgContent}, ${msgImages ? sql.json(msgImages) : null}, ${timestamp})
`;

// wsBroadcast 改为：
wsBroadcast({ type: 'hall_message', id, from: userId, fromName: senderName, content: msgContent, images: msgImages, timestamp });

// wsSend 改为：
const outMsg = { type: 'private_message', id, from: userId, fromName: senderName, to, content: msgContent, images: msgImages, timestamp };
```

- [ ] 完成上述修改。

---

#### Step 4：类型检查

```bash
cd server && npx tsc --noEmit
```

Expected: 无错误

- [ ] 完成。

---

#### Step 5：提交

```bash
git add server/src/auth.ts server/src/ws.ts server/src/messages.ts
git commit -m "feat(server): /me returns profile, WS events carry nickname/avatar_url, messages use nickname"
```

- [ ] 完成。
