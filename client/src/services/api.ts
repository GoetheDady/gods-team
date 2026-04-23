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

export interface ServerMessage {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  images: { url: string }[] | null;
  createdAt: number;
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

  getMessages(chatId: string, before?: number): Promise<{ messages: ServerMessage[]; hasMore: boolean }> {
    const qs = before ? `?before=${before}` : '';
    return request(`/messages/${encodeURIComponent(chatId)}${qs}`);
  },

  getOssSign(): Promise<{ url: string; fields: Record<string, string> }> {
    return request('/oss/sign');
  },
};
