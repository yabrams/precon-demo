import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts'],
    exclude: ['node_modules', '.next'],
    testTimeout: 120000, // 2 minutes for API calls
    hookTimeout: 120000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['lib/extraction/**/*.ts', 'app/api/extraction/**/*.ts'],
    },
    // Run E2E tests sequentially to avoid rate limits
    sequence: {
      hooks: 'list',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
