# 改造概览：PostgreSQL + OSS + 去加密

## 目标

- 数据库从 SQLite 切换到 PostgreSQL，开发/生产使用不同库
- 完全去除 E2EE 加密，消息明文存储（传输层由 HTTPS 保障）
- 图片存储从服务器本地切换到阿里云 OSS，客户端直传

## 整体架构

```
客户端 ──HTTPS──> 服务端（Express + WebSocket）
                     │
                     ├── PostgreSQL（用户、邀请码、消息）
                     │
                     └── 阿里云 OSS（图片存储）
```

## 改造顺序（方案 A：分层替换）

| 阶段 | 内容 | 可验证点 |
|------|------|---------|
| 阶段一 | SQLite → PostgreSQL，迁移 users/invite_codes，新增 messages 表 | 登录、注册、邀请码正常 |
| 阶段二 | 去掉加密，WS 明文存消息，客户端拉历史 | 消息收发、历史加载正常 |
| 阶段三 | 本地文件 → OSS 直传，图片渲染用 OSS 参数缩放 | 图片发送、展示正常 |

## 环境变量

### 服务端

```env
# 数据库
DATABASE_URL=postgresql://gods:gods123@localhost:5433/gods_team_dev   # 开发
DATABASE_URL=postgresql://gods:gods123@gods-team-db:5432/gods_team_prod  # 生产

# OSS
OSS_ENDPOINT=oss-cn-beijing.aliyuncs.com
OSS_BUCKET=gdsw-ai-web-chat
OSS_ACCESS_KEY_ID=...
OSS_ACCESS_KEY_SECRET=...
OSS_DIR_PREFIX=gods-team-dev   # 开发用 gods-team-dev，生产用 gods-team-prod
```

### OSS 目录结构

```
gdsw-ai-web-chat/
├── gods-team-dev/      # 开发环境图片
└── gods-team-prod/     # 生产环境图片
```
