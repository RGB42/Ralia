import 'fake-indexeddb/auto';
import { openDB } from 'idb';
import { describe, expect, it } from 'vitest';
import { OUTBOX_DB_VERSION, openRaliaDB } from './db.js';

let dbCounter = 0;

function databaseName(): string {
  dbCounter += 1;
  return `ralia-upgrade-test-${dbCounter}`;
}

describe('outbox database migration', () => {
  it('upgrades v1 records without loss and indexes them as unclaimed', async () => {
    const name = databaseName();
    const v1 = await openDB(name, 1, {
      upgrade(db) {
        const store = db.createObjectStore('outbox', { keyPath: 'id', autoIncrement: true });
        store.createIndex('by-domain-calendar', ['domain', 'calendarId', 'enqueuedAt']);
        store.createIndex('by-enqueued-at', 'enqueuedAt');
        db.createObjectStore('meta');
      },
    });
    const original = {
      domain: 'events',
      calendarId: 'legacy-cal',
      mutation: { kind: 'offline-update', payload: { title: 'Keep me' } },
      enqueuedAt: 123,
      attempts: 2,
      retryAfter: 456,
      legacy: false,
      lastError: 'offline',
    };
    const id = await v1.add('outbox', original);
    await v1.put('meta', { preserved: true }, 'existing-marker');
    v1.close();

    const upgraded = await openRaliaDB(name);

    expect(upgraded.version).toBe(OUTBOX_DB_VERSION);
    expect(await upgraded.get('outbox', id as number)).toEqual({
      ...original,
      id,
      ownerUserId: '',
    });
    expect(await upgraded.get('meta', 'existing-marker')).toEqual({ preserved: true });

    const tx = upgraded.transaction('outbox');
    expect(tx.store.indexNames.contains('by-owner-domain-calendar')).toBe(true);
    const indexed = await tx.store
      .index('by-owner-domain-calendar')
      .getAll(
        IDBKeyRange.bound(
          ['', 'events', 'legacy-cal', -Infinity],
          ['', 'events', 'legacy-cal', Infinity],
        ),
      );
    await tx.done;
    expect(indexed).toHaveLength(1);
    upgraded.close();
  });

  it('creates new databases directly at v2 with the owner-scoped index', async () => {
    const db = await openRaliaDB(databaseName());

    expect(db.version).toBe(2);
    expect(db.transaction('outbox').store.indexNames.contains('by-owner-domain-calendar')).toBe(
      true,
    );
    db.close();
  });
});
