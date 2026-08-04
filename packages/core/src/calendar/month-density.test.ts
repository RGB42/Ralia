import { describe, expect, it } from 'vitest';
import { MONTH_MAX_CHIPS, MONTH_MAX_DOTS, monthDensity } from './month-density.js';

describe('monthDensity', () => {
  it('zeigt Punkte, wenn nicht einmal ein Chip passt', () => {
    // Zeilenhoehe 50 → 50 - 35 = 15 < 19
    expect(monthDensity(50 * 6)).toEqual({ mode: 'dots', maxChips: 0, maxDots: MONTH_MAX_DOTS });
  });

  it('zeigt genau einen Chip an der unteren Schwelle', () => {
    // Zeilenhoehe 54 → 19 verfuegbar → floor(19/19) = 1
    expect(monthDensity(54 * 6)).toEqual({ mode: 'chips', maxChips: 1, maxDots: 0 });
  });

  it('zeigt zwei Chips bei mittlerer Hoehe', () => {
    // Zeilenhoehe 73 → 38 verfuegbar → floor(38/19) = 2
    expect(monthDensity(73 * 6)).toEqual({ mode: 'chips', maxChips: 2, maxDots: 0 });
  });

  it('deckelt bei drei Chips, egal wie hoch die Zeile ist', () => {
    expect(monthDensity(400 * 6).maxChips).toBe(MONTH_MAX_CHIPS);
  });

  it('behandelt eine noch nicht gemessene Hoehe als Punkte-Modus', () => {
    expect(monthDensity(0).mode).toBe('dots');
    expect(monthDensity(-10).mode).toBe('dots');
  });

  it('stimmt mit der Vorlage bei 900 px Viewport ueberein', () => {
    // Vorlage: shellH = clamp(560, 900-90, 860) = 810; rowH = (810-290)/6 = 86.67
    // → chipAvail 51.67 → floor(51.67/19) = 2
    expect(monthDensity(810 - 290).maxChips).toBe(2);
  });
});
