import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    sequence: { concurrent: false },
    fileParallelism: false,
    env: { NODE_ENV: 'test' },
  },
});
