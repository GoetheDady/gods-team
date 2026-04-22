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

    clients.set(userId, { ws, userId, username });

    const onlineUsers = Array.from(clients.values()).map(c => ({
      id: c.userId,
      username: c.username,
    }));
    ws.send(JSON.stringify({ type: 'online_users', users: onlineUsers }));

    broadcast({ type: 'user_joined', userId, username }, userId);

    ws.on('message', (raw) => {
      let msg: { type: string; payload?: Record<string, unknown> };
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }

      if (msg.type === 'hall_message') {
        broadcast({
          type: 'hall_message',
          from: userId,
          payload: msg.payload,
          timestamp: Date.now(),
        });
      } else if (msg.type === 'private_message') {
        const to = msg.payload?.to as string | undefined;
        if (!to) return;
        send(to, {
          type: 'private_message',
          from: userId,
          payload: msg.payload,
          timestamp: Date.now(),
        });
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
