import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp, originMatches, parseSites } from '../src';

let base = '';
let close: () => void;

beforeAll(async () => {
  const app = createApp({
    mock: true,
    log: false,
    rateLimitPerMinute: 3,
    sites: parseSites('pk_demo=http://localhost:5173;pk_ext=chrome-extension://*'),
    authorize: (_req, { token }) => token !== 'banned',
  });
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  close = () => server.close();
});
afterAll(() => close());

const body = {
  prompt: 'a realistic customer',
  fields: [
    { key: 'firstName', kind: 'text', label: 'First name' },
    { key: 'email', kind: 'email', label: 'Email' },
    { key: 'country', kind: 'select', label: 'Country', options: [{ value: 'AL', label: 'Albania' }] },
    { key: 'pw', kind: 'text', label: 'Password' },
  ],
};

const post = (headers: Record<string, string>, b: unknown = body) =>
  fetch(`${base}/v1/fill`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(b) });

describe('POST /v1/fill', () => {
  it('fills for an allowed key + origin, and never returns sensitive keys', async () => {
    const res = await post({ origin: 'http://localhost:5173', 'x-promptfill-key': 'pk_demo' });
    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');
    const json = (await res.json()) as { values: Record<string, unknown> };
    expect(typeof json.values.firstName).toBe('string');
    expect(json.values.firstName).not.toBe('');
    expect(json.values.email).toMatch(/^[^@\s]+@[^@\s]+$/);
    expect(json.values.country).toBe('AL');
    expect(json.values.pw).toBeUndefined();
  });

  it('rejects a key used from the wrong origin', async () => {
    const res = await post({ origin: 'https://evil.example', 'x-promptfill-key': 'pk_demo' });
    expect(res.status).toBe(403);
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('accepts the extension key from any extension origin', async () => {
    const res = await post({ origin: 'chrome-extension://abcdefghijklmnop', 'x-promptfill-key': 'pk_ext' });
    expect(res.status).toBe(200);
  });

  it('runs the authorize hook', async () => {
    const res = await post({ origin: 'http://localhost:5173', 'x-promptfill-key': 'pk_demo', authorization: 'Bearer banned' });
    expect(res.status).toBe(401);
  });

  it('validates the body', async () => {
    const res = await post({ origin: 'chrome-extension://x', 'x-promptfill-key': 'pk_ext' }, { prompt: '', fields: [] });
    expect(res.status).toBe(400);
  });

  it('rate limits', async () => {
    const h = { origin: 'chrome-extension://rl', 'x-promptfill-key': 'pk_ext' };
    const statuses = [];
    for (let i = 0; i < 4; i++) statuses.push((await post(h)).status);
    expect(statuses).toContain(429);
  });
});

describe('originMatches', () => {
  it('handles wildcards', () => {
    expect(originMatches('https://*.staging.acme.com', 'https://app.staging.acme.com')).toBe(true);
    expect(originMatches('https://*.staging.acme.com', 'https://evil.com/.staging.acme.com')).toBe(false);
    expect(originMatches('http://localhost:5173', 'http://localhost:5174')).toBe(false);
  });
});
