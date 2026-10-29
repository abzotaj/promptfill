import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const src = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  plugins: [react()],
  // Use the widget's source directly so edits hot-reload without rebuilding the package.
  resolve: {
    alias: {
      '@promptfill/widget': src('../../packages/widget/src/index.ts'),
      '@promptfill/core': src('../../packages/core/src/index.ts'),
    },
  },
  server: { port: 5173 },
});
