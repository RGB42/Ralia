import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { NewOutboxRecord, OutboxDomain, OutboxRecord } from './types.js';

export const OUTBOX_DB_NAME = 'ralia';
export const OUTBOX_DB_VERSION = 1;

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
      /** FIFO drain of one queue. */
      'by-domain-calendar': [OutboxDomain, string, number];
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
    upgrade(db) {
      if (!db.objectStoreNames.contains('outbox')) {
        const store = db.createObjectStore('outbox', { keyPath: 'id', autoIncrement: true });
        store.createIndex('by-domain-calendar', ['domain', 'calendarId', 'enqueuedAt']);
        store.createIndex('by-enqueued-at', 'enqueuedAt');
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
