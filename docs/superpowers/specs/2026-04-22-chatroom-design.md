# 聊天室设计规格

**日期**：2026-04-22  
**状态**：已确认，待实现

---

## 概述

一个邀请制私人聊天室 Web 应用，支持公共大厅与私聊，消息端对端加密（E2EE），服务端不保存任何聊天记录，所有消息历史存储在用户本地设备。

---

## 技术栈

| 层 | 技术 |
|----|------|
| 前端 | React + TypeScript |
| 后端 | Node.js + Express |
| 实时通信 | WebSocket（WSS） |
| 加密 | Web Crypto API（ECDH P-256 + AES-GCM 256） |
| 本地存储 | SQLite WASM + OPFS |
| 传输 | HTTPS + WSS |
| 未来迁移 | 兼容 Electron / Tauri（同一前端代码库） |

---

## 整体架构

```
┌─────────────────────────────────────────────┐
│              客户端 (React + TS)              │
│                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │  Auth UI │  │ Chat UI  │  │ Settings │  │
│  └──────────┘  └──────────┘  └──────────┘  │
│                      │                      │
│  ┌──────────────────────────────────────┐   │
│  │         Crypto Service               │   │
│  │  (Web Crypto API · ECDH · AES-GCM)   │   │
│  └──────────────────────────────────────┘   │
│                      │                      │
│  ┌─────────┐   ┌───────────┐                │
│  │REST API │   │ WebSocket │                │
│  │ Client  │   │  Client   │                │
│  └─────────┘   └───────────┘                │
│                      │                      │
│  ┌──────────────────────────────────────┐   │
│  │   SQLite WASM + OPFS (本地消息存储)   │   │
│  └──────────────────────────────────────┘   │
└──────────────────────┬──────────────────────┘
                       │ HTTPS / WSS
┌──────────────────────▼──────────────────────┐
│           服务端 (Node.js + Express)          │
│                                             │
│  ┌────────────┐   ┌──────────────────────┐  │
│  │  REST API  │   │   WebSocket Server   │  │
│  │  /auth     │   │  · 消息中继（不存储）  │  │
│  │  /users    │   │  · 在线状态管理       │  │
│  │  /invite   │   │  · 公钥分发          │  │
│  └────────────┘   └──────────────────────┘  │
│                                             │
│  ┌──────────────────────────────────────┐   │
│  │  数据库（只存用户信息，无消息）        │   │
│  │  users · invite_codes · public_keys   │   │
│  └──────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

**核心原则**：
- 服务端是消息中继，只转发加密密文，永不明文存储消息
- 密钥对在客户端生成，私钥绝不离开浏览器
- 公钥上传服务端用于密钥协商，消息内容服务端无法解密

---

## 数据模型

### 服务端数据库（SQLite，只存用户信息）

```sql
-- 用户表
users (
  id          TEXT PRIMARY KEY,   -- UUID
  username    TEXT UNIQUE NOT NULL,
  password    TEXT NOT NULL,       -- bcrypt hash
  created_at  INTEGER NOT NULL
)

-- 公钥表（用于 E2EE 密钥协商）
public_keys (
  user_id     TEXT PRIMARY KEY REFERENCES users(id),
  key_data    TEXT NOT NULL,       -- ECDH 公钥，Base64
  updated_at  INTEGER NOT NULL
)

-- 邀请码表
invite_codes (
  code        TEXT PRIMARY KEY,
  created_by  TEXT REFERENCES users(id),
  used_by     TEXT REFERENCES users(id),
  created_at  INTEGER NOT NULL,
  used_at     INTEGER              -- NULL 表示未使用
)
```

### 客户端本地数据库（SQLite WASM + OPFS）

```sql
-- 本地消息记录（解密后明文）
messages (
  id          TEXT PRIMARY KEY,
  chat_id     TEXT NOT NULL,       -- "hall" 或对方 user_id
  from_id     TEXT NOT NULL,
  content     TEXT NOT NULL,
  timestamp   INTEGER NOT NULL
)
```

---

## REST API

```
POST /api/auth/register        { username, password, invite_code }
POST /api/auth/login           { username, password }
POST /api/auth/logout

GET  /api/users/:id/pubkey     获取某用户公钥
POST /api/users/me/pubkey      上传自己的公钥（登录后）

POST /api/invite/generate      生成邀请码（需登录，单次有效）
GET  /api/invite/mine          查看自己生成的邀请码列表
```

---

## WebSocket 消息协议

### 客户端 → 服务端

```typescript
{ type: "hall_message",    payload: { ciphertext: string, iv: string } }
{ type: "private_message", payload: { to: string, ciphertext: string, iv: string } }
{ type: "typing",          payload: { to?: string } }
```

### 服务端 → 客户端

```typescript
// 连接成功后立即推送当前在线列表
{ type: "online_users",    users: Array<{ id: string, username: string }> }

// 实时增量更新
{ type: "user_joined",     userId: string, username: string }
{ type: "user_left",       userId: string, username: string }

