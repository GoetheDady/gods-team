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

const clients = new Map<string, Client>();

export function wsBroadcast(data: object, excludeUserId?: string) {
  const msg = JSON.stringify(data);
  for (const [uid, client] of clients) {
    if (uid !== excludeUserId && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(msg);
    }
  }
}

export function wsSend(userId: string, data: object) {
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
    wsBroadcast({ type: 'user_joined', userId, username }, userId);

    ws.on('message', async (raw) => {
      try {
        let msg: { type: string; to?: string };
        try { msg = JSON.parse(raw.toString()); } catch { return; }

        if (msg.type === 'typing') {
          const to = msg.to;
          if (to) {
            wsSend(to, { type: 'typing', from: userId });
          } else {
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
