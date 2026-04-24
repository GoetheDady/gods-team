# 私聊体验重构 Implementation Plan — Part 1

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> Part 2: `docs/superpowers/plans/2026-04-24-private-chat-ux-plan-p2.md`

**Goal:** 重构私聊面板为大厅下方可拖拽分屏，显示全部用户（含离线），共用输入框，未读气泡，浏览器通知。

**Architecture:** 服务端新增 GET /api/users 返回全量用户；客户端 UserList 合并全量用户与在线状态；Chat.tsx 用纵向 flexbox 分屏替换原右侧列，共用 MessageInput，activePanel state 决定发送目标。

**Tech Stack:** TypeScript, React, CSS Modules, Vitest + supertest（服务端测试），pnpm

---

## 文件改动总览

| 文件 | 操作 |
|---|---|
| `server/src/users.ts` | 追加 `GET /` 路由 |
| `server/tests/users.test.ts` | 新建，测试 GET /api/users |
| `client/src/services/api.ts` | 新增 `AllUser` 接口 + `getAllUsers()` |
| `client/src/components/UserList.tsx` | 重写 props + 渲染逻辑 |
| `client/src/components/UserList.module.css` | 追加 `.offline` `.avatarWrap` `.badge` |
| `client/src/components/PrivatePanel.tsx` | 精简：去掉 header + MessageInput |
| `client/src/components/PrivatePanel.module.css` | 删除 `.empty` `.emptyIcon` `.header` `.peerName` `.closeBtn` |

---

## Task 1: 服务端 GET /api/users

**Files:**
- Modify: `server/src/users.ts`
- Create: `server/tests/users.test.ts`

- [ ] **Step 1: 写失败测试**

新建 `server/tests/users.test.ts`：

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/index';
import { setupTestDb, teardownTestDb } from './setup';

