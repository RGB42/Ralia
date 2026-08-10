import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  LEGACY_MIGRATION_META_KEY,
  collectLegacyKeysToRemove,
  collectLegacyQueues,
  importLegacyOutbox,
  type KeyValueStorage,
  type LegacyMigrationMarker,
} from './legacy-import.js';
import { Outbox } from './outbox.js';
import type { OutboxRecord } from './types.js';

/** Minimal `localStorage` stand-in with the same index-shifting behaviour. */
class FakeStorage implements KeyValueStorage {
  private map = new Map<string, string>();

  constructor(initial: Record<string, string> = {}) {
    for (const [key, value] of Object.entries(initial)) this.map.set(key, value);
  }

  get length(): number {
    return this.map.size;
  }

  key(index: number): string | null {
    return [...this.map.keys()][index] ?? null;
  }

  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }

  removeItem(key: string): void {
    this.map.delete(key);
  }

  has(key: string): boolean {
    return this.map.has(key);
  }

  keys(): string[] {
    return [...this.map.keys()];
  }
}

let dbCounter = 0;
function freshOutbox(): Outbox {
  dbCounter += 1;
  return new Outbox({ now: () => 5_000, databaseName: `ralia-legacy-test-${dbCounter}` });
}

describe('collectLegacyQueues', () => {
  it('maps each legacy queue prefix to its outbox domain', () => {
    const storage = new FakeStorage({
      'ralia:event-queue:u1_u2': JSON.stringify([{ type: 'upsert-event' }]),
      'ralia:todo-queue:u1_u2': JSON.stringify([{ type: 'upsert-todo' }]),
      'ralia:expenses-queue:u1_u2': JSON.stringify([{ type: 'upsert-expense' }]),
      'ralia:weekplan-queue:u1_u2': JSON.stringify([{ type: 'upsert-weekplan' }]),
    });

    const { queues } = collectLegacyQueues(storage);

    expect(queues.map((q) => q.domain).sort()).toEqual(['events', 'expenses', 'todos', 'weekplan']);
    expect(queues.every((q) => q.calendarId === 'u1_u2')).toBe(true);
  });

  it('ignores cache keys, including the week-plan cache that shares a prefix stem', () => {
    const storage = new FakeStorage({
      'ralia:event-cache:u1_u2': JSON.stringify({ events: [] }),
      'ralia:weekplan:u1_u2': JSON.stringify({ plans: [] }),
      'ralia:identity': 'whatever',
    });

    expect(collectLegacyQueues(storage).queues).toHaveLength(0);
  });

  it('skips empty queues', () => {
    const storage = new FakeStorage({ 'ralia:event-queue:u1_u2': '[]' });

    expect(collectLegacyQueues(storage).queues).toHaveLength(0);
  });

  it('reports malformed queues instead of throwing', () => {
    const storage = new FakeStorage({
      'ralia:event-queue:broken': '{not json',
      'ralia:todo-queue:wrong-shape': '{"not":"an array"}',
      'ralia:event-queue:good': JSON.stringify([{ type: 'upsert-event' }]),
    });

    const { queues, malformedKeys } = collectLegacyQueues(storage);

    expect(queues).toHaveLength(1);
    expect(malformedKeys.sort()).toEqual([
      'ralia:event-queue:broken',
      'ralia:todo-queue:wrong-shape',
    ]);
  });
});

describe('collectLegacyKeysToRemove', () => {
  it('lists queue and cache keys but leaves unrelated keys alone', () => {
    const storage = new FakeStorage({
      'ralia:event-queue:u1_u2': '[]',
      'ralia:event-cache:u1_u2': '{}',
      'ralia:weekplan:u1_u2': '{}',
      'ralia:identity': 'keep',
      appLanguage: 'de',
      googleAccessToken: 'keep',
    });

    expect(collectLegacyKeysToRemove(storage).sort()).toEqual([
      'ralia:event-cache:u1_u2',
      'ralia:event-queue:u1_u2',
      'ralia:weekplan:u1_u2',
    ]);
  });
});

