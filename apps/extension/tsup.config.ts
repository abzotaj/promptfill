import { defineConfig } from 'tsup';

// Each extension entry is a single self-contained classic script.
export default defineConfig({
  entry: {
    background: 'src/background.ts',
    content: 'src/content.ts',
    options: 'src/options.ts',
  },
  format: ['iife'],
  outDir: 'dist',
  outExtension: () => ({ js: '.js' }),
  clean: true,
  minify: false,
  target: 'chrome114',
  noExternal: [/.*/],
});
