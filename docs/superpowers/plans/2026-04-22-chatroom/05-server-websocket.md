# Task 05: 服务端 WebSocket

**Files:**
- Create: `server/src/ws.ts`
- Modify: `server/src/index.ts`

---

- [ ] **Step 1: 创建 `server/src/ws.ts`**

```typescript
import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { Server } from 'http';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-prod';

interface Client {
  ws: WebSocket;
  userId: string;
  username: string;
}

// userId → Client 映射
const clients = new Map<string, Client>();

function broadcast(data: object, excludeUserId?: string) {
  const msg = JSON.stringify(data);
  for (const [userId, client] of clients) {
    if (userId !== excludeUserId && client.ws.readyState === WebSocket.OPEN) {
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
    // 从查询参数中获取 token
    const url = new URL(req.url || '', 'http://localhost');
    const token = url.searchParams.get('token');

    if (!token) {
      ws.close(4001, 'Token required');
      return;
    }

    let userId: string;
    let username: string;
    try {
      const payload = jwt.verify(token, JWT_SECRET) as { userId: string; username: string };
      userId = payload.userId;
      username = payload.username;
    } catch {
      ws.close(4001, 'Invalid token');
      return;
    }

    // 注册客户端
    clients.set(userId, { ws, userId, username });

    // 推送当前在线用户列表给新连接的用户
    const onlineUsers = Array.from(clients.values()).map(c => ({
      id: c.userId,
      username: c.username,
    }));
    ws.send(JSON.stringify({ type: 'online_users', users: onlineUsers }));

    // 通知其他人有新用户上线
    broadcast({ type: 'user_joined', userId, username }, userId);

    ws.on('message', (raw) => {
      let msg: { type: string; payload?: Record<string, unknown> };
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }

      if (msg.type === 'hall_message') {
        // 中继大厅消息给所有人（包括发送者自己，方便确认）
        broadcast({
          type: 'hall_message',
          from: userId,
          payload: msg.payload,
          timestamp: Date.now(),
        });
      } else if (msg.type === 'private_message') {
        const to = msg.payload?.to as string | undefined;
        if (!to) return;
        // 中继私聊消息给目标用户
        send(to, {
          type: 'private_message',
          from: userId,
          payload: msg.payload,
          timestamp: Date.now(),
        });
        // 同时发给自己（用于本地存储）
        send(userId, {
          type: 'private_message',
          from: userId,
          payload: msg.payload,
          timestamp: Date.now(),
        });
      } else if (msg.type === 'typing') {
        const to = msg.payload?.to as string | undefined;
        if (to) {
          send(to, { type: 'typing', from: userId });
        } else {
          broadcast({ type: 'typing', from: userId }, userId);
        }
      } else if (msg.type === 'hall_key_distribution') {
        // 大厅密钥分发：客户端请求将加密的 K_hall 发给指定用户
        const targetUserId = msg.payload?.to as string | undefined;
        if (!targetUserId) return;
        send(targetUserId, {
          type: 'hall_key_distribution',
          from: userId,
          payload: msg.payload,
        });
      }
    });

    ws.on('close', () => {
      clients.delete(userId);
      broadcast({ type: 'user_left', userId, username });
    });
  });
}
```

- [ ] **Step 2: 在 `server/src/index.ts` 中接入 WebSocket**

在文件末尾 `server.listen(...)` 之前加入：

```typescript
import { setupWebSocket } from './ws';

setupWebSocket(server);
```

- [ ] **Step 3: 重启服务，验证 WebSocket 连接**

先获取 JWT token（从登录响应中提取，WebSocket 需要在 URL 参数中携带）。

由于 token 在 HttpOnly Cookie 中，WebSocket 连接需要从登录响应头中读取，或者临时加一个 `/api/auth/token` 端点返回 token。

在 `server/src/auth.ts` 中，在 `router.get('/me', ...)` 之后加入：

```typescript
// 仅用于 WebSocket 握手获取 token
router.get('/token', requireAuth, (req: AuthRequest, res: Response) => {
  const token = signToken(req.userId!, req.username!);
  res.json({ token });
});
```

重启服务，测试：
```bash
TOKEN=$(curl -s -b /tmp/alice.txt http://localhost:3000/api/auth/token | jq -r '.token')
# 使用 wscat 测试（需先安装: npm install -g wscat）
wscat -c "ws://localhost:3000/ws?token=$TOKEN"
```
期望：连接成功，收到 `{"type":"online_users","users":[{"id":"...","username":"alice"}]}`

- [ ] **Step 4: 提交**

```bash
git add server/src/ws.ts server/src/auth.ts server/src/index.ts
git commit -m "feat: add WebSocket server with message relay and online presence"
```
