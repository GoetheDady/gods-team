import { Router, Response } from 'express';
import db from './db';
import { requireAuth, AuthRequest } from './middleware/auth';

const router = Router();

router.post('/me/pubkey', requireAuth, (req: AuthRequest, res: Response) => {
  const { key_data } = req.body as { key_data?: string };

  if (!key_data || typeof key_data !== 'string') {
    res.status(400).json({ error: 'key_data required' });
    return;
  }

  const now = Date.now();
  db.prepare(`
    INSERT INTO public_keys (user_id, key_data, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET key_data = excluded.key_data, updated_at = excluded.updated_at
  `).run(req.userId, key_data, now);

  res.json({ ok: true });
});

router.get('/:id/pubkey', requireAuth, (req: AuthRequest, res: Response) => {
  const row = db.prepare('SELECT key_data FROM public_keys WHERE user_id = ?').get(req.params.id) as
    | { key_data: string }
    | undefined;

  if (!row) {
    res.status(404).json({ error: 'Public key not found' });
    return;
  }

  res.json({ key_data: row.key_data });
});

export default router;
