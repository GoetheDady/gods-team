# 江湖 — 端对端加密聊天室

邀请制、端对端加密（E2EE）的私密聊天室。服务器只转发密文，永远无法读取任何消息内容。

## 功能

- **邀请注册**：只有持有有效邀请码才能注册，防止陌生人进入
- **公共大厅**：所有在线用户共享一个加密频道，消息对服务器不可见
- **私聊**：任意两人之间的点对点加密会话
- **消息持久化**：聊天记录存储在本地 IndexedDB，服务器不留存任何消息
- **实时在线列表**：用户加入、离开即时同步

## 加密设计

```
注册时
  └─ 客户端生成 ECDH P-256 密钥对
     公钥上传服务器，私钥仅存于本地 localStorage

大厅消息
  └─ UUID 最小的在线用户为权威节点
     权威生成 AES-256-GCM 对称密钥（hallKey）
     通过 ECDH 派生的共享密钥将 hallKey 加密分发给其他成员
     所有人用 hallKey 加解密大厅消息

私聊
  └─ 双方各自用对方公钥派生 ECDH 共享密钥
     直接用该共享密钥加解密私信，无需服务器中转密钥
```

服务器全程只持有用户公钥和密文，不参与任何密钥协商过程。

## 技术栈

| 端 | 技术 |
|---|---|
| 前端框架 | React 18 + TypeScript + Vite |
| 加密 | Web Crypto API（ECDH P-256 + AES-256-GCM）|
| 本地存储 | IndexedDB |
| 实时通信 | WebSocket |
| 样式 | CSS Modules |
| 后端框架 | Node.js + Express |
| WebSocket | `ws` |
| 数据库 | SQLite（`better-sqlite3`）|
| 认证 | JWT + HttpOnly Cookie |
| 密码 | bcrypt |

## 快速开始

**环境要求**：Node.js 18+

```bash
# 安装依赖
cd server && npm install
cd ../client && npm install

# 启动服务端（端口 3000）
cd server && npm run dev

# 启动前端（端口 5173）
cd client && npm run dev
```

打开 http://localhost:5173

## 初始化

首次启动后，使用管理员邀请码 `ADMIN0001` 注册第一个账号，再由该账号生成邀请码邀请其他人。

## 目录结构

```
.
├── client/          # React 前端
│   └── src/
│       ├── pages/       # Chat、Login、Register、Settings
│       ├── components/  # UserList、MessageList、MessageInput、PrivatePanel
│       └── services/    # api、ws、crypto、localDb
└── server/          # Node.js 后端
    └── src/
        ├── auth.ts      # 注册、登录、JWT
        ├── invite.ts    # 邀请码管理
        ├── pubkey.ts    # 公钥存取
        └── ws.ts        # WebSocket 消息中继
```

## 隐私说明

- 消息在发送前于客户端加密，服务器收到的是密文
- 聊天记录仅保存在用户自己的浏览器 IndexedDB 中
- 清除浏览器数据会丢失本地历史记录（这是 E2EE 的设计取舍）
- 换设备或换浏览器无法查看历史消息
