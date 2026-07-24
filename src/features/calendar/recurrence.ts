import { addLocalDays, formatLocalDate, parseLocalDate } from '@/lib/local-date';
import { makeRenderKey, type CalendarEvent } from '@/types/calendar';
import type { EventRow, RecurringEventException } from '@/types/database';

/**
 * Steps a date forward by N recurrence periods using plain JS Date field
 * arithmetic (setMonth/setFullYear), deliberately NOT a "smart" calendar
 * library helper that clamps month-end overflow. The legacy web app expands
 * recurrence the same raw way, so a monthly event anchored on the 31st rolls
 * into early next month exactly like it does there today — bit-matching
 * this (rather than "fixing" it) matters because both apps expand the same
 * stored row independently; diverging here would show different occurrence
 * dates for the same event depending which app you open.
 */
function stepOccurrence(anchor: Date, type: 'daily' | 'weekly' | 'monthly' | 'yearly', interval: number, n: number): Date {
  const d = new Date(anchor);
  if (type === 'daily') d.setDate(d.getDate() + interval * n);
  else if (type === 'weekly') d.setDate(d.getDate() + interval * 7 * n);
  else if (type === 'monthly') d.setMonth(d.getMonth() + interval * n);
  else if (type === 'yearly') d.setFullYear(d.getFullYear() + interval * n);
  return d;
}

/** Expands one master event row into occurrences overlapping [rangeStart, rangeEnd], with exceptions applied. */
export function expandEvent(
  event: EventRow,
  exceptions: RecurringEventException[],
  rangeStart: Date,
  rangeEnd: Date
): CalendarEvent[] {
  const anchor = parseLocalDate(event.start_date);
  const dayDelta = daysBetween(event.start_date, event.end_date);

  if (!event.recurrence_type) {
    if (anchor > rangeEnd || parseLocalDate(event.end_date) < rangeStart) return [];
    return [
      {
        ...event,
        renderKey: makeRenderKey(event.id, event.start_date),
        occurrenceDate: event.start_date,
        isRecurrenceInstance: false,
      },
    ];
  }

  const interval = Math.max(1, event.recurrence_interval ?? 1);
  const recurrenceEnd = event.recurrence_end_date ? parseLocalDate(event.recurrence_end_date) : null;
  const exceptionsByDate = new Map(exceptions.filter((e) => e.master_event_id === event.id).map((e) => [e.original_occurrence_date, e]));

  const results: CalendarEvent[] = [];
  // Safety cap: never expand more than ~500 occurrences for one event in one call.
  for (let n = 0, guard = 0; guard < 500; n++, guard++) {
    const occurrenceStart = stepOccurrence(anchor, event.recurrence_type, interval, n);
    if (recurrenceEnd && occurrenceStart > recurrenceEnd) break;
    if (occurrenceStart > rangeEnd) break;

    const occurrenceEnd = addLocalDays(occurrenceStart, dayDelta);
    if (occurrenceEnd < rangeStart) continue;

    const originalDateKey = formatLocalDate(occurrenceStart);
    const exception = exceptionsByDate.get(originalDateKey);
    if (exception?.is_deleted) continue;

    const override = exception?.override_event_data;
    results.push({
      ...event,
      ...(override ?? {}),
      renderKey: makeRenderKey(event.id, originalDateKey),
      occurrenceDate: override?.start_date ?? originalDateKey,
      isRecurrenceInstance: true,
    });
  }
  return results;
}

function daysBetween(startDate: string, endDate: string): number {
  const start = parseLocalDate(startDate);
  const end = parseLocalDate(endDate);
  return Math.round((end.getTime() - start.getTime()) / 86400000);
}

export function expandAllEvents(
  events: EventRow[],
  exceptions: RecurringEventException[],
  rangeStart: Date,
  rangeEnd: Date
): CalendarEvent[] {
  return events.flatMap((e) => expandEvent(e, exceptions, rangeStart, rangeEnd));
}
