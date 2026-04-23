### Task 1：数据库加列

**Files:**
- Modify: `server/src/pg.ts`

当前 `users` 表建表语句在 `initDb()` 中，需要在 `CREATE TABLE IF NOT EXISTS users` 之后补两条 `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`，确保幂等（已有列不会报错）。

- [ ] **Step 1：修改 `server/src/pg.ts`**

在 `initDb()` 函数的第一个 `CREATE TABLE IF NOT EXISTS users` 语句之后，添加以下两行（放在 `CREATE TABLE IF NOT EXISTS invite_codes` 之前）：

```typescript
export async function initDb() {
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id          TEXT PRIMARY KEY,
      username    TEXT UNIQUE NOT NULL,
      password    TEXT NOT NULL,
      is_admin    BOOLEAN DEFAULT FALSE,
      created_at  BIGINT NOT NULL
    )
  `;
  // 新增列：幂等，已有列不报错
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS nickname TEXT DEFAULT NULL`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT DEFAULT NULL`;

  await sql`
    CREATE TABLE IF NOT EXISTS invite_codes (
      // ... 其余不变
```

完整替换 `initDb()` 函数（保留其余内容不变，只在 users 建表后插入两行）：

```typescript
export async function initDb() {
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id          TEXT PRIMARY KEY,
      username    TEXT UNIQUE NOT NULL,
      password    TEXT NOT NULL,
      is_admin    BOOLEAN DEFAULT FALSE,
      created_at  BIGINT NOT NULL
    )
  `;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS nickname TEXT DEFAULT NULL`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT DEFAULT NULL`;
  await sql`
    CREATE TABLE IF NOT EXISTS invite_codes (
      code        TEXT PRIMARY KEY,
      created_by  TEXT REFERENCES users(id),
      used_by     TEXT REFERENCES users(id),
      created_at  BIGINT NOT NULL,
      used_at     BIGINT
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS messages (
      id          TEXT PRIMARY KEY,
      chat_id     TEXT NOT NULL,
      sender_id   TEXT REFERENCES users(id),
      sender_name TEXT NOT NULL,
      content     TEXT,
      images      JSONB,
      created_at  BIGINT NOT NULL
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      token      TEXT PRIMARY KEY,
      user_id    TEXT REFERENCES users(id),
      expires_at BIGINT NOT NULL
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user
      ON refresh_tokens(user_id)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_messages_chat
      ON messages(chat_id, created_at DESC)
  `;
  await sql`
    INSERT INTO invite_codes (code, created_by, created_at)
    VALUES ('ADMIN0001', NULL, 0)
    ON CONFLICT DO NOTHING
  `;
}
```

- [ ] **Step 2：类型检查**

```bash
cd /path/to/project/server && npx tsc --noEmit
```

Expected: 无输出（零错误）

- [ ] **Step 3：手动验证（可选）**

启动服务后查询列是否存在：
```bash
DATABASE_URL=postgresql://gods:gods123@localhost:5433/gods_team_dev pnpm dev
# 另一终端
psql postgresql://gods:gods123@localhost:5433/gods_team_dev -c "\d users"
```

Expected: 表中出现 `nickname` 和 `avatar_url` 两列。

- [ ] **Step 4：提交**

```bash
git add server/src/pg.ts
git commit -m "feat(server): add nickname and avatar_url columns to users table"
```