// 消息中继（服务端只转发，不解密）
{ type: "hall_message",    from: string, payload: { ciphertext: string, iv: string }, timestamp: number }
{ type: "private_message", from: string, payload: { ciphertext: string, iv: string }, timestamp: number }

// 打字状态
{ type: "typing",          from: string }
```

---

## E2EE 加密流程

### 密钥体系

每个用户拥有一对 ECDH P-256 密钥对，登录时在浏览器生成：

| 密钥 | 存储位置 | 说明 |
|------|---------|------|
| 私钥 | IndexedDB（`extractable: false`） | 永不离开客户端 |
| 公钥 | 服务端 public_keys 表 | 供其他用户做密钥协商 |
| 群组密钥 K_hall | IndexedDB（加密存储） | 公共大厅共享对称密钥 |
| 会话密钥 K_ab | 内存 | 私聊点对点密钥，断开后重新协商 |

### 公共大厅加密流程

```
1. 第一个进入大厅的用户随机生成 AES-GCM 256 群组密钥 K_hall
2. K_hall 用每个在线成员的 ECDH 公钥分别加密后推送给各客户端
3. 新用户加入时，服务端通知持有 K_hall 的用户为新人重新加密分发
4. 发消息：AES-GCM 加密(content, K_hall) → 密文+IV → 服务端中继给所有人
5. 收消息：用本地 K_hall 解密 → 存入本地 SQLite
```

### 私聊加密流程

```
1. Alice 获取 Bob 的公钥（从服务端）
2. Alice 用自己私钥 + Bob 公钥 做 ECDH 协商 → 得到 K_ab
3. Bob 用自己私钥 + Alice 公钥 做同样协商 → 得到相同 K_ab
4. 双方用 K_ab 做 AES-GCM 加解密，服务端只见密文
```

> **取舍说明**：更换设备或清除浏览器数据会导致私钥丢失，历史消息在新设备无法解密。这是 E2EE 的必然代价，需在 UI 上明确提示用户。

---

## 功能规格

### 注册流程

1. 用户填写用户名、密码、邀请码
2. 服务端验证邀请码有效（存在且未使用）
3. 创建用户，标记邀请码为已使用
4. 返回会话 token

### 邀请码机制

- 已登录用户可生成邀请码，每码仅限一次使用
- 用户可查看自己生成的邀请码及使用状态
- 邀请码格式：8位大写字母+数字随机串（如 `A3X9KM2P`）

### 聊天功能

- **公共大厅**：所有在线用户可见，消息 E2EE 加密
- **私聊**：点击在线用户列表中的用户发起，独立 ECDH 会话密钥
- **打字状态**：实时显示对方正在输入
- **消息历史**：存储在本地 SQLite，断线重连后从本地加载，无需向服务端请求

---

## UI 设计方向

### 布局（参考江湖聊天室三栏结构）

```
┌─────────────────────────────────────────────────────────┐
│  顶栏：Logo · 房间名            用户名 · 邀请码 · 退出   │
├───────────────┬─────────────────────────┬───────────────┤
│               │                         │               │
│   在线用户    │      公共大厅            │   私聊面板    │
│   侧边栏      │      消息流              │               │
│               │                         │  （点击用户   │
│  [头像] 用户A │                         │   后展开）    │
│  [头像] 用户B │                         │               │
│  ...          │                         │               │
│               ├─────────────────────────┤               │
│               │  输入框        [发 送]   │               │
└───────────────┴─────────────────────────┴───────────────┘
```

### 美学方向：「数字墨客」

| 设计要素 | 具体实现 |
|---------|---------|
| 背景色 | 深墨色 `#16181d`，细腻噪点纹理叠加 |
| 主色调 | 暖金色 `#c9a84c` 用于交互元素、高亮、边线 |
| 消息气泡 | 低饱和度暗蓝 `#1e2535`，轻微磨砂玻璃效果 |
| 标题字体 | ZCOOL XiaoWei（典雅宋体感） |
| 正文字体 | Noto Sans SC |
| 代码/用户名 | JetBrains Mono |
| 在线状态 | 金色小圆点（在线）/ 灰色（离线） |
| 未读私聊 | 金色数字角标 |
| 输入框 | 底部细金线而非传统边框 |
| 消息动画 | 向上淡入（translateY + opacity） |
| 用户上下线 | 侧滑淡出动画 |
| 发送按钮 | 墨水扩散涟漪效果 |

### 页面清单

| 页面 | 说明 |
|------|------|
| 登录页 | 全屏居中卡片，背景有微动墨迹粒子效果 |
| 注册页 | 含邀请码输入字段，校验反馈实时显示 |
| 主聊天页 | 三栏布局，响应式（移动端侧边栏折叠） |
| 设置页 | 抽屉式，含邀请码管理（生成/查看） |

---

## 安全边界说明

- 服务端绝不存储消息明文，也无法解密（无私钥）
- 私钥设置 `extractable: false`，JS 层无法导出
- 所有 API 需鉴权（JWT / session cookie，HttpOnly）
- 邀请码单次有效，使用后立即标记
- WebSocket 连接需携带有效 session token
- 密码存储用 bcrypt（cost factor ≥ 12）
