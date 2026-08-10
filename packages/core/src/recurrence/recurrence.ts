const DAY_MS = 86_400_000;
const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export type RecurrenceType = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface InclusiveDateRange {
  /** Inclusive lower boundary in `YYYY-MM-DD` form. */
  startDate: string;
  /** Inclusive upper boundary in `YYYY-MM-DD` form. */
  endDate: string;
}

export interface RecurringEventMaster {
  id: string;
  start_date: string;
  end_date: string;
  recurrence_type: RecurrenceType;
  recurrence_interval?: number | null;
  recurrence_end_date?: string | null;
}

type ProtectedRecurrenceField =
  'id' | 'recurrence_type' | 'recurrence_interval' | 'recurrence_end_date';

export type RecurringEventOverride<TEvent extends RecurringEventMaster> = Partial<
  Omit<TEvent, ProtectedRecurrenceField>
>;

export interface RecurringEventException<TEvent extends RecurringEventMaster> {
  id?: string | null;
  master_event_id: string;
  original_occurrence_date: string;
  is_deleted: boolean;
  override_event_data?: RecurringEventOverride<TEvent> | null;
}

export type RecurrenceOccurrence<TEvent extends RecurringEventMaster> = TEvent & {
  /** Actual date after an optional exception override. */
  occurrenceDate: string;
  /** Date produced by the recurrence rule and used to identify an exception. */
  originalOccurrenceDate: string;
  isRecurrenceInstance: true;
  isExceptionOverride: boolean;
  exceptionId: string | null;
};

interface ParsedDate {
  iso: string;
  year: number;
  month: number;
  day: number;
  epochDay: number;
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return month === 4 || month === 6 || month === 9 || month === 11 ? 30 : 31;
}

function epochDayFromParts(year: number, month: number, day: number): number {
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);
  return Math.floor(date.getTime() / DAY_MS);
}

const MAX_EPOCH_DAY = epochDayFromParts(9999, 12, 31);

function parseIsoDate(value: string, field: string): ParsedDate {
  const match = ISO_DATE_PATTERN.exec(value);
  if (!match) {
    throw new RangeError(`${field} must be a date in YYYY-MM-DD form`);
  }

  const year = Number(match[1] ?? Number.NaN);
  const month = Number(match[2] ?? Number.NaN);
  const day = Number(match[3] ?? Number.NaN);
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    throw new RangeError(`${field} must be a valid calendar date`);
  }

  return {
    iso: value,
    year,
    month,
    day,
    epochDay: epochDayFromParts(year, month, day),
  };
}

function isoFromEpochDay(epochDay: number): string {
  if (!Number.isInteger(epochDay) || epochDay > MAX_EPOCH_DAY) {
    throw new RangeError('date exceeds the supported YYYY-MM-DD range');
  }
  return new Date(epochDay * DAY_MS).toISOString().slice(0, 10);
}

function recurrenceInterval(value: number | null | undefined): number {
  if (value == null) return 1;
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new RangeError('recurrence_interval must be a positive integer');
  }
  return value;
}

function recurrenceType(value: RecurrenceType): RecurrenceType {
  if (value === 'daily' || value === 'weekly' || value === 'monthly' || value === 'yearly') {
    return value;
  }
  throw new RangeError(`unsupported recurrence_type: ${String(value)}`);
}

/**
 * Returns the rule-produced day at a zero-based occurrence index.
 *
 * Month and year arithmetic always starts from the master date. Clamping an
 * occurrence therefore never causes the next occurrence to drift away from the
 * master's original day of month.
 */
function occurrenceDayAt(
  anchor: ParsedDate,
  type: RecurrenceType,
  interval: number,
  index: number,
): number | null {
  if (index === 0) return anchor.epochDay;

  if (type === 'daily' || type === 'weekly') {
    const stepDays = type === 'daily' ? interval : interval * 7;
    if (!Number.isSafeInteger(stepDays)) return null;
    if (index > Math.floor((MAX_EPOCH_DAY - anchor.epochDay) / stepDays)) return null;
    return anchor.epochDay + index * stepDays;
  }

  if (type === 'monthly') {
    const anchorMonth = anchor.year * 12 + anchor.month - 1;
    const maximumMonth = 9999 * 12 + 11;
    if (index > Math.floor((maximumMonth - anchorMonth) / interval)) return null;
    const targetMonth = anchorMonth + index * interval;
    const year = Math.floor(targetMonth / 12);
    const month = (targetMonth % 12) + 1;
    const day = Math.min(anchor.day, daysInMonth(year, month));
    return epochDayFromParts(year, month, day);
  }

  if (index > Math.floor((9999 - anchor.year) / interval)) return null;
  const year = anchor.year + index * interval;
  const day = Math.min(anchor.day, daysInMonth(year, anchor.month));
  return epochDayFromParts(year, anchor.month, day);
}

