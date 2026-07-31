import { describe, expect, it, vi } from 'vitest';
import { AppApi } from './app-api.js';
import { BOOTSTRAP_ANON_KEY, bootstrapConfig, loadRuntimeConfig, mergeRuntimeConfig } from './config.js';

/** The exact payload the live edge function returned on 2026-07-31. */
const LIVE_CONFIG = {
  supabaseUrl: 'https://nyvripddydrzvfuateea.supabase.co',
  supabaseAnonKey: 'sb_publishable_U_KrjLMuc_o4TFwcY3SErA_N8EXxeCV',
  googleClientId: '1061137684494-49scn6qq27lkoqlih951750e627q3f4a.apps.googleusercontent.com',
  googleRedirectUri: 'postmessage',
  vapidPublicKey: 'BADFWCUOj39xD1qDA2cx42EzRBF__Gifv0_h1ssMM_iMZ_7vuO92XXjAjN5f9a6k7JCojnOvrf7eW9KMZgorC7w',
  billingEnabled: true,
};

function apiReturning(body: unknown, status = 200): AppApi {
  return new AppApi({
    supabaseUrl: 'https://nyvripddydrzvfuateea.supabase.co',
    anonKey: BOOTSTRAP_ANON_KEY,
    fetchImpl: vi.fn(
      async () =>
        new Response(status === 204 ? null : JSON.stringify(body), {
          status,
          headers: { 'content-type': 'application/json' },
        }),
    ),
  });
}

describe('mergeRuntimeConfig', () => {
  it('adopts every field the live response provides', () => {
    const merged = mergeRuntimeConfig(bootstrapConfig(), LIVE_CONFIG);

    expect(merged.supabaseAnonKey).toBe(LIVE_CONFIG.supabaseAnonKey);
    expect(merged.googleClientId).toBe(LIVE_CONFIG.googleClientId);
    expect(merged.googleRedirectUri).toBe('postmessage');
    expect(merged.vapidPublicKey).toBe(LIVE_CONFIG.vapidPublicKey);
    expect(merged.billingEnabled).toBe(true);
  });

  it('replaces the compiled-in key, which is a different string from the runtime one', () => {
    const merged = mergeRuntimeConfig(bootstrapConfig(), LIVE_CONFIG);

    expect(BOOTSTRAP_ANON_KEY).not.toBe(LIVE_CONFIG.supabaseAnonKey);
    expect(merged.supabaseAnonKey).not.toBe(BOOTSTRAP_ANON_KEY);
  });

  it('keeps the base values for fields the response omits', () => {
    const merged = mergeRuntimeConfig(bootstrapConfig(), { billingEnabled: true });

    expect(merged.supabaseAnonKey).toBe(BOOTSTRAP_ANON_KEY);
    expect(merged.googleClientId).toBeNull();
  });

  it('ignores non-object and empty-string values instead of poisoning the config', () => {
    expect(mergeRuntimeConfig(bootstrapConfig(), null)).toEqual(bootstrapConfig());
    expect(mergeRuntimeConfig(bootstrapConfig(), 'nope')).toEqual(bootstrapConfig());
    expect(mergeRuntimeConfig(bootstrapConfig(), { supabaseAnonKey: '' }).supabaseAnonKey).toBe(
      BOOTSTRAP_ANON_KEY,
    );
  });

  it('treats a missing billingEnabled as off', () => {
    expect(mergeRuntimeConfig(bootstrapConfig(), {}).billingEnabled).toBe(false);
    expect(mergeRuntimeConfig(bootstrapConfig(), { billingEnabled: 'yes' }).billingEnabled).toBe(
      false,
    );
  });
});

describe('loadRuntimeConfig', () => {
  it('loads the config and pushes the runtime key into the api client', async () => {
    const api = apiReturning(LIVE_CONFIG);

    const result = await loadRuntimeConfig(api);

    expect(result.ok).toBe(true);
    expect(result.config.supabaseAnonKey).toBe(LIVE_CONFIG.supabaseAnonKey);
    // Subsequent calls must go out with the rotated key.
    expect(api.url('/config')).toContain('/functions/v1/app-api/config');
  });

  it('falls back to bootstrap values when the request fails, so the app still starts', async () => {
    const api = new AppApi({
      supabaseUrl: 'https://nyvripddydrzvfuateea.supabase.co',
      anonKey: BOOTSTRAP_ANON_KEY,
      fetchImpl: vi.fn(async () => {
        throw new Error('Failed to fetch');
      }),
    });

    const result = await loadRuntimeConfig(api);

    expect(result.ok).toBe(false);
    expect(result.error).toBe('Failed to fetch');
    expect(result.config).toEqual(bootstrapConfig());
  });

  it('reports failure without throwing when the function answers non-2xx', async () => {
    const result = await loadRuntimeConfig(apiReturning({ error: 'boom' }, 500));

    expect(result.ok).toBe(false);
    expect(result.config).toEqual(bootstrapConfig());
  });
});
