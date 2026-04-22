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
