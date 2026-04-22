# Task 16: 浏览器测试 - 本地 SQLite 存储

**文件：** `client/tests/localDb.test.ts`  
**运行：** `npm run test:browser`  
**依赖：** Task 14（浏览器测试配置）、Task 07（localDb.ts 实现）

---

- [ ] **Step 1: 创建 `client/tests/localDb.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { saveMessage, getMessages, clearChat, LocalMessage } from '../src/services/localDb';

function makeMsg(overrides: Partial<LocalMessage> = {}): LocalMessage {
  return {
    id: `msg-${Math.random().toString(36).slice(2)}`,
    chat_id: 'hall',
    from_id: 'user-alice',
    content: '测试消息',
    timestamp: Date.now(),
    ...overrides,
  };
}

describe('saveMessage / getMessages', () => {
  it('保存消息后可以查询到', async () => {
    const msg = makeMsg({ content: '你好江湖' });
    await saveMessage(msg);

    const result = await getMessages('hall');
    expect(result.some(m => m.id === msg.id)).toBe(true);
  });

  it('查询结果按 timestamp 升序排列', async () => {
    const now = Date.now();
    await saveMessage(makeMsg({ id: 'ts-1', timestamp: now - 2000 }));
    await saveMessage(makeMsg({ id: 'ts-3', timestamp: now }));
    await saveMessage(makeMsg({ id: 'ts-2', timestamp: now - 1000 }));

    const result = await getMessages('hall');
    const ids = result.map(m => m.id);
    const idx1 = ids.indexOf('ts-1');
    const idx2 = ids.indexOf('ts-2');
    const idx3 = ids.indexOf('ts-3');

    expect(idx1).toBeLessThan(idx2);
    expect(idx2).toBeLessThan(idx3);
  });

  it('不同 chat_id 的消息互不干扰', async () => {
    await saveMessage(makeMsg({ id: 'hall-msg', chat_id: 'hall' }));
    await saveMessage(makeMsg({ id: 'priv-msg', chat_id: 'user-alice-user-bob' }));

    const hall = await getMessages('hall');
    const priv = await getMessages('user-alice-user-bob');

    expect(hall.some(m => m.id === 'hall-msg')).toBe(true);
    expect(hall.some(m => m.id === 'priv-msg')).toBe(false);
    expect(priv.some(m => m.id === 'priv-msg')).toBe(true);
  });

  it('重复保存相同 id 的消息不会报错（INSERT OR IGNORE）', async () => {
    const msg = makeMsg({ id: 'dup-id', content: '原始' });
    await saveMessage(msg);
    await saveMessage({ ...msg, content: '修改版' }); // 不应报错

    const result = await getMessages('hall');
    const found = result.find(m => m.id === 'dup-id');
    expect(found?.content).toBe('原始'); // 保留原始，不覆盖
  });

  it('limit 参数限制返回数量', async () => {
    for (let i = 0; i < 10; i++) {
      await saveMessage(makeMsg({ chat_id: 'limit-test', timestamp: Date.now() + i }));
    }

    const result = await getMessages('limit-test', 5);
    expect(result.length).toBe(5);
  });

  it('查询不存在的 chat_id 返回空数组', async () => {
    const result = await getMessages('nonexistent-chat');
    expect(result).toEqual([]);
  });

  it('保存的消息字段与查询结果一致', async () => {
    const msg: LocalMessage = {
      id: 'field-check',
      chat_id: 'hall',
      from_id: 'user-bob',
      content: '字段验证',
      timestamp: 1700000000000,
    };
    await saveMessage(msg);

    const result = await getMessages('hall');
    const found = result.find(m => m.id === 'field-check');

    expect(found).toEqual(msg);
  });
});

describe('clearChat', () => {
  it('清除指定 chat_id 的所有消息', async () => {
    await saveMessage(makeMsg({ chat_id: 'to-clear' }));
    await saveMessage(makeMsg({ chat_id: 'to-clear' }));

    await clearChat('to-clear');

    const result = await getMessages('to-clear');
    expect(result).toHaveLength(0);
  });

  it('清除一个频道不影响其他频道', async () => {
    await saveMessage(makeMsg({ id: 'keep-this', chat_id: 'keep' }));
    await saveMessage(makeMsg({ chat_id: 'clear-this' }));

    await clearChat('clear-this');

    const kept = await getMessages('keep');
    expect(kept.some(m => m.id === 'keep-this')).toBe(true);
  });

  it('清除不存在的 chat_id 不报错', async () => {
    await expect(clearChat('ghost-chat')).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: 运行测试（实现前应全部红灯）**

```bash
cd client && npm run test:browser -- tests/localDb.test.ts
```

期望：全部 FAIL，原因是 `../src/services/localDb` 模块不存在。

- [ ] **Step 3: 提交**

```bash
git add client/tests/localDb.test.ts
git commit -m "test: add browser SQLite WASM local storage tests"
```
