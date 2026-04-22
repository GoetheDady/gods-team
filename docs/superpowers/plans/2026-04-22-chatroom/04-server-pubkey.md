# Task 04: 服务端公钥 API

**Files:**
- Create: `server/src/pubkey.ts`
- Modify: `server/src/index.ts`

---

- [ ] **Step 1: 创建 `server/src/pubkey.ts`**

```typescript
import { Router, Response } from 'express';
import db from './db';
import { requireAuth, AuthRequest } from './middleware/auth';

const router = Router();

// 上传或更新自己的 ECDH 公钥
router.post('/me/pubkey', requireAuth, (req: AuthRequest, res: Response) => {
  const { key_data } = req.body as { key_data?: string };

  if (!key_data || typeof key_data !== 'string') {
    res.status(400).json({ error: 'key_data required' });
    return;
  }

  const now = Date.now();
  db.prepare(`
    INSERT INTO public_keys (user_id, key_data, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET key_data = excluded.key_data, updated_at = excluded.updated_at
  `).run(req.userId, key_data, now);

  res.json({ ok: true });
});

// 获取某用户的公钥（用于 ECDH 密钥协商）
router.get('/:id/pubkey', requireAuth, (req: AuthRequest, res: Response) => {
  const row = db.prepare('SELECT key_data FROM public_keys WHERE user_id = ?').get(req.params.id) as
    | { key_data: string }
    | undefined;

  if (!row) {
    res.status(404).json({ error: 'Public key not found' });
    return;
  }

  res.json({ key_data: row.key_data });
});

export default router;
```

- [ ] **Step 2: 注册路由到 `server/src/index.ts`**

在 `app.use('/api/invite', inviteRouter)` 之后加入：

```typescript
import pubkeyRouter from './pubkey';

app.use('/api/users', pubkeyRouter);
```

- [ ] **Step 3: 测试公钥上传与获取**

登录 alice（获取 cookie）：
```bash
curl -s -c /tmp/alice.txt -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","password":"pass123"}' | jq
```

获取 alice 的 userId：
```bash
ALICE_ID=$(curl -s -b /tmp/alice.txt http://localhost:3000/api/auth/me | jq -r '.userId')
```

上传一个假公钥：
```bash
curl -s -b /tmp/alice.txt -X POST http://localhost:3000/api/users/me/pubkey \
  -H "Content-Type: application/json" \
  -d '{"key_data":"dGVzdC1wdWJsaWMta2V5LWJhc2U2NA=="}' | jq
```
期望：`{"ok":true}`

获取 alice 的公钥：
```bash
curl -s -b /tmp/alice.txt "http://localhost:3000/api/users/$ALICE_ID/pubkey" | jq
```
期望：`{"key_data":"dGVzdC1wdWJsaWMta2V5LWJhc2U2NA=="}`

重复上传（应更新，不报错）：
```bash
curl -s -b /tmp/alice.txt -X POST http://localhost:3000/api/users/me/pubkey \
  -H "Content-Type: application/json" \
  -d '{"key_data":"bmV3LXB1YmxpYy1rZXk="}' | jq
curl -s -b /tmp/alice.txt "http://localhost:3000/api/users/$ALICE_ID/pubkey" | jq
```
期望：返回新的 key_data

- [ ] **Step 4: 提交**

```bash
git add server/src/pubkey.ts server/src/index.ts
git commit -m "feat: add public key upload and retrieval API"
```
