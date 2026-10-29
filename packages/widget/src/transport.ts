import type { FillError, FillRequest, FillResponse } from '@promptfill/core';

/** Anything that can turn a request into a response. Swap it to route calls elsewhere. */
export type Transport = (req: FillRequest) => Promise<FillResponse>;

export interface HttpTransportOptions {
  /** Base URL of the PromptFill server, e.g. https://promptfill.example.com */
  endpoint: string;
  /** Identifies the site to the server. Not a secret; the server also checks Origin. */
  publishableKey?: string;
  /**
   * Return the logged-in user's token (JWT, session token…). Sent as
   * `Authorization: Bearer <token>` so your server can verify who is asking.
   */
  getAuthToken?: () => string | null | undefined | Promise<string | null | undefined>;
  timeoutMs?: number;
}

export class PromptFillError extends Error {
  constructor(
    message: string,
    public code?: FillError['code'],
    public status?: number,
  ) {
    super(message);
    this.name = 'PromptFillError';
  }
}

export function httpTransport(opts: HttpTransportOptions): Transport {
  const base = opts.endpoint.replace(/\/+$/, '');
  return async (req) => {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (opts.publishableKey) headers['x-promptfill-key'] = opts.publishableKey;
    const token = await opts.getAuthToken?.();
    if (token) headers.authorization = `Bearer ${token}`;

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 45_000);
    let res: Response;
    try {
      res = await fetch(`${base}/v1/fill`, {
        method: 'POST',
        headers,
        body: JSON.stringify(req),
        signal: ctrl.signal,
        credentials: 'omit',
      });
    } catch (e) {
      throw new PromptFillError(
        (e as Error).name === 'AbortError' ? 'The request timed out.' : `Could not reach ${base}.`,
        'upstream',
      );
    } finally {
      clearTimeout(timer);
    }

    const body = (await res.json().catch(() => ({}))) as FillResponse & FillError;
    if (!res.ok) throw new PromptFillError(body.error || `Server error (${res.status})`, body.code, res.status);
    return body;
  };
}
