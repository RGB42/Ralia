import { personTokens } from '@ralia/ui';
import type { Lang } from '../../i18n/catalog.js';
import type { MockCategory } from '../../mock/fixtures.js';

/**
 * Die Rechnung des Geld-Screens, getrennt von der Darstellung. Sie ist die
 * einzige Stelle dort, die falsch rechnen kann — deshalb steht sie fuer sich
 * und ist einzeln geprueft. Regel aus Vorlage Z. 1413–1458.
 */

const SHARE_SLOTS = ['u1', 'u2', 'both'] as const;

export function formatEur(value: number, lang: Lang): string {
  return new Intl.NumberFormat(lang === 'en' ? 'en-GB' : 'de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export interface CategoryTotal {
  name: string;
  limit: number;
  spent: number;
  /** Anteil am Limit, auf 0–100 geklemmt. */
  pct: number;
  segments: { widthPct: number; color: string }[];
}

/**
 * Ein Limit von null ergibt 100 Prozent, sobald etwas ausgegeben wurde, und
 * sonst 0 — nicht Infinity oder NaN, die als Balkenbreite unbrauchbar sind.
 */
function percentOfLimit(value: number, limit: number): number {
  if (limit <= 0) return value > 0 ? 100 : 0;
  return Math.min(100, (value / limit) * 100);
}

export function categoryTotals(categories: readonly MockCategory[]): CategoryTotal[] {
  return categories.map((category) => {
    const spent = SHARE_SLOTS.reduce((sum, slot) => sum + category.shares[slot], 0);
    return {
      name: category.name,
      limit: category.limit,
      spent,
      pct: percentOfLimit(spent, category.limit),
      // Farben als Token-Referenz, nie als Literal — sonst ignoriert der
      // Balken das Dark-Theme.
      segments: SHARE_SLOTS.filter((slot) => category.shares[slot] > 0).map((slot) => ({
        widthPct: percentOfLimit(category.shares[slot], category.limit),
        color: personTokens(slot).bar,
      })),
    };
  });
}

export interface BudgetSummary {
  spent: number;
  pct: number;
  /** Nie negativ: „minus 40 € uebrig" ist keine Aussage. */
  remaining: number;
}

export function budgetSummary(categories: readonly MockCategory[], budget: number): BudgetSummary {
  const spent = categories.reduce(
    (sum, category) => sum + SHARE_SLOTS.reduce((inner, slot) => inner + category.shares[slot], 0),
    0,
  );
  return {
    spent,
    pct: budget <= 0 ? (spent > 0 ? 100 : 0) : (spent / budget) * 100,
    remaining: Math.max(0, budget - spent),
  };
}
