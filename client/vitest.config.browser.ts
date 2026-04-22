import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { playwright } from '@vitest/browser-playwright';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['@sqlite.org/sqlite-wasm'],
  },
  test: {
    globals: true,
    browser: {
      enabled: true,
      provider: playwright({
        launch: {
          args: ['--enable-features=SharedArrayBuffer'],
        },
      }),
      headless: true,
      instances: [{ browser: 'chromium' }],
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
