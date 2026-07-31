/**
 * Gateway to the Supabase Edge Function `app-api`.
 *
 * This is a hard contract boundary. The function is deployed to the Ralia
 * Supabase project but its source is not in this repository, so Ralia 2.0
 * consumes it exactly as Ralia 1.x did and never assumes anything beyond the
 * routes 1.x actually called.
 *
 * Path handling is ported verbatim from `Ralia_Opus/public/js/backend.js`:
 * a leading `/api` is stripped, because 1.x call sites were written against the
 * old Express server and still pass `/api/…`. Both spellings must keep working.
 */

export interface AppApiOptions {
  supabaseUrl: string;
  /** Sent as the `apikey` header, which the Supabase gateway requires. */
  anonKey: string;
  /** Injectable for tests. */
  fetchImpl?: typeof fetch;
  /** Function name; only overridden in tests. */
  functionName?: string;
}

export const DEFAULT_APP_API_FUNCTION = 'app-api';

export function normalizePath(path: string): string {
  if (!path) return '/';
  return path.startsWith('/') ? path : `/${path}`;
}

/** `/api/billing/status` → `/billing/status`; `/billing/status` unchanged. */
export function stripLegacyApiPrefix(path: string): string {
  if (path === '/api') return '/';
  return path.startsWith('/api/') ? path.slice(4) : path;
}

export class AppApi {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private anonKey: string;

  constructor(options: AppApiOptions) {
    const fn = options.functionName ?? DEFAULT_APP_API_FUNCTION;
    this.baseUrl = `${options.supabaseUrl.replace(/\/+$/, '')}/functions/v1/${fn}`;
    this.anonKey = options.anonKey;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  /**
   * `/config` hands back a publishable key that may differ from the one the
   * client booted with, so the key is replaceable after bootstrap.
   */
  setAnonKey(anonKey: string): void {
    this.anonKey = anonKey;
  }

  url(path: string): string {
    return this.baseUrl + stripLegacyApiPrefix(normalizePath(path));
  }

  async fetch(path: string, init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(init.headers);
    if (!headers.has('apikey')) headers.set('apikey', this.anonKey);
    return this.fetchImpl(this.url(path), { ...init, headers });
  }

  /** GET returning parsed JSON, throwing `AppApiError` on a non-2xx response. */
  async getJson<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await this.fetch(path, { ...init, method: 'GET' });
    return unwrapJson<T>(response, path);
  }

  async postJson<T>(path: string, body: unknown, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    if (!headers.has('content-type')) headers.set('content-type', 'application/json');
    const response = await this.fetch(path, {
      ...init,
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    return unwrapJson<T>(response, path);
  }
}

export class AppApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly path: string,
    readonly body: string,
  ) {
    super(message);
    this.name = 'AppApiError';
  }
}

async function unwrapJson<T>(response: Response, path: string): Promise<T> {
  const text = await response.text();

  if (!response.ok) {
    throw new AppApiError(
      `app-api ${path} responded ${response.status}`,
      response.status,
      path,
      text,
    );
  }

  if (!text) return undefined as T;

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new AppApiError(`app-api ${path} returned malformed JSON`, response.status, path, text);
  }
}
