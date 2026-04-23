### Task 2：重写 middleware/auth.ts

**Files:**
- Modify: `server/src/middleware/auth.ts`

- [ ] **Step 1：完整替换 `server/src/middleware/auth.ts`**

```typescript
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-prod';

export interface AuthRequest extends Request {
  userId?: string;
  username?: string;
}

// 从 Authorization: Bearer <token> 头中提取并验证 JWT
// access token 有效期 15 分钟，过期后客户端需用 refresh token 换新
export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: string; username: string };
    req.userId = payload.userId;
    req.username = payload.username;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

export function signToken(userId: string, username: string): string {
  return jwt.sign({ userId, username }, JWT_SECRET, { expiresIn: '15m' });
}
```

注意：`signToken` 的 `expiresIn` 从 `'7d'` 改为 `'15m'`，因为现在是 access token。

- [ ] **Step 2：类型检查**

```bash
cd server && npx tsc --noEmit
```

Expected: `auth.ts` 可能报错（因为调用方还用旧的 `res.cookie` 等），但 `middleware/auth.ts` 本身不应报错。如果其他文件的错误只是因为还没改到，继续下一步。

- [ ] **Step 3：提交**

```bash
git add server/src/middleware/auth.ts
git commit -m "refactor(server): auth middleware reads only Authorization Bearer header"
```
