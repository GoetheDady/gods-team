import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import bcrypt from 'bcrypt';
import db from './db';
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

  const code = db.prepare('SELECT * FROM invite_codes WHERE code = ?').get(invite_code) as
    | { code: string; used_by: string | null }
    | undefined;

  if (!code || code.used_by !== null) {
    res.status(400).json({ error: 'Invalid or already used invite code' });
    return;
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    res.status(400).json({ error: 'Username already taken' });
    return;
  }

  const hash = await bcrypt.hash(password, 12);
  const userId = randomUUID();
  const now = Date.now();

  db.transaction(() => {
    db.prepare('INSERT INTO users (id, username, password, created_at) VALUES (?, ?, ?, ?)').run(
      userId, username, hash, now
    );
    db.prepare('UPDATE invite_codes SET used_by = ?, used_at = ? WHERE code = ?').run(
      userId, now, invite_code
    );
  })();

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

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as
    | { id: string; username: string; password: string }
    | undefined;

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
