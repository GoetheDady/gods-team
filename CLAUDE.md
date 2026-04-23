# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

减少 LLM 常见编码错误的行为准则。根据需要与项目特定说明合并使用。

**权衡取舍：** 这些准则偏向谨慎而非速度。对于琐碎任务，请自行判断。

## 1. 编码前先思考

**不要假设。不要隐藏困惑。暴露权衡取舍。**

在实现之前：
- 明确说明你的假设。如有不确定，先询问。
- 如果存在多种理解方式，逐一列出——不要默默选择一种。
- 如果有更简单的方案，说出来。必要时提出异议。
- 如果有不清楚的地方，停下来。指出困惑所在，然后询问。

## 2. 简洁优先

**用最少的代码解决问题。不做任何推测性实现。**

- 不添加超出要求的功能。
- 不为单次使用的代码做抽象。
- 不添加未被要求的"灵活性"或"可配置性"。
- 不为不可能发生的场景添加错误处理。
- 如果写了 200 行但 50 行就能搞定，重写它。

问自己："一个资深工程师会说这过于复杂吗？"如果是，就简化。

## 3. 外科手术式修改

**只改必须改的。只清理自己制造的混乱。**

修改已有代码时：
- 不要"顺手改进"相邻代码、注释或格式。
- 不要重构没有问题的代码。
- 匹配已有风格，即使你会用不同方式写。
- 如果发现无关的死代码，提及它——但不要删除。

当你的修改产生孤儿代码时：
- 移除因**你的修改**而变得无用的 import/变量/函数。
- 不要移除已有的死代码，除非被明确要求。

检验标准：每一行改动都应直接对应用户的请求。

## 4. 目标驱动执行

**定义成功标准。循环验证直到达成。**

将任务转化为可验证的目标：
- "添加验证" → "为无效输入编写测试，然后让测试通过"
- "修复 bug" → "编写复现该 bug 的测试，然后让测试通过"
- "重构 X" → "确保重构前后测试均通过"

对于多步骤任务，先陈述简要计划：
```
1. [步骤] → 验证：[检查项]
2. [步骤] → 验证：[检查项]
3. [步骤] → 验证：[检查项]
```

强成功标准让你能独立循环推进。弱标准（"让它能用"）则需要不断澄清。

---

**这些准则有效的标志：** diff 中多余的改动更少、因过度复杂而返工的情况更少、澄清性问题在实现前提出而非在出错后补问。

---

## 项目：江湖 E2EE 聊天室

### 常用命令

```bash
# 启动后端（端口 3000）
cd server && npm run dev

# 启动前端（端口 5173）
cd client && npm run dev

# 后端单测
cd server && npm test

# 运行单个后端测试文件
cd server && npx vitest run tests/auth.test.ts

# 前端浏览器测试（Vitest + Playwright Chromium）
cd client && npm run test:browser

# 运行单个前端测试文件
cd client && npx vitest --config vitest.config.browser.ts run tests/crypto.test.ts

# 前端 lint
cd client && npm run lint

# 构建
cd client && npm run build
cd server && npm run build
```

首次启动使用管理员邀请码 `ADMIN0001` 注册第一个账号。

### 环境变量

| 变量 | 默认值 | 说明 |
|---|---|---|
| `JWT_SECRET` | `dev-secret-change-in-prod` | JWT 签名密钥，生产环境必须修改 |
| `PORT` | `3000` | 服务端端口 |
| `CORS_ORIGIN` | `http://localhost:5173` | 开发环境 CORS 允许的来源 |
| `NODE_ENV` | — | 设为 `production` 时 serve 静态文件 + 禁用 CORS |

### Docker 部署

```bash
docker compose up -d
```

生产模式：客户端构建产物由 Express 直接 serve（无独立前端服务）。数据持久化到 Docker volume `gods-team-data`。

### 架构概览

**后端** (`server/src/`)
- `index.ts` — Express 入口，挂载路由，升级 WebSocket
- `db.ts` — `better-sqlite3` 单例，同步 API，数据库文件 `data/chatroom.db`，表：`users`、`invite_codes`、`pubkeys`
- `auth.ts` — 注册（邀请码验证 + bcrypt）、登录、JWT 签发
- `invite.ts` — 邀请码 CRUD（管理员权限由 JWT payload 中 `isAdmin` 标志控制）
- `pubkey.ts` — 公钥上传/查询（每个用户一条记录，upsert）
- `middleware/auth.ts` — `requireAuth` 中间件，从 HttpOnly cookie 或 Authorization header 提取 JWT
- `ws.ts` — WebSocket 中继：JWT 鉴权后加入房间，纯转发密文，不解析消息内容

**前端** (`client/src/`)
- `services/crypto.ts` — Web Crypto API 封装：ECDH P-256 密钥对、AES-256-GCM 加解密、密钥包装/解包
- `services/ws.ts` — WebSocket 客户端，事件发布订阅，单例
- `services/localDb.ts` — IndexedDB 封装，存储明文消息（解密后），索引 `[chat_id, timestamp]`
- `services/api.ts` — fetch 封装，REST API 调用
- `pages/Chat.tsx` — 核心页面，管理 E2EE 状态机、WebSocket 消息处理、大厅/私聊逻辑
- `pages/Settings.tsx` — 邀请码管理（管理员）
- `styles/tokens.css` + `styles/global.css` — CSS 变量与全局样式
- `App.tsx` — 路由守卫，`/me` 接口验证登录态

### E2EE 协议关键点

**大厅密钥权威选举**：在线用户列表中 UUID 字典序最小的用户为权威节点，负责生成 `hallKey`（AES-256-GCM）并用 ECDH 派生的共享密钥逐一分发给其他成员。

**session key 缓存失效**：`user_joined` 事件中必须 `sessionKeys.current.delete(u.id)`，因为重连用户可能已重新生成密钥对。

**React StrictMode 陷阱**（`Chat.tsx`）：
- `wsClient.on()` 必须在 `useEffect` 同步顶部注册（不能在 `async init()` 内部），否则 cleanup 先于 init 完成执行，导致 handler 无法取消订阅，出现双倍消息。
- WS handler 闭包内不能读取 React state（stale closure）；`activePeerId` 需用 `activePeerIdRef` ref 同步。

**IndexedDB vs SQLite WASM**：`sqlite-wasm` 的 OPFS VFS 需要 `FileSystemSyncAccessHandle`，该 API 仅在 Worker 上下文可用，主线程调用会静默失败。本项目使用原生 IndexedDB。

### 数据模型（SQLite）

```sql
users(id TEXT PK, username TEXT UNIQUE, password TEXT, is_admin INTEGER, created_at INTEGER)
invite_codes(code TEXT PK, created_by TEXT, used_by TEXT, used_at INTEGER, created_at INTEGER)
pubkeys(user_id TEXT PK, key_data TEXT, updated_at INTEGER)
```

### 注意事项

- `import type` 必须用于仅类型导入（TypeScript isolatedModules 要求）
- vite dev server 已配置 COOP/COEP 响应头（原为 SQLite WASM SharedArrayBuffer 所需，现已无实际用途但保留无害）
- 前端通过 `/api` proxy 访问后端，WebSocket 通过 `/ws` proxy
- 后端测试位于 `server/tests/`（auth、invite、pubkey），前端测试位于 `client/tests/`（crypto、localDb）
- 样式使用 CSS Modules（`.module.css`），组件和样式文件同名并列存放
