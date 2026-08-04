import type { PersonSlot } from '@ralia/ui';

/**
 * Demo-Daten aus der Design-Vorlage (Z. 1063–1147, Todo-Listen Z. 1357–1361).
 *
 * NUR FUER SP0: sie fuellen die Screens, damit sie beurteilbar sind. SP2 bis SP4
 * ersetzen sie durch Repositories gegen Supabase; diese Datei faellt dann weg.
 * Nichts auszerhalb von apps/app/src/screens und apps/app/src/sheets darf sie
 * importieren.
 *
 * Feldnamen sind ausgeschrieben: d → iso, t → title, s → start, e → end,
 * who → slot, loc → location, g → listId, wd → weekday, num → dayOfMonth.
 */

/** Das fiktive Heute der Vorlage (Z. 1075). Alle Daten haengen daran. */
export const MOCK_TODAY = '2026-07-29';

/** Vorlage Z. 1076–1077. */
export const WEEKDAYS_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] as const;
export const MONTH_NAMES = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
] as const;

export interface MockEvent {
  iso: string;
  title: string;
  /** `HH:MM` oder leer bei ganztaegig. */
  start: string;
  end: string;
  slot: PersonSlot;
  location: string;
}

/** Vorlage Z. 1079–1105. */
export const MOCK_EVENTS: readonly MockEvent[] = [
  {
    iso: '2026-07-01',
    title: 'Zahnarzt',
    start: '09:00',
    end: '10:00',
    slot: 'u1',
    location: 'Praxis Dr. Feld',
  },
  {
    iso: '2026-07-03',
    title: 'Yoga',
    start: '19:00',
    end: '20:15',
    slot: 'u2',
    location: 'Studio Balance',
  },
  {
    iso: '2026-07-04',
    title: 'Grillen bei Mia',
    start: '17:00',
    end: '22:00',
    slot: 'both',
    location: 'Mia & Tom',
  },
  { iso: '2026-07-07', title: 'Physio', start: '08:30', end: '09:15', slot: 'u2', location: '' },
  {
    iso: '2026-07-08',
    title: 'Sprint Review',
    start: '11:00',
    end: '12:00',
    slot: 'u1',
    location: 'Büro',
  },
  {
    iso: '2026-07-10',
    title: 'Kino: Dune 3',
    start: '20:30',
    end: '23:00',
    slot: 'both',
    location: 'Astor',
  },
  {
    iso: '2026-07-13',
    title: 'Team-Offsite',
    start: '09:00',
    end: '17:00',
    slot: 'u1',
    location: 'Starnberg',
  },
  { iso: '2026-07-15', title: 'Lenas Geburtstag', start: '', end: '', slot: 'bday', location: '' },
  {
    iso: '2026-07-15',
    title: 'Essen mit Lenas Eltern',
    start: '18:30',
    end: '21:30',
    slot: 'both',
    location: '',
  },
  {
    iso: '2026-07-18',
    title: 'Wandern Isartal',
    start: '10:00',
    end: '16:00',
    slot: 'both',
    location: '',
  },
  { iso: '2026-07-21', title: 'Friseur', start: '16:00', end: '17:00', slot: 'u2', location: '' },
  {
    iso: '2026-07-22',
    title: 'Elternabend Chor',
    start: '19:00',
    end: '20:30',
    slot: 'u2',
    location: '',
  },
  {
    iso: '2026-07-24',
    title: 'Team-Dinner',
    start: '19:30',
    end: '23:00',
    slot: 'u1',
    location: 'Ratskeller',
  },
  {
    iso: '2026-07-27',
    title: 'Sport',
    start: '18:00',
    end: '19:30',
    slot: 'u1',
    location: 'Fitness Nord',
  },
  { iso: '2026-07-28', title: 'Physio', start: '08:30', end: '09:15', slot: 'u2', location: '' },
  {
    iso: '2026-07-28',
    title: 'Call Vermieter',
    start: '17:00',
    end: '17:30',
    slot: 'both',
    location: '',
  },
  {
    iso: '2026-07-29',
    title: 'Zahnarzt',
    start: '09:00',
    end: '10:00',
    slot: 'u1',
    location: 'Praxis Dr. Feld',
  },
  {
    iso: '2026-07-29',
    title: 'Yoga',
    start: '19:00',
    end: '20:15',
    slot: 'u2',
    location: 'Studio Balance',
  },
  {
    iso: '2026-07-29',
    title: 'Abendessen Marco',
    start: '20:30',
    end: '23:00',
    slot: 'both',
    location: 'Trattoria Sole',
  },
  { iso: '2026-07-30', title: 'Buchclub', start: '19:30', end: '21:30', slot: 'u2', location: '' },
  {
    iso: '2026-07-31',
    title: 'Feierabendbier',
    start: '17:30',
    end: '19:00',
    slot: 'u1',
    location: '',
  },
  {
    iso: '2026-07-31',
    title: 'Kino Open Air',
    start: '21:00',
    end: '23:30',
    slot: 'both',
    location: 'Olympiapark',
  },
  {
    iso: '2026-08-01',
    title: 'Wochenmarkt',
    start: '10:00',
    end: '11:30',
    slot: 'both',
    location: '',
  },
  {
    iso: '2026-08-01',
    title: 'Hochzeit Anna & Tim',
    start: '15:00',
    end: '23:00',
    slot: 'both',
    location: 'Gut Kaltenbrunn',
  },
  {
    iso: '2026-08-02',
    title: 'Brunch bei Eltern',
    start: '11:00',
    end: '14:00',
    slot: 'both',
    location: '',
  },
];

