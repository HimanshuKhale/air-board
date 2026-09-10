import { defineConfig } from 'vitest/config';
export default defineConfig({
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true },
  worker: { format: 'iife' },
  test: { include: ['tests/unit/**/*.test.ts'] },
});
