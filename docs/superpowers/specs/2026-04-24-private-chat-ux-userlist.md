# 用户列表

## 现状

UserList 只接收 WS `online_users` 事件推送的在线用户，无法显示离线用户。

## 目标

显示全部注册用户，在线用户排前面，离线用户排后面置灰。所有用户均可点击打开私聊（在线实时收发，离线对方上线后可见）。

## 服务端

新增路由文件 `server/src/users.ts`（已存在，追加路由）：

```typescript
// GET /api/users — 返回所有注册用户（不含密码）
router.get('/', requireAuth, async (_req, res) => {
  const rows = await sql`
    SELECT id, username, nickname, avatar_url FROM users ORDER BY created_at ASC
  `;
  res.json({ users: rows });
});
```

## 客户端数据流

`Chat.tsx` 新增状态：

```typescript
const [allUsers, setAllUsers] = useState<AllUser[]>([]);
```

`AllUser` 接口：`{ id, username, nickname: string | null, avatar_url: string | null }`

页面加载时（`useEffect` 内的 `init()`）调用 `api.getAllUsers()` 填充 `allUsers`。

`api.ts` 新增：

```typescript
getAllUsers(): Promise<{ users: AllUser[] }> {
  return this.fetch('/users');
}
```

## UserList Props 变更

```typescript
interface Props {
  allUsers: AllUser[];           // 全部用户
  onlineUserIds: Set<string>;    // 在线用户 id 集合
  currentUserId: string;
  currentUserNickname: string | null;
  currentUserAvatarUrl: string | null;
  activePrivateId: string | null;
  unread: Map<string, number>;   // peerId → 未读数
  onSelectUser: (userId: string) => void;
}
```

Chat.tsx 将 `onlineUsers` 转为 `onlineUserIds = new Set(onlineUsers.map(u => u.id))` 后传入。

## UserList 渲染逻辑

```typescript
const sorted = [
  ...allUsers.filter(u => onlineUserIds.has(u.id)),   // 在线
  ...allUsers.filter(u => !onlineUserIds.has(u.id)),  // 离线
];
```

每个用户行：
- 在线：正常样式
- 离线：`opacity: 0.4`，`cursor: pointer`（仍可点击查看历史）
- 自己（currentUserId）：名字金色 + `(我)` 后缀，不触发 onSelectUser
- 未读数 > 0：Avatar 右上角显示红色气泡（见通知 spec）

## UserList.module.css 新增

```css
.offline {
  opacity: 0.4;
}
```

（其余已有样式不变）
