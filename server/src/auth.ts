import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import bcrypt from 'bcrypt';
import sql from './pg';
import { signToken, requireAuth, AuthRequest } from './middleware/auth';

const router = Router();

router.post('/register', async (req: Request, res: Response) => {
  const { username, password, invite_code } = req.body as {
    username?: string;
    password?: string;
    invite_code?: string;
  };

  if (!username || !password || !invite_code) {
    res.status(400).json({ error: 'username, password, invite_code required' });
    return;
  }

  const [code] = await sql<{ code: string; used_by: string | null }[]>`
    SELECT code, used_by FROM invite_codes WHERE code = ${invite_code}
  `;
  if (!code || code.used_by !== null) {
    res.status(400).json({ error: 'Invalid or already used invite code' });
    return;
  }

  const [existing] = await sql`SELECT id FROM users WHERE username = ${username}`;
  if (existing) {
    res.status(400).json({ error: 'Username already taken' });
    return;
  }

  const hash = await bcrypt.hash(password, 12);
  const userId = randomUUID();
  const now = Date.now();

  await sql.begin(async (tx) => {
    await tx`
      INSERT INTO users (id, username, password, is_admin, created_at)
      VALUES (${userId}, ${username}, ${hash}, FALSE, ${now})
    `;
    await tx`
      UPDATE invite_codes SET used_by = ${userId}, used_at = ${now}
      WHERE code = ${invite_code}
    `;
  });

  const token = signToken(userId, username);
  res.cookie('token', token, { httpOnly: true, sameSite: 'strict', maxAge: 7 * 24 * 3600 * 1000 });
  res.json({ userId, username });
});

router.post('/login', async (req: Request, res: Response) => {
  const { username, password } = req.body as { username?: string; password?: string };

  if (!username || !password) {
    res.status(400).json({ error: 'username and password required' });
    return;
  }

  const [user] = await sql<{ id: string; username: string; password: string }[]>`
    SELECT id, username, password FROM users WHERE username = ${username}
  `;
  if (!user || !(await bcrypt.compare(password, user.password))) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const token = signToken(user.id, user.username);
  res.cookie('token', token, { httpOnly: true, sameSite: 'strict', maxAge: 7 * 24 * 3600 * 1000 });
  res.json({ userId: user.id, username: user.username });
});

router.post('/logout', (_req, res: Response) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req: AuthRequest, res: Response) => {
  res.json({ userId: req.userId, username: req.username });
});

router.get('/token', requireAuth, (req: AuthRequest, res: Response) => {
  const token = signToken(req.userId!, req.username!);
  res.json({ token });
});

export default router;
