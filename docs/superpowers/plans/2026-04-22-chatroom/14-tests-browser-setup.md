# Task 14: 浏览器测试配置

**Files:**
- Create: `client/vitest.config.browser.ts`
- Create: `client/tests/setup.browser.ts`

---

- [ ] **Step 1: 安装浏览器测试依赖**

```bash
cd client
npm install -D @vitest/browser playwright
npx playwright install chromium
```

- [ ] **Step 2: 创建 `client/vitest.config.browser.ts`**

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['@sqlite.org/sqlite-wasm'],
  },
  test: {
    globals: true,
    browser: {
      enabled: true,
      name: 'chromium',
      provider: 'playwright',
      headless: true,
      providerOptions: {
        launch: {
          args: [
            '--enable-features=SharedArrayBuffer',
          ],
        },
      },
    },
    setupFiles: ['./tests/setup.browser.ts'],
    server: {
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp',
      },
    },
  },
});
```

- [ ] **Step 3: 创建 `client/tests/setup.browser.ts`**

```typescript
import { beforeEach } from 'vitest';

// 每个测试前清空 OPFS 存储，避免测试间污染
beforeEach(async () => {
  try {
    const root = await navigator.storage.getDirectory();
    for await (const [name] of (root as any).entries()) {
      await root.removeEntry(name, { recursive: true });
    }
  } catch {
    // OPFS 不可用时忽略
  }
});
```

- [ ] **Step 4: 在 `client/package.json` 加入测试命令**

```json
"scripts": {
  "test:browser": "vitest --config vitest.config.browser.ts run",
  "test:browser:watch": "vitest --config vitest.config.browser.ts"
}
```

- [ ] **Step 5: 提交**

```bash
git add client/vitest.config.browser.ts client/tests/setup.browser.ts
git commit -m "test: add browser test config (vitest + playwright chromium)"
```
