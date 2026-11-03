import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@promptfill/core': fileURLToPath(new URL('../core/src/index.ts', import.meta.url)),
    },
  },
  test: { name: 'faker', include: ['test/**/*.test.ts'] },
});
