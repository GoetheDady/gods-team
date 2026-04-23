# Image Sending Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add E2EE image sending — images encrypted client-side with session key, uploaded to server, URL shared via existing E2EE WebSocket channel.

**Architecture:** `encryptBinary` encrypts image ArrayBuffer with the same AES-256-GCM key used for text. `EncryptedPayload` is JSON.stringify'd and uploaded to `POST /api/upload`. Server stores it, returns URL. URL goes into E2EE message payload. Receiver fetches the file, parses JSON, calls `decryptBinary`, creates blob URL. Server cleans files older than 1 hour.

**Tech Stack:** Express 5, Web Crypto API, React + CSS Modules, Vitest + Supertest

---

### Task 1: Server — Upload endpoint + test

**Files:**
- Create: `server/src/upload.ts`
- Create: `server/tests/upload.test.ts`
- Modify: `server/src/index.ts`

- [ ] **Step 1: Create upload route with requireAuth**

`server/src/upload.ts`:

```typescript
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
```

- [ ] **Step 2: Write test**

`server/tests/upload.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/index';
import db from '../src/db';

beforeEach(() => {
  db.exec('DELETE FROM public_keys; DELETE FROM invite_codes; DELETE FROM users;');
});

describe('POST /api/upload', () => {
  it('未登录时返回 401', async () => {
    const res = await request(app)
      .post('/api/upload')
      .send(Buffer.from('test'));
    expect(res.status).toBe(401);
  });

  it('登录后上传返回 url', async () => {
    db.prepare(
      'INSERT INTO invite_codes (code, created_by, created_at) VALUES (?, NULL, ?)'
    ).run('UPLOAD01', Date.now());
    const agent = request.agent(app);
    await agent
      .post('/api/auth/register')
      .send({ username: 'uploaduser', password: 'pass123', invite_code: 'UPLOAD01' });

    const res = await agent
      .post('/api/upload')
      .send(Buffer.from('encrypted-image-data'));

    expect(res.status).toBe(200);
    expect(res.body.url).toMatch(/^\/files\//);
  });

  it('GET /files/:id 返回上传的文件', async () => {
    db.prepare(
      'INSERT INTO invite_codes (code, created_by, created_at) VALUES (?, NULL, ?)'
    ).run('UPLOAD02', Date.now());
    const agent = request.agent(app);
    await agent
      .post('/api/auth/register')
      .send({ username: 'getfileuser', password: 'pass123', invite_code: 'UPLOAD02' });

    const data = Buffer.from('encrypted-image-data-2');
    const uploadRes = await agent
      .post('/api/upload')
      .send(data);

    const fileRes = await request(app).get(uploadRes.body.url);
    expect(fileRes.status).toBe(200);
    expect(fileRes.body.toString()).toBe('encrypted-image-data-2');
  });
});
```

- [ ] **Step 3: Mount in index.ts**

Add imports:
```typescript
import uploadRouter from './upload';
import { FILES_DIR } from './upload';
```

After the health check route:
```typescript
app.use('/api', uploadRouter);
app.use('/files', express.static(FILES_DIR));
```

- [ ] **Step 4: Run tests**

`cd server && npx vitest run tests/upload.test.ts`

- [ ] **Step 5: Commit**

```bash
git add server/src/upload.ts server/src/index.ts server/tests/upload.test.ts
git commit -m "feat(server): add encrypted file upload endpoint"
```

---

### Task 2: Server — Cleanup timer

**Files:**
- Create: `server/src/cleanup.ts`
- Modify: `server/src/index.ts`

- [ ] **Step 1: Create cleanup module**

`server/src/cleanup.ts`:

```typescript
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
```

- [ ] **Step 2: Start in index.ts**

Import and call inside the `NODE_ENV !== 'test'` block before `server.listen`:
```typescript
import { startCleanup } from './cleanup';
// ...
startCleanup(FILES_DIR);
```

