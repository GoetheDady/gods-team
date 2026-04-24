# 布局与分屏

## 现状

三列固定 grid：`sidebar(200px) | main(1fr) | private(280px)`。
右侧 private 列始终存在，无私聊时显示空状态文案。

## 目标布局

两列 grid：`sidebar(200px) | main(1fr)`，移除 private 列。

```
┌─────────────────────────────────┐
│ header                          │
├──────────┬──────────────────────┤
│          │   大厅消息列表        │
│  用户列表 │                      │
│          │   大厅输入框          │
└──────────┴──────────────────────┘
```

私聊打开后，main 区域内部变为纵向 flexbox 分屏：

```
┌─────────────────────────────────┐
│ header                          │
├──────────┬──────────────────────┤
│          │   大厅消息列表        │ ← hallPane
│  用户列表 ├──── 拖拽分隔条 ───────┤
│          │   私聊消息 @xx  [×]  │ ← privatePane
│          ├──────────────────────┤
│          │ 共用输入框            │
└──────────┴──────────────────────┘
```

## CSS 改动

`Chat.module.css`：
- `grid-template-columns` 改为 `200px 1fr`
- `grid-template-areas` 移除 `private`
- 删除 `.private` 规则
- 新增 `.mainInner`：`display: flex; flex-direction: column; height: 100%; overflow: hidden`
- 新增 `.hallPane`：`flex: 1 1 auto; display: flex; flex-direction: column; overflow: hidden; min-height: 80px`
- 新增 `.privatePane`：`flex: 0 0 <draggedHeight>px; display: flex; flex-direction: column; overflow: hidden; min-height: 80px; border-top: 1px solid var(--border-subtle)`
- 新增 `.divider`：`height: 4px; cursor: row-resize; background: transparent; flex-shrink: 0`
- 新增 `.divider:hover`、`.divider.dragging`：`background: var(--gold)`
- 新增 `.paneHeader`：`display: flex; align-items: center; justify-content: space-between; padding: 6px 16px; font-size: 12px; font-family: var(--font-mono); color: var(--text-secondary); border-bottom: 1px solid var(--border-subtle); flex-shrink: 0`
- 新增 `.paneActive`：在 hallPane / privatePane 上叠加，`border: 1px solid var(--gold)` 表示当前选中面板

## 拖拽实现

在 `Chat.tsx` 中：

```typescript
const [privatePaneHeight, setPrivatePaneHeight] = useState(300); // px
const dragging = useRef(false);
const dragStartY = useRef(0);
const dragStartHeight = useRef(0);

function onDividerMouseDown(e: React.MouseEvent) {
  dragging.current = true;
  dragStartY.current = e.clientY;
  dragStartHeight.current = privatePaneHeight;
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
}

function onMouseMove(e: MouseEvent) {
  if (!dragging.current) return;
  const delta = dragStartY.current - e.clientY; // 向上拖 → private 变高
  setPrivatePaneHeight(Math.max(80, Math.min(dragStartHeight.current + delta, window.innerHeight - 200)));
}

function onMouseUp() {
  dragging.current = false;
  window.removeEventListener('mousemove', onMouseMove);
  window.removeEventListener('mouseup', onMouseUp);
}
```

privatePane style：`{ height: privatePaneHeight }`，flex-shrink: 0。

## 私聊面板头部

privatePane 顶部显示：`私聊 · {peerUsername}` + 右侧 `×` 关闭按钮。  
点击 `×`：`activePeerIdRef.current = null; setActivePeerId(null); setActivePanel('hall')`。

## PrivatePanel 组件

移除原来的空状态渲染（`if (!peerId) return ...`）——Chat.tsx 控制是否挂载 privatePane，PrivatePanel 始终假定有 peerId。

去掉 PrivatePanel 内部的 header（移到 Chat.tsx 的 paneHeader 里），去掉 MessageInput（移到共用输入框）。

PrivatePanel 只负责渲染消息列表：

```tsx
export default function PrivatePanel({ messages, currentUserId, typingUsernames, hasMore, onLoadMore }: Props) {
  return (
    <div className={styles.messages}>
      <MessageList messages={messages} currentUserId={currentUserId}
        typingUsernames={typingUsernames} hasMore={hasMore} onLoadMore={onLoadMore} />
    </div>
  );
}
```
