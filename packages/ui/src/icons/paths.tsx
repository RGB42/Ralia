import type { ReactNode } from 'react';

/**
 * Die Icon-Geometrie der Vorlage, woertlich uebernommen.
 *
 * `meal` und `task` tragen dort feste Strichfarben (`#f97316`, `#3b82f6`).
 * Die bleiben hier weg: die Farbe kommt ueber `currentColor` vom Aufrufer,
 * sonst wuerden diese zwei Icons das Theme ignorieren. Die Screens setzen
 * sie auf `var(--bday)` bzw. `var(--u1)` — dieselben Farbwerte.
 */
export const ICON_NAMES = [
  'calendar',
  'planner',
  'todos',
  'money',
  'settings',
  'meal',
  'task',
] as const;
export type IconName = (typeof ICON_NAMES)[number];

interface IconDef {
  body: ReactNode;
  linecap?: 'round';
  linejoin?: 'round';
}

export const ICON_DEFS: Record<IconName, IconDef> = {
  // Vorlage Z. 84
  calendar: {
    body: (
      <>
        <rect x="2.5" y="4" width="15" height="13.5" rx="3" />
        <line x1="2.5" y1="8" x2="17.5" y2="8" />
        <line x1="6.5" y1="2.5" x2="6.5" y2="5" />
        <line x1="13.5" y1="2.5" x2="13.5" y2="5" />
      </>
    ),
  },
  // Vorlage Z. 87
  planner: {
    body: (
      <>
        <rect x="2.5" y="3" width="15" height="14.5" rx="3" />
        <line x1="6" y1="7.5" x2="14" y2="7.5" />
        <line x1="6" y1="11" x2="14" y2="11" />
        <line x1="6" y1="14" x2="11" y2="14" />
      </>
    ),
  },
  // Vorlage Z. 90
  todos: {
    body: (
      <>
        <rect x="2.5" y="3" width="5" height="5" rx="1.5" />
        <rect x="2.5" y="12" width="5" height="5" rx="1.5" />
        <line x1="10.5" y1="5.5" x2="17.5" y2="5.5" />
        <line x1="10.5" y1="14.5" x2="17.5" y2="14.5" />
      </>
    ),
  },
  // Vorlage Z. 93
  money: {
    body: (
      <>
        <circle cx="10" cy="10" r="7.2" />
        <line x1="10" y1="5.6" x2="10" y2="14.4" />
        <line x1="7.6" y1="8" x2="12.4" y2="8" />
      </>
    ),
  },
  // Vorlage Z. 96
  settings: {
    body: (
      <>
        <circle cx="10" cy="10" r="2.6" />
        <circle cx="10" cy="10" r="7" />
      </>
    ),
  },
  // Vorlage Z. 249
  meal: {
    body: (
      <>
        <path d="M5.5 2.5v6.5a2 2 0 0 0 4 0V2.5" />
        <line x1="7.5" y1="9" x2="7.5" y2="17.5" />
        <path d="M14 2.5c1.6 1 2.4 2.6 2.4 4.4 0 1.6-.8 2.6-2.4 3.1v7.5" />
      </>
    ),
    linecap: 'round',
  },
  // Vorlage Z. 257
  task: {
    body: (
      <>
        <polyline points="3,10.5 6.5,14 10.5,6" />
        <line x1="13" y1="6" x2="17.5" y2="6" />
        <line x1="13" y1="13" x2="17.5" y2="13" />
      </>
    ),
    linecap: 'round',
    linejoin: 'round',
  },
};
