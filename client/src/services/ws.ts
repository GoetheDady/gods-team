import { io, type Socket } from 'socket.io-client';
import { getAccessToken, refreshTokens } from './api';

export interface WsMessage {
  type: string;
  from?: string;
  payload?: Record<string, unknown>;
  timestamp?: number;
  users?: Array<{ id: string; username: string; nickname?: string | null; avatar_url?: string | null }>;
  userId?: string;
  username?: string;
  nickname?: string | null;
  avatar_url?: string | null;
}

type MessageHandler = (msg: WsMessage) => void;

class WsClient {
  private socket: Socket | null = null;
  private handlers = new Set<MessageHandler>();
  private shouldReconnect = false;
  private replaced = false;

  // 连接后立即发送 auth 事件，携带 access token
  connect() {
    this.shouldReconnect = true;
    if (this.socket?.connected || this.socket?.active) return;

    const socket = io({ path: '/ws', autoConnect: false });
    this.socket = socket;
    this.replaced = false;

    socket.on('connect', async () => {
      let token = getAccessToken();
      if (!token && await refreshTokens()) token = getAccessToken();
      if (token) socket.emit('auth', token);
    });

    socket.on('message', (msg: WsMessage) => {
      this.handlers.forEach(h => h(msg));
    });

    socket.on('replaced', () => {
      this.replaced = true;
      this.shouldReconnect = false;
    });

    socket.on('auth_error', async () => {
      if (!await refreshTokens()) return;
      const token = getAccessToken();
      if (token && this.shouldReconnect) socket.emit('auth', token);
    });

    socket.on('disconnect', () => {
      if (this.replaced) return;
      if (!this.shouldReconnect && this.socket === socket) this.socket = null;
    });

    socket.connect();
  }

  disconnect() {
    this.shouldReconnect = false;
    this.socket?.disconnect();
    this.socket = null;
  }

  send(data: { type?: string; to?: string }) {
    if (!this.socket?.connected) return;
    if (data.type === 'typing') this.socket.emit('typing', { to: data.to });
  }

  on(handler: MessageHandler) {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }
}

export const wsClient = new WsClient();
