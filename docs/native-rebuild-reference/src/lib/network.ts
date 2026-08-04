import NetInfo from '@react-native-community/netinfo';

/**
 * One canonical "is this error just connectivity, or a real rejection" check.
 * The legacy web app had two subtly different versions of this in events.js
 * vs offline-store.js — we use a single, more-inclusive classifier everywhere
 * (matches offline-store.js's broader version, which session.js relied on).
 */
export function isOfflineSyncError(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    message.includes('failed to fetch') ||
    message.includes('network request failed') ||
    message.includes('networkerror') ||
    message.includes('load failed') ||
    message.includes('session check timeout') ||
    message.includes('timeout') ||
    message.includes('fetch failed')
  );
}

export async function isOnline(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return state.isConnected !== false && state.isInternetReachable !== false;
}
