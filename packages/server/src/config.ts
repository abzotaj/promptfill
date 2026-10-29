import type { SiteConfig } from './app';

/**
 * PROMPTFILL_SITES format: "key=origin1,origin2;key2=origin3"
 *   pk_demo=http://localhost:5173;pk_ext=chrome-extension://*
 */
export function parseSites(value: string | undefined): SiteConfig[] {
  if (!value?.trim()) return [];
  return value
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const eq = entry.indexOf('=');
      if (eq < 1) throw new Error(`PROMPTFILL_SITES: expected "key=origin,origin", got "${entry}"`);
      return {
        key: entry.slice(0, eq).trim(),
        origins: entry
          .slice(eq + 1)
          .split(',')
          .map((o) => o.trim().replace(/\/+$/, ''))
          .filter(Boolean),
      };
    });
}
