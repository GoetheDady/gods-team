# 未读气泡与浏览器通知

## 未读计数

### 状态

`Chat.tsx` 新增：

```typescript
const [unread, setUnread] = useState<Map<string, number>>(new Map());
```

### 计数逻辑

收到 `private_message` WS 消息时：

```typescript
const peer = m.from === userId ? m.to : m.from;
const isCurrentlyOpen = peer === activePeerIdRef.current;
const pageActive = document.hasFocus();

if (!isCurrentlyOpen) {
  // 未读 +1
  setUnread(prev => {
    const next = new Map(prev);
    next.set(peer, (next.get(peer) ?? 0) + 1);
    return next;
  });
}
```

打开私聊面板时（`selectUser`）清零：

```typescript
setUnread(prev => {
  const next = new Map(prev);
  next.delete(peerId);
  return next;
});
```

### 气泡 UI

UserList 接收 `unread: Map<string, number>` prop，在每个用户行的 Avatar 上叠加气泡：

```tsx
const count = unread.get(user.id) ?? 0;

<div className={styles.avatarWrap}>
  <Avatar src={avatarUrl} name={displayName} size={28} />
  {count > 0 && (
    <span className={styles.badge}>{count > 99 ? '99+' : count}</span>
  )}
</div>
```

`UserList.module.css` 新增：

```css
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

## 浏览器通知

### 权限请求时机

首次收到私聊消息（且需要弹通知）时请求权限，不主动在页面加载时弹授权弹窗：

```typescript
async function requestNotificationPermission() {
  if (Notification.permission === 'default') {
    await Notification.requestPermission();
  }
}
```

### 通知触发条件

收到 `private_message` 时，满足以下**所有**条件才弹通知：
1. `Notification.permission === 'granted'`
2. `!document.hasFocus()` 或 `peer !== activePeerIdRef.current`（页面不聚焦，或聚焦但看的不是这个私聊）

```typescript
async function maybeNotify(peerName: string, content: string, peer: string) {
  await requestNotificationPermission();
  if (Notification.permission !== 'granted') return;
  const shouldNotify = !document.hasFocus() || peer !== activePeerIdRef.current;
  if (!shouldNotify) return;
  new Notification(peerName, {
    body: content.slice(0, 80) || '[图片]',
    icon: '/favicon.ico',
  });
}
```

在 `private_message` 处理分支中调用 `maybeNotify`。

### 用户拒绝权限

`Notification.permission === 'denied'` 时静默跳过，不再请求，不显示任何提示。
