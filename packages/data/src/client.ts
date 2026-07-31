import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types.js';

export type RaliaSupabaseClient = SupabaseClient<Database>;

/**
 * Supabase client, created lazily and cached.
 *
 * The key can change once at boot (`/config` returns the current publishable
 * key), so the cache is keyed on url+key: asking for a different key produces a
 * new client instead of silently returning the stale one. Ralia 1.x had the same
 * lazy-cached shape in `supabase.js`.
 */

let cached: { key: string; client: RaliaSupabaseClient } | undefined;

export interface ClientOptions {
  supabaseUrl: string;
  supabaseAnonKey: string;
  /**
   * Auth storage. Defaults to the platform's `localStorage`.
   * Capacitor's WebView provides a persistent one, so no override is needed
   * there; the parameter exists for tests and for a future native secure store.
   */
  storage?: {
    getItem(key: string): string | null | Promise<string | null>;
    setItem(key: string, value: string): void | Promise<void>;
    removeItem(key: string): void | Promise<void>;
  };
}

export function getSupabaseClient(options: ClientOptions): RaliaSupabaseClient {
  const cacheKey = `${options.supabaseUrl}::${options.supabaseAnonKey}`;
  if (cached && cached.key === cacheKey) return cached.client;

  const client = createClient<Database>(options.supabaseUrl, options.supabaseAnonKey, {
    auth: {
      // Ralia intercepts `type=recovery` and `type=signup` links itself so it can
      // drive the UI transition (see SP1); Supabase must not consume the URL
      // fragment first.
      detectSessionInUrl: false,
      persistSession: true,
      autoRefreshToken: true,
      flowType: 'pkce',
      ...(options.storage ? { storage: options.storage } : {}),
    },
    global: {
      headers: { 'x-ralia-client': 'ralia-2.0' },
    },
  });

  cached = { key: cacheKey, client };
  return client;
}

/** Drops the cached client. Used by tests and by a full sign-out reset. */
export function resetSupabaseClient(): void {
  cached = undefined;
}
