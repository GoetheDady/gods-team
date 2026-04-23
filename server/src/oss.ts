import { Router } from 'express';
import crypto from 'crypto';
import { requireAuth } from './middleware/auth';
import type { AuthRequest } from './middleware/auth';

const router = Router();

router.get('/sign', requireAuth, (_req: AuthRequest, res) => {
  const bucket = process.env.OSS_BUCKET!;
  const endpoint = process.env.OSS_ENDPOINT!;
  const accessKeyId = process.env.OSS_ACCESS_KEY_ID!;
  const accessKeySecret = process.env.OSS_ACCESS_KEY_SECRET!;
  const dirPrefix = process.env.OSS_DIR_PREFIX || 'gods-team-dev';

  if (!bucket || !endpoint || !accessKeyId || !accessKeySecret) {
    res.status(503).json({ error: 'OSS not configured' });
    return;
  }

  const expiration = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  const key = `${dirPrefix}/${crypto.randomUUID()}`;

  const policy = {
    expiration,
    conditions: [
      ['content-length-range', 0, 50 * 1024 * 1024],
      ['starts-with', '$key', dirPrefix],
    ],
  };

  const policyBase64 = Buffer.from(JSON.stringify(policy)).toString('base64');
  const signature = crypto
    .createHmac('sha1', accessKeySecret)
    .update(policyBase64)
    .digest('base64');

  res.json({
    url: `https://${bucket}.${endpoint}`,
    fields: {
      key,
      policy: policyBase64,
      OSSAccessKeyId: accessKeyId,
      signature,
    },
  });
});

export default router;
