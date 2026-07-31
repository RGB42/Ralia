/**
 * Flush triggers.
 *
 * Ported from `offline-store.js#bindLifecycle`. The interval deliberately skips
 * hidden documents: a backgrounded tab firing network requests every 60s drains
 * phone batteries for no benefit, and `visibilitychange` already covers the
 * moment the user comes back.
 */

export interface LifecycleHandlers {
  onOnline?: () => void;
  onOffline?: () => void;
  onVisible?: () => void;
  onInterval?: () => void;
  intervalMs?: number;
}

export type Unbind = () => void;

export const DEFAULT_FLUSH_INTERVAL_MS = 60_000;

export function bindLifecycle(handlers: LifecycleHandlers): Unbind {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return () => undefined;
  }

  const { onOnline, onOffline, onVisible, onInterval, intervalMs } = handlers;
  const teardown: Unbind[] = [];

  if (onOnline) {
    window.addEventListener('online', onOnline);
    teardown.push(() => window.removeEventListener('online', onOnline));
  }

  if (onOffline) {
    window.addEventListener('offline', onOffline);
    teardown.push(() => window.removeEventListener('offline', onOffline));
  }

  if (onVisible) {
    const handler = () => {
      if (document.visibilityState === 'visible') onVisible();
    };
    document.addEventListener('visibilitychange', handler);
    teardown.push(() => document.removeEventListener('visibilitychange', handler));
  }

  if (onInterval && intervalMs && intervalMs > 0) {
    const timer = window.setInterval(() => {
      if (!document.hidden) onInterval();
    }, intervalMs);
    teardown.push(() => window.clearInterval(timer));
  }

  return () => {
    for (const fn of teardown) fn();
  };
}
