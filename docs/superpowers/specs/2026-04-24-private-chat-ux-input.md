# 输入框与焦点

## 设计

main 区底部一个共用 MessageInput，位于 hallPane 和 privatePane 之外（flexbox 末尾，不参与拖拽）。

输入框左侧显示当前发送目标标签：
- 只有大厅时：不显示标签，placeholder = `发言于大厅...`
- 私聊打开时，显示两个可点击标签：`大厅` 和 `私聊 · {peerUsername}`，选中的标签高亮（金色），placeholder 跟随切换

## Chat.tsx 状态

```typescript
const [activePanel, setActivePanel] = useState<'hall' | 'private'>('hall');
```

打开私聊：`setActivePanel('private')`  
关闭私聊：`setActivePanel('hall')`  
点击 hallPane 区域：`setActivePanel('hall')`  
点击 privatePane 区域：`setActivePanel('private')`

## 发送逻辑

```typescript
function handleSend(text: string, imageUrl?: string) {
  if (activePanel === 'hall') {
    sendHallMessage(text, imageUrl);
  } else {
    sendPrivateMessage(text, imageUrl);
  }
}

function handleTyping() {
  if (activePanel === 'hall') sendTyping();
  else sendPrivateTyping();
}
```

## 目标标签 UI

在 `Chat.tsx` JSX 中，输入框上方（或作为 MessageInput 的 prefix prop）渲染：

```tsx
{activePeerId && (
  <div className={styles.panelTabs}>
    <button
      className={`${styles.tab} ${activePanel === 'hall' ? styles.tabActive : ''}`}
      onClick={() => setActivePanel('hall')}
    >大厅</button>
    <button
      className={`${styles.tab} ${activePanel === 'private' ? styles.tabActive : ''}`}
      onClick={() => setActivePanel('private')}
    >私聊 · {activePeerUsername}</button>
  </div>
)}
```

`Chat.module.css` 新增：

```css
.panelTabs {
  display: flex;
  gap: 4px;
  padding: 6px 16px 0;
  background: var(--bg-base);
}

.tab {
  font-size: 11px;
  font-family: var(--font-mono);
  padding: 3px 10px;
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  border: 1px solid transparent;
  transition: color var(--transition), border-color var(--transition);
}

.tabActive {
  color: var(--gold);
  border-color: var(--border-gold);
}
```

## MessageInput 接口不变

MessageInput 的 `onSend`、`onTyping`、`placeholder` 接口保持不变，由 Chat.tsx 根据 activePanel 传入对应的回调和 placeholder。

placeholder 逻辑：

```typescript
const inputPlaceholder = activePeerId
  ? (activePanel === 'hall' ? '发言于大厅...' : `私聊 ${activePeerUsername}...`)
  : '发言于大厅...';
```

## 面板点击选中

hallPane 和 privatePane 的消息列表区域点击时切换 activePanel：

```tsx
<div className={styles.hallPane} onClick={() => setActivePanel('hall')}>
  ...
</div>
<div className={styles.privatePane} onClick={() => setActivePanel('private')}>
  ...
</div>
```

注意：MessageList 内部的点击（灯箱、复制等）不应冒泡影响 activePanel，这些交互本身会 stopPropagation，无需额外处理。
