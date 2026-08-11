import { describe, expect, it, vi } from 'vitest';
import { createPrivacyApi } from './privacy-api.js';
import type { PrivacyApiError } from './privacy-api.js';

describe('PrivacyApi', () => {
  it('sends the active session token with a personal export request', async () => {
    let requestHeaders: Headers | undefined;
    const fetchImpl: typeof fetch = async (_input, init) => {
      requestHeaders = new Headers(init?.headers);
      return new Response('{"format":"ralia-personal-export/v1"}');
    };
    const api = createPrivacyApi({
      supabaseUrl: 'https://example.supabase.co',
      anonKey: 'publishable-key',
      getAccessToken: async () => 'session-token',
      fetchImpl,
    });

    await api.personalExport();

    expect(requestHeaders?.get('apikey')).toBe('publishable-key');
    expect(requestHeaders?.get('authorization')).toBe('Bearer session-token');
  });

  it('does not send a request without an authenticated session', async () => {
    const fetchImpl = vi.fn();
    const api = createPrivacyApi({
      supabaseUrl: 'https://example.supabase.co',
      anonKey: 'publishable-key',
      getAccessToken: async () => null,
      fetchImpl,
    });

    await expect(api.deleteAccount()).rejects.toMatchObject({
      code: 'unauthorized',
      status: 401,
    } satisfies Partial<PrivacyApiError>);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('exposes the server error code for a rejected shared export request', async () => {
    const api = createPrivacyApi({
      supabaseUrl: 'https://example.supabase.co',
      anonKey: 'publishable-key',
      getAccessToken: async () => 'session-token',
      fetchImpl: async () => new Response('{"error":"request_not_approved"}', { status: 409 }),
    });

    await expect(api.sharedExport('request-id')).rejects.toMatchObject({
      code: 'request_not_approved',
      status: 409,
    });
  });
});
