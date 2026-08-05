/** Geometrie der Wochen-Timeline. Werte wertgenau aus der Vorlage (Z. 1297–1305). */

export const WEEK_HOUR_HEIGHT_PX = 52;
export const WEEK_MIN_EVENT_HEIGHT_PX = 26;
/** Luft nach unten, damit aufeinanderfolgende Termine nicht verkleben. */
export const WEEK_EVENT_HEIGHT_INSET_PX = 3;
/** Nachtstunden bleiben eingeklappt, bis der Nutzer sie aufklappt. */
export const WEEK_DEFAULT_START_HOUR = 6;
export const WEEK_EXPANDED_START_HOUR = 0;

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** `null` statt Wurf: die Vorlage behandelt ganztaegige Termine als „keine Zeit". */
export function parseTimeToMinutes(value: string): number | null {
  const match = TIME_RE.exec(value);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export interface WeekEventGeometry {
  topPx: number;
  heightPx: number;
}

export function weekEventGeometry(
  startMinutes: number,
  endMinutes: number,
  dayStartHour: number,
): WeekEventGeometry {
  const offset = dayStartHour * 60;
  const topPx = (Math.max(0, startMinutes - offset) / 60) * WEEK_HOUR_HEIGHT_PX;
  const heightPx = Math.max(
    WEEK_MIN_EVENT_HEIGHT_PX,
    ((endMinutes - startMinutes) / 60) * WEEK_HOUR_HEIGHT_PX - WEEK_EVENT_HEIGHT_INSET_PX,
  );
  return { topPx, heightPx };
}
