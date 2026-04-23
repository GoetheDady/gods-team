### Task 6：Chat 传 avatar 数据，UserList 展示 Avatar

**Files:**
- Modify: `client/src/pages/Chat.tsx`
- Modify: `client/src/components/UserList.tsx`

---

#### Step 1：修改 `client/src/pages/Chat.tsx` — OnlineUser 扩展 + 传递 avatar 数据给 UserList

将文件顶部的 `OnlineUser` 接口从：
```typescript
interface OnlineUser { id: string; username: string; }
```

改为：
```typescript
interface OnlineUser {
  id: string;
  username: string;
  nickname: string | null;
  avatar_url: string | null;
}
```

将 Props 接口从：
```typescript
interface Props {
  userId: string;
  username: string;
  onLogout: () => void;
}
```

改为：
```typescript
interface Props {
  userId: string;
  username: string;
  nickname: string | null;
  avatarUrl: string | null;
  onLogout: () => void;
}
```

将组件函数签名从：
```typescript
export default function Chat({ userId, username, onLogout }: Props) {
```

改为：
```typescript
export default function Chat({ userId, username, nickname, avatarUrl, onLogout }: Props) {
```

WS 事件处理中的 `online_users` 和 `user_joined` 已经带有 `nickname`/`avatar_url`，更新对应解析逻辑：

将 `online_users` 处理从：
```typescript
if (msg.type === 'online_users' && msg.users) {
  const users = msg.users as OnlineUser[];
  users.forEach(u => usernameMap.current.set(u.id, u.username));
  setOnlineUsers(users);
}
```

改为：
```typescript
if (msg.type === 'online_users' && msg.users) {
  const users = msg.users as OnlineUser[];
  users.forEach(u => usernameMap.current.set(u.id, u.nickname ?? u.username));
  setOnlineUsers(users);
}
```

将 `user_joined` 处理从：
```typescript
} else if (msg.type === 'user_joined') {
  usernameMap.current.set(msg.userId!, msg.username!);
  setOnlineUsers(prev => {
    if (prev.some(u => u.id === msg.userId)) return prev;
    return [...prev, { id: msg.userId!, username: msg.username! }];
  });
}
```

改为：
```typescript
} else if (msg.type === 'user_joined') {
  const m = msg as any;
  usernameMap.current.set(m.userId, m.nickname ?? m.username);
  setOnlineUsers(prev => {
    if (prev.some(u => u.id === m.userId)) return prev;
    return [...prev, { id: m.userId, username: m.username, nickname: m.nickname ?? null, avatar_url: m.avatar_url ?? null }];
  });
}
```

找到 JSX 中渲染 `<UserList>` 的地方，将 props 从：
```typescript
<UserList
  users={onlineUsers}
  currentUserId={userId}
  activePrivateId={activePeerId}
  onSelectUser={handleSelectUser}
/>
```

改为：
```typescript
<UserList
  users={onlineUsers}
  currentUserId={userId}
  currentUserNickname={nickname}
  currentUserAvatarUrl={avatarUrl}
  activePrivateId={activePeerId}
  onSelectUser={handleSelectUser}
/>
```

- [ ] 完成上述修改。

---

#### Step 2：修改 `client/src/components/UserList.tsx` — 引入 Avatar 组件，展示头像

完整替换 `client/src/components/UserList.tsx`：

```typescript
import Avatar from './Avatar';
import styles from './UserList.module.css';

interface OnlineUser {
  id: string;
  username: string;
  nickname: string | null;
  avatar_url: string | null;
}

interface Props {
  users: OnlineUser[];
  currentUserId: string;
  currentUserNickname: string | null;
  currentUserAvatarUrl: string | null;
  activePrivateId: string | null;
  onSelectUser: (userId: string) => void;
}

export default function UserList({
  users,
  currentUserId,
  currentUserNickname,
  currentUserAvatarUrl,
  activePrivateId,
  onSelectUser,
}: Props) {
  return (
    <div className={styles.container}>
      <div className={styles.title}>在线 · {users.length}</div>
      {users.map(user => {
        const isSelf = user.id === currentUserId;
        const displayName = isSelf
          ? (currentUserNickname ?? user.username)
          : (user.nickname ?? user.username);
        const avatarUrl = isSelf ? currentUserAvatarUrl : user.avatar_url;
        return (
          <div
            key={user.id}
            className={`${styles.user} ${activePrivateId === user.id ? styles.active : ''}`}
            onClick={() => !isSelf && onSelectUser(user.id)}
          >
            <Avatar src={avatarUrl} name={displayName} size={28} />
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

同时更新 `client/src/components/UserList.module.css`，移除 `.dot` 样式，因为头像取代了绿点：

```css
.container {
  padding: 16px 0;
}

.title {
  font-size: 10px;
  font-family: var(--font-mono);
  color: var(--text-muted);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 0 16px 10px;
}

.user {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 16px;
  cursor: pointer;
  transition: background var(--transition);
}

.user:hover {
  background: var(--border-subtle);
}

.user.active {
  background: var(--gold-glow);
}

.name {
  font-size: 12px;
  color: var(--text-primary);
  font-family: var(--font-mono);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.name.self {
  color: var(--gold);
}
```

- [ ] 完成上述修改。

---

#### Step 3：类型检查

```bash
cd client && npx tsc --noEmit
```

Expected: 无错误

- [ ] 完成。

---

#### Step 4：提交

```bash
git add client/src/pages/Chat.tsx client/src/components/UserList.tsx client/src/components/UserList.module.css
git commit -m "feat(client): UserList shows Avatar, Chat passes nickname/avatar props"
```

- [ ] 完成。
