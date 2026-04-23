# 阶段一：数据库表结构

## 删除

- `public_keys` 表（E2EE 公钥，随加密一起去掉）
- `better-sqlite3` 依赖

## 新增依赖

- `postgres`（postgres.js）—— PostgreSQL 驱动，TypeScript 原生支持

## 表结构

### users

```sql
CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,
  username    TEXT UNIQUE NOT NULL,
  password    TEXT NOT NULL,
  is_admin    BOOLEAN DEFAULT FALSE,
  created_at  BIGINT NOT NULL
);
```

### invite_codes

```sql
CREATE TABLE IF NOT EXISTS invite_codes (
  code        TEXT PRIMARY KEY,
  created_by  TEXT REFERENCES users(id),
  used_by     TEXT REFERENCES users(id),
  created_at  BIGINT NOT NULL,
  used_at     BIGINT
);
```

### messages

```sql
CREATE TABLE IF NOT EXISTS messages (
  id          TEXT PRIMARY KEY,
  chat_id     TEXT NOT NULL,
  sender_id   TEXT REFERENCES users(id),
  sender_name TEXT NOT NULL,
  content     TEXT,
  images      JSONB,
  created_at  BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_chat
  ON messages(chat_id, created_at DESC);
```

## chat_id 规则

- 大厅：固定值 `'hall'`
- 私聊：两个 userId 字典序排序后用 `:` 拼接，例如 `uid_a:uid_b`（保证同一对话唯一）

## images 字段格式

```json
[{ "url": "https://gdsw-ai-web-chat.oss-cn-beijing.aliyuncs.com/gods-team-prod/uuid.jpg" }]
```

## 初始化引导数据

```sql
INSERT INTO invite_codes (code, created_by, created_at)
VALUES ('ADMIN0001', NULL, 0)
ON CONFLICT DO NOTHING;
```
