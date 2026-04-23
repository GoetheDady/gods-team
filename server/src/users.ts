import { Router } from 'express';
import { requireAuth } from './middleware/auth';
import type { AuthRequest } from './middleware/auth';
import sql from './pg';

const router = Router();

// 更新当前用户的昵称和/或头像 URL
// PATCH /api/users/me
// Body: { nickname?: string; avatar_url?: string }（至少一个字段）
router.patch('/me', requireAuth, async (req: AuthRequest, res) => {
  const { nickname, avatar_url } = req.body as {
    nickname?: string;
    avatar_url?: string;
  };

  // 至少需要一个字段
  if (nickname === undefined && avatar_url === undefined) {
    res.status(400).json({ error: 'nickname or avatar_url required' });
    return;
  }

  // nickname 校验：不能超过 20 字，不能为纯空格
  if (nickname !== undefined) {
    if (nickname.trim().length === 0) {
      res.status(400).json({ error: 'nickname cannot be empty or whitespace' });
      return;
    }
    if (nickname.length > 20) {
      res.status(400).json({ error: 'nickname must be 20 characters or fewer' });
      return;
    }
  }

  // 动态构建只更新传入字段的 SQL
  if (nickname !== undefined && avatar_url !== undefined) {
    await sql`
      UPDATE users SET nickname = ${nickname.trim()}, avatar_url = ${avatar_url}
      WHERE id = ${req.userId!}
    `;
  } else if (nickname !== undefined) {
    await sql`
      UPDATE users SET nickname = ${nickname.trim()}
      WHERE id = ${req.userId!}
    `;
  } else {
    await sql`
      UPDATE users SET avatar_url = ${avatar_url!}
      WHERE id = ${req.userId!}
    `;
  }

  res.json({ ok: true });
});

export default router;
