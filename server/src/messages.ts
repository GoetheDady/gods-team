import { Router } from 'express';
import { requireAuth } from './middleware/auth';
import type { AuthRequest } from './middleware/auth';
import sql from './pg';

const router = Router();

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
