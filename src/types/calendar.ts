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
  isRecurrenceInstance: boolean;
}

export function makeRenderKey(eventId: string, occurrenceDate: string): string {
  return `${eventId}:${occurrenceDate}`;
}
