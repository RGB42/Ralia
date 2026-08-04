import type { AppApi } from './app-api.js';

/**
 * Runtime configuration.
 *
 * The Supabase URL and a bootstrap key are compiled in so the app can make its
 * very first request. Everything else — the Google client id, the VAPID public
 * key, whether billing is on — comes from `GET /config` on the edge function,
 * which is also where the *current* publishable key lives.
 *
 * Verified against the live function on 2026-07-31: the compiled-in JWT anon key
 * and the `sb_publishable_…` key returned by `/config` are different strings.
 * The client therefore boots with the compiled key and is rebuilt with the
 * runtime one, exactly as Ralia 1.x does.
 */

export const SUPABASE_URL = 'https://nyvripddydrzvfuateea.supabase.co';

/**
 * Bootstrap key, safe to ship: it is the public anon key and every table is
 * protected by row-level security. Only used until `/config` answers.
 */
export const BOOTSTRAP_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55dnJpcGRkeWRyenZmdWF0ZWVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwMzgwOTksImV4cCI6MjA5MDYxNDA5OX0.oSogfwag7v8d4Tt-5HtflWadnnNSEpjuk-cMu7ql70s';

export interface RuntimeConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  googleClientId: string | null;
  googleRedirectUri: string | null;
  vapidPublicKey: string | null;
  billingEnabled: boolean;
}

export function bootstrapConfig(): RuntimeConfig {
  return {
    supabaseUrl: SUPABASE_URL,
    supabaseAnonKey: BOOTSTRAP_ANON_KEY,
    googleClientId: null,
    googleRedirectUri: null,
    vapidPublicKey: null,
    billingEnabled: false,
  };
}

/** Shape `/config` actually returns; every field is treated as optional. */
interface ConfigResponse {
  supabaseUrl?: unknown;
  supabaseAnonKey?: unknown;
  googleClientId?: unknown;
  googleRedirectUri?: unknown;
  vapidPublicKey?: unknown;
  billingEnabled?: unknown;
}

export function mergeRuntimeConfig(base: RuntimeConfig, response: unknown): RuntimeConfig {
  if (typeof response !== 'object' || response === null) return base;
  const raw = response as ConfigResponse;

  return {
    supabaseUrl: asString(raw.supabaseUrl) ?? base.supabaseUrl,
    supabaseAnonKey: asString(raw.supabaseAnonKey) ?? base.supabaseAnonKey,
    googleClientId: asString(raw.googleClientId) ?? base.googleClientId,
    googleRedirectUri: asString(raw.googleRedirectUri) ?? base.googleRedirectUri,
    vapidPublicKey: asString(raw.vapidPublicKey) ?? base.vapidPublicKey,
    billingEnabled: raw.billingEnabled === true,
  };
}

/**
 * Fetches `/config`, falling back to the bootstrap values.
 *
 * A failure here must not block startup: without network the app still has to
 * open, show cached data and accept offline edits. Features that genuinely need
 * a runtime value (push, Google sync, billing) check for it themselves.
 */
export async function loadRuntimeConfig(
  api: AppApi,
  base: RuntimeConfig = bootstrapConfig(),
): Promise<{ config: RuntimeConfig; ok: boolean; error?: string }> {
  try {
    const response = await api.getJson<unknown>('/config');
    const config = mergeRuntimeConfig(base, response);
    api.setAnonKey(config.supabaseAnonKey);
    return { config, ok: true };
  } catch (error) {
    return {
      config: base,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}
