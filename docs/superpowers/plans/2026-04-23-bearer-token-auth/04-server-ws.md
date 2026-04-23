### Task 4：重写 ws.ts — 连接后等 auth 消息才鉴权

**Files:**
- Modify: `server/src/ws.ts`

- [ ] **Step 1：完整替换 `server/src/ws.ts`**

```typescript
import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';
import type { Server } from 'http';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-prod';

interface Client {
  ws: WebSocket;
  userId: string;
  username: string;
}

// 所有已连接的客户端，key 为 userId
// 同一用户重连时会覆盖旧的 ws 引用
const clients = new Map<string, Client>();

// 广播消息给所有在线用户（可排除发送者）
// 被 messages.ts 的 POST /api/messages 调用，发送消息后触发广播
export function wsBroadcast(data: object, excludeUserId?: string) {
  const msg = JSON.stringify(data);
  for (const [uid, client] of clients) {
    if (uid !== excludeUserId && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(msg);
    }
  }
}

// 点对点发送消息给指定用户
// 用于私聊推送（双方各收一份）和 typing 状态
export function wsSend(userId: string, data: object) {
  const client = clients.get(userId);
  if (client && client.ws.readyState === WebSocket.OPEN) {
    client.ws.send(JSON.stringify(data));
  }
}

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: WebSocket, _req: IncomingMessage) => {
    // WS 不支持自定义 header，所以改为连接后通过消息发送 token
    // 未认证状态下只处理 'auth' 类型消息，其他消息一律忽略
    let authenticated = false;

    ws.on('message', async (raw) => {
      try {
        let msg: { type: string; token?: string; to?: string };
        try { msg = JSON.parse(raw.toString()); } catch { return; }

        // 未认证时只接受 auth 消息
        if (!authenticated) {
          if (msg.type !== 'auth' || !msg.token) return;

          try {
            const payload = jwt.verify(msg.token, JWT_SECRET) as { userId: string; username: string };
            const userId = payload.userId;
            const username = payload.username;

            authenticated = true;
            clients.set(userId, { ws, userId, username });

            // 验证通过：发送在线列表 + 广播上线
            const onlineUsers = Array.from(clients.values()).map(c => ({ id: c.userId, username: c.username }));
            ws.send(JSON.stringify({ type: 'online_users', users: onlineUsers }));
            wsBroadcast({ type: 'user_joined', userId, username }, userId);
          } catch {
            ws.close(4001, 'Invalid token');
          }
          return;
        }

        // 已认证：处理 typing 消息（消息发送已改为 HTTP POST /api/messages）
        if (msg.type === 'typing') {
          // 需要从 clients 中找到当前连接的 userId
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

注意变化：
- 删除 URL query 参数取 token 的逻辑
- 连接建立后进入 `authenticated = false` 状态
- 收到 `{ type: 'auth', token }` 后验证 JWT，通过后切换状态
- typing 处理中通过 `clients` 反查 userId（不再闭包捕获）

- [ ] **Step 2：类型检查**

```bash
cd server && npx tsc --noEmit
```

- [ ] **Step 3：提交**

```bash
git add server/src/ws.ts
git commit -m "refactor(server): WS auth via first message instead of URL param"
```
