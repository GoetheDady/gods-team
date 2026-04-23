const BASE = '/api';

// Token 存储在 localStorage，页面刷新后仍然有效
const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

export function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

// 用 refresh token 换新的 access + refresh token
// 刷新成功自动更新 localStorage，返回 true；失败返回 false
async function refresh(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  try {
    const res = await fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    setTokens(data.accessToken, data.refreshToken);
    return true;
  } catch {
    return false;
  }
}

// 核心请求函数：
// 1. 自动带 Authorization: Bearer <token> 头
// 2. 401 时自动刷新 token 并重试一次
// 3. 刷新失败则清 token 并跳登录页
async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getAccessToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(BASE + path, { ...options, headers });
  const data = await res.json();

  if (res.status === 401 && !path.includes('/auth/')) {
    // access token 过期，尝试刷新
    const ok = await refresh();
    if (ok) {
      // 刷新成功，用新 token 重试原请求
      const newToken = getAccessToken();
      if (newToken) headers['Authorization'] = `Bearer ${newToken}`;
      const retryRes = await fetch(BASE + path, { ...options, headers });
      const retryData = await retryRes.json();
      if (!retryRes.ok) throw new Error(retryData.error || 'Request failed');
      return retryData as T;
    }
    // 刷新也失败，清 token 跳登录
    clearTokens();
    window.location.href = '/login';
    throw new Error('Session expired');
  }

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
    return request<{ userId: string; username: string; accessToken: string; refreshToken: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password, invite_code }),
    });
  },

  login(username: string, password: string) {
    return request<{ userId: string; username: string; accessToken: string; refreshToken: string }>('/auth/login', {
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

  sendMessage(chatId: string, content: string, images?: { url: string }[], to?: string) {
    return request<{ id: string; createdAt: number }>('/messages', {
      method: 'POST',
      body: JSON.stringify({ chatId, content, images, to }),
    });
  },

  getMessages(chatId: string, before?: number): Promise<{ messages: ServerMessage[]; hasMore: boolean }> {
    const qs = before ? `?before=${before}` : '';
    return request(`/messages/${encodeURIComponent(chatId)}${qs}`);
  },

  getOssSign(): Promise<{ url: string; fields: Record<string, string> }> {
    return request('/oss/sign');
  },
};
