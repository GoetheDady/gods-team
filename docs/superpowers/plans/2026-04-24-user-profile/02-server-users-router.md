### Task 2：新增 PATCH /api/users/me 接口

**Files:**
- Create: `server/src/users.ts`
- Modify: `server/src/index.ts`

- [ ] **Step 1：创建 `server/src/users.ts`**

```typescript
import { Router } from 'express';
import { requireAuth } from './middleware/auth';
import type { AuthRequest } from './middleware/auth';
import sql from './pg';

const router = Router();

// 更新当前用户的昵称和/或头像 URL
// PATCH /api/users/me
// Body: { nickname?: string; avatar_url?: string }（至少一个字段）
router.patch('/me', requireAuth, async (req: AuthRequest, res) => {
  const { nickname, avatar_url } = req.body as {
    nickname?: string;
    avatar_url?: string;
  };

  // 至少需要一个字段
  if (nickname === undefined && avatar_url === undefined) {
    res.status(400).json({ error: 'nickname or avatar_url required' });
    return;
  }

  // nickname 校验：不能超过 20 字，不能为纯空格
  if (nickname !== undefined) {
    if (nickname.trim().length === 0) {
      res.status(400).json({ error: 'nickname cannot be empty or whitespace' });
      return;
    }
    if (nickname.length > 20) {
      res.status(400).json({ error: 'nickname must be 20 characters or fewer' });
      return;
    }
  }

  // 动态构建只更新传入字段的 SQL
  if (nickname !== undefined && avatar_url !== undefined) {
    await sql`
      UPDATE users SET nickname = ${nickname.trim()}, avatar_url = ${avatar_url}
      WHERE id = ${req.userId!}
    `;
  } else if (nickname !== undefined) {
    await sql`
      UPDATE users SET nickname = ${nickname.trim()}
      WHERE id = ${req.userId!}
    `;
  } else {
    await sql`
      UPDATE users SET avatar_url = ${avatar_url!}
      WHERE id = ${req.userId!}
    `;
  }

  res.json({ ok: true });
});

export default router;
```

- [ ] **Step 2：修改 `server/src/index.ts` — 挂载 usersRouter**

在现有 `import ossRouter from './oss';` 后添加：
```typescript
import usersRouter from './users';
```

在 `app.use('/api/oss', ossRouter);` 后添加：
```typescript
app.use('/api/users', usersRouter);
```

完整的 import 区域变为：
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
import usersRouter from './users';
import { setupWebSocket } from './ws';
```

路由挂载区域变为：
```typescript
app.use('/api/auth', authRouter);
app.use('/api/invite', inviteRouter);
app.use('/api/messages', messagesRouter);
app.use('/api/oss', ossRouter);
app.use('/api/users', usersRouter);
app.get('/api/health', (_req, res) => res.json({ ok: true }));
```

- [ ] **Step 3：类型检查**

```bash
cd server && npx tsc --noEmit
```

Expected: 无错误

- [ ] **Step 4：手动测试（服务运行时）**

注册/登录后用返回的 accessToken 测试：
```bash
# 更新昵称
curl -X PATCH http://localhost:3000/api/users/me \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{"nickname":"剑客无名"}'
# Expected: {"ok":true}

# 空昵称应报错
curl -X PATCH http://localhost:3000/api/users/me \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{"nickname":"   "}'
# Expected: 400 {"error":"nickname cannot be empty or whitespace"}

# 未登录应报错
curl -X PATCH http://localhost:3000/api/users/me \
  -H "Content-Type: application/json" \
  -d '{"nickname":"test"}'
# Expected: 401
```

- [ ] **Step 5：提交**

```bash
git add server/src/users.ts server/src/index.ts
git commit -m "feat(server): add PATCH /api/users/me endpoint for profile update"
```
