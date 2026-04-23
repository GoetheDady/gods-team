# E2EE 聊天室图片发送功能设计

## 概述

为江湖 E2EE 聊天室添加图片发送能力。图片客户端加密后上传到服务器，URL 通过现有 E2EE WebSocket 通道传输，服务端永远无法看到明文图片。图片 1 小时后自动清理。

## 消息格式扩展

现有 `Message.content` 为纯字符串。扩展为支持图片：

```typescript
type ImageMeta = {
  url: string;      // 服务器上的加密文件路径，如 "/files/abc123"
  width: number;
  height: number;
};

// Message 和 LocalMessage 均增加可选字段
type Message = {
  id: string;
  from_id: string;
  from_username: string;
  content: string;
  images?: ImageMeta[];
  timestamp: number;
};
```

E2EE 加密载荷（解密后的 JSON）：

```json
{"content": "hello"}
{"content": "看这个", "images": [{"url": "/files/abc123", "width": 800, "height": 600}]}
```

服务端 WebSocket 中继逻辑无需改动——只转发 `{ ciphertext, iv }`。

## 图片发送流程

1. 用户通过文件选择器或粘贴选择图片，输入框显示缩略图预览
2. 点击发送时：
   a. 如果原图 > 5MB，Canvas 压缩（长边超过 2000px 时等比缩放到 2000px，降低 JPEG 质量）
   b. 用当前会话密钥（hall key 或 session key）AES-256-GCM 加密图片 ArrayBuffer
   c. POST /api/upload，body 为加密后的二进制文件，requireAuth 鉴权
   d. 服务器返回 { url: "/files/随机ID" }
   e. 构造载荷 { content: "文字", images: [{ url, width, height }] }
   f. 用同一个会话密钥加密载荷，通过 WebSocket 发送

## 图片接收与展示流程

1. 收到 WebSocket E2EE 消息，解密载荷
2. 如果载荷含 images 字段，对每张图片：
   a. fetch(url) 下载加密文件
   b. 用当前会话密钥解密得到原始图片字节
   c. 创建 Blob + URL.createObjectURL() 得到 blob URL
   d. 缓存到 Map<messageId, string[]> 中（内存，不持久化）
3. 消息气泡渲染：有文字显示文字，有图片显示缩略图（CSS 限制最大宽高），两者都有则文字在上图片在下
4. 点击缩略图全屏查看大图
5. 页面刷新后 blob URL 失效，滚动到该消息时重新下载解密（图片在服务器上存在 1 小时内可重新获取）

## 服务端改动

### 新增上传接口（upload.ts）

- `POST /api/upload`：接收二进制 body，生成随机文件名（crypto.randomUUID()），存到 data/files/ 目录，返回 { url: "/files/xxx" }。需要 requireAuth 中间件。
- `GET /files/:id`：静态文件服务，serve data/files/ 下的文件。

### 定期清理（cleanup.ts）

- 每小时扫描 data/files/ 目录，删除修改时间超过 1 小时的文件
- 用 setInterval 在服务启动时注册

### Express 入口（index.ts）

- 挂载 /api/upload 路由
- 挂载 /files 静态文件 serve
- 启动清理定时器

## 边界情况

- 图片超过 5MB 且压缩失败：提示"图片过大，无法发送"
- 下载加密图片失败（已被清理）：显示"图片已过期"占位符
- 上传失败：提示"上传失败"，不发送消息
- v1 限制每次只发一张图片
- 文件名随机（crypto.randomUUID()），不可枚举目录

## 改动范围

| 层 | 文件 | 改动 |
|---|---|---|
| 加密 | crypto.ts | 新增 encryptBinary / decryptBinary 处理 ArrayBuffer |
| API | api.ts | 新增 uploadFile 方法 |
| 服务端 | 新增 upload.ts | 上传接口 + 静态文件 serve |
| 服务端 | 新增 cleanup.ts | 定时清理 |
| 服务端 | index.ts | 挂载新路由，启动清理器 |
| 本地存储 | localDb.ts | LocalMessage 增加 images 字段 |
| UI | MessageInput.tsx | 文件选择 + 粘贴 + 预览 |
| UI | MessageList.tsx | 图片渲染 + 点击放大 |
| 逻辑 | Chat.tsx | 图片发送/接收/blob URL 缓存 |
| 样式 | 对应 .module.css | 图片相关样式 |

WebSocket 中继和 E2EE 协议选举机制完全不动。
