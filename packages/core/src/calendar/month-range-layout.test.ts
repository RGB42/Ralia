import { describe, expect, it } from 'vitest';
import { layoutMonthEventRanges } from './month-range-layout.js';

const GRID = Array.from({ length: 42 }, (_, index) => {
  const date = new Date(Date.UTC(2026, 5, 29 + index));
  return date.toISOString().slice(0, 10);
});

describe('layoutMonthEventRanges', () => {
  it('stretches a range across adjacent cells', () => {
    const layout = layoutMonthEventRanges(GRID, [
      { startDate: '2026-07-01', endDate: '2026-07-04' },
    ]);
    expect(layout.segments).toEqual([
      expect.objectContaining({ row: 0, columnStart: 3, columnSpan: 4, lane: 0 }),
    ]);
  });

  it('wraps a range into the next calendar row', () => {
    const layout = layoutMonthEventRanges(GRID, [
      { startDate: '2026-07-03', endDate: '2026-07-08' },
    ]);
    expect(layout.segments).toEqual([
      expect.objectContaining({ row: 0, columnStart: 5, columnSpan: 3, continuesAfter: true }),
      expect.objectContaining({ row: 1, columnStart: 1, columnSpan: 3, continuesBefore: true }),
    ]);
  });

  it('clips ranges at both grid edges', () => {
    const layout = layoutMonthEventRanges(GRID, [
      { startDate: '2026-06-20', endDate: '2026-08-20' },
    ]);
    expect(layout.segments).toHaveLength(6);
    expect(layout.segments[0]).toMatchObject({ columnStart: 1, columnSpan: 7, continuesBefore: true });
    expect(layout.segments[5]).toMatchObject({ columnStart: 1, columnSpan: 7, continuesAfter: true });
  });

  it('places overlapping ranges on separate lanes', () => {
    const layout = layoutMonthEventRanges(GRID, [
      { startDate: '2026-07-01', endDate: '2026-07-04' },
      { startDate: '2026-07-02', endDate: '2026-07-05' },
      { startDate: '2026-07-06', endDate: '2026-07-07' },
    ]);
    expect(layout.segments[0]?.lane).toBe(0);
    expect(layout.segments[1]?.lane).toBe(1);
    expect(layout.rowLaneCounts[0]).toBe(2);
    expect(layout.rowLaneCounts[1]).toBe(1);
  });

  it('ignores invalid reversed ranges', () => {
    expect(
      layoutMonthEventRanges(GRID, [{ startDate: '2026-07-04', endDate: '2026-07-01' }])
        .segments,
    ).toEqual([]);
  });
});
