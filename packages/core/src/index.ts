/**
 * @ralia/core — framework-free domain logic.
 *
 * Nothing in this package may import React, touch the DOM, or talk to Supabase.
 * That constraint is what makes the hard parts (recurrence expansion, the
 * offline queue, split arithmetic) unit-testable as plain functions — the thing
 * Ralia 1.x could not do, because all of it lived in globals next to DOM code.
 */

export {
  MONTH_CELL_CHROME_PX,
  MONTH_CHIP_HEIGHT_PX,
  MONTH_MAX_CHIPS,
  MONTH_MAX_DOTS,
  MONTH_ROW_COUNT,
  monthDensity,
  type MonthDensity,
} from './calendar/month-density.js';

export {
  MONTH_CELL_COUNT,
  monthGridCells,
  type MonthGridCell,
  type WeekStart,
} from './calendar/month-grid.js';

export {
  layoutMonthEventRanges,
  type MonthRangeInput,
  type MonthRangeLayout,
  type MonthRangeSegment,
} from './calendar/month-range-layout.js';

export {
  WEEK_DEFAULT_START_HOUR,
  WEEK_EVENT_HEIGHT_INSET_PX,
  WEEK_EXPANDED_START_HOUR,
  WEEK_HOUR_HEIGHT_PX,
  WEEK_MIN_EVENT_HEIGHT_PX,
  parseTimeToMinutes,
  weekEventGeometry,
  type WeekEventGeometry,
} from './calendar/week-geometry.js';

export { isLocalId, localIdScope, makeLocalId, type IdFactoryOptions } from './ids.js';

export {
  UNCATEGORIZED_CATEGORY,
  aggregateExpensesByCategory,
  aggregateExpensesByMonth,
  calculateLedger,
  type CategoryExpenseTotal,
  type ExpenseAggregationInput,
  type ExpenseSplitType,
  type LedgerBalance,
  type LedgerExpense,
  type LedgerInput,
  type LedgerResult,
  type LedgerSettlement,
  type LedgerShare,
  type MonthlyExpenseTotal,
  type RecommendedPayment,
} from './money/ledger.js';

export {
  isOfflineSyncError,
  isPermanentRequestError,
  type OfflineProbe,
} from './net/offline-error.js';

export {
  expandRecurringEvent,
  expandRecurringEvents,
  type InclusiveDateRange,
  type RecurrenceOccurrence,
  type RecurrenceType as CoreRecurrenceType,
  type RecurringEventException,
  type RecurringEventMaster,
  type RecurringEventOverride,
} from './recurrence/index.js';

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
