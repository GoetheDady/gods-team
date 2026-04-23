# 阶段二：WebSocket 消息流与历史记录

## WebSocket 消息格式

### 客户端发送

```json
{ "type": "hall_message", "content": "你好", "images": [{"url": "https://..."}] }
{ "type": "private_message", "to": "uid_b", "content": "你好", "images": null }
{ "type": "typing", "to": "uid_b" }
```

### 服务端下发

```json
{
  "type": "hall_message",
  "id": "uuid",
  "from": "uid",
  "fromName": "gdsw",
  "content": "你好",
  "images": null,
  "timestamp": 1234567890
}
```

## 服务端处理逻辑

收到消息后：
1. 生成 UUID 作为消息 id
2. 写入 PostgreSQL `messages` 表
3. 广播（大厅）或点对点下发（私聊双方各收一份）

删除消息类型：`hall_key_distribution`（E2EE 密钥分发，不再需要）

## 历史记录 REST API

### 接口

```
GET /api/messages/:chatId?before=<timestamp>&limit=50
```

- `chatId`：`hall` 或私聊 id（如 `uid_a:uid_b`）
- `before`：可选，返回该时间戳之前的消息（首次不传，返回最新 50 条）
- `limit`：固定 50

### 返回格式

```json
{
  "messages": [
    {
      "id": "uuid",
      "senderId": "uid",
      "senderName": "gdsw",
      "content": "你好",
      "images": null,
      "createdAt": 1234567890
    }
  ],
  "hasMore": true
}
```

消息按 `created_at ASC` 排列（旧→新），方便客户端直接 append。

## 客户端加载逻辑

1. WS 连接建立后，立即调 `GET /api/messages/hall` 加载大厅最新 50 条
2. 用户滚到顶时，传 `before=最早一条的 timestamp` 加载更多
3. 收到 WS 实时消息时直接 append 到列表末尾
4. 切换私聊时，调 `GET /api/messages/:chatId` 加载该对话历史
