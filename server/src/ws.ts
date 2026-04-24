import type { Server } from 'http';
import { Server as SocketIOServer, type Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import sql from './pg';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-prod';

interface Client {
  socket: Socket;
  userId: string;
  username: string;
  nickname: string | null;
  avatarUrl: string | null;
}

// 所有已连接的客户端，key 为 userId
// 同一用户重连时会覆盖旧的 ws 引用
const clients = new Map<string, Client>();

// 广播消息给所有在线用户（可排除发送者）
// 被 messages.ts 的 POST /api/messages 调用，发送消息后触发广播
export function wsBroadcast(data: object, excludeUserId?: string) {
  for (const [uid, client] of clients) {
    if (uid !== excludeUserId) {
      client.socket.emit('message', data);
    }
  }
}

// 点对点发送消息给指定用户
// 用于私聊推送（双方各收一份）和 typing 状态
export function wsSend(userId: string, data: object) {
  const client = clients.get(userId);
  if (client) client.socket.emit('message', data);
}

export function setupWebSocket(server: Server) {
  const io = new SocketIOServer(server, {
    path: '/ws',
    cors: process.env.NODE_ENV === 'production'
      ? undefined
      : { origin: process.env.CORS_ORIGIN || 'http://localhost:5173', credentials: true },
  });

  io.on('connection', (socket) => {
    socket.on('auth', async (token: string | undefined) => {
      try {
        if (!token) return;

        const payload = jwt.verify(token, JWT_SECRET) as { userId: string; username: string };
        const userId = payload.userId;
        const username = payload.username;

        // 从 DB 读取最新的 nickname 和 avatar_url
        const [profile] = await sql<{ nickname: string | null; avatar_url: string | null }[]>`
          SELECT nickname, avatar_url FROM users WHERE id = ${userId}
        `;
        const nickname = profile?.nickname ?? null;
        const avatarUrl = profile?.avatar_url ?? null;

        const previous = clients.get(userId);
        if (previous && previous.socket.id !== socket.id) {
          previous.socket.emit('replaced');
          previous.socket.disconnect(true);
        }
        clients.set(userId, { socket, userId, username, nickname, avatarUrl });

        // 验证通过：发送在线列表 + 广播上线
        const onlineUsers = Array.from(clients.values()).map(c => ({
          id: c.userId,
          username: c.username,
          nickname: c.nickname,
          avatar_url: c.avatarUrl,
        }));
        socket.emit('message', { type: 'online_users', users: onlineUsers });
        wsBroadcast({ type: 'user_joined', userId, username, nickname, avatar_url: avatarUrl }, userId);
      } catch (err) {
        socket.emit('auth_error');
        socket.disconnect(true);
      }
    });

    // 已认证：处理 typing 消息（消息发送已改为 HTTP POST /api/messages）
    socket.on('typing', (msg: { to?: string } = {}) => {
      const client = Array.from(clients.values()).find(c => c.socket.id === socket.id);
      if (!client) return;
      const to = msg.to;
      if (to) {
        wsSend(to, { type: 'typing', from: client.userId });
      } else {
        wsBroadcast({ type: 'typing', from: client.userId }, client.userId);
      }
    });

    socket.on('disconnect', () => {
      const client = Array.from(clients.values()).find(c => c.socket.id === socket.id);
      if (client) {
        clients.delete(client.userId);
        wsBroadcast({ type: 'user_left', userId: client.userId, username: client.username });
      }
    });
  });
}