function firstOccurrenceOnOrAfter(
  anchor: ParsedDate,
  type: RecurrenceType,
  interval: number,
  targetEpochDay: number,
): number {
  if (targetEpochDay <= anchor.epochDay) return 0;

  let low = 0;
  let high = 1;
  while (true) {
    const day = occurrenceDayAt(anchor, type, interval, high);
    if (day == null || day >= targetEpochDay) break;
    low = high + 1;
    high *= 2;
  }

  while (low < high) {
    const middle = Math.floor(low + (high - low) / 2);
    const day = occurrenceDayAt(anchor, type, interval, middle);
    if (day == null || day >= targetEpochDay) {
      high = middle;
    } else {
      low = middle + 1;
    }
  }
  return low;
}

function makeBaseOccurrence<TEvent extends RecurringEventMaster>(
  master: TEvent,
  originalDate: string,
  originalEpochDay: number,
  durationDays: number,
): RecurrenceOccurrence<TEvent> {
  return {
    ...master,
    start_date: originalDate,
    end_date: isoFromEpochDay(originalEpochDay + durationDays),
    occurrenceDate: originalDate,
    originalOccurrenceDate: originalDate,
    isRecurrenceInstance: true,
    isExceptionOverride: false,
    exceptionId: null,
  };
}

function applyExceptionOverride<TEvent extends RecurringEventMaster>(
  occurrence: RecurrenceOccurrence<TEvent>,
  master: TEvent,
  exception: RecurringEventException<TEvent>,
): RecurrenceOccurrence<TEvent> {
  if (exception.override_event_data == null) return occurrence;

  const overridden = {
    ...occurrence,
    ...exception.override_event_data,
    // An occurrence override cannot change the identity or rule of its master.
    id: master.id,
    recurrence_type: master.recurrence_type,
    recurrence_interval: master.recurrence_interval,
    recurrence_end_date: master.recurrence_end_date,
  };

  return {
    ...overridden,
    occurrenceDate: overridden.start_date,
    originalOccurrenceDate: occurrence.originalOccurrenceDate,
    isRecurrenceInstance: true,
    isExceptionOverride: true,
    exceptionId: exception.id ?? null,
  } as RecurrenceOccurrence<TEvent>;
}

function overlapsRange<TEvent extends RecurringEventMaster>(
  occurrence: RecurrenceOccurrence<TEvent>,
  rangeStart: number,
  rangeEnd: number,
): boolean {
  const start = parseIsoDate(occurrence.start_date, 'occurrence start_date').epochDay;
  const end = parseIsoDate(occurrence.end_date, 'occurrence end_date').epochDay;
  if (end < start) {
    throw new RangeError('occurrence end_date must not be before start_date');
  }
  return end >= rangeStart && start <= rangeEnd;
}

function compareOccurrences<TEvent extends RecurringEventMaster>(
  left: RecurrenceOccurrence<TEvent>,
  right: RecurrenceOccurrence<TEvent>,
): number {
  return (
    left.start_date.localeCompare(right.start_date) ||
    left.originalOccurrenceDate.localeCompare(right.originalOccurrenceDate) ||
    left.id.localeCompare(right.id)
  );
}

function exceptionsForMaster<TEvent extends RecurringEventMaster>(
  masterId: string,
  exceptions: readonly RecurringEventException<TEvent>[],
): Map<string, RecurringEventException<TEvent>> {
  const indexed = new Map<string, RecurringEventException<TEvent>>();
  for (const exception of exceptions) {
    if (exception.master_event_id === masterId) {
      // A unique database constraint normally prevents duplicates. Last write
      // wins here so optimistic/local rows can deterministically supersede one.
      indexed.set(exception.original_occurrence_date, exception);
    }
  }
  return indexed;
}

/**
 * Expands a recurring event into all occurrences overlapping an inclusive
 * date-only range. The input objects are never mutated.
 */
