# Task 01: 项目脚手架

**Files:**
- Create: `server/package.json`
- Create: `server/tsconfig.json`
- Create: `server/src/index.ts`
- Create: `client/package.json`
- Create: `client/tsconfig.json`
- Create: `client/vite.config.ts`
- Create: `client/index.html`
- Create: `client/src/main.tsx`
- Create: `client/src/App.tsx`

---

- [ ] **Step 1: 初始化 server 目录**

```bash
mkdir -p server/src/middleware
cd server
npm init -y
npm install express ws better-sqlite3 bcrypt jsonwebtoken cors
npm install -D typescript @types/express @types/ws @types/better-sqlite3 @types/bcrypt @types/jsonwebtoken @types/cors @types/node ts-node nodemon
```

- [ ] **Step 2: 创建 `server/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: 创建 `server/src/index.ts`**

```typescript
import express from 'express';
import cors from 'cors';
import http from 'http';

const app = express();
app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ ok: true }));

const server = http.createServer(app);

server.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});

export { app, server };
```

- [ ] **Step 4: 在 `server/package.json` 的 scripts 中加入开发命令**

在已生成的 `server/package.json` 中找到 `"scripts"` 字段，替换为：

```json
"scripts": {
  "dev": "nodemon --exec ts-node src/index.ts",
  "build": "tsc",
  "start": "node dist/index.js"
}
```

- [ ] **Step 5: 初始化 client 目录**

```bash
cd ..
npm create vite@latest client -- --template react-ts
cd client
npm install
npm install @sqlite.org/sqlite-wasm
```

- [ ] **Step 6: 更新 `client/vite.config.ts`**

SQLite WASM 需要 `SharedArrayBuffer`，要设置特定响应头：

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['@sqlite.org/sqlite-wasm'],
  },
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
    proxy: {
      '/api': 'http://localhost:3000',
      '/ws': { target: 'ws://localhost:3000', ws: true },
    },
  },
});
```

- [ ] **Step 7: 替换 `client/src/App.tsx`**

```typescript
export default function App() {
  return <div>聊天室加载中...</div>;
}
```

- [ ] **Step 8: 验证两端均能启动**

终端 1：
```bash
cd server && npm run dev
```
期望输出：`Server running on http://localhost:3000`

终端 2：
```bash
cd client && npm run dev
```
期望输出：`Local: http://localhost:5173/`

访问 `http://localhost:3000/api/health`，期望返回 `{"ok":true}`

- [ ] **Step 9: 提交**

```bash
git add server/ client/
git commit -m "feat: scaffold server and client projects"
```