export interface MockTodoItem {
  id: string;
  listId: string;
  text: string;
  done: boolean;
  slot: PersonSlot;
  note: string;
}

/** Vorlage Z. 1107–1119. */
export const MOCK_TODOS: readonly MockTodoItem[] = [
  { id: 't1', listId: 'einkauf', text: 'Haferflocken', done: false, slot: 'u2', note: '2 Pack' },
  { id: 't2', listId: 'einkauf', text: 'Tomaten & Basilikum', done: false, slot: 'u1', note: '' },
  { id: 't3', listId: 'einkauf', text: 'Spülmaschinentabs', done: true, slot: 'u1', note: '' },
  { id: 't4', listId: 'einkauf', text: 'Kaffeebohnen', done: false, slot: 'u1', note: '1 kg' },
  { id: 't5', listId: 'einkauf', text: 'Hafermilch', done: false, slot: 'u2', note: '6x' },
  {
    id: 't6',
    listId: 'erled',
    text: 'Paket zurückschicken',
    done: false,
    slot: 'u2',
    note: 'bis Fr',
  },
  { id: 't7', listId: 'erled', text: 'Versicherung kündigen', done: false, slot: 'u1', note: '' },
  { id: 't8', listId: 'erled', text: 'Reifen wechseln lassen', done: false, slot: 'u1', note: '' },
  { id: 't9', listId: 'erled', text: 'Geschenk für Mia', done: true, slot: 'u2', note: '' },
  {
    id: 't10',
    listId: 'urlaub',
    text: 'Flüge Lissabon vergleichen',
    done: false,
    slot: 'u1',
    note: 'Sep',
  },
  { id: 't11', listId: 'urlaub', text: 'Ferienwohnung anfragen', done: true, slot: 'u2', note: '' },
];

export interface MockTodoList {
  id: string;
  title: string;
  /** Token-Referenz, kein Literal — die Vorlage nutzt hier Hex, wir das Theme. */
  color: string;
  initial: string;
}

/**
 * Vorlage Z. 1357–1361. Die Farben stehen dort als Hex (#8b5cf6, #3b82f6,
 * #ec4899) — das sind genau die Werte von --both, --u1 und --u2, also nehmen
 * wir die Tokens und nicht die Literale.
 */
export const MOCK_TODO_LISTS: readonly MockTodoList[] = [
  { id: 'einkauf', title: 'Einkaufsliste', color: 'var(--both)', initial: 'EK' },
  { id: 'erled', title: 'Erledigungen', color: 'var(--u1)', initial: 'TO' },
  { id: 'urlaub', title: 'Urlaub Portugal', color: 'var(--u2)', initial: 'PT' },
];

export interface MockPlannerTask {
  id: string;
  text: string;
  done: boolean;
  slot: PersonSlot;
}

export interface MockPlannerDay {
  weekday: string;
  dayOfMonth: number;
  meal: string;
  tasks: readonly MockPlannerTask[];
}

/** Vorlage Z. 1121–1129. */
export const MOCK_PLANNER: readonly MockPlannerDay[] = [
  {
    weekday: 'Mo',
    dayOfMonth: 27,
    meal: 'Ofengemüse mit Feta',
    tasks: [
      { id: 'p1', text: 'Wäsche aufhängen', done: true, slot: 'u2' },
      { id: 'p2', text: 'Müll rausbringen', done: false, slot: 'u1' },
    ],
  },
  {
    weekday: 'Di',
    dayOfMonth: 28,
    meal: 'Linsen-Dal',
    tasks: [{ id: 'p3', text: 'Einkauf Rewe', done: true, slot: 'u1' }],
  },
  {
    weekday: 'Mi',
    dayOfMonth: 29,
    meal: 'Auswärts: Trattoria Sole',
    tasks: [
      { id: 'p4', text: 'Bad putzen', done: false, slot: 'u2' },
      { id: 'p5', text: 'Pflanzen gießen', done: false, slot: 'u1' },
    ],
  },
  {
    weekday: 'Do',
    dayOfMonth: 30,
    meal: 'Pasta al limone',
    tasks: [{ id: 'p6', text: 'Rechnung Strom prüfen', done: false, slot: 'u1' }],
  },
  {
    weekday: 'Fr',
    dayOfMonth: 31,
    meal: 'Pizza selbst gemacht',
    tasks: [{ id: 'p7', text: 'Getränke holen', done: false, slot: 'u2' }],
  },
  {
    weekday: 'Sa',
    dayOfMonth: 1,
    meal: '',
    tasks: [{ id: 'p8', text: 'Wochenmarkt', done: false, slot: 'both' }],
  },
  { weekday: 'So', dayOfMonth: 2, meal: 'Brunch bei Eltern', tasks: [] },
];

