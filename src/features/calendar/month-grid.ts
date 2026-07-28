import { addLocalDays, formatLocalDate, isSameLocalDay, startOfLocalMonth } from '@/lib/local-date';
import type { CalendarEvent } from '@/types/calendar';

export interface MonthCell {
  date: Date;
  key: string;
  inMonth: boolean;
  isToday: boolean;
}

/** Max stacked event bars per cell before collapsing into a "+N" indicator. */
export const VISIBLE_LANES = 3;
/** Lane search depth. Beyond this an event is folded into the overflow count. */
const MAX_LANES = 10;

/**
 * Monday-first month grid.
 *
 * Row count varies (4–6) rather than being padded to a fixed 42 cells, matching
 * the legacy app — a fixed 42 would show a whole trailing week of greyed-out
 * cells for short months.
 */
export function buildMonthGrid(monthAnchor: Date): MonthCell[] {
  const monthStart = startOfLocalMonth(monthAnchor);
  const firstWeekday = (monthStart.getDay() + 6) % 7; // 0 = Monday
  const daysInMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
  const trailing = (7 - ((firstWeekday + daysInMonth) % 7)) % 7;
  const total = firstWeekday + daysInMonth + trailing;

  const gridStart = addLocalDays(monthStart, -firstWeekday);
  const today = new Date();
  const month = monthStart.getMonth();

  return Array.from({ length: total }, (_, i) => {
    const date = addLocalDays(gridStart, i);
    return {
      date,
      key: formatLocalDate(date),
      inMonth: date.getMonth() === month,
      isToday: isSameLocalDay(date, today),
    };
  });
}

export interface LaneSegment {
  event: CalendarEvent;
  lane: number;
  /** This cell is the event's first day within the grid. */
  isStart: boolean;
  /** This cell is the event's last day within the grid. */
  isEnd: boolean;
}

export interface MonthLayout {
  /** date key → lane index → segment (or null for a gap that keeps lanes aligned). */
  byDate: Map<string, (LaneSegment | null)[]>;
  /** date key → count of events that didn't fit in the visible lanes. */
  overflowByDate: Map<string, number>;
}

/**
 * Assigns each event a horizontal "lane" that stays constant across every day it
 * spans, so a multi-day event renders as one continuous bar.
 *
 * A lane is only taken if it's free on *every* day of the event's span, which is
 * what prevents two events from swapping rows mid-bar. Sorting longer events
 * first packs them into low lanes, keeping short events from fragmenting the grid.
 */
export function layoutMonthEvents(cells: MonthCell[], events: CalendarEvent[]): MonthLayout {
  const byDate = new Map<string, (LaneSegment | null)[]>();
  const overflowByDate = new Map<string, number>();
  if (cells.length === 0) return { byDate, overflowByDate };

  const firstKey = cells[0].key;
  const lastKey = cells[cells.length - 1].key;

  // Index cell positions so an event's span maps to grid indices in O(1).
  const indexByKey = new Map(cells.map((c, i) => [c.key, i]));

  const visible = events
    .filter((e) => e.end_date >= firstKey && e.start_date <= lastKey)
    .sort((a, b) => {
      if (a.start_date !== b.start_date) return a.start_date < b.start_date ? -1 : 1;
      // Longer first, so long bars claim the top lanes.
      const spanA = span(a);
      const spanB = span(b);
      if (spanA !== spanB) return spanB - spanA;
      return a.renderKey < b.renderKey ? -1 : 1;
    });

  // occupancy[gridIndex] = Set<lane>
  const occupancy: Set<number>[] = cells.map(() => new Set<number>());

  for (const event of visible) {
    const startIdx = Math.max(0, indexByKey.get(clampKey(event.start_date, firstKey, lastKey)) ?? 0);
    const endIdx = Math.min(cells.length - 1, indexByKey.get(clampKey(event.end_date, firstKey, lastKey)) ?? cells.length - 1);

    let lane = -1;
    for (let candidate = 0; candidate < MAX_LANES; candidate++) {
      let free = true;
      for (let i = startIdx; i <= endIdx; i++) {
        if (occupancy[i].has(candidate)) {
          free = false;
          break;
        }
      }
      if (free) {
        lane = candidate;
        break;
      }
    }

    if (lane === -1) {
      // Genuinely no room — count it as overflow on every day it covers rather
      // than dropping it silently the way the legacy grid did.
      for (let i = startIdx; i <= endIdx; i++) {
        overflowByDate.set(cells[i].key, (overflowByDate.get(cells[i].key) ?? 0) + 1);
      }
      continue;
    }

    for (let i = startIdx; i <= endIdx; i++) {
      occupancy[i].add(lane);
      const key = cells[i].key;

      if (lane >= VISIBLE_LANES) {
        overflowByDate.set(key, (overflowByDate.get(key) ?? 0) + 1);
        continue;
      }

      let lanes = byDate.get(key);
      if (!lanes) {
        lanes = new Array<LaneSegment | null>(VISIBLE_LANES).fill(null);
        byDate.set(key, lanes);
      }
      lanes[lane] = {
        event,
        lane,
        isStart: i === startIdx,
        isEnd: i === endIdx,
      };
    }
  }

  return { byDate, overflowByDate };
}

function span(event: CalendarEvent): number {
  return event.end_date > event.start_date ? 1 + dayDiff(event.start_date, event.end_date) : 0;
}

function dayDiff(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round(
    (new Date(by, bm - 1, bd).getTime() - new Date(ay, am - 1, ad).getTime()) / 86_400_000
  );
}

function clampKey(key: string, min: string, max: string): string {
  if (key < min) return min;
  if (key > max) return max;
  return key;
}
