### Task 5：服务端收尾 — 删 cookie-parser + 更新测试

**Files:**
- Modify: `server/src/index.ts`
- Modify: `server/tests/setup.ts`
- Modify: `server/tests/auth.test.ts`
- Uninstall: `cookie-parser`, `@types/cookie-parser`

- [ ] **Step 1：修改 `server/src/index.ts`**

删除第 5 行的 `import cookieParser from 'cookie-parser';`
删除第 21 行的 `app.use(cookieParser());`

完整替换后的文件：

```typescript
import express from 'express';
import cors from 'cors';
import http from 'http';
import path from 'path';
import { initDb } from './pg';
import authRouter from './auth';
import inviteRouter from './invite';
import messagesRouter from './messages';
import ossRouter from './oss';
import { setupWebSocket } from './ws';

const app = express();
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? false
    : (process.env.CORS_ORIGIN || 'http://localhost:5173'),
  credentials: true,
}));
app.use(express.json());

app.use('/api/auth', authRouter);
app.use('/api/invite', inviteRouter);
app.use('/api/messages', messagesRouter);
app.use('/api/oss', ossRouter);
app.get('/api/health', (_req, res) => res.json({ ok: true }));

if (process.env.NODE_ENV === 'production') {
  const clientDist = '/app/client/dist';
  app.use(express.static(clientDist));
  app.use((_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

const server = http.createServer(app);
setupWebSocket(server);

if (process.env.NODE_ENV !== 'test') {
  (async () => {
    await initDb();
    const port = Number(process.env.PORT) || 3000;
    server.listen(port, () => {
      console.log(`Server running on http://localhost:${port}`);
    });
  })();
}

export { app, server };
```

- [ ] **Step 2：卸载 cookie-parser**

```bash
cd server && pnpm remove cookie-parser @types/cookie-parser
```

- [ ] **Step 3：更新 `server/tests/setup.ts`**

完整替换：

```typescript
import { initDb } from '../src/pg';
import sql from '../src/pg';

export async function setupTestDb() {
  await initDb();
  await sql`DELETE FROM messages`;
  await sql`DELETE FROM refresh_tokens`;
  await sql`DELETE FROM invite_codes WHERE code != 'ADMIN0001'`;
  await sql`UPDATE invite_codes SET used_by = NULL, used_at = NULL WHERE code = 'ADMIN0001'`;
  await sql`DELETE FROM users`;
}

export async function teardownTestDb() {
  await sql`DELETE FROM messages`;
  await sql`DELETE FROM refresh_tokens`;
  await sql`DELETE FROM invite_codes WHERE code != 'ADMIN0001'`;
  await sql`DELETE FROM users`;
  await sql.end();
}
```

注意：清表顺序遵循外键依赖：messages → refresh_tokens → invite_codes → users

- [ ] **Step 4：更新 `server/tests/auth.test.ts`**

完整替换：

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/index';
import { setupTestDb, teardownTestDb } from './setup';

describe('Auth API', () => {
  beforeAll(async () => {
    await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    const { default: sql } = await import('../src/pg');
    await sql`DELETE FROM refresh_tokens`;
    await sql`DELETE FROM users`;
    await sql`UPDATE invite_codes SET used_by = NULL, used_at = NULL WHERE code = 'ADMIN0001'`;
  });

  it('should register and return accessToken + refreshToken', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'testuser', password: 'testpass123', invite_code: 'ADMIN0001' });

    expect(res.status).toBe(200);
    expect(res.body.username).toBe('testuser');
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
  });

  it('should reject registration with invalid invite code', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'testuser', password: 'testpass123', invite_code: 'INVALID' });

    expect(res.status).toBe(400);
  });

  it('should login and return tokens', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ username: 'logintest', password: 'testpass123', invite_code: 'ADMIN0001' });

    // Reset invite code
    const { default: sql } = await import('../src/pg');
    await sql`UPDATE invite_codes SET used_by = NULL, used_at = NULL WHERE code = 'ADMIN0001'`;

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'logintest', password: 'testpass123' });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
  });

  it('should access /me with Bearer token', async () => {
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({ username: 'metest', password: 'testpass123', invite_code: 'ADMIN0001' });

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${regRes.body.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.username).toBe('metest');
  });

  it('should reject /me without token', async () => {
    const res = await request(app)
      .get('/api/auth/me');

    expect(res.status).toBe(401);
  });

  it('should refresh tokens', async () => {
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({ username: 'refreshtest', password: 'testpass123', invite_code: 'ADMIN0001' });

    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: regRes.body.refreshToken });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    // 新 token 应不同于旧 token（轮转）
    expect(res.body.refreshToken).not.toBe(regRes.body.refreshToken);
  });

  it('should reject invalid refresh token', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: 'invalid-token' });

    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 5：类型检查**

```bash
cd server && npx tsc --noEmit
```

- [ ] **Step 6：运行测试**

```bash
cd server && DATABASE_URL=postgresql://gods:gods123@localhost:5433/gods_team_dev pnpm test
```

Expected: 所有测试通过（需要 PostgreSQL 在线）

- [ ] **Step 7：提交**

```bash
git add server/src/index.ts server/package.json server/pnpm-lock.yaml server/tests/
git commit -m "refactor(server): remove cookie-parser, update tests for bearer token"
```
