import { defineWorkspace } from 'vitest/config';

// Each package owns its vitest.config.ts; this lets `npx vitest` at the root still run everything.
export default defineWorkspace(['packages/*/vitest.config.ts']);