export interface MockCategory {
  name: string;
  limit: number;
  shares: Record<'u1' | 'u2' | 'both', number>;
}

/** Vorlage Z. 1131–1137. */
export const MOCK_CATEGORIES: readonly MockCategory[] = [
  { name: 'Wohnen', limit: 800, shares: { u1: 780, u2: 0, both: 0 } },
  { name: 'Lebensmittel', limit: 550, shares: { u1: 243.2, u2: 243.2, both: 0 } },
  { name: 'Freizeit', limit: 300, shares: { u1: 52.2, u2: 42.0, both: 120.0 } },
  { name: 'Transport', limit: 150, shares: { u1: 0, u2: 96.6, both: 0 } },
  { name: 'Sonstiges', limit: 200, shares: { u1: 45.0, u2: 40.0, both: 25.0 } },
];

export interface MockExpense {
  title: string;
  slot: PersonSlot;
  category: string;
  /** Anzeigeform der Vorlage, kein ISO-Datum: „28. Juli". */
  date: string;
  amount: number;
  split: string;
}

/** Vorlage Z. 1139–1147. */
export const MOCK_EXPENSES: readonly MockExpense[] = [
  {
    title: 'Rewe Großeinkauf',
    slot: 'u1',
    category: 'Lebensmittel',
    date: '28. Juli',
    amount: 62.4,
    split: '50/50',
  },
  {
    title: 'Kino Open Air Tickets',
    slot: 'u2',
    category: 'Freizeit',
    date: '27. Juli',
    amount: 28.0,
    split: '50/50',
  },
  {
    title: 'Miete August',
    slot: 'u1',
    category: 'Wohnen',
    date: '26. Juli',
    amount: 780.0,
    split: '50/50',
  },
  {
    title: 'Tankstelle',
    slot: 'u2',
    category: 'Transport',
    date: '25. Juli',
    amount: 71.3,
    split: '50/50',
  },
  {
    title: 'Drogerie',
    slot: 'u2',
    category: 'Sonstiges',
    date: '24. Juli',
    amount: 34.8,
    split: 'nur Lena',
  },
  {
    title: 'Bio-Markt',
    slot: 'u1',
    category: 'Lebensmittel',
    date: '23. Juli',
    amount: 41.9,
    split: '50/50',
  },
  {
    title: 'Konzerttickets',
    slot: 'both',
    category: 'Freizeit',
    date: '21. Juli',
    amount: 120.0,
    split: 'Gem. Konto',
  },
];

export interface MockPerson {
  name: string;
  email: string;
  /** `YYYY-MM-DD` */
  birthday: string;
  slot: PersonSlot;
  initial: string;
}

/** Vorlage Z. 1063 (`me`) und Z. 474–475 (Partner). */
export const MOCK_PROFILE = {
  me: {
    name: 'Jonas Berger',
    email: 'jonas.berger@gmail.com',
    birthday: '1993-09-04',
    slot: 'u1',
    initial: 'J',
  } satisfies MockPerson,
  partner: {
    name: 'Lena Wolf',
    email: 'lena.wolf@gmail.com',
    birthday: '1994-07-15',
    slot: 'u2',
    initial: 'L',
  } satisfies MockPerson,
  /** Vorlage Z. 475: „verbunden seit 12.03.2024 · alles geteilt". */
  connectedSince: '12.03.2024',
  inviteCode: 'R7K2QM',
} as const;

/** Vorlage Z. 1073: die fuenf Quellkalender der Sync-Unterseite. */
export const MOCK_CALENDARS: readonly {
  id: string;
  label: string;
  slot: PersonSlot;
  on: boolean;
}[] = [
  { id: 'j_privat', label: 'Jonas · Privat', slot: 'u1', on: true },
  { id: 'j_arbeit', label: 'Jonas · Arbeit', slot: 'u1', on: true },
  { id: 'l_privat', label: 'Lena · Privat', slot: 'u2', on: true },
  { id: 'l_chor', label: 'Lena · Chor', slot: 'u2', on: false },
  { id: 'feiertage', label: 'Feiertage Bayern', slot: 'both', on: true },
];

/** Vorlage Z. 471–478: die Bilanzwerte des Geld-Screens. */
export const MOCK_BALANCE = {
  u1Total: 1024.1,
  u2Total: 663.1,
  owedLabel: 'Lena schuldet Jonas',
  owedAmount: 180.5,
  expenseCount: 14,
  monthlyBudget: 2000,
} as const;
