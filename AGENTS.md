# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

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

## 项目：江湖聊天室

### 常用命令

```bash
# 启动后端（端口 3000，需要 PostgreSQL 运行）
cd server && pnpm dev

# 启动前端（端口 5173）
cd client && pnpm dev

# 后端单测
cd server && pnpm test

# 运行单个后端测试文件
cd server && pnpm exec vitest run tests/auth.test.ts

# 前端 lint
cd client && pnpm lint

# 构建
cd client && pnpm build
cd server && pnpm build
```

首次启动使用管理员邀请码 `ADMIN0001` 注册第一个账号。

### 环境变量

| 变量 | 默认值 | 说明 |
|---|---|---|
| `JWT_SECRET` | `dev-secret-change-in-prod` | JWT 签名密钥，生产环境必须修改 |
| `PORT` | `3000` | 服务端端口 |
| `CORS_ORIGIN` | `http://localhost:5173` | 开发环境 CORS 允许的来源 |
| `NODE_ENV` | — | 设为 `production` 时 serve 静态文件 + 禁用 CORS |
| `DATABASE_URL` | `postgresql://gods:gods123@localhost:5433/gods_team_dev` | PostgreSQL 连接串 |
| `OSS_ENDPOINT` | — | 阿里云 OSS Endpoint |
| `OSS_BUCKET` | — | 阿里云 OSS Bucket 名称 |
| `OSS_ACCESS_KEY_ID` | — | 阿里云 AccessKey ID |
| `OSS_ACCESS_KEY_SECRET` | — | 阿里云 AccessKey Secret |
| `OSS_DIR_PREFIX` | `gods-team-dev` | OSS 文件目录前缀，生产用 `gods-team-prod` |

### Docker 部署

```bash
docker compose up -d --build
```

生产模式：客户端构建产物由 Express 直接 serve（无独立前端服务）。PostgreSQL 运行在独立的 `gods-team-db` 容器中，两个容器通过 `gods-net` 网络通信。

### 架构概览

**后端** (`server/src/`)
- `index.ts` — Express 入口，挂载路由，启动时调用 `initDb()` 建表，升级 WebSocket
- `pg.ts` — PostgreSQL 连接单例（postgres.js），`initDb()` 建表并种子 ADMIN0001 邀请码
- `auth.ts` — 注册（邀请码验证 + bcrypt）、登录、JWT 签发，使用 `sql.begin()` 事务保证原子性
- `invite.ts` — 邀请码生成和查询
- `messages.ts` — 消息相关：`POST /api/messages` 发送消息（写库 + WS 广播）、`GET /api/messages/:chatId` 分页查询历史
- `oss.ts` — 阿里云 OSS PostPolicy 签名（HMAC-SHA1），客户端拿到签名后直传 OSS
- `ws.ts` — WebSocket 连接管理：JWT 鉴权、在线用户状态、typing 状态、消息广播/推送
- `middleware/auth.ts` — `requireAuth` 中间件，从 HttpOnly cookie 或 Authorization header 提取 JWT

**前端** (`client/src/`)
- `services/api.ts` — fetch 封装，所有 REST API 调用（登录、注册、发消息、OSS 签名等）
- `services/ws.ts` — WebSocket 客户端，事件发布订阅，单例
- `pages/Chat.tsx` — 核心页面，管理在线用户、消息列表、私聊切换、历史分页加载
- `pages/Settings.tsx` — 邀请码管理
- `components/MessageList.tsx` — 消息列表（支持分页加载更多、OSS 图片渲染、灯箱）
- `components/MessageInput.tsx` — 消息输入（支持 OSS 直传图片、剪贴板粘贴）
- `components/PrivatePanel.tsx` — 私聊面板
- `components/UserList.tsx` — 在线用户列表
- `styles/tokens.css` + `styles/global.css` — CSS 变量与全局样式
- `App.tsx` — 路由守卫，`/me` 接口验证登录态

### 消息通信机制

**发送消息**：客户端通过 `POST /api/messages` 发送（HTTP），服务端写入 PostgreSQL 后通过 WS 广播/推送给在线用户。

**接收消息**：通过 WebSocket 实时推送，WS 只用于接收和 typing 状态。

**历史加载**：`GET /api/messages/:chatId?before=<ts>&limit=50` 分页查询，滚到顶加载更多。

**图片上传**：客户端先调 `GET /api/oss/sign` 获取签名，然后 FormData 直传阿里云 OSS，拿到 URL 后随消息发送。

### 数据模型（PostgreSQL）

```sql
users(id TEXT PK, username TEXT UNIQUE, password TEXT, is_admin BOOLEAN, created_at BIGINT)
invite_codes(code TEXT PK, created_by TEXT FK, used_by TEXT FK, created_at BIGINT, used_at BIGINT)
messages(id TEXT PK, chat_id TEXT, sender_id TEXT FK, sender_name TEXT, content TEXT, images JSONB, created_at BIGINT)
-- chat_id: 大厅为 'hall'，私聊为两个 userId 排序后用 ':' 连接（如 'uid_a:uid_b'）
-- messages 索引: idx_messages_chat ON (chat_id, created_at DESC)
```

### Docker 网络

生产环境使用 `gods-net` 外部网络，`gods-team` 和 `gods-team-db` 容器在同一网络中。PostgreSQL 连接串使用容器名：`postgresql://gods:gods123@gods-team-db:5432/gods_team_prod`。

### 注意事项

- `import type` 必须用于仅类型导入（TypeScript isolatedModules 要求）
- 前端通过 `/api` proxy 访问后端，WebSocket 通过 `/ws` proxy
- 后端测试位于 `server/tests/`（auth、invite），使用 Vitest
- 样式使用 CSS Modules（`.module.css`），组件和样式文件同名并列存放
- React StrictMode 下 useEffect 会执行两次，WS handler 必须在同步顶部注册（stale closure 注意事项见 Chat.tsx 注释）
- 包管理工具使用 pnpm
