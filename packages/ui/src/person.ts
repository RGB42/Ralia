/**
 * Das Personen-Vokabular des UI. Die Zuordnung von `belongs_to` und
 * `event_type` der Datenbank auf diese Slots gehört nach SP2 — `packages/ui`
 * darf die Datenbank nicht kennen.
 */
export type PersonSlot = 'u1' | 'u2' | 'both' | 'bday';

export const PERSON_SLOTS: readonly PersonSlot[] = ['u1', 'u2', 'both', 'bday'];

export interface PersonTokens {
  /** Farbbalken / Punkt — in beiden Themes identisch. */
  bar: string;
  /** Flächenhintergrund für Chips und Karten. */
  bg: string;
  /** Schriftfarbe auf `bg`. */
  fg: string;
}

/** Liefert Token-Referenzen, nie Literale — damit Themes greifen. */
export function personTokens(slot: PersonSlot): PersonTokens {
  return {
    bar: `var(--${slot})`,
    bg: `var(--${slot}-bg)`,
    fg: `var(--${slot}-fg)`,
  };
}
