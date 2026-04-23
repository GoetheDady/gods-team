# 阶段三：OSS 图片上传与渲染

## 上传流程

```
客户端                        服务端                         OSS
  │                             │                             │
  │── GET /api/oss/sign ───────>│                             │
  │                             │── 生成 PostPolicy + 签名    │
  │<── { url, fields } ────────│                             │
  │                             │                             │
  │── POST FormData ───────────────────────────────────────> │
  │<── 204 No Content ─────────────────────────────────────── │
  │                             │                             │
  │── 发 WS 消息（带图片 url）──>│                             │
```

## 服务端签名接口

```
GET /api/oss/sign
```

返回：
```json
{
  "url": "https://gdsw-ai-web-chat.oss-cn-beijing.aliyuncs.com",
  "fields": {
    "key": "gods-team-prod/<uuid>.jpg",
    "policy": "<base64 policy>",
    "OSSAccessKeyId": "...",
    "signature": "<hmac-sha1 signature>"
  }
}
```

- `key` 中的目录前缀由服务端根据 `OSS_DIR_PREFIX` 环境变量决定
- 文件名用 UUID，客户端不感知目录结构

## 客户端上传代码（伪代码）

```ts
const { url, fields } = await api.getOssSign();
const form = new FormData();
Object.entries(fields).forEach(([k, v]) => form.append(k, v));
form.append('file', imageFile);
await fetch(url, { method: 'POST', body: form });
const imageUrl = `${url}/${fields.key}`;
```

## 图片渲染

OSS 图片处理通过 URL 参数按需缩放，不在客户端压缩：

| 场景 | URL 参数 |
|------|---------|
| 气泡缩略图 | `?x-oss-process=image/resize,w_300` |
| 灯箱大图 | `?x-oss-process=image/resize,w_1200` |
| 原图下载 | 不加参数 |

## 删除

- `src/upload.ts`（本地上传路由）
- `src/cleanup.ts`（定时清理）
- `client/src/services/imageUtils.ts`（客户端压缩）
- `Dockerfile` 中 `/files` 静态托管配置
