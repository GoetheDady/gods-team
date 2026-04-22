# Task 13: 服务端单元测试

**测试框架：** Vitest + Supertest  
**运行环境：** Node.js（无需浏览器）  
**覆盖范围：** 注册、登录、登出、邀请码、公钥 API

**Files:**
- Create: `server/vitest.config.ts`
- Create: `server/tests/setup.ts`
- Create: `server/tests/auth.test.ts`
- Create: `server/tests/invite.test.ts`
- Create: `server/tests/pubkey.test.ts`

---

- [ ] **Step 1: 安装测试依赖**

```bash
cd server
npm install -D vitest supertest @types/supertest
```

- [ ] **Step 2: 创建 `server/vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    sequence: { concurrent: false }, // SQLite 不能并发写
  },
});
```

- [ ] **Step 3: 创建 `server/tests/setup.ts`**

测试用内存数据库，每个测试文件前清空状态。

```typescript
import Database from 'better-sqlite3';
import { vi, beforeEach } from 'vitest';

// 用内存 SQLite 替换文件数据库
vi.mock('../src/db', () => {
  const db = new Database(':memory:');
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
  return { default: db };
});

// 每个测试前清空所有表
beforeEach(() => {
  const { default: db } = require('../src/db');
  db.exec('DELETE FROM public_keys; DELETE FROM invite_codes; DELETE FROM users;');
});
```

- [ ] **Step 4: 在 `server/package.json` 加入 test 命令**

```json
"scripts": {
  "test": "vitest run",
  "test:watch": "vitest"
}
```

---

## 认证测试 `server/tests/auth.test.ts`

- [ ] **Step 5: 创建 `server/tests/auth.test.ts`**

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/index';

describe('POST /api/auth/register', () => {
  beforeAll(() => {
    // 插入初始邀请码
    const { default: db } = require('../src/db');
    db.prepare(
      'INSERT INTO invite_codes (code, created_by, created_at) VALUES (?, NULL, ?)'
    ).run('TESTCODE', Date.now());
  });

  it('使用有效邀请码注册成功，返回 userId 和 username', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'alice', password: 'pass123', invite_code: 'TESTCODE' });

    expect(res.status).toBe(200);
    expect(res.body.username).toBe('alice');
    expect(res.body.userId).toBeTruthy();
  });

  it('注册成功后邀请码不可重复使用', async () => {
    const db = require('../src/db').default;
    db.prepare(
      'INSERT INTO invite_codes (code, created_by, created_at) VALUES (?, NULL, ?)'
    ).run('ONCEONLY', Date.now());

    await request(app)
      .post('/api/auth/register')
      .send({ username: 'bob', password: 'pass123', invite_code: 'ONCEONLY' });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'charlie', password: 'pass123', invite_code: 'ONCEONLY' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/already used/i);
  });

  it('邀请码不存在时注册失败', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'dave', password: 'pass123', invite_code: 'INVALID0' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid/i);
  });

  it('用户名重复时注册失败', async () => {
    const db = require('../src/db').default;
    db.prepare(
      'INSERT INTO invite_codes (code, created_by, created_at) VALUES (?, NULL, ?)'
    ).run('CODE0001', Date.now());
    db.prepare(
      'INSERT INTO invite_codes (code, created_by, created_at) VALUES (?, NULL, ?)'
    ).run('CODE0002', Date.now());

    await request(app)
      .post('/api/auth/register')
      .send({ username: 'duplicate', password: 'pass123', invite_code: 'CODE0001' });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'duplicate', password: 'pass456', invite_code: 'CODE0002' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/taken/i);
  });

  it('缺少字段时注册失败', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'alice' }); // 缺少 password 和 invite_code

    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  beforeAll(async () => {
    const db = require('../src/db').default;
    db.prepare(
      'INSERT INTO invite_codes (code, created_by, created_at) VALUES (?, NULL, ?)'
    ).run('LOGINTEST', Date.now());
    await request(app)
      .post('/api/auth/register')
      .send({ username: 'loginuser', password: 'mypassword', invite_code: 'LOGINTEST' });
  });

  it('正确凭据登录成功，返回用户信息并设置 cookie', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'loginuser', password: 'mypassword' });

    expect(res.status).toBe(200);
    expect(res.body.username).toBe('loginuser');
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('密码错误时登录失败', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'loginuser', password: 'wrongpassword' });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/invalid credentials/i);
  });

  it('用户不存在时登录失败', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'nobody', password: 'pass123' });

    expect(res.status).toBe(401);
  });
});

