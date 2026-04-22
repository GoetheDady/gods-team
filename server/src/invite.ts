import { Router, Response } from 'express';
import { randomBytes } from 'crypto';
import db from './db';
import { requireAuth, AuthRequest } from './middleware/auth';

const router = Router();

router.post('/generate', requireAuth, (req: AuthRequest, res: Response) => {
  const code = randomBytes(4).toString('hex').toUpperCase();
  const now = Date.now();

  db.prepare(
    'INSERT INTO invite_codes (code, created_by, created_at) VALUES (?, ?, ?)'
  ).run(code, req.userId, now);

  res.json({ code });
});

router.get('/mine', requireAuth, (req: AuthRequest, res: Response) => {
  const codes = db
    .prepare(
      `SELECT code, created_at, used_by, used_at
       FROM invite_codes
       WHERE created_by = ?
       ORDER BY created_at DESC`
    )
    .all(req.userId) as Array<{
      code: string;
      created_at: number;
      used_by: string | null;
      used_at: number | null;
    }>;

  res.json({ codes });
});

export default router;
