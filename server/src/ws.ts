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

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    // WebSocket 通过 URL query 参数传递 JWT token
    // 因为 WebSocket 不支持自定义 header，所以用 ?token=xxx 的方式鉴权
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

    // 新连接建立后：向该用户发送完整在线列表，向其他人广播 user_joined
    const onlineUsers = Array.from(clients.values()).map(c => ({ id: c.userId, username: c.username }));
    ws.send(JSON.stringify({ type: 'online_users', users: onlineUsers }));
    wsBroadcast({ type: 'user_joined', userId, username }, userId);

    // WS 只处理 typing 状态，消息发送已改为 HTTP POST /api/messages
    ws.on('message', async (raw) => {
      try {
        let msg: { type: string; to?: string };
        try { msg = JSON.parse(raw.toString()); } catch { return; }

        if (msg.type === 'typing') {
          const to = msg.to;
          if (to) {
            // 私聊 typing：只发给对方
            wsSend(to, { type: 'typing', from: userId });
          } else {
            // 大厅 typing：广播给所有人（除自己）
            wsBroadcast({ type: 'typing', from: userId }, userId);
          }
        }
      } catch (err) {
        console.error('WS message handler error:', err);
      }
    });

    ws.on('close', () => {
      clients.delete(userId);
      wsBroadcast({ type: 'user_left', userId, username });
    });
  });
}
