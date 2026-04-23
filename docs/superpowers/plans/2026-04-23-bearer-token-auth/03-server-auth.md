### Task 3：重写 auth.ts — 双 token 签发 + refresh + logout

**Files:**
- Modify: `server/src/auth.ts`

- [ ] **Step 1：完整替换 `server/src/auth.ts`**

```typescript
import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import bcrypt from 'bcrypt';
import sql from './pg';
import { signToken, requireAuth, AuthRequest } from './middleware/auth';

const router = Router();

// 辅助函数：签发 access token 并生成 refresh token 写库
async function issueTokens(userId: string, username: string) {
  const accessToken = signToken(userId, username);
  const refreshToken = randomUUID();
  const expiresAt = Date.now() + 7 * 24 * 3600 * 1000;
  await sql`
    INSERT INTO refresh_tokens (token, user_id, expires_at)
    VALUES (${refreshToken}, ${userId}, ${expiresAt})
  `;
  return { accessToken, refreshToken };
}

// 注册：验证邀请码 → 创建用户 → 签发双 token
router.post('/register', async (req: Request, res: Response) => {
  const { username, password, invite_code } = req.body as {
    username?: string;
    password?: string;
    invite_code?: string;
  };

  if (!username || !password || !invite_code) {
    res.status(400).json({ error: 'username, password, invite_code required' });
    return;
  }

  const [code] = await sql<{ code: string; used_by: string | null }[]>`
    SELECT code, used_by FROM invite_codes WHERE code = ${invite_code}
  `;
  if (!code || code.used_by !== null) {
    res.status(400).json({ error: 'Invalid or already used invite code' });
    return;
  }

  const [existing] = await sql`SELECT id FROM users WHERE username = ${username}`;
  if (existing) {
    res.status(400).json({ error: 'Username already taken' });
    return;
  }

  const hash = await bcrypt.hash(password, 12);
  const userId = randomUUID();
  const now = Date.now();

  await sql.begin(async (tx) => {
    await tx`
      INSERT INTO users (id, username, password, is_admin, created_at)
      VALUES (${userId}, ${username}, ${hash}, FALSE, ${now})
    `;
    await tx`
      UPDATE invite_codes SET used_by = ${userId}, used_at = ${now}
      WHERE code = ${invite_code}
    `;
  });

  const { accessToken, refreshToken } = await issueTokens(userId, username);
  res.json({ userId, username, accessToken, refreshToken });
});

// 登录：验证密码 → 签发双 token
router.post('/login', async (req: Request, res: Response) => {
  const { username, password } = req.body as { username?: string; password?: string };

  if (!username || !password) {
    res.status(400).json({ error: 'username and password required' });
    return;
  }

  const [user] = await sql<{ id: string; username: string; password: string }[]>`
    SELECT id, username, password FROM users WHERE username = ${username}
  `;
  if (!user || !(await bcrypt.compare(password, user.password))) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const { accessToken, refreshToken } = await issueTokens(user.id, user.username);
  res.json({ userId: user.id, username: user.username, accessToken, refreshToken });
});

// 刷新 token：验证旧 refresh token → 删除旧 token → 签发新双 token（轮转）
router.post('/refresh', async (req: Request, res: Response) => {
  const { refreshToken } = req.body as { refreshToken?: string };
  if (!refreshToken) {
    res.status(400).json({ error: 'refreshToken required' });
    return;
  }

  const [row] = await sql<{ token: string; user_id: string; expires_at: number }[]>`
    SELECT token, user_id, expires_at FROM refresh_tokens WHERE token = ${refreshToken}
  `;
  if (!row || row.expires_at < Date.now()) {
    res.status(401).json({ error: 'Invalid or expired refresh token' });
    return;
  }

  // 获取用户信息用于签发新 access token
  const [user] = await sql<{ id: string; username: string }[]>`
    SELECT id, username FROM users WHERE id = ${row.user_id}
  `;
  if (!user) {
    res.status(401).json({ error: 'User not found' });
    return;
  }

  // 删除旧 refresh token（轮转），保证一次性使用
  await sql`DELETE FROM refresh_tokens WHERE token = ${refreshToken}`;

  const tokens = await issueTokens(user.id, user.username);
  res.json(tokens);
});

// 登出：删除 refresh token，客户端清 localStorage
router.post('/logout', requireAuth, async (req: AuthRequest, res: Response) => {
  await sql`DELETE FROM refresh_tokens WHERE user_id = ${req.userId!}`;
  res.json({ ok: true });
});

// 验证当前 token 有效性
router.get('/me', requireAuth, (req: AuthRequest, res: Response) => {
  res.json({ userId: req.userId, username: req.username });
});

export default router;
```

注意变化：
- `signToken` 现在签发 15 分钟的 access token
- register/login 返回 `{ userId, username, accessToken, refreshToken }`，不再 `res.cookie()`
- 新增 `POST /refresh` 接口
- logout 改为 `requireAuth`，删除该用户所有 refresh token
- 删除 `GET /token` 接口

- [ ] **Step 2：类型检查**

```bash
cd server && npx tsc --noEmit
```

Expected: 无输出（如果 index.ts 中还有 `cookieParser` 引用报错，先忽略，Task 5 处理）

- [ ] **Step 3：提交**

```bash
git add server/src/auth.ts
git commit -m "feat(server): dual token auth - access + refresh token, remove cookies"
```
