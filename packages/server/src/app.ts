import express, { type Request, type RequestHandler } from 'express';
import type { FillError } from '@promptfill/core';
import { BadRequestError, generateFill, parseFillRequest, type GenerateOptions } from './generate';

export interface SiteConfig {
  /** Publishable key the widget sends in `x-promptfill-key`. */
  key: string;
  /**
   * Origins allowed to use this key. Supports a trailing wildcard, e.g.
   * "https://*.staging.example.com" or "chrome-extension://*".
   */
  origins: string[];
}

export interface ServerConfig extends GenerateOptions {
  sites: SiteConfig[];
  /**
   * Decide whether this caller may use PromptFill: verify the Bearer token
   * against your auth (JWT, session lookup, role check). Return true to allow.
   * When omitted, any request with a valid key + origin is allowed.
   */
  authorize?: (req: Request, ctx: { site: SiteConfig; token?: string }) => boolean | Promise<boolean>;
  /** Requests per minute per IP + key. Default 20. */
  rateLimitPerMinute?: number;
  /** Log one line per request. Default true. */
  log?: boolean;
}

export function createApp(config: ServerConfig) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '200kb' }));

  app.get('/health', (_req, res) => {
    res.json({ ok: true, mock: !!config.mock });
  });

  const fill = createFillHandler(config);
  app.options('/v1/fill', cors(config), (_req, res) => res.sendStatus(204));
  app.post('/v1/fill', cors(config), fill);

  return app;
}

/** The handler on its own, if you'd rather mount it in an existing Express app. */
export function createFillHandler(config: ServerConfig): RequestHandler {
  const limiter = rateLimiter(config.rateLimitPerMinute ?? 20);

  return async (req, res) => {
    const started = Date.now();
    const send = (status: number, body: FillError) => {
      res.status(status).json(body);
      log(status, body.code);
    };
    const log = (status: number, note = '') => {
      if (config.log !== false) {
        console.log(`[promptfill] ${req.method} ${req.path} ${status} ${Date.now() - started}ms ${req.get('origin') ?? '-'} ${note}`);
      }
    };

    const site = res.locals.site as SiteConfig | undefined;
    if (!site) return send(403, { error: 'Unknown key or origin not allowed.', code: 'origin_not_allowed' });

    if (!limiter(`${req.ip}|${site.key}`)) {
      return send(429, { error: 'Too many requests. Try again in a minute.', code: 'rate_limited' });
    }

    const token = req.get('authorization')?.replace(/^Bearer\s+/i, '') || undefined;
    if (config.authorize) {
      try {
        if (!(await config.authorize(req, { site, token }))) {
          return send(401, { error: 'Not allowed to use PromptFill.', code: 'unauthorized' });
        }
      } catch {
        return send(401, { error: 'Not allowed to use PromptFill.', code: 'unauthorized' });
      }
    }

    let parsed;
    try {
      parsed = parseFillRequest(req.body);
    } catch (e) {
      if (e instanceof BadRequestError) return send(400, { error: e.message, code: 'bad_request' });
      throw e;
    }

    try {
      const result = await generateFill(parsed, config);
      res.json(result);
      log(200, `${parsed.fields.length} fields → ${Object.keys(result.values).length} values`);
    } catch (e) {
      const err = e as { status?: number; message?: string };
      console.error('[promptfill] model call failed:', err.message);
      send(502, {
        error: err.status === 401 ? 'The server has an invalid ANTHROPIC_API_KEY.' : 'The model request failed. Try again.',
        code: 'upstream',
      });
    }
  };
}

/** Resolves the site from key + Origin and sets CORS headers only for allowed origins. */
function cors(config: ServerConfig): RequestHandler {
  return (req, res, next) => {
    const origin = req.get('origin');
    const key = req.get('x-promptfill-key') ?? '';
    res.vary('Origin');

    // Preflight carries no custom headers' values, so match on origin alone.
    const candidates = req.method === 'OPTIONS' ? config.sites : config.sites.filter((s) => s.key === key);
    const site = origin ? candidates.find((s) => s.origins.some((o) => originMatches(o, origin))) : undefined;

    if (site && origin) {
      res.set({
        'access-control-allow-origin': origin,
        'access-control-allow-methods': 'POST, OPTIONS',
        'access-control-allow-headers': 'content-type, authorization, x-promptfill-key',
        'access-control-max-age': '600',
      });
      res.locals.site = site;
    }
    next();
  };
}

export function originMatches(pattern: string, origin: string): boolean {
  if (pattern === '*') return true;
  if (!pattern.includes('*')) return pattern === origin;
  const re = new RegExp('^' + pattern.split('*').map(escapeRe).join('[^/]*') + '$');
  return re.test(origin);
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function rateLimiter(perMinute: number) {
  const hits = new Map<string, number[]>();
  return (id: string): boolean => {
    const now = Date.now();
    const recent = (hits.get(id) ?? []).filter((t) => now - t < 60_000);
    if (recent.length >= perMinute) {
      hits.set(id, recent);
      return false;
    }
    recent.push(now);
    hits.set(id, recent);
    if (hits.size > 10_000) hits.clear();
    return true;
  };
}
