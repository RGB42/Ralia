import type { EventRow } from './database';

/**
 * One expanded occurrence of an event. Recurring events share their master
 * row's `id` across every occurrence, so `.id` alone can't key a list or
 * identify "which occurrence is this" — every occurrence gets a synthetic
 * `renderKey` for that; `.id` remains the row to mutate in the DB.
 */
export interface CalendarEvent extends EventRow {
  renderKey: string;
  /** The occurrence's actual date — equals start_date for non-recurring events. */
  occurrenceDate: string;
  /**
   * The date the recurrence rule produced, *before* any exception override moved
   * it. This — not `occurrenceDate` — is the key into
   * `recurring_event_exceptions.original_occurrence_date`.
   */
  originalOccurrenceDate: string;
  isRecurrenceInstance: boolean;
  /** True when an exception's `override_event_data` was merged into this occurrence. */
  isExceptionOverride: boolean;
  exceptionId: string | null;
}

/**
 * The legacy web app builds this key as `${masterId}::${originalOccurrenceDate}`.
 * Keep the separator identical — it's used as a cross-app stable identity for an
 * occurrence (e.g. reminder dedup tokens).
 */
export function makeRenderKey(eventId: string, originalOccurrenceDate: string): string {
  return `${eventId}::${originalOccurrenceDate}`;
}
