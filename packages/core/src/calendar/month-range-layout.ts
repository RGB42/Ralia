const DAY_MS = 86_400_000;

export interface MonthRangeInput {
  startDate: string;
  endDate: string;
}

export interface MonthRangeSegment {
  eventIndex: number;
  startDate: string;
  endDate: string;
  row: number;
  columnStart: number;
  columnSpan: number;
  lane: number;
  continuesBefore: boolean;
  continuesAfter: boolean;
}

export interface MonthRangeLayout {
  segments: MonthRangeSegment[];
  rowLaneCounts: number[];
}

function epochDay(iso: string): number {
  const timestamp = Date.parse(`${iso}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || Number.isNaN(timestamp)) {
    throw new RangeError(`Invalid ISO date: ${iso}`);
  }
  return Math.floor(timestamp / DAY_MS);
}

function isoFromEpochDay(day: number): string {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

/**
 * Splits clipped multi-day ranges at week boundaries and assigns non-overlapping
 * lanes independently in each calendar row.
 */
export function layoutMonthEventRanges(
  gridDates: readonly string[],
  ranges: readonly MonthRangeInput[],
): MonthRangeLayout {
  if (gridDates.length === 0 || gridDates.length % 7 !== 0) {
    throw new RangeError('Month range layout requires complete seven-day rows');
  }

  const gridStart = epochDay(gridDates[0]!);
  const gridEnd = epochDay(gridDates[gridDates.length - 1]!);
  const pending: Omit<MonthRangeSegment, 'lane'>[] = [];

  ranges.forEach((range, eventIndex) => {
    const eventStart = epochDay(range.startDate);
    const eventEnd = epochDay(range.endDate);
    if (eventEnd < eventStart || eventEnd < gridStart || eventStart > gridEnd) return;

    let startIndex = Math.max(eventStart, gridStart) - gridStart;
    const finalIndex = Math.min(eventEnd, gridEnd) - gridStart;
    while (startIndex <= finalIndex) {
      const row = Math.floor(startIndex / 7);
      const rowEnd = row * 7 + 6;
      const segmentEnd = Math.min(finalIndex, rowEnd);
      pending.push({
        eventIndex,
        startDate: isoFromEpochDay(gridStart + startIndex),
        endDate: isoFromEpochDay(gridStart + segmentEnd),
        row,
        columnStart: (startIndex % 7) + 1,
        columnSpan: segmentEnd - startIndex + 1,
        continuesBefore: gridStart + startIndex > eventStart,
        continuesAfter: gridStart + segmentEnd < eventEnd,
      });
      startIndex = segmentEnd + 1;
    }
  });

  pending.sort(
    (left, right) =>
      left.row - right.row ||
      left.columnStart - right.columnStart ||
      right.columnSpan - left.columnSpan ||
      left.eventIndex - right.eventIndex,
  );

  const rowCount = gridDates.length / 7;
  const occupancy: boolean[][][] = Array.from({ length: rowCount }, () => []);
  const rowLaneCounts = Array.from({ length: rowCount }, () => 0);
  const segments = pending.map((segment): MonthRangeSegment => {
    const rowLanes = occupancy[segment.row]!;
    const firstColumn = segment.columnStart - 1;
    const lastColumn = firstColumn + segment.columnSpan - 1;
    let lane = 0;
    while (
      rowLanes[lane]?.some((used, column) => used && column >= firstColumn && column <= lastColumn)
    ) {
      lane += 1;
    }
    rowLanes[lane] ??= Array.from({ length: 7 }, () => false);
    for (let column = firstColumn; column <= lastColumn; column += 1) {
      rowLanes[lane]![column] = true;
    }
    rowLaneCounts[segment.row] = Math.max(rowLaneCounts[segment.row]!, lane + 1);
    return { ...segment, lane };
  });

  return { segments, rowLaneCounts };
}
