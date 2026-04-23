import { Router } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { requireAuth } from './middleware/auth';

const router = Router();
const FILES_DIR = path.join(__dirname, '../../data/files');

if (!fs.existsSync(FILES_DIR)) {
  fs.mkdirSync(FILES_DIR, { recursive: true });
}

router.post('/upload', requireAuth, (req, res) => {
  const chunks: Buffer[] = [];
  req.on('data', (chunk: Buffer) => chunks.push(chunk));
  req.on('end', () => {
    const id = crypto.randomUUID();
    fs.writeFileSync(path.join(FILES_DIR, id), Buffer.concat(chunks));
    res.json({ url: `/files/${id}` });
  });
  req.on('error', () => {
    res.status(500).json({ error: 'Upload failed' });
  });
});

export default router;
export { FILES_DIR };
