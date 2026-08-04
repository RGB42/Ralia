import { addLocalDays, formatLocalDate, parseLocalDate } from '@/lib/local-date';
import { makeRenderKey, type CalendarEvent } from '@/types/calendar';
import type { EventRow, RecurrenceType, RecurringEventException } from '@/types/database';

type ConcreteRecurrence = 'daily' | 'weekly' | 'monthly' | 'yearly';

/** Hard cap on occurrences per event per expansion — also the infinite-loop backstop. */
const MAX_OCCURRENCES = 800;

/**
 * Advances one recurrence step from `current`.
 *
 * CRITICAL: this steps *cumulatively* from the previous occurrence, not from the
 * series anchor. The distinction is load-bearing because plain JS `Date` field
 * arithmetic overflows month ends, so the two approaches disagree:
 *
 *   anchor-based, monthly from 2026-01-31:
 *     01-31 → 03-03 → 03-31 → 05-01 → 05-31   (oscillates)
 *   cumulative, monthly from 2026-01-31:
 *     01-31 → 03-03 → 04-03 → 05-03 → 06-03   (drifts permanently)
 *
 * The legacy web app is cumulative and is still live against this same database.
 * Both apps expand the same stored row independently, so anything but an exact
 * match means the same event shows different dates depending which app you open.
 * Do not "fix" the drift, and do not swap in an RRULE library.
 */
function stepOnce(current: Date, type: ConcreteRecurrence, interval: number): Date {
  const step = Math.max(1, interval);
  const d = new Date(current);
  switch (type) {
    case 'daily':
      d.setDate(d.getDate() + step);
      return d;
    case 'weekly':
      d.setDate(d.getDate() + 7 * step);
      return d;
    case 'monthly':
      d.setMonth(d.getMonth() + step);
      return d;
    case 'yearly':
      d.setFullYear(d.getFullYear() + step);
      return d;
  }
}

function isConcreteRecurrence(type: RecurrenceType): type is ConcreteRecurrence {
  return type === 'daily' || type === 'weekly' || type === 'monthly' || type === 'yearly';
}

/**
 * Fields an exception override is NOT allowed to change. In particular the
 * instance keeps the MASTER's `id` and is presented as non-recurring, which is
 * why an editor opened on an overridden occurrence has to read recurrence
 * settings from the master row rather than from the occurrence.
 */
function applyOverride(
  instance: CalendarEvent,
  override: Partial<EventRow>,
  originalOccurrenceDate: string,
  exceptionId: string | null
): CalendarEvent {
  return {
    ...instance,
    ...override,
    id: instance.id,
    calendar_id: instance.calendar_id,
    created_by: instance.created_by,
    parent_event_id: null,
    recurrence_type: null,
    recurrence_end_date: null,
    recurrence_interval: 1,
    renderKey: makeRenderKey(instance.id, originalOccurrenceDate),
    // `start_date` may have been moved by the override; the occurrence's real
    // date follows it, while the rule-produced date stays the exception key.
    occurrenceDate: override.start_date ?? originalOccurrenceDate,
    originalOccurrenceDate,
    isRecurrenceInstance: true,
    isExceptionOverride: true,
    exceptionId,
  };
}

function daysBetween(startDate: string, endDate: string): number {
  const start = parseLocalDate(startDate);
  const end = parseLocalDate(endDate);
  return Math.round((end.getTime() - start.getTime()) / 86_400_000);
}

