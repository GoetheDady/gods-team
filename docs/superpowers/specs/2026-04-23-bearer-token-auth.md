# Bearer Token 认证改造设计

## 目标

将认证机制从 HttpOnly cookie 改为 `Authorization: Bearer <token>` 请求头，引入双 token（access token + refresh token）机制，支持自动续期。

## Token 设计

### Access Token
- 格式：JWT
- 有效期：15 分钟
- 用途：所有 API 请求的 `Authorization: Bearer <token>` 头
- WS 连接鉴权：建立连接后通过 `{ type: 'auth', token }` 消息发送

### Refresh Token
- 格式：`crypto.randomUUID()` 生成的随机字符串（非 JWT）
- 有效期：7 天
- 用途：调用 `POST /api/auth/refresh` 换取新的 access token 和 refresh token
- 为什么不用 JWT：refresh token 需要能被主动撤销（登出时删除），JWT 签发后无法作废

### 为什么选择双 token
- Access token 短期，即使泄露影响小
- Refresh token 长期但可撤销，安全性更高
- 用户无感知自动续期，体验好

## 数据库变更

新增 `refresh_tokens` 表：

```sql
CREATE TABLE IF NOT EXISTS refresh_tokens (
  token      TEXT PRIMARY KEY,
  user_id    TEXT REFERENCES users(id),
  expires_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
```

`initDb()` 中添加建表语句。

## 服务端改动

### middleware/auth.ts
- 只从 `Authorization: Bearer <token>` 头提取 token
- 删除 `req.cookies?.token` 逻辑

### auth.ts
- `POST /register` 和 `POST /login`：返回 `{ userId, username, accessToken, refreshToken }`，不再 `res.cookie()`
- 生成 refresh token：UUID 写入 `refresh_tokens` 表
- 删除 `POST /logout`：改为删除 `refresh_tokens` 表中对应记录
- 删除 `GET /token`：不再需要单独获取 token 的接口
- 新增 `POST /refresh`：验证 refresh token，返回新的 access token + 新的 refresh token（轮转）

### ws.ts
- 连接建立后不立即鉴权，进入「未认证」状态
- 等待客户端发送 `{ type: 'auth', token: '<accessToken>' }` 消息
- 验证通过后切换为「已认证」状态，开始处理其他消息
- 未认证期间收到的消息（非 auth 类型）直接忽略

### index.ts
- 删除 `cookie-parser` import 和 `app.use(cookieParser())`
- 删除 `cookie-parser` 依赖

## 客户端改动

### api.ts
- token 存 `localStorage`（key: `access_token` 和 `refresh_token`）
- `request()` 函数自动带 `Authorization: Bearer <access_token>` 头
- 401 响应时自动调 `refresh()` 换 token，成功后重试原请求
- refresh 也失败（401）则清 localStorage 跳登录页
- 删除 `credentials: 'include'`，删除 `getToken()` 方法
- 登录/注册成功后存 token 到 localStorage

### ws.ts
- `connect()` 不再接收 token 参数，改为 `connect()` 无参
- 连接建立后立即发送 `{ type: 'auth', token: localStorage.getItem('access_token') }`

### App.tsx
- 启动时从 localStorage 取 access token，带 Authorization 头调 `/me` 验证
- 有 token 且有效 → 进入聊天
- 无 token 或 401 → 跳登录页

### Chat.tsx
- `wsClient.connect(token)` 改为 `wsClient.connect()`
- 删除 `api.getToken()` 调用

## 删除内容

- `cookie-parser` 依赖（服务端）
- `res.cookie()` / `res.clearCookie()` 所有调用
- `GET /api/auth/token` 接口
- `credentials: 'include'` 配置（客户端）

## WS 鉴权流程

```
客户端                         服务端
  │── new WebSocket(url) ────>│
  │<─── 连接建立 ────────────│ （此时未认证）
  │── {type:'auth', token} ──>│
  │                           │── jwt.verify(token)
  │<── online_users ───────── │ （验证通过，发送在线列表）
  │<── user_joined (广播) ─── │
  │── {type:'typing', ...} ──>│ （正常通信）
```

## Token 刷新流程

```
客户端                         服务端
  │── GET /api/me             │
  │   Authorization: Bearer <过期token>
  │<── 401 Unauthorized ─────│
  │                           │
  │── POST /api/auth/refresh  │
  │   { refreshToken }        │
  │                           │── 验证 refresh_tokens 表
  │                           │── 删除旧 refresh token
  │                           │── 生成新 access + refresh token
  │<── { accessToken, refreshToken } ──│
  │                           │
  │── GET /api/me (重试)      │
  │   Authorization: Bearer <新token>
  │<── 200 OK ───────────────│
```