describe('GET /api/auth/me', () => {
  it('携带有效 cookie 时返回当前用户信息', async () => {
    const db = require('../src/db').default;
    db.prepare(
      'INSERT INTO invite_codes (code, created_by, created_at) VALUES (?, NULL, ?)'
    ).run('METEST01', Date.now());

    const agent = request.agent(app); // agent 自动携带 cookie
    await agent
      .post('/api/auth/register')
      .send({ username: 'meuser', password: 'pass123', invite_code: 'METEST01' });

    const res = await agent.get('/api/auth/me');

    expect(res.status).toBe(200);
    expect(res.body.username).toBe('meuser');
  });

  it('未登录时返回 401', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/logout', () => {
  it('登出后清除 cookie，再访问 /me 返回 401', async () => {
    const db = require('../src/db').default;
    db.prepare(
      'INSERT INTO invite_codes (code, created_by, created_at) VALUES (?, NULL, ?)'
    ).run('LOGOUT01', Date.now());

    const agent = request.agent(app);
    await agent
      .post('/api/auth/register')
      .send({ username: 'logoutuser', password: 'pass123', invite_code: 'LOGOUT01' });

    await agent.post('/api/auth/logout');

    const res = await agent.get('/api/auth/me');
    expect(res.status).toBe(401);
  });
});
```

---

## 邀请码测试 `server/tests/invite.test.ts`

- [ ] **Step 6: 创建 `server/tests/invite.test.ts`**

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/index';

async function registerAndGetAgent(username: string, code: string) {
  const db = require('../src/db').default;
  db.prepare(
    'INSERT INTO invite_codes (code, created_by, created_at) VALUES (?, NULL, ?)'
  ).run(code, Date.now());

  const agent = request.agent(app);
  await agent
    .post('/api/auth/register')
    .send({ username, password: 'pass123', invite_code: code });
  return agent;
}

describe('POST /api/invite/generate', () => {
  it('已登录用户可生成邀请码，返回 8 位大写字符串', async () => {
    const agent = await registerAndGetAgent('inviter1', 'INV00001');

    const res = await agent.post('/api/invite/generate');

    expect(res.status).toBe(200);
    expect(res.body.code).toMatch(/^[A-F0-9]{8}$/);
  });

  it('未登录用户无法生成邀请码', async () => {
    const res = await request(app).post('/api/invite/generate');
    expect(res.status).toBe(401);
  });

  it('同一用户可以生成多个邀请码', async () => {
    const agent = await registerAndGetAgent('inviter2', 'INV00002');

    const res1 = await agent.post('/api/invite/generate');
    const res2 = await agent.post('/api/invite/generate');

    expect(res1.body.code).not.toBe(res2.body.code);
  });
});

describe('GET /api/invite/mine', () => {
  it('返回自己生成的所有邀请码', async () => {
    const agent = await registerAndGetAgent('inviter3', 'INV00003');

    await agent.post('/api/invite/generate');
    await agent.post('/api/invite/generate');

    const res = await agent.get('/api/invite/mine');

    expect(res.status).toBe(200);
    expect(res.body.codes.length).toBe(2);
  });

  it('新生成的邀请码 used_by 为 null', async () => {
    const agent = await registerAndGetAgent('inviter4', 'INV00004');
    await agent.post('/api/invite/generate');

    const res = await agent.get('/api/invite/mine');

    expect(res.body.codes[0].used_by).toBeNull();
    expect(res.body.codes[0].used_at).toBeNull();
  });

  it('邀请码被使用后 used_by 有值', async () => {
    const agent = await registerAndGetAgent('inviter5', 'INV00005');
    const { body: { code } } = await agent.post('/api/invite/generate');

    // 用这个邀请码注册新用户
    await request(app)
      .post('/api/auth/register')
      .send({ username: 'newbie', password: 'pass123', invite_code: code });

    const res = await agent.get('/api/invite/mine');
    const usedCode = res.body.codes.find((c: { code: string }) => c.code === code);

    expect(usedCode.used_by).not.toBeNull();
    expect(usedCode.used_at).not.toBeNull();
  });

  it('未登录用户无法查看邀请码列表', async () => {
    const res = await request(app).get('/api/invite/mine');
    expect(res.status).toBe(401);
  });
});
```

---

## 公钥测试 `server/tests/pubkey.test.ts`

- [ ] **Step 7: 创建 `server/tests/pubkey.test.ts`**

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/index';

async function registerAndGetAgent(username: string, code: string) {
  const db = require('../src/db').default;
  db.prepare(
    'INSERT INTO invite_codes (code, created_by, created_at) VALUES (?, NULL, ?)'
  ).run(code, Date.now());

  const agent = request.agent(app);
  const res = await agent
    .post('/api/auth/register')
    .send({ username, password: 'pass123', invite_code: code });
  return { agent, userId: res.body.userId as string };
}

const FAKE_PUBKEY = 'dGVzdC1wdWJsaWMta2V5LWJhc2U2NA==';
const FAKE_PUBKEY_2 = 'bmV3LXB1YmxpYy1rZXktdXBkYXRlZA==';

describe('POST /api/users/me/pubkey', () => {
  it('已登录用户上传公钥成功', async () => {
    const { agent } = await registerAndGetAgent('keyuser1', 'KEY00001');

    const res = await agent
      .post('/api/users/me/pubkey')
      .send({ key_data: FAKE_PUBKEY });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('重复上传公钥会更新，不报错', async () => {
    const { agent, userId } = await registerAndGetAgent('keyuser2', 'KEY00002');

    await agent.post('/api/users/me/pubkey').send({ key_data: FAKE_PUBKEY });
    await agent.post('/api/users/me/pubkey').send({ key_data: FAKE_PUBKEY_2 });

    const res = await agent.get(`/api/users/${userId}/pubkey`);
    expect(res.body.key_data).toBe(FAKE_PUBKEY_2);
  });

  it('缺少 key_data 时返回 400', async () => {
    const { agent } = await registerAndGetAgent('keyuser3', 'KEY00003');

    const res = await agent.post('/api/users/me/pubkey').send({});
    expect(res.status).toBe(400);
  });

  it('未登录用户无法上传公钥', async () => {
    const res = await request(app)
      .post('/api/users/me/pubkey')
      .send({ key_data: FAKE_PUBKEY });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/users/:id/pubkey', () => {
  it('获取已上传公钥成功', async () => {
    const { agent, userId } = await registerAndGetAgent('keyuser4', 'KEY00004');
    await agent.post('/api/users/me/pubkey').send({ key_data: FAKE_PUBKEY });

    // 用另一个已登录用户来获取
    const db = require('../src/db').default;
    db.prepare(
      'INSERT INTO invite_codes (code, created_by, created_at) VALUES (?, NULL, ?)'
    ).run('KEY00005', Date.now());
    const agent2 = request.agent(app);
    await agent2
      .post('/api/auth/register')
      .send({ username: 'keyuser5', password: 'pass123', invite_code: 'KEY00005' });

    const res = await agent2.get(`/api/users/${userId}/pubkey`);

    expect(res.status).toBe(200);
    expect(res.body.key_data).toBe(FAKE_PUBKEY);
  });

  it('用户未上传公钥时返回 404', async () => {
    const { agent, userId } = await registerAndGetAgent('keyuser6', 'KEY00006');

    const res = await agent.get(`/api/users/${userId}/pubkey`);
    expect(res.status).toBe(404);
  });

  it('未登录用户无法获取公钥', async () => {
    const res = await request(app).get('/api/users/some-id/pubkey');
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 8: 运行测试，确认全部红灯（实现前应全部失败）**

```bash
cd server && npm test
```

期望：所有测试 FAIL，错误原因是找不到模块（`../src/index` 不存在），不是测试逻辑错误。

- [ ] **Step 9: 提交测试文件**

```bash
git add server/tests/ server/vitest.config.ts
git commit -m "test: add server API unit tests (auth, invite, pubkey)"
```
