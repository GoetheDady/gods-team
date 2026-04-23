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
      try {
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
      } catch (err) {
        console.error('WS message handler error:', err);
      }
    });

    ws.on('close', () => {
      clients.delete(userId);
      broadcast({ type: 'user_left', userId, username });
    });
  });
}
