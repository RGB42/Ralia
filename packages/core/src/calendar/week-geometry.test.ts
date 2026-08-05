import { describe, expect, it } from 'vitest';
import { WEEK_HOUR_HEIGHT_PX, parseTimeToMinutes, weekEventGeometry } from './week-geometry.js';

describe('parseTimeToMinutes', () => {
  it('liest HH:MM', () => {
    expect(parseTimeToMinutes('09:00')).toBe(540);
    expect(parseTimeToMinutes('00:00')).toBe(0);
    expect(parseTimeToMinutes('23:59')).toBe(1439);
  });

  it('gibt null fuer Unbrauchbares', () => {
    expect(parseTimeToMinutes('')).toBeNull();
    expect(parseTimeToMinutes('24:00')).toBeNull();
    expect(parseTimeToMinutes('9:00')).toBeNull();
    expect(parseTimeToMinutes('09:60')).toBeNull();
  });
});

describe('weekEventGeometry', () => {
  it('setzt einen Termin zur Tagesstartstunde auf top 0', () => {
    expect(weekEventGeometry(6 * 60, 7 * 60, 6)).toEqual({ topPx: 0, heightPx: 49 });
  });

  it('rechnet eine Stunde als Stundenhoehe minus 3 px Einzug', () => {
    const { heightPx } = weekEventGeometry(9 * 60, 10 * 60, 6);
    expect(heightPx).toBe(WEEK_HOUR_HEIGHT_PX - 3);
  });

  it('verschiebt nach Tagesstartstunde', () => {
    expect(weekEventGeometry(9 * 60, 10 * 60, 6).topPx).toBe(3 * WEEK_HOUR_HEIGHT_PX);
    expect(weekEventGeometry(9 * 60, 10 * 60, 0).topPx).toBe(9 * WEEK_HOUR_HEIGHT_PX);
  });

  it('klemmt Termine vor dem Tagesstart auf top 0', () => {
    expect(weekEventGeometry(2 * 60, 3 * 60, 6).topPx).toBe(0);
  });

  it('erzwingt eine Mindesthoehe fuer sehr kurze Termine', () => {
    expect(weekEventGeometry(9 * 60, 9 * 60 + 15, 6).heightPx).toBe(26);
  });

  it('rechnet 45 Minuten korrekt', () => {
    // 45/60*52 - 3 = 39 - 3 = 36
    expect(weekEventGeometry(510, 555, 6).heightPx).toBe(36);
  });
});
