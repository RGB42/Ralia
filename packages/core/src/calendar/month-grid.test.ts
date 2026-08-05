import { describe, expect, it } from 'vitest';
import { monthGridCells } from './month-grid.js';

describe('monthGridCells', () => {
  it('liefert immer 42 Zellen', () => {
    expect(monthGridCells(2026, 6, 'mo')).toHaveLength(42);
    expect(monthGridCells(2026, 1, 'mo')).toHaveLength(42);
  });

  it('beginnt bei Wochenstart Montag am richtigen Tag', () => {
    // 1. Juli 2026 ist ein Mittwoch → zwei Tage Vorlauf: 29. und 30. Juni
    const cells = monthGridCells(2026, 6, 'mo');
    expect(cells[0]?.iso).toBe('2026-06-29');
    expect(cells[0]?.inMonth).toBe(false);
    expect(cells[2]?.iso).toBe('2026-07-01');
    expect(cells[2]?.inMonth).toBe(true);
  });

  it('verschiebt bei Wochenstart Sonntag um einen Tag', () => {
    expect(monthGridCells(2026, 6, 'so')[0]?.iso).toBe('2026-06-28');
  });

  it('markiert Tage des Folgemonats als ausserhalb', () => {
    const cells = monthGridCells(2026, 6, 'mo');
    const last = cells[41];
    expect(last?.inMonth).toBe(false);
    expect(last?.iso.startsWith('2026-08')).toBe(true);
  });

  it('kommt ueber einen Jahreswechsel', () => {
    const cells = monthGridCells(2026, 11, 'mo');
    expect(cells.some((c) => c.iso.startsWith('2027-01'))).toBe(true);
  });

  it('kommt mit einem Schaltjahr-Februar zurecht', () => {
    const cells = monthGridCells(2028, 1, 'mo');
    expect(cells.filter((c) => c.inMonth)).toHaveLength(29);
  });

  it('liefert die Tagesnummer passend zum ISO-Datum', () => {
    for (const cell of monthGridCells(2026, 6, 'mo')) {
      expect(cell.dayOfMonth).toBe(Number(cell.iso.slice(8, 10)));
    }
  });
});
