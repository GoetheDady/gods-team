# Task 02: 服务端数据库与认证

**Files:**
- Create: `server/src/db.ts`
- Create: `server/src/middleware/auth.ts`
- Create: `server/src/auth.ts`
- Modify: `server/src/index.ts`

---

- [ ] **Step 1: 创建 `server/src/db.ts`**

```typescript
import Database from 'better-sqlite3';
import path from 'path';

const db = new Database(path.join(__dirname, '../../data/chatroom.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS public_keys (
    user_id TEXT PRIMARY KEY REFERENCES users(id),
    key_data TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS invite_codes (
    code TEXT PRIMARY KEY,
    created_by TEXT REFERENCES users(id),
    used_by TEXT REFERENCES users(id),
    created_at INTEGER NOT NULL,
    used_at INTEGER
  );
`);

export default db;
```

- [ ] **Step 2: 创建数据目录**

```bash
mkdir -p server/data
echo "data/*.db" >> server/.gitignore
```

- [ ] **Step 3: 创建 `server/src/middleware/auth.ts`**

```typescript
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-prod';

export interface AuthRequest extends Request {
  userId?: string;
  username?: string;
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
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
  return jwt.sign({ userId, username }, JWT_SECRET, { expiresIn: '7d' });
}
```

- [ ] **Step 4: 安装 cookie-parser**

```bash
cd server && npm install cookie-parser @types/cookie-parser
```

- [ ] **Step 5: 创建 `server/src/auth.ts`**

```typescript
import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import bcrypt from 'bcrypt';
import db from './db';
import { signToken, requireAuth, AuthRequest } from './middleware/auth';

const router = Router();

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

  const code = db.prepare('SELECT * FROM invite_codes WHERE code = ?').get(invite_code) as
    | { code: string; used_by: string | null }
    | undefined;

  if (!code || code.used_by !== null) {
    res.status(400).json({ error: 'Invalid or already used invite code' });
    return;
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    res.status(400).json({ error: 'Username already taken' });
    return;
  }

  const hash = await bcrypt.hash(password, 12);
  const userId = randomUUID();
  const now = Date.now();

  db.transaction(() => {
    db.prepare('INSERT INTO users (id, username, password, created_at) VALUES (?, ?, ?, ?)').run(
      userId, username, hash, now
    );
    db.prepare('UPDATE invite_codes SET used_by = ?, used_at = ? WHERE code = ?').run(
      userId, now, invite_code
    );
  })();

  const token = signToken(userId, username);
  res.cookie('token', token, { httpOnly: true, sameSite: 'strict', maxAge: 7 * 24 * 3600 * 1000 });
  res.json({ userId, username });
});

router.post('/login', async (req: Request, res: Response) => {
  const { username, password } = req.body as { username?: string; password?: string };

  if (!username || !password) {
    res.status(400).json({ error: 'username and password required' });
    return;
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as
    | { id: string; username: string; password: string }
    | undefined;

  if (!user || !(await bcrypt.compare(password, user.password))) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const token = signToken(user.id, user.username);
  res.cookie('token', token, { httpOnly: true, sameSite: 'strict', maxAge: 7 * 24 * 3600 * 1000 });
  res.json({ userId: user.id, username: user.username });
});

router.post('/logout', (_req, res: Response) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req: AuthRequest, res: Response) => {
  res.json({ userId: req.userId, username: req.username });
});

export default router;
```

- [ ] **Step 6: 注册路由到 `server/src/index.ts`**

在 `app.get('/api/health', ...)` 之前加入：

```typescript
import cookieParser from 'cookie-parser';
import authRouter from './auth';

app.use(cookieParser());
app.use('/api/auth', authRouter);
```

- [ ] **Step 7: 手动测试注册接口**

先插入一条初始邀请码（第一个用户无法通过注册获得邀请码，需要手动初始化）：

```bash
cd server
node -e "
const Database = require('better-sqlite3');
const db = new Database('./data/chatroom.db');
db.prepare(\"INSERT INTO invite_codes (code, created_by, created_at) VALUES ('ADMIN0001', null, \"+Date.now()+\")\").run();
console.log('初始邀请码已插入: ADMIN0001');
"
```

测试注册：
```bash
curl -s -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","password":"pass123","invite_code":"ADMIN0001"}' | jq
```
期望：`{"userId":"...","username":"alice"}`

测试登录：
```bash
curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","password":"pass123"}' | jq
```
期望：`{"userId":"...","username":"alice"}`

- [ ] **Step 8: 提交**

```bash
git add server/src/db.ts server/src/middleware/auth.ts server/src/auth.ts server/src/index.ts server/.gitignore
git commit -m "feat: add server db schema and auth (register/login/logout)"
```
