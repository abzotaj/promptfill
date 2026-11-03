import { defineConfig } from 'tsup';

// @promptfill/core is bundled in (tiny); @faker-js/faker stays a real dependency.
export default defineConfig({
  entry: { index: 'src/index.ts', locales: 'src/locales.ts' },
  format: ['esm', 'cjs'],
  dts: { resolve: true },
  clean: true,
  noExternal: ['@promptfill/core'],
  external: ['@faker-js/faker'],
  target: 'es2020',
});
