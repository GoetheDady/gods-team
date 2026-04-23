# 服务端改动清单

## 删除文件

| 文件 | 原因 |
|------|------|
| `src/pubkey.ts` | 公钥存储，E2EE 移除后不需要 |
| `src/upload.ts` | 本地文件上传，改用 OSS |
| `src/cleanup.ts` | 本地文件定时清理，OSS 无需 |
| `src/db.ts` | SQLite 单例，替换为 pg.ts |

## 新增文件

### `src/pg.ts`

PostgreSQL 连接单例，使用 `postgres.js` 驱动：

```ts
import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL!);
// 自动建表（users、invite_codes、messages）
export default sql;
```

### `src/oss.ts`

OSS 签名路由：

```
GET /api/oss/sign   （需登录）
```

使用 HMAC-SHA1 生成 PostPolicy 签名，返回 `{ url, fields }`。
依赖：`crypto`（Node.js 内置），无需额外 SDK。

### `src/messages.ts`

历史记录路由：

```
GET /api/messages/:chatId?before=<timestamp>&limit=50   （需登录）
```

## 重写文件

### `src/ws.ts`

- 删除：`hall_key_distribution` 消息类型处理
- 新增：收到 `hall_message` / `private_message` 后写入 `messages` 表
- 消息写库后再广播，确保 id 和 timestamp 一致
- `online_users` 下发不再触发密钥分发

### `src/auth.ts` / `src/invite.ts`

- SQL 占位符从 SQLite 的 `?` 改为 PostgreSQL 的 `$1, $2, ...`
- 使用 `postgres.js` 的模板字面量语法（`` sql`...` ``）

### `src/index.ts`

- 删除：`pubkeyRouter`、`uploadRouter`、`FILES_DIR`、`startCleanup`、`/files` 静态路由
- 新增：`ossRouter`（`/api/oss`）、`messagesRouter`（`/api/messages`）

## 依赖变更

```json
// 删除
"better-sqlite3": "^12.9.0"

// 新增
"postgres": "^3.4.5"
```

## docker-compose.yml 变更

生产容器新增环境变量：

```yaml
environment:
  - NODE_ENV=production
  - JWT_SECRET=${JWT_SECRET}
  - DATABASE_URL=postgresql://gods:gods123@gods-team-db:5432/gods_team_prod
  - OSS_ENDPOINT=oss-cn-beijing.aliyuncs.com
  - OSS_BUCKET=gdsw-ai-web-chat
  - OSS_ACCESS_KEY_ID=${OSS_ACCESS_KEY_ID}
  - OSS_ACCESS_KEY_SECRET=${OSS_ACCESS_KEY_SECRET}
  - OSS_DIR_PREFIX=gods-team-prod
```

`gods-team-db` 容器需与 `gods-team` 在同一 Docker 网络中。
