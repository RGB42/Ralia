/**
 * Wie viele Ereignisse eine Monatszelle zeigt.
 *
 * Die Vorlage leitete das aus `window.innerHeight - 90` ab, wobei die 90 px
 * ihre eigene Prototyp-Kopfleiste waren. Hier kommt die Rasterhoehe aus einer
 * echten Messung; Regel und Schwellwerte sind unveraendert.
 */

/** Chiphoehe 16 px + 3 px Abstand (Vorlage Z. 163, Z. 1258). */
export const MONTH_CHIP_HEIGHT_PX = 19;
/** 12 px Zellpadding + 20 px Tagesnummer + 3 px Abstand (Vorlage Z. 1257). */
export const MONTH_CELL_CHROME_PX = 35;
export const MONTH_MAX_CHIPS = 3;
export const MONTH_MAX_DOTS = 5;
export const MONTH_ROW_COUNT = 6;

export interface MonthDensity {
  mode: 'chips' | 'dots';
  maxChips: number;
  maxDots: number;
}

const DOTS: MonthDensity = { mode: 'dots', maxChips: 0, maxDots: MONTH_MAX_DOTS };

export function monthDensity(gridHeightPx: number): MonthDensity {
  if (!Number.isFinite(gridHeightPx) || gridHeightPx <= 0) return DOTS;
  const rowHeight = gridHeightPx / MONTH_ROW_COUNT;
  const available = rowHeight - MONTH_CELL_CHROME_PX;
  const maxChips = Math.min(MONTH_MAX_CHIPS, Math.floor(available / MONTH_CHIP_HEIGHT_PX));
  return maxChips < 1 ? DOTS : { mode: 'chips', maxChips, maxDots: 0 };
}
