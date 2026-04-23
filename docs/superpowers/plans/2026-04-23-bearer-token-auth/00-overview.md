# Bearer Token 认证改造 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将认证从 HttpOnly cookie 改为 `Authorization: Bearer` 请求头，引入 access token（15 分钟）+ refresh token（7 天）双 token 机制。

**Architecture:** 服务端 JWT 签发 access token，refresh token 为随机 UUID 存 PostgreSQL `refresh_tokens` 表。客户端 token 存 localStorage，401 时自动 refresh。WS 鉴权改为连接后第一条消息发送 `{ type: 'auth', token }`。

**Tech Stack:** JWT（jsonwebtoken）、PostgreSQL（postgres.js）、React + TypeScript

**Spec:** `docs/superpowers/specs/2026-04-23-bearer-token-auth.md`

---

## 文件变更总览

### 服务端

| 操作 | 文件 |
|------|------|
| 修改 | `server/src/pg.ts` — 新增 refresh_tokens 建表 |
| 重写 | `server/src/middleware/auth.ts` — 只从 Authorization 头取 token |
| 重写 | `server/src/auth.ts` — 返回双 token，新增 refresh/logout 接口 |
| 重写 | `server/src/ws.ts` — 连接后等 auth 消息才鉴权 |
| 修改 | `server/src/index.ts` — 删除 cookie-parser |
| 修改 | `server/tests/setup.ts` — 清理 refresh_tokens |
| 修改 | `server/tests/auth.test.ts` — 适配新接口 |
| 删除依赖 | `cookie-parser`、`@types/cookie-parser` |

### 客户端

| 操作 | 文件 |
|------|------|
| 重写 | `client/src/services/api.ts` — localStorage + 自动 refresh |
| 重写 | `client/src/services/ws.ts` — 无参 connect + auth 消息 |
| 修改 | `client/src/App.tsx` — localStorage 读 token |
| 修改 | `client/src/pages/Login.tsx` — 存 token |
| 修改 | `client/src/pages/Register.tsx` — 存 token |
| 修改 | `client/src/pages/Chat.tsx` — 删除 getToken |

## 任务列表

| Task | 文件 | 说明 |
|------|------|------|
| [Task 1](01-server-pg.md) | `server/src/pg.ts` | 新增 refresh_tokens 表 |
| [Task 2](02-server-middleware.md) | `server/src/middleware/auth.ts` | 只读 Authorization 头 |
| [Task 3](03-server-auth.md) | `server/src/auth.ts` | 双 token 签发 + refresh + logout |
| [Task 4](04-server-ws.md) | `server/src/ws.ts` | WS auth 消息鉴权 |
| [Task 5](05-server-cleanup.md) | `server/src/index.ts` + 测试 | 删 cookie-parser + 更新测试 |
| [Task 6](06-client-api.md) | `client/src/services/api.ts` | localStorage + 自动 refresh |
| [Task 7](07-client-ws.md) | `client/src/services/ws.ts` | 无参 connect + auth 消息 |
| [Task 8](08-client-pages.md) | App + Login + Register + Chat | 适配新 token 存储 |
