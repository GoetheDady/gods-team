# 用户头像与昵称功能设计

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 允许用户上传头像并设置独立昵称，头像和昵称在在线用户列表与消息气泡中展示。

**Architecture:** 在 `users` 表新增 `nickname` 和 `avatar_url` 两列。昵称独立于登录用户名，不写入 JWT。头像通过现有 OSS 直传流程上传。新增 `PATCH /api/users/me` 接口更新资料，WS 在线用户事件携带 nickname + avatar_url。

**Tech Stack:** PostgreSQL（现有）、阿里云 OSS（现有 sign 接口复用）、React + CSS Modules（现有风格）

---

## 数据模型

`users` 表新增两列：

```sql
ALTER TABLE users ADD COLUMN nickname TEXT DEFAULT NULL;
ALTER TABLE users ADD COLUMN avatar_url TEXT DEFAULT NULL;
```

- `nickname` 为空时，前端展示回退到 `username`
- `avatar_url` 为空时，前端展示首字母占位头像（取 nickname 或 username 首字）
- 首字母头像颜色由 `userId` hash 决定，颜色固定、确定性生成（不随刷新变化）

`initDb()` 中使用 `ADD COLUMN IF NOT EXISTS` 确保幂等。

---

## 后端 API

### 现有接口变更

**`GET /api/auth/me`**
响应新增字段：
```json
{ "userId": "...", "username": "...", "nickname": "剑客无名", "avatar_url": "https://..." }
```
nickname / avatar_url 可为 `null`。

**`POST /api/messages`**（messages.ts）
发消息时从 DB 查当前用户 nickname：
- 有 nickname → 存为 `sender_name`
- 无 nickname → 回退存 username
历史消息保留写入时的 sender_name，不追溯修改。

**WebSocket `online_users` / `user_joined` 事件**
新增字段：
```json
{ "type": "online_users", "users": [{ "id": "...", "username": "...", "nickname": "...", "avatar_url": "..." }] }
{ "type": "user_joined", "userId": "...", "username": "...", "nickname": "...", "avatar_url": "..." }
```

### 新增接口

**`PATCH /api/users/me`**（新文件 `server/src/users.ts`）
- 需登录（`requireAuth`）
- 请求体：`{ nickname?: string; avatar_url?: string }`（至少一个字段）
- nickname 限制：最长 20 字，不能为纯空格
- 返回：`{ ok: true }`
- 挂载：`app.use('/api/users', usersRouter)`

---

## 前端变更

### 新组件：`client/src/components/Avatar.tsx`

可复用头像组件，统一处理「有图片 / 无图片用首字母」两种状态：

```tsx
interface Props {
  src?: string | null;
  name: string;      // 用于生成首字母和颜色
  size?: number;     // 默认 36
}
```

颜色算法：对 `name` 字符串做简单 hash，从预设的 6 个品牌色中取一个。

### `client/src/services/api.ts`

新增方法：
```typescript
updateProfile(nickname?: string, avatarUrl?: string) {
  return request<{ ok: boolean }>('/users/me', {
    method: 'PATCH',
    body: JSON.stringify({ nickname, avatar_url: avatarUrl }),
  });
}
```

`me()` 返回类型更新为：
```typescript
{ userId: string; username: string; nickname: string | null; avatar_url: string | null }
```

### `client/src/App.tsx`

auth state 扩展：
```typescript
{ userId: string; username: string; nickname: string | null; avatarUrl: string | null }
```
登录/注册后从 `api.me()` 获取完整 profile 写入 state。

### `client/src/pages/Chat.tsx`

- `OnlineUser` 接口新增 `nickname?: string; avatarUrl?: string`
- WS `online_users` / `user_joined` 事件解析新增字段
- `usernameMap` 扩展为存储 `{ username, nickname, avatarUrl }`
- 向 `UserList`、`MessageList`、`PrivatePanel` 传递 avatar 相关数据

### `client/src/components/UserList.tsx`

- 每个用户条目左侧展示 `<Avatar>` 组件（32px）
- 展示 nickname（有则优先），无 nickname 回退 username

### `client/src/components/MessageList.tsx`

- `Message` 接口新增 `from_avatar_url?: string`
- 每条消息左侧（或右侧 self 消息）展示 `<Avatar>` 组件（36px）
- 发送者名称展示 nickname（若存在）

### `client/src/pages/Settings.tsx`

顶部新增「个人资料」卡片（位于邀请码区域上方）：

1. **头像区域**：展示当前头像（无则首字母占位），点击触发 OSS 上传 → 上传成功后调 `updateProfile(undefined, url)` 保存 avatar_url
2. **昵称输入框**：输入 + 保存按钮，调 `updateProfile(nickname)` 保存

头像上传复用 `api.getOssSign()` + FormData 直传，与 MessageInput 中图片上传逻辑相同。

### Header（`Chat.tsx` 内联 header）

右上角用户名旁展示小头像（28px Avatar 组件）。

---

## 不在范围内

- 昵称修改不实时同步给其他在线用户（其他用户刷新后才生效）
- 不支持删除头像（只能替换）
- 消息历史中已有的 sender_name 不追溯更新

---

## 文件变更清单

| 文件 | 操作 |
|---|---|
| `server/src/pg.ts` | `initDb()` 中 ADD COLUMN IF NOT EXISTS nickname / avatar_url |
| `server/src/auth.ts` | `/me` 接口返回 nickname + avatar_url |
| `server/src/messages.ts` | 发消息时查 nickname 作为 sender_name |
| `server/src/ws.ts` | online_users / user_joined 事件携带 nickname + avatar_url |
| `server/src/users.ts` | 新建，PATCH /api/users/me |
| `server/src/index.ts` | 挂载 usersRouter |
| `client/src/components/Avatar.tsx` | 新建，可复用头像组件 |
| `client/src/services/api.ts` | 新增 updateProfile，me() 类型更新 |
| `client/src/App.tsx` | auth state 含 nickname + avatarUrl |
| `client/src/pages/Chat.tsx` | OnlineUser 含 avatar，usernameMap 扩展 |
| `client/src/components/UserList.tsx` | 展示 Avatar |
| `client/src/components/MessageList.tsx` | 展示 Avatar，Message 含 from_avatar_url |
| `client/src/pages/Settings.tsx` | 个人资料卡片 |
