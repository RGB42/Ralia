import type { Outbox } from './outbox.js';
import type { OutboxDomain } from './types.js';

/**
 * One-time migration of the Ralia 1.x offline state.
 *
 * Ralia 1.x kept both a cache and a pending-mutation queue per domain per
 * calendar in `localStorage`. Since Ralia 2.0 replaces 1.x at the same origin,
 * an existing user can arrive with unsynced mutations sitting in those queues.
 * Losing them would silently discard something the user actually did, so the
 * queues are imported; the caches are dropped because they are server data that
 * will be refetched anyway.
 */

/** `localStorage`-shaped surface, narrowed to what the migration needs. */
export interface KeyValueStorage {
  readonly length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
  removeItem(key: string): void;
}

/** Legacy queue key prefixes and the outbox domain each maps to. */
export const LEGACY_QUEUE_PREFIXES: ReadonlyArray<readonly [string, OutboxDomain]> = [
  ['ralia:event-queue:', 'events'],
  ['ralia:todo-queue:', 'todos'],
  ['ralia:expenses-queue:', 'expenses'],
  ['ralia:weekplan-queue:', 'weekplan'],
];

/**
 * Legacy cache key prefixes. These hold server snapshots, not user intent, so
 * they are deleted rather than migrated.
 *
 * `ralia:weekplan:` has no `-queue` segment and would be matched by a naive
 * prefix scan for the week-plan queue; the two lists are kept separate so the
 * queue prefix stays exact.
 */
export const LEGACY_CACHE_PREFIXES: readonly string[] = [
  'ralia:event-cache:',
  'ralia:todo-cache:',
  'ralia:expenses-cache:',
  'ralia:weekplan:',
];

export const LEGACY_MIGRATION_META_KEY = 'migration:legacy-localstorage';
export const LEGACY_MIGRATION_VERSION = 1;

export interface LegacyMigrationMarker {
  version: number;
  completedAt: number;
  importedRecords: number;
  importedQueues: number;
}

export interface LegacyImportResult {
  /** False when the marker showed the migration had already run. */
  ran: boolean;
  importedRecords: number;
  importedQueues: number;
  /** Keys removed: legacy queues plus legacy caches. */
  removedKeys: number;
  /** Queue keys whose JSON could not be parsed; left in place for inspection. */
  malformedKeys: string[];
}

interface LegacyQueue {
  key: string;
  domain: OutboxDomain;
  calendarId: string;
  mutations: unknown[];
}

/**
 * Reads every legacy queue out of storage.
 *
 * A key that fails to parse, or that does not hold an array, is reported rather
 * than thrown on — one corrupt queue must not block migrating the others.
 */
export function collectLegacyQueues(storage: KeyValueStorage): {
  queues: LegacyQueue[];
  malformedKeys: string[];
} {
  const queues: LegacyQueue[] = [];
  const malformedKeys: string[] = [];

  for (const key of listKeys(storage)) {
    const match = LEGACY_QUEUE_PREFIXES.find(([prefix]) => key.startsWith(prefix));
    if (!match) continue;

    const [prefix, domain] = match;
    const calendarId = key.slice(prefix.length);
    if (!calendarId) continue;

    const raw = storage.getItem(key);
    if (!raw) continue;

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      malformedKeys.push(key);
      continue;
    }

    if (!Array.isArray(parsed)) {
      malformedKeys.push(key);
      continue;
    }

    if (parsed.length === 0) continue;
    queues.push({ key, domain, calendarId, mutations: parsed });
  }

  return { queues, malformedKeys };
}

/** Every legacy key that should be deleted once the import is committed. */
export function collectLegacyKeysToRemove(
  storage: KeyValueStorage,
  options: { skipKeys?: readonly string[] } = {},
): string[] {
  const skip = new Set(options.skipKeys ?? []);
  const prefixes = [...LEGACY_QUEUE_PREFIXES.map(([prefix]) => prefix), ...LEGACY_CACHE_PREFIXES];
  return listKeys(storage).filter(
    (key) => !skip.has(key) && prefixes.some((prefix) => key.startsWith(prefix)),
  );
}

/**
 * Runs the migration at most once.
 *
 * Ordering is load-bearing:
 *   1. import every queue into the outbox
 *   2. write the marker
 *   3. only then delete the legacy keys
 *
 * Deleting first would lose mutations if the browser were closed mid-migration.
 * Because step 3 can still be interrupted, a run that finds the marker already
 * present sweeps up any leftover keys instead of returning immediately.
 */
export async function importLegacyOutbox(
  outbox: Outbox,
  storage: KeyValueStorage,
  options: { now?: () => number } = {},
): Promise<LegacyImportResult> {
  const now = options.now ?? Date.now;
  const db = await outbox.db();
  const existing = (await db.get('meta', LEGACY_MIGRATION_META_KEY)) as
    LegacyMigrationMarker | undefined;

  if (existing && existing.version >= LEGACY_MIGRATION_VERSION) {
    // Already imported. Finish any cleanup a previous interrupted run left behind.
    const leftovers = collectLegacyKeysToRemove(storage);
    for (const key of leftovers) storage.removeItem(key);
    return {
      ran: false,
      importedRecords: 0,
      importedQueues: 0,
      removedKeys: leftovers.length,
      malformedKeys: [],
    };
  }

  const { queues, malformedKeys } = collectLegacyQueues(storage);

  let importedRecords = 0;
  for (const queue of queues) {
    for (const [offset, mutation] of queue.mutations.entries()) {
      // Synthetic enqueue times preserve the legacy queue's relative order and
      // sort ahead of anything this session creates.
      await outbox.enqueueLegacy(queue.domain, queue.calendarId, mutation, {
        enqueuedAt: offset,
      });
      importedRecords += 1;
    }
  }

  const marker: LegacyMigrationMarker = {
    version: LEGACY_MIGRATION_VERSION,
    completedAt: now(),
    importedRecords,
    importedQueues: queues.length,
  };
  await db.put('meta', marker, LEGACY_MIGRATION_META_KEY);

  // Committed — now it is safe to drop the legacy state. Malformed queue keys
  // are kept so a support case can still inspect them.
  const removable = collectLegacyKeysToRemove(storage, { skipKeys: malformedKeys });
  for (const key of removable) storage.removeItem(key);

  return {
    ran: true,
    importedRecords,
    importedQueues: queues.length,
    removedKeys: removable.length,
    malformedKeys,
  };
}

/**
 * Snapshot of the key list.
 *
 * `localStorage.key(i)` is index-based and the indices shift as keys are
 * removed, so the list has to be materialised before any deletion happens.
 */
function listKeys(storage: KeyValueStorage): string[] {
  const keys: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key) keys.push(key);
  }
  return keys;
}
