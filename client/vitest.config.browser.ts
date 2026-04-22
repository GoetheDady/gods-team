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
          args: ['--enable-features=SharedArrayBuffer'],
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