export function expandRecurringEvent<TEvent extends RecurringEventMaster>(
  master: TEvent,
  range: InclusiveDateRange,
  exceptions: readonly RecurringEventException<TEvent>[] = [],
): RecurrenceOccurrence<TEvent>[] {
  const rangeStart = parseIsoDate(range.startDate, 'range startDate');
  const rangeEnd = parseIsoDate(range.endDate, 'range endDate');
  if (rangeEnd.epochDay < rangeStart.epochDay) {
    throw new RangeError('range endDate must not be before startDate');
  }

  const anchor = parseIsoDate(master.start_date, 'master start_date');
  const masterEnd = parseIsoDate(master.end_date, 'master end_date');
  if (masterEnd.epochDay < anchor.epochDay) {
    throw new RangeError('master end_date must not be before start_date');
  }

  const type = recurrenceType(master.recurrence_type);
  const interval = recurrenceInterval(master.recurrence_interval);
  const recurrenceEnd = master.recurrence_end_date
    ? parseIsoDate(master.recurrence_end_date, 'master recurrence_end_date')
    : null;
  const durationDays = masterEnd.epochDay - anchor.epochDay;
  const indexedExceptions = exceptionsForMaster(master.id, exceptions);
  const processedOriginalDates = new Set<string>();
  const results: RecurrenceOccurrence<TEvent>[] = [];

  const firstIndex = firstOccurrenceOnOrAfter(
    anchor,
    type,
    interval,
    rangeStart.epochDay - durationDays,
  );

  for (let index = firstIndex; ; index += 1) {
    const originalEpochDay = occurrenceDayAt(anchor, type, interval, index);
    if (originalEpochDay == null || originalEpochDay > rangeEnd.epochDay) break;
    if (recurrenceEnd && originalEpochDay > recurrenceEnd.epochDay) break;

    const originalDate = isoFromEpochDay(originalEpochDay);
    processedOriginalDates.add(originalDate);
    const exception = indexedExceptions.get(originalDate);
    if (exception?.is_deleted) continue;

    let occurrence = makeBaseOccurrence(master, originalDate, originalEpochDay, durationDays);
    if (exception) occurrence = applyExceptionOverride(occurrence, master, exception);
    if (overlapsRange(occurrence, rangeStart.epochDay, rangeEnd.epochDay)) {
      results.push(occurrence);
    }
  }

  // An override can move an otherwise out-of-range occurrence into this range.
  // Validate that its original date is an exact member of the rule before adding it.
  for (const [originalDate, exception] of indexedExceptions) {
    if (
      processedOriginalDates.has(originalDate) ||
      exception.is_deleted ||
      exception.override_event_data == null
    ) {
      continue;
    }

    const original = parseIsoDate(originalDate, 'exception original_occurrence_date');
    const index = firstOccurrenceOnOrAfter(anchor, type, interval, original.epochDay);
    const ruleEpochDay = occurrenceDayAt(anchor, type, interval, index);
    if (ruleEpochDay !== original.epochDay) continue;
    if (recurrenceEnd && ruleEpochDay > recurrenceEnd.epochDay) continue;

    const base = makeBaseOccurrence(master, originalDate, ruleEpochDay, durationDays);
    const occurrence = applyExceptionOverride(base, master, exception);
    if (overlapsRange(occurrence, rangeStart.epochDay, rangeEnd.epochDay)) {
      results.push(occurrence);
    }
  }

  return results.sort(compareOccurrences);
}

/** Expands several masters and returns one chronological occurrence list. */
export function expandRecurringEvents<TEvent extends RecurringEventMaster>(
  masters: readonly TEvent[],
  range: InclusiveDateRange,
  exceptions: readonly RecurringEventException<TEvent>[] = [],
): RecurrenceOccurrence<TEvent>[] {
  const exceptionsByMaster = new Map<string, RecurringEventException<TEvent>[]>();
  for (const exception of exceptions) {
    const grouped = exceptionsByMaster.get(exception.master_event_id);
    if (grouped) grouped.push(exception);
    else exceptionsByMaster.set(exception.master_event_id, [exception]);
  }

  return masters
    .flatMap((master) =>
      expandRecurringEvent(master, range, exceptionsByMaster.get(master.id) ?? []),
    )
    .sort(compareOccurrences);
}
