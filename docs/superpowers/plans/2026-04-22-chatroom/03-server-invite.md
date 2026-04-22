# Task 03: 服务端邀请码

**Files:**
- Create: `server/src/invite.ts`
- Modify: `server/src/index.ts`

---

- [ ] **Step 1: 创建 `server/src/invite.ts`**

```typescript
import { Router, Response } from 'express';
import { randomBytes } from 'crypto';
import db from './db';
import { requireAuth, AuthRequest } from './middleware/auth';

const router = Router();

// 生成邀请码（已登录用户）
router.post('/generate', requireAuth, (req: AuthRequest, res: Response) => {
  const code = randomBytes(4).toString('hex').toUpperCase(); // 8位大写十六进制
  const now = Date.now();

  db.prepare(
    'INSERT INTO invite_codes (code, created_by, created_at) VALUES (?, ?, ?)'
  ).run(code, req.userId, now);

  res.json({ code });
});

// 查看自己生成的邀请码列表
router.get('/mine', requireAuth, (req: AuthRequest, res: Response) => {
  const codes = db
    .prepare(
      `SELECT code, created_at, used_by, used_at
       FROM invite_codes
       WHERE created_by = ?
       ORDER BY created_at DESC`
    )
    .all(req.userId) as Array<{
      code: string;
      created_at: number;
      used_by: string | null;
      used_at: number | null;
    }>;

  res.json({ codes });
});

export default router;
```

- [ ] **Step 2: 注册路由到 `server/src/index.ts`**

在 `app.use('/api/auth', authRouter)` 之后加入：

```typescript
import inviteRouter from './invite';

app.use('/api/invite', inviteRouter);
```

- [ ] **Step 3: 重启服务并测试**

先登录获取 cookie：
```bash
curl -s -c /tmp/cookies.txt -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","password":"pass123"}' | jq
```

生成邀请码：
```bash
curl -s -b /tmp/cookies.txt -X POST http://localhost:3000/api/invite/generate | jq
```
期望：`{"code":"A3F9B2C1"}`（8位随机大写）

查看自己的邀请码：
```bash
curl -s -b /tmp/cookies.txt http://localhost:3000/api/invite/mine | jq
```
期望：包含刚生成的邀请码，`used_by` 为 `null`

用新邀请码注册 bob：
```bash
CODE=$(curl -s -b /tmp/cookies.txt -X POST http://localhost:3000/api/invite/generate | jq -r '.code')
curl -s -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"bob\",\"password\":\"pass456\",\"invite_code\":\"$CODE\"}" | jq
```
期望：`{"userId":"...","username":"bob"}`

验证邀请码已被标记为使用：
```bash
curl -s -b /tmp/cookies.txt http://localhost:3000/api/invite/mine | jq '.codes[] | select(.used_by != null)'
```

- [ ] **Step 4: 提交**

```bash
git add server/src/invite.ts server/src/index.ts
git commit -m "feat: add invite code generation and listing"
```
