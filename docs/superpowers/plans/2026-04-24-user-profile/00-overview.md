# 用户头像与昵称功能 — 实施计划总览

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 允许用户上传头像并设置独立昵称，头像和昵称在在线用户列表与消息气泡中展示。

**Architecture:** `users` 表新增 `nickname`/`avatar_url` 两列；新增 `PATCH /api/users/me` 接口；WS 在线用户事件携带 nickname/avatar_url；前端新增可复用 `Avatar` 组件，在 UserList、MessageList、Settings 中使用。

**Tech Stack:** PostgreSQL（postgres.js）、阿里云 OSS（现有 sign 接口复用）、React + CSS Modules、TypeScript

---

## 任务列表

| # | 文件 | 任务 |
|---|---|---|
| [Task 1](./01-db-schema.md) | `server/src/pg.ts` | 数据库加列 |
| [Task 2](./02-server-users-router.md) | `server/src/users.ts`、`server/src/index.ts` | 新增 PATCH /api/users/me |
| [Task 3](./03-server-auth-ws.md) | `server/src/auth.ts`、`server/src/ws.ts`、`server/src/messages.ts` | 更新 /me 返回值、WS 事件、发消息时用 nickname |
| [Task 4](./04-client-avatar.md) | `client/src/components/Avatar.tsx`、`Avatar.module.css` | 可复用 Avatar 组件 |
| [Task 5](./05-client-api-app.md) | `client/src/services/api.ts`、`client/src/App.tsx` | api 新增 updateProfile，App auth state 扩展 |
| [Task 6](./06-client-chat-userlist.md) | `client/src/pages/Chat.tsx`、`client/src/components/UserList.tsx` | Chat 传 avatar 数据，UserList 展示 Avatar |
| [Task 7](./07-client-messagelist.md) | `client/src/components/MessageList.tsx` | 消息气泡展示 Avatar |
| [Task 8](./08-client-settings.md) | `client/src/pages/Settings.tsx`、`Settings.module.css` | Settings 个人资料卡片 |

---

## 不在范围内

- 昵称修改不实时同步给其他在线用户（刷新后生效）
- 不支持删除头像（只能替换）
- 历史消息 sender_name 不追溯更新
