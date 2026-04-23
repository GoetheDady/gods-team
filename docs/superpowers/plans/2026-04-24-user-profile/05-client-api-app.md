### Task 5：api.ts 新增 updateProfile，App.tsx auth state 扩展

**Files:**
- Modify: `client/src/services/api.ts`
- Modify: `client/src/App.tsx`

---

#### Step 1：修改 `client/src/services/api.ts` — 扩展 User 接口 + 新增 updateProfile

将 `User` 接口从：
```typescript
export interface User {
  userId: string;
  username: string;
}
```

改为：
```typescript
export interface User {
  userId: string;
  username: string;
  nickname: string | null;
  avatar_url: string | null;
}
```

在 `api` 对象中，在 `getOssSign()` 之后添加 `updateProfile` 方法：

```typescript
  updateProfile(data: { nickname?: string; avatar_url?: string }) {
    return request<{ ok: boolean }>('/users/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },
```

- [ ] 完成上述修改。

---

#### Step 2：修改 `client/src/App.tsx` — auth state 扩展 nickname + avatar_url

将 auth state 类型从：
```typescript
const [auth, setAuth] = useState<{ userId: string; username: string } | null | undefined>(
  undefined
);
```

改为：
```typescript
const [auth, setAuth] = useState<{
  userId: string;
  username: string;
  nickname: string | null;
  avatar_url: string | null;
} | null | undefined>(undefined);
```

将 `handleLogin` 函数从：
```typescript
function handleLogin(userId: string, username: string) {
  setAuth({ userId, username });
}
```

改为：
```typescript
function handleLogin(userId: string, username: string) {
  setAuth({ userId, username, nickname: null, avatar_url: null });
}
```

将 Chat 路由中的元素从：
```typescript
<Chat userId={auth.userId} username={auth.username} onLogout={() => setAuth(null)} />
```

改为：
```typescript
<Chat
  userId={auth.userId}
  username={auth.username}
  nickname={auth.nickname}
  avatarUrl={auth.avatar_url}
  onLogout={() => setAuth(null)}
/>
```

- [ ] 完成上述修改。

---

#### Step 3：类型检查

```bash
cd client && npx tsc --noEmit
```

Expected: 无错误（Chat 组件的 Props 尚未更新，会报错——Task 6 会修复；此时类型检查可以跳过，等 Task 6 完成后再验证）

- [ ] 完成。

---

#### Step 4：提交

```bash
git add client/src/services/api.ts client/src/App.tsx
git commit -m "feat(client): extend User type with nickname/avatar_url, pass profile to Chat"
```

- [ ] 完成。
