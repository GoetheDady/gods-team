### Task 1：新增 refresh_tokens 表

**Files:**
- Modify: `server/src/pg.ts`

- [ ] **Step 1：在 `server/src/pg.ts` 的 `initDb()` 中，messages 建表之后、idx_messages_chat 索引之前，添加 refresh_tokens 建表语句**

```typescript
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
```

- [ ] **Step 2：类型检查**

```bash
cd server && npx tsc --noEmit
```

Expected: 无输出

- [ ] **Step 3：提交**

```bash
git add server/src/pg.ts
git commit -m "feat(server): add refresh_tokens table to schema"
```
