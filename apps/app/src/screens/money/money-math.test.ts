import { describe, expect, it } from 'vitest';
import { budgetSummary, categoryTotals, formatEur } from './money-math.js';

const categories = [
  { name: 'Wohnen', limit: 800, shares: { u1: 780, u2: 0, both: 0 } },
  { name: 'Freizeit', limit: 300, shares: { u1: 52.2, u2: 42, both: 120 } },
] as const;

/**
 * Intl trennt Zahl und Waehrungszeichen mit einem geschuetzten Leerzeichen;
 * welches genau, haengt an der ICU-Version der Laufzeit. Ein Vergleich mit
 * einem getippten Leerzeichen waere darum umgebungsabhaengig.
 */
const bare = (value: string) => value.replace(/\s/gu, '');

describe('formatEur', () => {
  it('formatiert deutsch mit zwei Dezimalstellen', () => {
    expect(bare(formatEur(1024.1, 'de'))).toBe('1.024,10€');
    expect(bare(formatEur(0, 'de'))).toBe('0,00€');
  });

  it('formatiert englisch', () => {
    expect(formatEur(1024.1, 'en')).toContain('1,024.10');
  });
});

describe('categoryTotals', () => {
  it('summiert die Anteile je Kategorie', () => {
    const [wohnen, freizeit] = categoryTotals(categories);
    expect(wohnen?.spent).toBeCloseTo(780);
    expect(freizeit?.spent).toBeCloseTo(214.2);
  });

  it('rechnet den Prozentsatz gegen das Limit', () => {
    const [wohnen] = categoryTotals(categories);
    expect(wohnen?.pct).toBeCloseTo(97.5);
  });

  it('erzeugt ein Segment je Person mit Anteil ueber null', () => {
    const [wohnen, freizeit] = categoryTotals(categories);
    expect(wohnen?.segments).toHaveLength(1);
    expect(freizeit?.segments).toHaveLength(3);
  });

  it('gibt Segmentbreiten relativ zum Limit an', () => {
    const [wohnen] = categoryTotals(categories);
    expect(wohnen?.segments[0]?.widthPct).toBeCloseTo(97.5);
  });

  it('nennt Segmentfarben als Token, nicht als Hex', () => {
    for (const segment of categoryTotals(categories)[1]?.segments ?? []) {
      expect(segment.color).toMatch(/^var\(--/);
    }
  });

  it('deckelt bei Ueberschreitung auf 100 Prozent', () => {
    const over = [{ name: 'X', limit: 100, shares: { u1: 150, u2: 0, both: 0 } }] as const;
    expect(categoryTotals(over)[0]?.pct).toBe(100);
  });

  it('kommt mit Limit null ohne Division durch null zurecht', () => {
    const zero = [{ name: 'X', limit: 0, shares: { u1: 10, u2: 0, both: 0 } }] as const;
    expect(categoryTotals(zero)[0]?.pct).toBe(100);
    const empty = [{ name: 'X', limit: 0, shares: { u1: 0, u2: 0, both: 0 } }] as const;
    expect(categoryTotals(empty)[0]?.pct).toBe(0);
  });
});

describe('budgetSummary', () => {
  it('summiert alle Kategorien', () => {
    const summary = budgetSummary(categories, 2400);
    expect(summary.spent).toBeCloseTo(994.2);
    expect(summary.remaining).toBeCloseTo(1405.8);
    expect(summary.pct).toBeCloseTo(41.425);
  });

  it('meldet bei Ueberschreitung null uebrig statt negativ', () => {
    expect(budgetSummary(categories, 500).remaining).toBe(0);
  });
});
