# 聊天室实现计划总览

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个邀请制 E2EE 加密聊天室，支持公共大厅与私聊，服务端不保存消息，消息历史存本地 SQLite。

**Architecture:** React + TypeScript 前端，Node.js + Express 后端，WebSocket 实时通信。消息使用 Web Crypto API（ECDH P-256 + AES-GCM）端对端加密，服务端仅中继密文。本地消息存储使用 SQLite WASM + OPFS，为后续迁移 Electron/Tauri 保持 SQL 兼容。

**Tech Stack:** React 18, TypeScript 5, Vite, Express 4, ws, better-sqlite3（服务端）, @sqlite.org/sqlite-wasm（客户端）, bcrypt, jsonwebtoken, CSS Modules

---

## 计划文件索引

| 文件 | 内容 |
|------|------|
| [01-project-scaffold.md](./01-project-scaffold.md) | 项目脚手架：目录结构、依赖安装、TS 配置 |
| [02-server-db-auth.md](./02-server-db-auth.md) | 服务端：数据库 schema、注册/登录/JWT |
| [03-server-invite.md](./03-server-invite.md) | 服务端：邀请码生成与验证 |
| [04-server-pubkey.md](./04-server-pubkey.md) | 服务端：公钥上传与获取 API |
| [05-server-websocket.md](./05-server-websocket.md) | 服务端：WebSocket 消息中继与在线状态 |
| [06-client-crypto.md](./06-client-crypto.md) | 客户端：Web Crypto 加密服务 |
| [07-client-db.md](./07-client-db.md) | 客户端：SQLite WASM 本地消息存储 |
| [08-client-auth-ui.md](./08-client-auth-ui.md) | 客户端：登录/注册页面 UI |
| [09-client-chat-ui.md](./09-client-chat-ui.md) | 客户端：主聊天页三栏布局 |
| [10-client-invite-ui.md](./10-client-invite-ui.md) | 客户端：邀请码管理设置页 |

## 文件结构预览

```
gods-team/
├── server/
│   ├── src/
│   │   ├── index.ts          # Express 入口
│   │   ├── db.ts             # SQLite 连接与 schema
│   │   ├── auth.ts           # 注册/登录路由
│   │   ├── invite.ts         # 邀请码路由
│   │   ├── pubkey.ts         # 公钥路由
│   │   ├── ws.ts             # WebSocket 服务
│   │   └── middleware/
│   │       └── auth.ts       # JWT 验证中间件
│   ├── package.json
│   └── tsconfig.json
│
└── client/
    ├── src/
    │   ├── main.tsx
    │   ├── App.tsx
    │   ├── services/
    │   │   ├── crypto.ts     # Web Crypto API 封装
    │   │   ├── localDb.ts    # SQLite WASM 封装
    │   │   ├── api.ts        # REST API 客户端
    │   │   └── ws.ts         # WebSocket 客户端
    │   ├── store/
    │   │   └── chat.ts       # 聊天状态（useState/useReducer）
    │   ├── pages/
    │   │   ├── Login.tsx
    │   │   ├── Register.tsx
    │   │   └── Chat.tsx
    │   ├── components/
    │   │   ├── UserList.tsx
    │   │   ├── MessageList.tsx
    │   │   ├── MessageInput.tsx
    │   │   └── PrivatePanel.tsx
    │   └── styles/
    │       ├── global.css
    │       └── tokens.css    # CSS 变量（颜色、字体）
    ├── index.html
    ├── vite.config.ts
    ├── package.json
    └── tsconfig.json
```
