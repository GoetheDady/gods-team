### Task 7：重写客户端 ws.ts — 无参 connect + auth 消息

**Files:**
- Modify: `client/src/services/ws.ts`

- [ ] **Step 1：完整替换 `client/src/services/ws.ts`**

```typescript
import { getAccessToken } from './api';

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

  // 连接 WS 后立即发送 auth 消息
  // 不再通过 URL 参数传 token，避免 token 出现在服务端日志中
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
```

注意变化：
- `connect()` 不再接收 `token` 参数
- `onopen` 回调中从 localStorage 取 token 发送 `{ type: 'auth', token }`
- WS URL 不再拼接 `?token=xxx`
- 重连时调用 `this.connect()` 无参

- [ ] **Step 2：类型检查**

```bash
cd client && npx tsc --noEmit
```

- [ ] **Step 3：提交**

```bash
git add client/src/services/ws.ts
git commit -m "refactor(client): WS connect without token param, send auth message"
```
