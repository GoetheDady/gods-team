# 客户端改动清单

## 删除文件

| 文件 | 原因 |
|------|------|
| `src/services/crypto.ts` | E2EE 全部移除 |
| `src/services/localDb.ts` | IndexedDB 不再需要 |
| `src/services/imageUtils.ts` | 客户端压缩移除，改用 OSS 缩放 |

## 重写文件

### `src/pages/Chat.tsx`

- 删除：所有密钥管理（`myKeyPair`、`hallKey`、`sessionKeys`、`getSessionKey`）
- 删除：`hallKeyReady` 状态，等待密钥的逻辑
- 删除：E2EE 相关 WS 消息处理（`hall_key_distribution`）
- 新增：WS 连接后调 `api.getMessages('hall')` 拉历史
- 新增：`hallMessages` / `privateMessages` 直接由服务端下发，不再解密
- 新增：滚到顶触发 `loadMore(chatId, beforeTimestamp)`
- 新增：切换私聊时加载该对话历史
- 简化：`sendHallMessage` / `sendPrivateMessage` 直接发明文 WS 消息

### `src/services/api.ts`

新增：
```ts
getMessages(chatId: string, before?: number): Promise<{ messages: Message[]; hasMore: boolean }>
getOssSign(): Promise<{ url: string; fields: Record<string, string> }>
```

删除：
```ts
uploadFile()
getPubkey()
uploadPubkey()
```

## 改动较小的文件

### `src/components/MessageList.tsx`

- 删除：图片解密逻辑（`onLoadImage`、`imageUrls` Map）
- 简化：图片直接用 OSS URL 渲染，缩略图加 `?x-oss-process=image/resize,w_300`
- 保留：灯箱逻辑，大图用 `?x-oss-process=image/resize,w_1200`

### `src/components/MessageInput.tsx`

- 附件按钮：先 `GET /api/oss/sign`，再 FormData 直传 OSS，拿到 URL 后存入 `pendingImage`
- 发送时：把 `pendingImage.url` 附在消息里通过 WS 发出
- 删除：`onSend` 中的 file 参数（上传在 Input 内部完成，发送时只传 URL）

### `src/components/PrivatePanel.tsx`

- 删除：`imageUrls`、`onLoadImage` props（不再需要解密回调）
- 其余结构不变

## 保留不动

- 所有 `.module.css` 样式文件
- `src/pages/Login.tsx`、`Register.tsx`、`Settings.tsx`
- `src/services/ws.ts`
- `src/App.tsx`