- [ ] **Step 3: Run all server tests**

`cd server && npm test`

- [ ] **Step 4: Commit**

```bash
git add server/src/cleanup.ts server/src/index.ts
git commit -m "feat(server): add hourly cleanup for uploaded files"
```

---

### Task 3: Client — Binary crypto + API + vite proxy

**Files:**
- Modify: `client/src/services/crypto.ts`
- Modify: `client/src/services/api.ts`
- Modify: `client/vite.config.ts`
- Modify: `client/tests/crypto.test.ts`

- [ ] **Step 1: Write failing test**

Append to `client/tests/crypto.test.ts`:

```typescript
describe('encryptBinary / decryptBinary', () => {
  it('encrypts and decrypts binary data', async () => {
    const key = await generateAesKey();
    const original = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]);
    const encrypted = await encryptBinary(original.buffer as ArrayBuffer, key);
    const decrypted = await decryptBinary(encrypted, key);
    expect(new Uint8Array(decrypted)).toEqual(original);
  });
});
```

- [ ] **Step 2: Run test, verify fail**

`cd client && npx vitest --config vitest.config.browser.ts run tests/crypto.test.ts`

- [ ] **Step 3: Implement**

Append to `client/src/services/crypto.ts`:

```typescript
export async function encryptBinary(data: ArrayBuffer, key: CryptoKey): Promise<EncryptedPayload> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipherbuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
  return {
    ciphertext: btoa(String.fromCharCode(...new Uint8Array(cipherbuf))),
    iv: btoa(String.fromCharCode(...new Uint8Array(iv))),
  };
}

export async function decryptBinary(payload: EncryptedPayload, key: CryptoKey): Promise<ArrayBuffer> {
  const cipherbuf = Uint8Array.from(atob(payload.ciphertext), c => c.charCodeAt(0));
  const iv = Uint8Array.from(atob(payload.iv), c => c.charCodeAt(0));
  return crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipherbuf);
}
```

- [ ] **Step 4: Run test, verify pass**

`cd client && npx vitest --config vitest.config.browser.ts run tests/crypto.test.ts`

- [ ] **Step 5: Add uploadFile to api.ts**

Append to the `api` object in `client/src/services/api.ts`:

```typescript
uploadFile(encryptedPayload: string): Promise<{ url: string }> {
  return fetch(BASE + '/upload', {
    method: 'POST',
    credentials: 'include',
    body: encryptedPayload,
  }).then(async res => {
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload failed');
    return data as { url: string };
  });
},
```

- [ ] **Step 6: Add /files proxy**

In `client/vite.config.ts`, add to proxy:
```typescript
'/files': 'http://localhost:3000',
```

- [ ] **Step 7: Commit**

```bash
git add client/src/services/crypto.ts client/src/services/api.ts client/vite.config.ts client/tests/crypto.test.ts
git commit -m "feat(client): add binary crypto, upload API, vite proxy"
```

---

### Task 4: Client — Message types

**Files:**
- Modify: `client/src/components/MessageList.tsx`
- Modify: `client/src/services/localDb.ts`

- [ ] **Step 1: Update MessageList.tsx types**

Replace interface block:
```typescript
export interface ImageMeta {
  url: string;
  width: number;
  height: number;
}

export interface Message {
  id: string;
  from_id: string;
  from_username: string;
  content: string;
  images?: ImageMeta[];
  timestamp: number;
}
```

- [ ] **Step 2: Update localDb.ts types**

Replace interface block:
```typescript
export interface ImageMeta {
  url: string;
  width: number;
  height: number;
}

export interface LocalMessage {
  id: string;
  chat_id: string;
  from_id: string;
  from_username: string;
  content: string;
  images?: ImageMeta[];
  timestamp: number;
}
```

- [ ] **Step 3: Commit**

```bash
git add client/src/components/MessageList.tsx client/src/services/localDb.ts
git commit -m "feat(client): add images field to Message and LocalMessage"
```

