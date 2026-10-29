import { defineConfig } from 'tsup';

// @promptfill/core is bundled in (it's tiny), so the published widget has zero runtime deps.
export default defineConfig([
  {
    entry: { index: 'src/index.ts' },
    format: ['esm', 'cjs'],
    dts: { resolve: true },
    clean: true,
    noExternal: ['@promptfill/core'],
    target: 'es2020',
  },
  {
    entry: { 'promptfill.global': 'src/global.ts' },
    format: ['iife'],
    minify: true,
    noExternal: ['@promptfill/core'],
    target: 'es2020',
    outExtension: () => ({ js: '.js' }),
  },
]);