describe('GET /api/users', () => {
  let token: string;

  beforeAll(async () => {
    await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    const { default: sql } = await import('../src/pg');
    await sql`DELETE FROM refresh_tokens`;
    await sql`DELETE FROM invite_codes WHERE code != 'ADMIN0001'`;
    await sql`UPDATE invite_codes SET used_by = NULL, used_at = NULL WHERE code = 'ADMIN0001'`;
    await sql`DELETE FROM users`;

    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'alice', password: 'pass1234', invite_code: 'ADMIN0001' });
    token = res.body.accessToken;
  });

  it('returns all users without password', async () => {
    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.users)).toBe(true);
    expect(res.body.users.length).toBe(1);
    expect(res.body.users[0].username).toBe('alice');
    expect(res.body.users[0].password).toBeUndefined();
    expect(res.body.users[0].id).toBeDefined();
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/users');
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd server && pnpm exec vitest run tests/users.test.ts
```

Expected: FAIL — `GET /api/users` 返回 404

- [ ] **Step 3: 在 `server/src/users.ts` 追加路由**

在 `export default router;` 前插入：

```typescript
// GET /api/users — 返回所有注册用户（不含密码）
router.get('/', requireAuth, async (_req, res) => {
  const rows = await sql<{ id: string; username: string; nickname: string | null; avatar_url: string | null }[]>`
    SELECT id, username, nickname, avatar_url FROM users ORDER BY created_at ASC
  `;
  res.json({ users: rows });
});
```

- [ ] **Step 4: 运行测试确认通过**

```bash
cd server && pnpm exec vitest run tests/users.test.ts
```

Expected: PASS (2 tests)

- [ ] **Step 5: 运行全部测试确认无回归**

```bash
cd server && pnpm test
```

Expected: 全部 PASS

- [ ] **Step 6: 提交**

```bash
git add server/src/users.ts server/tests/users.test.ts
git commit -m "feat(server): GET /api/users returns all registered users"
```

---

## Task 2: api.ts — AllUser 类型 + getAllUsers()

**Files:**
- Modify: `client/src/services/api.ts`

无服务端测试（前端单元测试不在本项目范围内，手动验证）。

- [ ] **Step 1: 在 `client/src/services/api.ts` 的 `User` 接口后新增 `AllUser`**

在第 85 行（`export interface ServerMessage {` 之前）插入：

```typescript
export interface AllUser {
  id: string;
  username: string;
  nickname: string | null;
  avatar_url: string | null;
}
```

- [ ] **Step 2: 在 `api` 对象末尾（`updateProfile` 后）新增 `getAllUsers`**

```typescript
  getAllUsers(): Promise<{ users: AllUser[] }> {
    return request('/users');
  },
```

- [ ] **Step 3: 确认 TypeScript 编译无错误**

```bash
cd client && pnpm exec tsc --noEmit
```

Expected: 无错误输出

- [ ] **Step 4: 提交**

```bash
git add client/src/services/api.ts
git commit -m "feat(client): add AllUser type and getAllUsers() to api"
```

---

## Task 3: UserList — 全用户 + 在线/离线 + 未读气泡

**Files:**
- Modify: `client/src/components/UserList.tsx`
- Modify: `client/src/components/UserList.module.css`

- [ ] **Step 1: 替换 `client/src/components/UserList.tsx`**

```typescript
import Avatar from './Avatar';
import styles from './UserList.module.css';
import type { AllUser } from '../services/api';

interface Props {
  allUsers: AllUser[];
  onlineUserIds: Set<string>;
  currentUserId: string;
  currentUserNickname: string | null;
  currentUserAvatarUrl: string | null;
  activePrivateId: string | null;
  unread: Map<string, number>;
  onSelectUser: (userId: string) => void;
}

export default function UserList({
  allUsers,
  onlineUserIds,
  currentUserId,
  currentUserNickname,
  currentUserAvatarUrl,
  activePrivateId,
  unread,
  onSelectUser,
}: Props) {
  const sorted = [
    ...allUsers.filter(u => onlineUserIds.has(u.id)),
    ...allUsers.filter(u => !onlineUserIds.has(u.id)),
  ];

  return (
    <div className={styles.container}>
      <div className={styles.title}>用户 · {onlineUserIds.size} 在线</div>
      {sorted.map(user => {
        const isSelf = user.id === currentUserId;
        const isOnline = onlineUserIds.has(user.id);
        const displayName = isSelf
          ? (currentUserNickname ?? user.username)
          : (user.nickname ?? user.username);
        const avatarSrc = isSelf ? currentUserAvatarUrl : user.avatar_url;
        const count = unread.get(user.id) ?? 0;

        return (
          <div
            key={user.id}
            className={[
              styles.user,
              !isOnline ? styles.offline : '',
              activePrivateId === user.id ? styles.active : '',
            ].join(' ')}
            onClick={() => !isSelf && onSelectUser(user.id)}
          >
            <div className={styles.avatarWrap}>
              <Avatar src={avatarSrc} name={displayName} size={28} />
              {count > 0 && (
                <span className={styles.badge}>{count > 99 ? '99+' : count}</span>
              )}
            </div>
            <span className={`${styles.name} ${isSelf ? styles.self : ''}`}>
              {displayName}{isSelf ? ' (我)' : ''}
            </span>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: 在 `client/src/components/UserList.module.css` 末尾追加**

```css
.offline {
  opacity: 0.4;
}

.avatarWrap {
  position: relative;
  flex-shrink: 0;
}

.badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 16px;
  height: 16px;
  padding: 0 3px;
  background: var(--danger);
  color: #fff;
  font-size: 9px;
  font-family: var(--font-mono);
  border-radius: 99px;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}
```

- [ ] **Step 3: 确认 TypeScript 编译无错误**

```bash
cd client && pnpm exec tsc --noEmit
```

Expected: 报错 — Chat.tsx 传给 UserList 的 props 不匹配（`users` 已改为 `allUsers` 等），属于预期错误，Task 5 会修复。

- [ ] **Step 4: 提交**

```bash
git add client/src/components/UserList.tsx client/src/components/UserList.module.css
git commit -m "feat(client): UserList shows all users with offline state and unread badge"
```

---

## Task 4: PrivatePanel — 精简为纯消息列表

**Files:**
- Modify: `client/src/components/PrivatePanel.tsx`
- Modify: `client/src/components/PrivatePanel.module.css`

- [ ] **Step 1: 替换 `client/src/components/PrivatePanel.tsx`**

```typescript
import MessageList from './MessageList';
import type { Message } from './MessageList';
import styles from './PrivatePanel.module.css';

interface Props {
  messages: Message[];
  currentUserId: string;
  typingUsernames: string[];
  hasMore: boolean;
  onLoadMore: () => void;
}

export default function PrivatePanel({
  messages, currentUserId, typingUsernames, hasMore, onLoadMore,
}: Props) {
  return (
    <div className={styles.messages}>
      <MessageList
        messages={messages}
        currentUserId={currentUserId}
        typingUsernames={typingUsernames}
        hasMore={hasMore}
        onLoadMore={onLoadMore}
      />
    </div>
  );
}
```

- [ ] **Step 2: 替换 `client/src/components/PrivatePanel.module.css`**

```css
.messages {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
```

- [ ] **Step 3: 确认 TypeScript 编译无错误（除 Chat.tsx 的已知不匹配外）**

```bash
cd client && pnpm exec tsc --noEmit 2>&1 | grep -v "Chat.tsx"
```

Expected: 无其他错误

- [ ] **Step 4: 提交**

```bash
git add client/src/components/PrivatePanel.tsx client/src/components/PrivatePanel.module.css
git commit -m "refactor(client): PrivatePanel stripped to message list only"
```
