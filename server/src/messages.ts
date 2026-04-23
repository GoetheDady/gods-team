import { Router } from 'express';
import { randomUUID } from 'crypto';
import { requireAuth } from './middleware/auth';
import type { AuthRequest } from './middleware/auth';
import sql from './pg';
import { wsBroadcast, wsSend } from './ws';

const router = Router();

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

  // 私聊校验
  if (chatId !== 'hall') {
    const participants = chatId.split(':');
    if (!participants.includes(userId)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
  }

  await sql`
    INSERT INTO messages (id, chat_id, sender_id, sender_name, content, images, created_at)
    VALUES (${id}, ${chatId}, ${userId}, ${username}, ${msgContent}, ${msgImages ? sql.json(msgImages) : null}, ${timestamp})
  `;

  if (chatId === 'hall') {
    wsBroadcast({ type: 'hall_message', id, from: userId, fromName: username, content: msgContent, images: msgImages, timestamp });
  } else {
    const outMsg = { type: 'private_message', id, from: userId, fromName: username, to, content: msgContent, images: msgImages, timestamp };
    if (to) wsSend(to, outMsg);
    wsSend(userId, outMsg);
  }

  res.json({ id, createdAt: timestamp });
});

router.get('/:chatId', requireAuth, async (req: AuthRequest, res) => {
  const chatId = req.params.chatId as string;

  if (chatId !== 'hall') {
    const participants = chatId.split(':');
    if (!participants.includes(req.userId!)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
  }

  const before = req.query.before ? Number(req.query.before) : Date.now() + 1;
  const limit = 50;

  const rows = await sql<{
    id: string;
    sender_id: string;
    sender_name: string;
    content: string | null;
    images: { url: string }[] | null;
    created_at: number;
  }[]>`
    SELECT id, sender_id, sender_name, content, images, created_at
    FROM messages
    WHERE chat_id = ${chatId}
      AND created_at < ${before}
    ORDER BY created_at DESC
    LIMIT ${limit + 1}
  `;

  const hasMore = rows.length > limit;
  const messages = rows.slice(0, limit).reverse().map(r => ({
    id: r.id,
    senderId: r.sender_id,
    senderName: r.sender_name,
    content: r.content ?? '',
    images: r.images,
    createdAt: Number(r.created_at),
  }));

  res.json({ messages, hasMore });
});

export default router;
