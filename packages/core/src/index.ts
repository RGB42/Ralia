/**
 * @ralia/core — framework-free domain logic.
 *
 * Nothing in this package may import React, touch the DOM, or talk to Supabase.
 * That constraint is what makes the hard parts (recurrence expansion, the
 * offline queue, split arithmetic) unit-testable as plain functions — the thing
 * Ralia 1.x could not do, because all of it lived in globals next to DOM code.
 */

export { isLocalId, localIdScope, makeLocalId, type IdFactoryOptions } from './ids.js';

export {
  isOfflineSyncError,
  isPermanentRequestError,
  type OfflineProbe,
} from './net/offline-error.js';

export { BACKOFF_BASE_MS, BACKOFF_CEILING_MS, backoffDelayMs } from './outbox/backoff.js';

export {
  OUTBOX_DB_NAME,
  OUTBOX_DB_VERSION,
  openRaliaDB,
  type RaliaDB,
  type RaliaDatabase,
} from './outbox/db.js';

export {
  DEFAULT_FLUSH_INTERVAL_MS,
  bindLifecycle,
  type LifecycleHandlers,
  type Unbind,
} from './outbox/lifecycle.js';

export {
  LEGACY_CACHE_PREFIXES,
  LEGACY_MIGRATION_META_KEY,
  LEGACY_MIGRATION_VERSION,
  LEGACY_QUEUE_PREFIXES,
  collectLegacyKeysToRemove,
  collectLegacyQueues,
  importLegacyOutbox,
  type KeyValueStorage,
  type LegacyImportResult,
  type LegacyMigrationMarker,
} from './outbox/legacy-import.js';

export { Outbox, type OutboxOptions } from './outbox/outbox.js';

export {
  OUTBOX_DOMAINS,
  emptyFlushSummary,
  isOutboxDomain,
  type FlushOutcome,
  type FlushSummary,
  type IdRebase,
  type NewOutboxRecord,
  type OutboxDomain,
  type OutboxExecutor,
  type OutboxRecord,
} from './outbox/types.js';
