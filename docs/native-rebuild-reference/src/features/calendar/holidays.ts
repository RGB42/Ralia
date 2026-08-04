import { readLocalJson, writeLocalJson } from '@/lib/storage';

export interface Holiday {
  /** YYYY-MM-DD */
  date: string;
  /** English name from the API. */
  name: string;
  /** Localised name ("Tag der Deutschen Einheit"); preferred for display in German. */
  localName: string;
  /** False for regional holidays, which only apply to the listed `counties`. */
  isGlobal: boolean;
  /** ISO subdivision codes, e.g. ["DE-BY"]. Empty/null means nationwide. */
  counties: string[] | null;
}

const CACHE_KEY = 'ralia:public-holidays';
const FETCHED_KEY = 'ralia:public-holidays-fetched';
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Nager.Date is free, needs no key, and is what the legacy web app already uses. */
const API = 'https://date.nager.at/api/v3/publicholidays';

interface NagerHoliday {
  date: string;
  localName: string;
  name: string;
  global: boolean;
  counties: string[] | null;
}

/**
 * Public holidays are never rows in `events` — they're a parallel lookup the
 * calendar consults at render time. That keeps them out of the shared calendar
 * data (no sync, no RLS, no per-couple duplication) and means changing region
 * doesn't require rewriting anything.
 */
export async function loadHolidays(countryCode = 'DE'): Promise<Holiday[]> {
  const cached = await readLocalJson<Holiday[]>(CACHE_KEY, []);
  const fetchedAt = await readLocalJson<number>(FETCHED_KEY, 0);
  const fresh = Date.now() - fetchedAt < TTL_MS;

  if (cached.length > 0) {
    // Serve the cache immediately; refresh in the background when it's stale so
    // the calendar never waits on the network to draw.
    if (!fresh) void refresh(countryCode);
    return cached;
  }

  const fetched = await fetchFromApi(countryCode);
  if (fetched.length > 0) {
    await persist(fetched);
    return fetched;
  }

  const fallback = builtInGermanHolidays();
  await persist(fallback);
  return fallback;
}

async function refresh(countryCode: string): Promise<void> {
  try {
    const fetched = await fetchFromApi(countryCode);
    if (fetched.length > 0) await persist(fetched);
  } catch {
    // Stale cache is fine; nothing to surface to the user.
  }
}

async function persist(holidays: Holiday[]): Promise<void> {
  await writeLocalJson(CACHE_KEY, holidays);
  await writeLocalJson(FETCHED_KEY, Date.now());
}

async function fetchFromApi(countryCode: string): Promise<Holiday[]> {
  const year = new Date().getFullYear();
  const years = [year - 1, year, year + 1, year + 2];
  const out: Holiday[] = [];

  // Sequential and individually guarded: one bad year shouldn't lose the others.
  for (const y of years) {
    try {
      const res = await fetch(`${API}/${y}/${countryCode}`);
      if (!res.ok) continue;
      const rows = (await res.json()) as NagerHoliday[];
      if (!Array.isArray(rows)) continue;
      for (const row of rows) {
        if (!row?.date) continue;
        out.push({
          date: row.date,
          name: row.name ?? '',
          localName: row.localName ?? row.name ?? '',
          isGlobal: row.global !== false,
          counties: row.counties ?? null,
        });
      }
    } catch {
      continue;
    }
  }

  return out;
}

/**
 * Indexes holidays by date, filtered to a region.
 *
 * `federalState` null means "show everything including regional holidays" —
 * that's the legacy default. Passing e.g. 'DE-BY' hides regional holidays that
 * don't apply to Bavaria.
 */
export function indexHolidays(
  holidays: Holiday[],
  federalState: string | null = null
): Map<string, Holiday> {
  const map = new Map<string, Holiday>();
  for (const h of holidays) {
    if (!h.isGlobal && federalState) {
      if (!h.counties || !h.counties.includes(federalState)) continue;
    }
    // First one wins so a nationwide entry isn't shadowed by a regional duplicate.
    if (!map.has(h.date)) map.set(h.date, h);
  }
  return map;
}

export function holidayDisplayName(holiday: Holiday, language: 'de' | 'en' = 'de'): string {
  return language === 'de' ? holiday.localName || holiday.name : holiday.name || holiday.localName;
}

/**
 * Offline fallback: the nine nationwide German holidays.
 *
 * Easter-derived dates are computed (Gauss's algorithm) rather than hardcoded per
 * year — the legacy app shipped a literal table that silently runs out after 2028.
 */
function builtInGermanHolidays(): Holiday[] {
  const thisYear = new Date().getFullYear();
  const out: Holiday[] = [];

  for (let y = thisYear - 1; y <= thisYear + 3; y++) {
    const easter = easterSunday(y);
    const add = (date: Date, localName: string, name: string) => {
      out.push({ date: fmt(date), localName, name, isGlobal: true, counties: null });
    };

    add(new Date(y, 0, 1), 'Neujahr', "New Year's Day");
    add(offset(easter, -2), 'Karfreitag', 'Good Friday');
    add(offset(easter, 1), 'Ostermontag', 'Easter Monday');
    add(new Date(y, 4, 1), 'Tag der Arbeit', 'Labour Day');
    add(offset(easter, 39), 'Christi Himmelfahrt', 'Ascension Day');
    add(offset(easter, 50), 'Pfingstmontag', 'Whit Monday');
    add(new Date(y, 9, 3), 'Tag der Deutschen Einheit', 'German Unity Day');
    add(new Date(y, 11, 25), 'Erster Weihnachtstag', 'Christmas Day');
    add(new Date(y, 11, 26), 'Zweiter Weihnachtstag', 'St. Stephen’s Day');
  }

  return out;
}

/** Anonymous Gregorian computus. */
function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3 = March, 4 = April
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function offset(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function fmt(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
