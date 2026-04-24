import { Router } from 'express';
import { randomUUID } from 'crypto';
import { requireAuth } from './middleware/auth';
import type { AuthRequest } from './middleware/auth';
import sql from './pg';
import { wsBroadcast, wsSend } from './ws';

const router = Router();

// 发送消息（写库 + WS 广播/推送）
// 客户端通过 HTTP POST 发送消息，服务端写入 PostgreSQL 后通过 WebSocket 推送给在线用户
router.post('/', requireAuth, async (req: AuthRequest, res) => {
  const { chatId, content, images, to } = req.body as {
    chatId?: string;
    content?: string;
    images?: { url: string }[];
    to?: string;
  };

  if (!chatId) {
    res.status(400).json({ error: 'chatId required' });
    return;
  }

  const userId = req.userId!;
  const username = req.username!;
  const id = randomUUID();
  const timestamp = Date.now();
  const msgContent = content ?? null;
  const msgImages = images ?? null;

  // 私聊校验：chatId 格式为 'uid_a:uid_b'（排序后拼接），只有参与方才能发送
  if (chatId !== 'hall') {
    const participants = chatId.split(':');
    if (!participants.includes(userId)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
  }

  const [userProfile] = await sql<{ nickname: string | null; avatar_url: string | null }[]>`
    SELECT nickname, avatar_url FROM users WHERE id = ${userId}
  `;
  const senderName = userProfile?.nickname ?? username;
  const senderAvatarUrl = userProfile?.avatar_url ?? null;

  // 先写库再推送，确保消息持久化后在线用户才能收到
  await sql`
    INSERT INTO messages (id, chat_id, sender_id, sender_name, content, images, created_at)
    VALUES (${id}, ${chatId}, ${userId}, ${senderName}, ${msgContent}, ${msgImages ? sql.json(msgImages) : null}, ${timestamp})
  `;

  if (chatId === 'hall') {
    // 大厅消息：广播给所有在线用户（排除发送者，发送者客户端已在本地添加）
    wsBroadcast({ type: 'hall_message', id, from: userId, fromName: senderName, avatar_url: senderAvatarUrl, content: msgContent, images: msgImages, timestamp });
  } else {
    // 私聊消息：双方各收一份（发送者也需要收到，确保多设备同步）
    const outMsg = { type: 'private_message', id, from: userId, fromName: senderName, avatar_url: senderAvatarUrl, to, content: msgContent, images: msgImages, timestamp };
    if (to) wsSend(to, outMsg);
    wsSend(userId, outMsg);
  }

  res.json({ id, createdAt: timestamp });
});

// 查询消息历史（分页）
// chatId: 'hall' 为大厅，私聊为 'uid_a:uid_b'
// before: 可选时间戳，返回该时间之前的消息（用于滚到顶加载更多）
// 返回按时间升序排列（旧→新），方便客户端直接 append
router.get('/:chatId', requireAuth, async (req: AuthRequest, res) => {
  const chatId = req.params.chatId as string;

  // 私聊记录只允许参与方访问
  if (chatId !== 'hall') {
    const participants = chatId.split(':');
    if (!participants.includes(req.userId!)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
  }

  const before = req.query.before ? Number(req.query.before) : Date.now() + 1;
  const limit = 50;

  // 多查一条（limit + 1）用来判断是否还有更多消息
  const rows = await sql<{
    id: string;
    sender_id: string;
    sender_name: string;
    avatar_url: string | null;
    content: string | null;
    images: { url: string }[] | null;
    created_at: number;
  }[]>`
    SELECT m.id, m.sender_id, m.sender_name, u.avatar_url, m.content, m.images, m.created_at
    FROM messages m
    LEFT JOIN users u ON u.id = m.sender_id
    WHERE chat_id = ${chatId}
      AND m.created_at < ${before}
    ORDER BY m.created_at DESC
    LIMIT ${limit + 1}
  `;

  const hasMore = rows.length > limit;
  // 数据库查出来是 DESC（新→旧），reverse 后变成 ASC（旧→新），客户端直接 append
  const messages = rows.slice(0, limit).reverse().map(r => ({
    id: r.id,
    senderId: r.sender_id,
    senderName: r.sender_name,
    senderAvatarUrl: r.avatar_url,
    content: r.content ?? '',
    images: r.images,
    createdAt: Number(r.created_at),
  }));

  res.json({ messages, hasMore });
});

export default router;