/** Expands one master row into occurrences overlapping [rangeStart, rangeEnd], exceptions applied. */
export function expandEvent(
  event: EventRow,
  exceptionsByKey: Map<string, RecurringEventException>,
  rangeStart: Date,
  rangeEnd: Date
): CalendarEvent[] {
  // Legacy drops rows carrying a parent_event_id entirely (a dead column from an
  // older recurrence model). Matching that avoids resurrecting orphaned rows the
  // web app treats as invisible.
  if (event.parent_event_id) return [];

  const spanDays = daysBetween(event.start_date, event.end_date);

  if (!isConcreteRecurrence(event.recurrence_type)) {
    if (parseLocalDate(event.start_date) > rangeEnd || parseLocalDate(event.end_date) < rangeStart) {
      return [];
    }
    return [
      {
        ...event,
        renderKey: makeRenderKey(event.id, event.start_date),
        occurrenceDate: event.start_date,
        originalOccurrenceDate: event.start_date,
        isRecurrenceInstance: false,
        isExceptionOverride: false,
        exceptionId: null,
      },
    ];
  }

  const interval = Math.max(1, event.recurrence_interval ?? 1);
  const recurrenceEnd = event.recurrence_end_date ? parseLocalDate(event.recurrence_end_date) : null;
  const rangeStartKey = formatLocalDate(rangeStart);
  const rangeEndKey = formatLocalDate(rangeEnd);

  const results: CalendarEvent[] = [];
  let current = parseLocalDate(event.start_date);

  for (let guard = 0; guard < MAX_OCCURRENCES; guard++) {
    if (current > rangeEnd) break;
    // recurrence_end_date is inclusive.
    if (recurrenceEnd && current > recurrenceEnd) break;

    const originalDateKey = formatLocalDate(current);
    const exception = exceptionsByKey.get(`${event.id}::${originalDateKey}`);

    // A deleted occurrence is skipped, but stepping continues — the rule still
    // governs where the *next* one lands.
    if (!exception?.is_deleted) {
      const occurrenceEnd = addLocalDays(current, spanDays);

      let instance: CalendarEvent = {
        ...event,
        start_date: originalDateKey,
        end_date: formatLocalDate(occurrenceEnd),
        renderKey: makeRenderKey(event.id, originalDateKey),
        occurrenceDate: originalDateKey,
        originalOccurrenceDate: originalDateKey,
        isRecurrenceInstance: true,
        isExceptionOverride: false,
        exceptionId: null,
      };

      if (exception?.override_event_data) {
        instance = applyOverride(instance, exception.override_event_data, originalDateKey, exception.id);
      }

      // Re-check the window *after* the override, since it may have moved the
      // occurrence's dates. String compare is safe on YYYY-MM-DD.
      if (instance.end_date >= rangeStartKey && instance.start_date <= rangeEndKey) {
        results.push(instance);
      }
    }

    const next = stepOnce(current, event.recurrence_type, interval);
    // Defensive: a corrupt interval that fails to advance would spin forever.
    if (next.getTime() <= current.getTime()) break;
    current = next;
  }

  return results;
}

/** Index exceptions once per expansion pass — `${master_event_id}::${original_occurrence_date}`. */
export function indexExceptions(
  exceptions: RecurringEventException[]
): Map<string, RecurringEventException> {
  const map = new Map<string, RecurringEventException>();
  for (const ex of exceptions) {
    if (!ex.master_event_id || !ex.original_occurrence_date) continue;
    // Last write wins, matching legacy.
    map.set(`${ex.master_event_id}::${ex.original_occurrence_date}`, ex);
  }
  return map;
}

export function expandAllEvents(
  events: EventRow[],
  exceptions: RecurringEventException[],
  rangeStart: Date,
  rangeEnd: Date
): CalendarEvent[] {
  const index = indexExceptions(exceptions);
  return events.flatMap((e) => expandEvent(e, index, rangeStart, rangeEnd));
}

/**
 * The occurrence immediately before `targetDate` in a series — the new
 * `recurrence_end_date` when splitting a series at `targetDate`
 * ("this and all following"). Returns null when the target IS the first
 * occurrence, which callers must handle by editing/deleting the master instead.
 */
export function getPreviousOccurrenceDate(master: EventRow, targetDate: string): string | null {
  if (!isConcreteRecurrence(master.recurrence_type)) return null;

  const interval = Math.max(1, master.recurrence_interval ?? 1);
  const target = parseLocalDate(targetDate);

  let current = parseLocalDate(master.start_date);
  if (formatLocalDate(current) === targetDate) return null;

  let previous: Date | null = null;
  for (let guard = 0; guard < MAX_OCCURRENCES && current < target; guard++) {
    previous = new Date(current);
    const next = stepOnce(current, master.recurrence_type, interval);
    if (next.getTime() <= current.getTime()) break;
    current = next;
  }

  return previous ? formatLocalDate(previous) : null;
}
