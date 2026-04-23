import { Router, Response } from 'express';
import { randomBytes } from 'crypto';
import sql from './pg';
import { requireAuth, AuthRequest } from './middleware/auth';

const router = Router();

router.post('/generate', requireAuth, async (req: AuthRequest, res: Response) => {
  const code = randomBytes(4).toString('hex').toUpperCase();
  const now = Date.now();

  await sql`
    INSERT INTO invite_codes (code, created_by, created_at)
    VALUES (${code}, ${req.userId!}, ${now})
  `;

  res.json({ code });
});

router.get('/mine', requireAuth, async (req: AuthRequest, res: Response) => {
  const codes = await sql<{
    code: string;
    created_at: number;
    used_by: string | null;
    used_at: number | null;
  }[]>`
    SELECT code, created_at, used_by, used_at
    FROM invite_codes
    WHERE created_by = ${req.userId!}
    ORDER BY created_at DESC
  `;

  res.json({ codes });
});

export default router;