---

### Task 5: Client — Image compression utility

**Files:**
- Create: `client/src/services/imageUtils.ts`

- [ ] **Step 1: Create**

```typescript
const MAX_SIZE = 5 * 1024 * 1024;
const MAX_DIMENSION = 2000;

export function compressImage(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (Math.max(width, height) > MAX_DIMENSION) {
        const scale = MAX_DIMENSION / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
      let quality = 0.85;
      const tryCompress = () => {
        canvas.toBlob(
          (blob) => {
            if (!blob) { reject(new Error('Compression failed')); return; }
            if (blob.size > MAX_SIZE && quality > 0.3) {
              quality -= 0.15;
              tryCompress();
            } else if (blob.size > MAX_SIZE) {
              reject(new Error('图片过大，无法发送'));
            } else {
              resolve({ blob, width, height });
            }
          },
          'image/jpeg',
          quality,
        );
      };
      tryCompress();
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/services/imageUtils.ts
git commit -m "feat(client): add image compression utility"
```

---

### Task 6: Client — MessageInput with image support

**Files:**
- Modify: `client/src/components/MessageInput.tsx`
- Modify: `client/src/components/MessageInput.module.css`

- [ ] **Step 1: Rewrite MessageInput.tsx**

`onSend` signature becomes `(text: string, file?: File) => void`. MessageInput handles file selection, paste, and preview. Chat.tsx handles compression/encryption/upload.

```typescript
import { useState, useRef } from 'react';
import type { KeyboardEvent, ChangeEvent, ClipboardEvent } from 'react';
import styles from './MessageInput.module.css';

interface Props {
  onSend: (text: string, file?: File) => void;
  onTyping: () => void;
  disabled?: boolean;
  placeholder?: string;
}

export default function MessageInput({ onSend, onTyping, disabled, placeholder }: Props) {
  const [text, setText] = useState('');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const composing = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function autoResize() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }

  function handleChange(e: ChangeEvent<HTMLTextAreaElement>) {
    setText(e.target.value);
    autoResize();
    onTyping();
    if (typingTimer.current) clearTimeout(typingTimer.current);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !composing.current) {
      e.preventDefault();
      submit();
    }
  }

  function handlePaste(e: ClipboardEvent<HTMLTextAreaElement>) {
    for (const item of e.clipboardData.items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) addImage(file);
        break;
      }
    }
  }

  function handleFileSelect(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) addImage(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function addImage(file: File) {
    if (preview) URL.revokeObjectURL(preview);
    setPendingFile(file);
    setPreview(URL.createObjectURL(file));
  }

  function removeImage() {
    if (preview) URL.revokeObjectURL(preview);
    setPendingFile(null);
    setPreview(null);
  }

  function submit() {
    const trimmed = text.trim();
    if ((!trimmed && !pendingFile) || disabled) return;
    onSend(trimmed, pendingFile || undefined);
    setText('');
    removeImage();
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  }

  return (
    <div className={styles.container}>
      {preview && (
        <div className={styles.preview}>
          <img src={preview} alt="preview" className={styles.previewImg} />
          <button className={styles.removeBtn} onClick={removeImage}>×</button>
        </div>
      )}
      <div className={styles.row}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className={styles.fileInput}
          onChange={handleFileSelect}
        />
        <button
          className={styles.attachBtn}
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          title="发送图片"
        >
          +
        </button>
        <textarea
          ref={textareaRef}
          className={styles.input}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onCompositionStart={() => { composing.current = true; }}
          onCompositionEnd={() => { composing.current = false; }}
          placeholder={placeholder || '输入消息，Enter 发送，Shift+Enter 换行'}
          disabled={disabled}
          rows={1}
        />
        <button className={styles.send} onClick={submit} disabled={disabled || (!text.trim() && !pendingFile)}>
          发送
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Rewrite MessageInput.module.css**

```css
.container {
  display: flex;
  flex-direction: column;
}

