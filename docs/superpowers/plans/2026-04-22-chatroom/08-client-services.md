# Task 08: 客户端 API 与 WebSocket 服务

**Files:**
- Create: `client/src/services/api.ts`
- Create: `client/src/services/ws.ts`

---

- [ ] **Step 1: 创建 `client/src/services/api.ts`**

```typescript
const BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data as T;
}

export interface User {
  userId: string;
  username: string;
}

export const api = {
  register(username: string, password: string, invite_code: string) {
    return request<User>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password, invite_code }),
    });
  },

  login(username: string, password: string) {
    return request<User>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  },

  logout() {
    return request<{ ok: boolean }>('/auth/logout', { method: 'POST' });
  },

  me() {
    return request<User>('/auth/me');
  },

  getToken() {
    return request<{ token: string }>('/auth/token');
  },

  uploadPubkey(key_data: string) {
    return request<{ ok: boolean }>('/users/me/pubkey', {
      method: 'POST',
      body: JSON.stringify({ key_data }),
    });
  },

  getPubkey(userId: string) {
    return request<{ key_data: string }>(`/users/${userId}/pubkey`);
  },

  generateInvite() {
    return request<{ code: string }>('/invite/generate', { method: 'POST' });
  },

  myInvites() {
    return request<{
      codes: Array<{
        code: string;
        created_at: number;
        used_by: string | null;
        used_at: number | null;
      }>;
    }>('/invite/mine');
  },
};
```

- [ ] **Step 2: 创建 `client/src/services/ws.ts`**

```typescript
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
```

- [ ] **Step 3: 验证 API 客户端正常工作**

启动两端服务后，在浏览器控制台：

```javascript
const { api } = await import('/src/services/api.ts');
const me = await api.me();
console.log(me); // 期望: { userId: '...', username: 'alice' }
const { token } = await api.getToken();
console.log('token:', token.slice(0, 20) + '...');
```

- [ ] **Step 4: 提交**

```bash
git add client/src/services/api.ts client/src/services/ws.ts
git commit -m "feat: add REST API client and WebSocket client service"
```
