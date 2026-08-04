/**
 * `events.start_date`/`end_date` are timezone-naive DATE columns — plain
 * "YYYY-MM-DD" wall-clock values with no stored offset (confirmed: the
 * legacy app never converts them). `new Date("YYYY-MM-DD")` parses that as
 * UTC midnight, which silently shifts a day in any negative-UTC-offset
 * timezone. Every date in this file is built/read from local Y/M/D
 * components instead — never via the ISO-string Date constructor.
 */
export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addLocalDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function startOfLocalMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function isSameLocalDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/**
 * Today as a local YYYY-MM-DD. Deliberately NOT
 * `new Date().toISOString().split('T')[0]` — that yields the UTC date, which is
 * a day off for several hours daily depending on the offset. The legacy app used
 * the ISO form in a few places and this is the fix.
 */
export function todayLocalDate(): string {
  return formatLocalDate(new Date());
}

/** Monday-based start of week (ISO), matching every week calculation in the app. */
export function startOfLocalWeek(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay(); // 0=Sun
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return d;
}

/** Monday-based day index: 0=Mon … 6=Sun. `week_plans.day_of_week` uses this. */
export function localDayOfWeek(date: Date): number {
  return (date.getDay() + 6) % 7;
}

/**
 * Postgres `time` comes back as `HH:MM:SS` but HTML/form values are `HH:MM`, so
 * equality checks on raw strings are unreliable. Everything is normalised to
 * `HH:MM` for display and comparison.
 */
export function normalizeTime(time: string | null | undefined): string {
  if (!time) return '00:00';
  return time.slice(0, 5);
}

export function isMidnightTime(time: string | null | undefined): boolean {
  if (!time) return true;
  const t = normalizeTime(time);
  return t === '00:00';
}

/**
 * The canonical all-day rule. The legacy app had three mutually inconsistent
 * definitions; this is the one its *editor* used, and it's the one the shared
 * production database is written against — both times at midnight.
 *
 * Multi-day (`start_date !== end_date`) is a SEPARATE concept and deliberately
 * not folded in here.
 */
export function isAllDay(event: { start_time: string; end_time: string }): boolean {
  return isMidnightTime(event.start_time) && isMidnightTime(event.end_time);
}

/**
 * What an all-day event must be written as. The legacy web app is still live on
 * the same database and detects all-day by "both ends at midnight", so writing
 * anything else (e.g. an end of 23:59) makes our rows look like timed events
 * over there.
 */
export const ALL_DAY_START = '00:00:00';
export const ALL_DAY_END = '00:00:00';

export function timeToMinutes(time: string | null | undefined): number {
  const [h, m] = normalizeTime(time).split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function minutesToTime(minutes: number): string {
  const clamped = Math.max(0, Math.min(24 * 60 - 1, Math.round(minutes)));
  const h = String(Math.floor(clamped / 60)).padStart(2, '0');
  const m = String(clamped % 60).padStart(2, '0');
  return `${h}:${m}`;
}
