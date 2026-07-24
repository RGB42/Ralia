/**
 * Offline cache + mutation-queue primitives, ported from public/js/offline-store.js.
 * Uses AsyncStorage instead of localStorage but keeps the exact same key
 * conventions and snapshot shape so behavior stays predictable across platforms.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export async function readLocalJson<T>(key: string | null, fallback: T): Promise<T> {
  if (!key) return fallback;
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function writeLocalJson(key: string | null, value: unknown): Promise<void> {
  if (!key) return;
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // best-effort cache; ignore quota/serialization errors
  }
}

export async function removeLocalJson(key: string | null): Promise<void> {
  if (!key) return;
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // ignore
  }
}

let localIdCounter = 0;
/** Same shape as offline-store.js's makeLocalId: a temp id we later rebase to the real DB id. */
export function makeLocalId(prefix: string): string {
  localIdCounter += 1;
  return `local-${prefix}-${Date.now()}-${localIdCounter}`;
}

export function isLocalId(id: string | null | undefined): boolean {
  return !!id && id.startsWith('local-');
}

export interface QueuedMutation {
  id: string;
  queuedAt: string;
  op: 'insert' | 'update' | 'delete';
  table: string;
  tempId?: string;
  targetId?: string;
  // Loosely typed on purpose: this just carries whatever row shape the
  // caller constructed (EventRow, NotesTodo, ...) through to a generic
  // Supabase insert/update — those concrete interfaces aren't structurally
  // assignable to Record<string, unknown> without an index signature.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  values?: any;
}
