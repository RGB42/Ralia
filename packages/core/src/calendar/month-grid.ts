/**
 * Die 42 Zellen eines Monatsrasters.
 *
 * Durchgehend UTC — genau wie die Vorlage (Z. 1261–1268). Lokale Zeitzonen
 * wuerden beim Datumssprung ueber Mitternacht Zellen verschieben.
 */

export const MONTH_CELL_COUNT = 42;
const DAY_MS = 86_400_000;

export type WeekStart = 'mo' | 'so';

export interface MonthGridCell {
  /** `YYYY-MM-DD` */
  iso: string;
  dayOfMonth: number;
  /** Gehoert die Zelle zum dargestellten Monat? Sonst ausgegraut. */
  inMonth: boolean;
}

function toIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** @param monthIndex 0-basiert, wie `Date#getUTCMonth`. */
export function monthGridCells(
  year: number,
  monthIndex: number,
  weekStart: WeekStart,
): MonthGridCell[] {
  const first = new Date(Date.UTC(year, monthIndex, 1));
  const weekday = first.getUTCDay();
  const shift = weekStart === 'mo' ? (weekday + 6) % 7 : weekday;
  const gridStart = Date.UTC(year, monthIndex, 1 - shift);

  const cells: MonthGridCell[] = [];
  for (let index = 0; index < MONTH_CELL_COUNT; index += 1) {
    const date = new Date(gridStart + index * DAY_MS);
    cells.push({
      iso: toIso(date),
      dayOfMonth: date.getUTCDate(),
      inMonth: date.getUTCMonth() === monthIndex && date.getUTCFullYear() === year,
    });
  }
  return cells;
}
