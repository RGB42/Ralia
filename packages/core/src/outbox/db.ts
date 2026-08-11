import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { NewOutboxRecord, OutboxDomain, OutboxRecord } from './types.js';

export const OUTBOX_DB_NAME = 'ralia';
export const OUTBOX_DB_VERSION = 3;

export interface RaliaDB extends DBSchema {
  outbox: {
    key: number;
    /**
     * The store uses an in-line auto-increment key, so IndexedDB writes `id`
     * into the stored object itself. Reads therefore always yield a complete
     * `OutboxRecord`.
     */
    value: OutboxRecord;
    indexes: {
      /** Account-safe FIFO access to exactly one domain/calendar queue. */
      'by-owner-domain-calendar': [string, OutboxDomain, string, number];
      /** FIFO drain of one queue. */
      'by-domain-calendar': [OutboxDomain, string, number];
      /** Owner-wide purge for account deletion. */
      'by-owner': string;
      /** Cheap global counts and full drains. */
      'by-enqueued-at': number;
    };
  };
  /** Small key/value area for migration markers and cached runtime config. */
  meta: {
    key: string;
    value: unknown;
  };
}

export type RaliaDatabase = IDBPDatabase<RaliaDB>;

/**
 * Opens (and on first run creates) the app database.
 *
 * `blocking` fires when another tab holds an older version open. Closing
 * immediately lets the newer tab upgrade instead of deadlocking — the common
 * case is a user with the app open in two tabs during a deploy.
 */
export function openRaliaDB(name: string = OUTBOX_DB_NAME): Promise<RaliaDatabase> {
  return openDB<RaliaDB>(name, OUTBOX_DB_VERSION, {
    upgrade(db, oldVersion, _newVersion, transaction) {
      let outboxStore;
      if (!db.objectStoreNames.contains('outbox')) {
        outboxStore = db.createObjectStore('outbox', { keyPath: 'id', autoIncrement: true });
        outboxStore.createIndex('by-domain-calendar', ['domain', 'calendarId', 'enqueuedAt']);
        outboxStore.createIndex('by-enqueued-at', 'enqueuedAt');
      } else {
        outboxStore = transaction.objectStore('outbox');
      }

      if (!outboxStore.indexNames.contains('by-owner-domain-calendar')) {
        outboxStore.createIndex('by-owner-domain-calendar', [
          'ownerUserId',
          'domain',
          'calendarId',
          'enqueuedAt',
        ]);
      }
      if (!outboxStore.indexNames.contains('by-owner')) {
        outboxStore.createIndex('by-owner', 'ownerUserId');
      }

      if (oldVersion === 1) {
        // v1 had no account attribution. Preserve every record, but keep it
        // unavailable to normal queue operations until claimLegacy() assigns it.
        void (async () => {
          let cursor = await outboxStore.openCursor();
          while (cursor) {
            if (typeof cursor.value.ownerUserId !== 'string') {
              await cursor.update({ ...cursor.value, ownerUserId: '' });
            }
            cursor = await cursor.continue();
          }
        })();
      }
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta');
      }
    },
    blocking(_currentVersion, _blockedVersion, event) {
      // A newer version wants to upgrade; get out of its way.
      (event.target as IDBPDatabase<RaliaDB> | null)?.close();
    },
  });
}

/**
 * IndexedDB assigns the in-line key on write, so the record handed to `add`
 * legitimately has no `id` yet. This is the single place that bridges the two
 * shapes; keeping the cast here means the rest of the codebase only ever sees
 * complete records.
 */
export function forInsert<TMutation>(record: NewOutboxRecord<TMutation>): OutboxRecord {
  return record as unknown as OutboxRecord;
}
