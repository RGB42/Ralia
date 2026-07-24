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