.preview {
  padding: 8px 16px 0;
  position: relative;
  display: inline-block;
}

.previewImg {
  max-height: 120px;
  max-width: 200px;
  border-radius: var(--radius-sm);
  object-fit: contain;
}

.removeBtn {
  position: absolute;
  top: 4px;
  right: -4px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--danger);
  color: white;
  font-size: 12px;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.row {
  display: flex;
  align-items: flex-end;
  gap: 12px;
  padding: 12px 16px;
  border-top: 1px solid var(--border-subtle);
  background: var(--bg-input);
}

.fileInput {
  display: none;
}

.input {
  flex: 1;
  padding: 8px 0;
  border-bottom: 1px solid var(--border-gold);
  resize: none;
  min-height: 36px;
  max-height: 120px;
  line-height: 1.5;
  transition: border-color var(--transition);
}

.input:focus {
  border-color: var(--gold);
}

.input::placeholder {
  color: var(--text-muted);
}

.attachBtn {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-gold);
  color: var(--gold);
  font-size: 18px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background var(--transition);
}

.attachBtn:hover:not(:disabled) {
  background: var(--gold-glow);
}

.attachBtn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.send {
  padding: 8px 18px;
  background: var(--gold);
  color: #0f1014;
  font-family: var(--font-display);
  font-size: 14px;
  border-radius: var(--radius-sm);
  transition: opacity var(--transition), transform var(--transition);
  flex-shrink: 0;
}

.send:hover:not(:disabled) {
  opacity: 0.9;
  transform: translateY(-1px);
}

.send:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
```

- [ ] **Step 3: Commit**

```bash
git add client/src/components/MessageInput.tsx client/src/components/MessageInput.module.css
git commit -m "feat(client): add image selection, paste, preview to MessageInput"
```

---

### Task 7: Client — MessageList with image rendering + lightbox

**Files:**
- Modify: `client/src/components/MessageList.tsx`
- Modify: `client/src/components/MessageList.module.css`

- [ ] **Step 1: Rewrite MessageList.tsx**

New props: `imageUrls: Map<string, string[]>` and `onLoadImage: (msgId: string, meta: ImageMeta) => void`. The component triggers image loading via useEffect when messages contain images not yet in the map.

```typescript
import { useEffect, useRef, useState } from 'react';
import styles from './MessageList.module.css';

export interface ImageMeta {
  url: string;
  width: number;
  height: number;
}

export interface Message {
  id: string;
  from_id: string;
  from_username: string;
  content: string;
  images?: ImageMeta[];
  timestamp: number;
}

