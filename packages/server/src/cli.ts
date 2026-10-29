#!/usr/bin/env node
import { createApp } from './app';
import { parseSites } from './config';
import { DEFAULT_MODEL } from './generate';

try {
  process.loadEnvFile(); // reads ./.env when present (Node ≥ 20.12)
} catch {
  /* no .env file: use the real environment */
}

const env = process.env;
const apiKey = env.ANTHROPIC_API_KEY;
const mock = env.PROMPTFILL_MOCK === '1' || !apiKey;
const sites = parseSites(env.PROMPTFILL_SITES ?? 'pk_demo=http://localhost:5173,http://127.0.0.1:5173;pk_ext=chrome-extension://*');
const port = Number(env.PORT ?? 8787);

const app = createApp({
  sites,
  apiKey,
  mock,
  model: env.PROMPTFILL_MODEL ?? DEFAULT_MODEL,
  rateLimitPerMinute: env.PROMPTFILL_RATE_LIMIT ? Number(env.PROMPTFILL_RATE_LIMIT) : undefined,
});

app.listen(port, () => {
  console.log(`PromptFill server on http://localhost:${port}`);
  console.log(mock ? '  mode: MOCK (no ANTHROPIC_API_KEY set; returns fake data)' : `  model: ${env.PROMPTFILL_MODEL ?? DEFAULT_MODEL}`);
  for (const s of sites) console.log(`  key ${s.key} → ${s.origins.join(', ')}`);
});
