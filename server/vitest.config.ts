import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    sequence: { concurrent: false },
    env: { NODE_ENV: 'test' },
  },
});
