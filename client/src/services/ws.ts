export interface WsMessage {
  type: string;
  from?: string;
  payload?: Record<string, unknown>;
  timestamp?: number;
  users?: Array<{ id: string; username: string }>;
  userId?: string;
  username?: string;
}

type MessageHandler = (msg: WsMessage) => void;

class WsClient {
  private socket: WebSocket | null = null;
  private handlers = new Set<MessageHandler>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  connect(token: string) {
    if (this.socket?.readyState === WebSocket.OPEN) return;

    const wsUrl = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws?token=${encodeURIComponent(token)}`;
    this.socket = new WebSocket(wsUrl);

    this.socket.onmessage = (e) => {
      try {
        const msg: WsMessage = JSON.parse(e.data);
        this.handlers.forEach(h => h(msg));
      } catch {
        // ignore malformed messages
      }
    };

    this.socket.onclose = () => {
      this.reconnectTimer = setTimeout(() => this.connect(token), 3000);
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
