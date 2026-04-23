import { getAccessToken } from './api';

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
  private socket: WebSocket | null = null;
  private handlers = new Set<MessageHandler>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  // 连接后立即发送 auth 消息，不再通过 URL 参数传 token
  connect() {
    if (this.socket?.readyState === WebSocket.OPEN) return;

    const wsUrl = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
    this.socket = new WebSocket(wsUrl);

    this.socket.onopen = () => {
      // 连接建立后发送 auth 消息，携带 access token
      const token = getAccessToken();
      if (token) {
        this.socket?.send(JSON.stringify({ type: 'auth', token }));
      }
    };

    this.socket.onmessage = (e) => {
      try {
        const msg: WsMessage = JSON.parse(e.data);
        this.handlers.forEach(h => h(msg));
      } catch {
        // ignore malformed messages
      }
    };

    this.socket.onclose = () => {
      this.reconnectTimer = setTimeout(() => this.connect(), 3000);
    };
  }

  disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.socket?.close();
    this.socket = null;
  }

  send(data: object) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(data));
    }
  }

  on(handler: MessageHandler) {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }
}

export const wsClient = new WsClient();