interface Props {
  messages: Message[];
  currentUserId: string;
  typingUsernames: string[];
  imageUrls: Map<string, string[]>;
  onLoadImage: (msgId: string, meta: ImageMeta) => void;
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

export default function MessageList({ messages, currentUserId, typingUsernames, imageUrls, onLoadImage }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUsernames]);

  useEffect(() => {
    for (const msg of messages) {
      if (msg.images?.length && !imageUrls.has(msg.id)) {
        for (const img of msg.images) {
          onLoadImage(msg.id, img);
        }
      }
    }
  }, [messages]);

  return (
    <div className={styles.container}>
      {messages.map(msg => (
        <div
          key={msg.id}
          className={`${styles.message} ${msg.from_id === currentUserId ? styles.self : styles.other}`}
        >
          <div className={styles.meta}>
            <span className={styles.sender}>{msg.from_username}</span>
            <span className={styles.time}>{formatTime(msg.timestamp)}</span>
          </div>
          <div className={styles.bubble}>
            {msg.content && <p className={styles.text}>{msg.content}</p>}
            {msg.images?.map((img, i) => {
              const urls = imageUrls.get(msg.id);
              if (urls?.[i]) {
                return (
                  <img
                    key={i}
                    src={urls[i]}
                    alt=""
                    className={styles.image}
                    onClick={() => setLightbox(urls[i])}
                  />
                );
              }
              return <div key={i} className={styles.imageExpired}>图片加载中…</div>;
            })}
          </div>
        </div>
      ))}
      <div
        className={styles.typing}
        style={{ visibility: typingUsernames.length > 0 ? 'visible' : 'hidden' }}
      >
        {typingUsernames.join('、')} 正在输入...
      </div>
      <div ref={bottomRef} />
      {lightbox && (
        <div className={styles.lightbox} onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="" />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Append styles to MessageList.module.css**

```css
.text {
  margin: 0;
}

.image {
  max-width: 280px;
  max-height: 200px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  object-fit: contain;
  display: block;
  margin-top: 4px;
}

.imageExpired {
  padding: 8px 12px;
  color: var(--text-muted);
  font-size: 12px;
  font-style: italic;
}

.lightbox {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  cursor: pointer;
}

.lightbox img {
  max-width: 90vw;
  max-height: 90vh;
  object-fit: contain;
}
```

- [ ] **Step 3: Commit**

```bash
git add client/src/components/MessageList.tsx client/src/components/MessageList.module.css
git commit -m "feat(client): add image rendering and lightbox to MessageList"
```

---

### Task 8: Client — Chat.tsx + PrivatePanel wiring

**Files:**
- Modify: `client/src/pages/Chat.tsx`
- Modify: `client/src/components/PrivatePanel.tsx`

- [ ] **Step 1: Add imports to Chat.tsx**

```typescript
import { encryptBinary, decryptBinary } from '../services/crypto';
import { compressImage } from '../services/imageUtils';
import type { ImageMeta } from '../components/MessageList';
```

- [ ] **Step 2: Add image state**

After `activePeerIdRef`:
```typescript
const [hallImageUrls, setHallImageUrls] = useState<Map<string, string[]>>(new Map());
const [privateImageUrls, setPrivateImageUrls] = useState<Map<string, string[]>>(new Map());
```

- [ ] **Step 3: Update WS message parsing**

In `hall_message` handler, replace the decrypt-then-construct block:

```typescript
const decrypted = await decrypt(payload, hallKey.current);
const parsed = JSON.parse(decrypted);
const newMsg: Message = {
  id: `${msg.from}-${msg.timestamp}`,
  from_id: msg.from,
  from_username: fromUsername,
  content: parsed.content || '',
  images: parsed.images,
  timestamp: msg.timestamp!,
};
```

Same pattern for `private_message` handler.

- [ ] **Step 4: Replace sendHallMessage**

```typescript
async function sendHallMessage(text: string, file?: File) {
  if (!hallKey.current) return;
  let images: ImageMeta[] | undefined;
  if (file) {
    try {
      const { blob, width, height } = await compressImage(file);
      const encrypted = await encryptBinary(await blob.arrayBuffer(), hallKey.current);
      const { url } = await api.uploadFile(JSON.stringify(encrypted));
      images = [{ url, width, height }];
    } catch (err) {
      alert(err instanceof Error ? err.message : '上传失败');
      return;
    }
  }
  const payload = await encrypt(JSON.stringify({ content: text, images }), hallKey.current);
  wsClient.send({ type: 'hall_message', payload });
}
```

- [ ] **Step 5: Replace sendPrivateMessage**

```typescript
async function sendPrivateMessage(text: string, file?: File) {
  if (!activePeerId) return;
  const sessionKey = await getSessionKey(activePeerId);
  if (!sessionKey) return;
  let images: ImageMeta[] | undefined;
  if (file) {
    try {
      const { blob, width, height } = await compressImage(file);
      const encrypted = await encryptBinary(await blob.arrayBuffer(), sessionKey);
      const { url } = await api.uploadFile(JSON.stringify(encrypted));
      images = [{ url, width, height }];
    } catch (err) {
      alert(err instanceof Error ? err.message : '上传失败');
      return;
    }
  }
  const payload = await encrypt(JSON.stringify({ content: text, images }), sessionKey);
  wsClient.send({ type: 'private_message', payload: { to: activePeerId, ...payload } });
}
```

- [ ] **Step 6: Add image loading helpers**

```typescript
async function loadHallImage(msgId: string, meta: ImageMeta) {
  if (!hallKey.current) return;
  try {
    const res = await fetch(meta.url);
    if (!res.ok) throw new Error();
    const encrypted = JSON.parse(await res.text());
    const decrypted = await decryptBinary(encrypted, hallKey.current);
    const blobUrl = URL.createObjectURL(new Blob([decrypted], { type: 'image/jpeg' }));
    setHallImageUrls(prev => {
      const next = new Map(prev);
      next.set(msgId, [...(next.get(msgId) || []), blobUrl]);
      return next;
    });
  } catch {}
}

async function loadPrivateImage(msgId: string, meta: ImageMeta) {
  if (!activePeerId) return;
  const sessionKey = await getSessionKey(activePeerId);
  if (!sessionKey) return;
  try {
    const res = await fetch(meta.url);
    if (!res.ok) throw new Error();
    const encrypted = JSON.parse(await res.text());
    const decrypted = await decryptBinary(encrypted, sessionKey);
    const blobUrl = URL.createObjectURL(new Blob([decrypted], { type: 'image/jpeg' }));
    setPrivateImageUrls(prev => {
      const next = new Map(prev);
      next.set(msgId, [...(next.get(msgId) || []), blobUrl]);
      return next;
    });
  } catch {}
}
```

- [ ] **Step 7: Update JSX**

Hall MessageList:
```tsx
<MessageList
  messages={hallMessages}
  currentUserId={userId}
  typingUsernames={hallTyping}
  imageUrls={hallImageUrls}
  onLoadImage={loadHallImage}
/>
```

PrivatePanel:
```tsx
<PrivatePanel
  peerId={activePeerId}
  peerUsername={activePeerUsername}
  messages={privateMessages}
  currentUserId={userId}
  typingUsernames={privateTyping}
  onSend={sendPrivateMessage}
  onTyping={sendPrivateTyping}
  onClose={() => { activePeerIdRef.current = null; setActivePeerId(null); }}
  imageUrls={privateImageUrls}
  onLoadImage={loadPrivateImage}
/>
```

- [ ] **Step 8: Update PrivatePanel.tsx**

Add `imageUrls` and `onLoadImage` props, pass to MessageList:

```typescript
interface Props {
  peerId: string | null;
  peerUsername: string;
  messages: Message[];
  currentUserId: string;
  typingUsernames: string[];
  onSend: (text: string, file?: File) => void;
  onTyping: () => void;
  onClose: () => void;
  imageUrls: Map<string, string[]>;
  onLoadImage: (msgId: string, meta: ImageMeta) => void;
}
```

MessageList in PrivatePanel:
```tsx
<MessageList
  messages={messages}
  currentUserId={currentUserId}
  typingUsernames={typingUsernames}
  imageUrls={imageUrls}
  onLoadImage={onLoadImage}
/>
```

- [ ] **Step 9: Build check**

`cd client && npm run build`

- [ ] **Step 10: Commit**

```bash
git add client/src/pages/Chat.tsx client/src/components/PrivatePanel.tsx
git commit -m "feat(client): wire image send/receive/cache into Chat and PrivatePanel"
```

---

### Task 9: Final verification

- [ ] **Step 1: Server tests** — `cd server && npm test`
- [ ] **Step 2: Client build** — `cd client && npm run build`
- [ ] **Step 3: Client browser tests** — `cd client && npm run test:browser`
- [ ] **Step 4: Manual test** — file picker, paste, send with text, lightbox, private chat, refresh
