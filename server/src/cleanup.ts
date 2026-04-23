import fs from 'fs';
import path from 'path';

const MAX_AGE_MS = 60 * 60 * 1000;

export function startCleanup(filesDir: string): NodeJS.Timeout {
  return setInterval(() => {
    if (!fs.existsSync(filesDir)) return;
    const now = Date.now();
    for (const file of fs.readdirSync(filesDir)) {
      const filePath = path.join(filesDir, file);
      try {
        if (now - fs.statSync(filePath).mtimeMs > MAX_AGE_MS) {
          fs.unlinkSync(filePath);
        }
      } catch {}
    }
  }, MAX_AGE_MS);
}
