import { describe, expect, it, vi } from 'vitest';
import { AppApi, AppApiError, normalizePath, stripLegacyApiPrefix } from './app-api.js';

const SUPABASE_URL = 'https://nyvripddydrzvfuateea.supabase.co';
const KEY = 'test-anon-key';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function api(fetchImpl: typeof fetch): AppApi {
  return new AppApi({ supabaseUrl: SUPABASE_URL, anonKey: KEY, fetchImpl });
}

describe('normalizePath', () => {
  it('adds the leading slash', () => {
    expect(normalizePath('config')).toBe('/config');
    expect(normalizePath('/config')).toBe('/config');
  });

  it('maps an empty path to root', () => {
    expect(normalizePath('')).toBe('/');
  });
});

describe('stripLegacyApiPrefix', () => {
  it('strips the /api prefix Ralia 1.x call sites still pass', () => {
    expect(stripLegacyApiPrefix('/api/billing/status')).toBe('/billing/status');
    expect(stripLegacyApiPrefix('/api/push/subscribe')).toBe('/push/subscribe');
    expect(stripLegacyApiPrefix('/api')).toBe('/');
  });

  it('leaves already-stripped paths alone', () => {
    expect(stripLegacyApiPrefix('/billing/status')).toBe('/billing/status');
    expect(stripLegacyApiPrefix('/config')).toBe('/config');
  });

  it('does not strip a path that merely starts with the letters api', () => {
    expect(stripLegacyApiPrefix('/apikeys')).toBe('/apikeys');
  });
});

describe('AppApi.url', () => {
  const subject = api(vi.fn());

  it('builds the edge function url', () => {
    expect(subject.url('/config')).toBe(`${SUPABASE_URL}/functions/v1/app-api/config`);
  });

  it('produces the same url for both legacy and modern spellings', () => {
    expect(subject.url('/api/billing/status')).toBe(subject.url('/billing/status'));
  });

  it('tolerates a trailing slash on the supabase url', () => {
    const trailing = new AppApi({
      supabaseUrl: `${SUPABASE_URL}/`,
      anonKey: KEY,
      fetchImpl: vi.fn(),
    });
    expect(trailing.url('/config')).toBe(`${SUPABASE_URL}/functions/v1/app-api/config`);
  });
});

describe('AppApi.fetch', () => {
  it('sends the apikey header the Supabase gateway requires', async () => {
    const fetchImpl = vi.fn<Parameters<typeof fetch>, Promise<Response>>(async () =>
      jsonResponse({}),
    );

    await api(fetchImpl).fetch('/config');

    const [, init] = fetchImpl.mock.calls[0] ?? [];
    expect(new Headers(init?.headers).get('apikey')).toBe(KEY);
  });

  it('does not clobber a caller-supplied apikey', async () => {
    const fetchImpl = vi.fn<Parameters<typeof fetch>, Promise<Response>>(async () =>
      jsonResponse({}),
    );

    await api(fetchImpl).fetch('/config', { headers: { apikey: 'caller-key' } });

    const [, init] = fetchImpl.mock.calls[0] ?? [];
    expect(new Headers(init?.headers).get('apikey')).toBe('caller-key');
  });

  it('uses the replacement key after setAnonKey', async () => {
    const fetchImpl = vi.fn<Parameters<typeof fetch>, Promise<Response>>(async () =>
      jsonResponse({}),
    );
    const subject = api(fetchImpl);

    subject.setAnonKey('sb_publishable_rotated');
    await subject.fetch('/config');

    const [, init] = fetchImpl.mock.calls[0] ?? [];
    expect(new Headers(init?.headers).get('apikey')).toBe('sb_publishable_rotated');
  });
});

describe('AppApi.getJson', () => {
  it('parses a successful response', async () => {
    const fetchImpl = vi.fn<Parameters<typeof fetch>, Promise<Response>>(async () =>
      jsonResponse({ billingEnabled: true }),
    );

    await expect(api(fetchImpl).getJson('/config')).resolves.toEqual({ billingEnabled: true });
  });

  it('throws AppApiError carrying status and body on a rejected response', async () => {
    const fetchImpl = vi.fn<Parameters<typeof fetch>, Promise<Response>>(
      async () => new Response('nope', { status: 403 }),
    );

    const error = await api(fetchImpl)
      .getJson('/admin/users')
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(AppApiError);
    expect((error as AppApiError).status).toBe(403);
    expect((error as AppApiError).path).toBe('/admin/users');
    expect((error as AppApiError).body).toBe('nope');
  });

  it('throws on malformed JSON rather than returning a broken value', async () => {
    const fetchImpl = vi.fn<Parameters<typeof fetch>, Promise<Response>>(
      async () => new Response('{not json', { status: 200 }),
    );

    await expect(api(fetchImpl).getJson('/config')).rejects.toThrow(/malformed JSON/);
  });

  it('resolves undefined for an empty 204 body', async () => {
    const fetchImpl = vi.fn<Parameters<typeof fetch>, Promise<Response>>(
      async () => new Response(null, { status: 204 }),
    );

    await expect(api(fetchImpl).getJson('/push/unsubscribe')).resolves.toBeUndefined();
  });
});

describe('AppApi.postJson', () => {
  it('serialises the body and sets the content type', async () => {
    const fetchImpl = vi.fn<Parameters<typeof fetch>, Promise<Response>>(async () =>
      jsonResponse({ ok: true }),
    );

    await api(fetchImpl).postJson('/api/push/subscribe', { endpoint: 'https://push.example' });

    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(url).toBe(`${SUPABASE_URL}/functions/v1/app-api/push/subscribe`);
    expect(init?.method).toBe('POST');
    expect(new Headers(init?.headers).get('content-type')).toBe('application/json');
    expect(init?.body).toBe('{"endpoint":"https://push.example"}');
  });
});
