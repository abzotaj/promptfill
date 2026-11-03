import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@promptfill/core': fileURLToPath(new URL('../core/src/index.ts', import.meta.url)),
      '@promptfill/faker/locales': fileURLToPath(new URL('../faker/src/locales.ts', import.meta.url)),
      '@promptfill/faker': fileURLToPath(new URL('../faker/src/index.ts', import.meta.url)),
    },
  },
  test: { name: 'server', include: ['test/**/*.test.ts'] },
});