describe('importLegacyOutbox', () => {
  let outbox: Outbox;

  beforeEach(() => {
    outbox = freshOutbox();
  });

  it('imports pending mutations, preserving their order', async () => {
    const storage = new FakeStorage({
      'ralia:event-queue:u1_u2': JSON.stringify([
        { type: 'upsert-event', mode: 'insert', tempId: 'local-event-1' },
        { type: 'upsert-event', mode: 'update', targetId: 'local-event-1' },
        { type: 'delete-event', targetId: 'db-9' },
      ]),
    });

    const result = await importLegacyOutbox(outbox, storage);

    expect(result.ran).toBe(true);
    expect(result.importedRecords).toBe(3);
    expect(result.importedQueues).toBe(1);

    const pending = (await (await outbox.db()).getAll('outbox')) as OutboxRecord<{
      type: string;
    }>[];
    expect(pending.map((r) => r.mutation.type)).toEqual([
      'upsert-event',
      'upsert-event',
      'delete-event',
    ]);
    expect(pending.every((r) => r.legacy)).toBe(true);
    expect(pending.every((r) => r.ownerUserId === '')).toBe(true);
  });

  it('preserves the mutation payload verbatim so domain executors still understand it', async () => {
    const mutation = {
      type: 'upsert-occurrence-exception',
      payload: {
        masterEventId: 'db-1',
        originalOccurrenceDate: '2026-07-15',
        isDeleted: false,
        overrideEventData: { name: 'Verschoben', start_time: '19:30' },
      },
    };
    const storage = new FakeStorage({
      'ralia:event-queue:u1_u2': JSON.stringify([mutation]),
    });

    await importLegacyOutbox(outbox, storage);

    const [record] = await (await outbox.db()).getAll('outbox');
    expect(record?.mutation).toEqual(mutation);
  });

  it('deletes legacy keys only after the import is committed', async () => {
    const storage = new FakeStorage({
      'ralia:event-queue:u1_u2': JSON.stringify([{ type: 'upsert-event' }]),
      'ralia:event-cache:u1_u2': JSON.stringify({ events: [] }),
      'ralia:weekplan:u1_u2': JSON.stringify({}),
      'ralia:identity': 'keep-me',
      appLanguage: 'de',
    });

    const result = await importLegacyOutbox(outbox, storage);

    expect(result.removedKeys).toBe(3);
    expect(storage.has('ralia:event-queue:u1_u2')).toBe(false);
    expect(storage.has('ralia:event-cache:u1_u2')).toBe(false);
    expect(storage.has('ralia:weekplan:u1_u2')).toBe(false);
    // Unrelated keys survive; language and identity are still needed.
    expect(storage.has('ralia:identity')).toBe(true);
    expect(storage.has('appLanguage')).toBe(true);
  });

  it('writes a marker recording what it did', async () => {
    const storage = new FakeStorage({
      'ralia:event-queue:u1_u2': JSON.stringify([{ type: 'a' }, { type: 'b' }]),
    });

    await importLegacyOutbox(outbox, storage, { now: () => 5_000 });

    const db = await outbox.db();
    const marker = (await db.get('meta', LEGACY_MIGRATION_META_KEY)) as LegacyMigrationMarker;
    expect(marker.version).toBe(1);
    expect(marker.importedRecords).toBe(2);
    expect(marker.completedAt).toBe(5_000);
  });

  it('does not import twice when run again', async () => {
    const storage = new FakeStorage({
      'ralia:event-queue:u1_u2': JSON.stringify([{ type: 'a' }]),
    });

    await importLegacyOutbox(outbox, storage);
    // Simulate a stale queue reappearing (e.g. another tab wrote it).
    const second = await importLegacyOutbox(outbox, storage);

    expect(second.ran).toBe(false);
    expect(second.importedRecords).toBe(0);
    expect(await (await outbox.db()).count('outbox')).toBe(1);
  });

  it('sweeps leftover keys when a previous run was interrupted after the marker', async () => {
    const storage = new FakeStorage({
      'ralia:event-queue:u1_u2': JSON.stringify([{ type: 'a' }]),
    });
    await importLegacyOutbox(outbox, storage);

    // A crash between marker and cleanup would leave keys behind.
    const leftover = new FakeStorage({
      'ralia:event-cache:u1_u2': '{}',
      'ralia:todo-queue:u1_u2': JSON.stringify([{ type: 'x' }]),
    });
    const result = await importLegacyOutbox(outbox, leftover);

    expect(result.ran).toBe(false);
    expect(result.removedKeys).toBe(2);
    expect(leftover.keys()).toHaveLength(0);
  });

  it('keeps malformed queue keys for inspection instead of deleting them', async () => {
    const storage = new FakeStorage({
      'ralia:event-queue:broken': '{not json',
      'ralia:event-cache:u1_u2': '{}',
    });

    const result = await importLegacyOutbox(outbox, storage);

    expect(result.malformedKeys).toEqual(['ralia:event-queue:broken']);
    expect(storage.has('ralia:event-queue:broken')).toBe(true);
    expect(storage.has('ralia:event-cache:u1_u2')).toBe(false);
  });

  it('is a no-op on a storage with nothing legacy in it', async () => {
    const storage = new FakeStorage({ appLanguage: 'de' });

    const result = await importLegacyOutbox(outbox, storage);

    expect(result.ran).toBe(true);
    expect(result.importedRecords).toBe(0);
    expect(result.removedKeys).toBe(0);
    expect(await (await outbox.db()).count('outbox')).toBe(0);
  });
});
