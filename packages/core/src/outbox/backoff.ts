/**
 * Retry backoff for failed flushes.
 *
 * Attempts are never capped. A device can be offline for days, and a mutation
 * the user made is not allowed to expire just because the network took a long
 * time to come back — so the *delay* is capped instead of the attempt count.
 */

export const BACKOFF_BASE_MS = 1_000;
export const BACKOFF_CEILING_MS = 5 * 60_000;

export function backoffDelayMs(attempts: number): number {
  if (attempts <= 0) return 0;
  // 1s, 2s, 4s, 8s, … capped at 5 min.
  const exponent = Math.min(attempts - 1, 30);
  const delay = BACKOFF_BASE_MS * 2 ** exponent;
  return Math.min(delay, BACKOFF_CEILING_MS);
}
