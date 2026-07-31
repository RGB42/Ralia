/**
 * Offline detection.
 *
 * These substrings are not guesses — they are the messages Supabase, Chrome,
 * Safari, the Android WebView and the iOS WKWebView actually produce when the
 * network is gone. Ralia 1.x accumulated this list in `offline-store.js` over
 * many bug reports; dropping an entry means a lost mutation gets treated as a
 * permanent failure and discarded, so the list is ported verbatim.
 */
const OFFLINE_MESSAGE_FRAGMENTS = [
  'failed to fetch', // Chrome / Firefox
  'networkerror', // Safari
  'load failed', // Safari, iOS WKWebView
  'network request failed', // Android WebView, React Native
  'session check timeout', // Ralia's own auth guard
  'timeout',
  // Addition beyond the 1.x list: iOS surfaces NSURLErrorTimedOut as
  // "The request timed out", which 'timeout' does not match. 1.x therefore
  // classified it as permanent and discarded the mutation. A timeout is a
  // transport failure, so retrying is the correct call.
  'timed out',
  'fetch failed', // undici / Node
] as const;

export interface OfflineProbe {
  /** Defaults to `navigator.onLine` when a navigator exists. */
  isOnline?: () => boolean;
}

function defaultIsOnline(): boolean {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine !== false;
}

/**
 * True when `error` looks like a transport failure rather than a rejected
 * request. Transport failures must be retried; rejected requests must not.
 */
export function isOfflineSyncError(error: unknown, probe: OfflineProbe = {}): boolean {
  if (error === null || error === undefined) return false;

  const isOnline = probe.isOnline ?? defaultIsOnline;
  if (!isOnline()) return true;

  const message = extractMessage(error).toLowerCase();
  if (!message) return false;

  return OFFLINE_MESSAGE_FRAGMENTS.some((fragment) => message.includes(fragment));
}

function extractMessage(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const { message } = error as { message: unknown };
    if (typeof message === 'string') return message;
  }
  return String(error);
}

/**
 * A rejected-by-the-server error, i.e. the request arrived and was refused.
 * Anything in the 4xx range is the caller's fault and will never succeed on
 * retry, so the mutation has to be dropped and the optimistic state rolled back.
 */
export function isPermanentRequestError(status: number | undefined): boolean {
  if (status === undefined) return false;
  // 408 Request Timeout and 429 Too Many Requests are worth retrying.
  if (status === 408 || status === 429) return false;
  return status >= 400 && status < 500;
}
