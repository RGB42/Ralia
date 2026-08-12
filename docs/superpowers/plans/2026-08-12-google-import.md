# Google-Kalender-Import · Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Termine aus ausgewählten Google-Kalendern nach Ralia holen — auf Knopfdruck oder alle zehn Minuten. Ralia schreibt nichts nach Google.

**Architecture:** Die Umrechnungs- und Vergleichslogik liegt framework-frei in `packages/core/src/google/` und ist ohne Netz vollständig testbar. Die Datenschicht spricht über `packages/data/src/google-sync-api.ts` mit der quellversionierten Edge Function `supabase/functions/google-sync-api/`. Tokens und Zuordnungen liegen im Schema `private`; der Client sieht sie nur durch `SECURITY DEFINER`-Funktionen, die nie ein Geheimnis zurückgeben.

**Tech Stack:** TypeScript strict, React 19 + Vite, Vitest, Supabase (Postgres + Deno Edge Functions), Google Calendar API v3.

Spec: [2026-08-12-google-sync-design.md](../specs/2026-08-12-google-sync-design.md). Abschnittsnummern unten verweisen dorthin.

## Global Constraints

- `packages/core` darf React, DOM-APIs und Supabase **nicht** importieren.
- UI-Code greift nie direkt auf Supabase zu — nur über die Datenschicht-Grenze.
- Migrationen sind additiv und vorwärts. Eine angewandte Migration wird nie umgeschrieben.
- Supabase-Projektreferenz: `nyvripddydrzvfuateea`.
- Kein Geheimnis in Repo, Test, Fixture, Log oder Commit.
- Redirect-URI, exakt:
  `https://nyvripddydrzvfuateea.supabase.co/functions/v1/google-sync-api/callback`
- Scope, exakt und einziger: `https://www.googleapis.com/auth/calendar.readonly`
- **Ralia führt gegen Google ausschließlich `GET` aus.** Ein `POST`, `PATCH`, `PUT` oder
  `DELETE` gegen `googleapis.com` ist in diesem Projekt ein Fehler, kein Feature.
- Zeitzone kommt aus `google_connections.time_zone`, Rückfall `Europe/Berlin` (Spec 5).
- Geschrieben wird ganztägig immer als `00:00`–`23:59` (Spec 6).
- Nach jedem Task: `npm run verify` muss grün sein.
- Tests werden auf Deutsch beschrieben, wie im übrigen Repo.
- Neue i18n-Schlüssel gehören nach `apps/app/src/i18n/additions.json` **und** nach `de.json`
  und `en.json` (alphabetisch einsortiert). `additions.json` überlebt ein `i18n:extract`,
  die beiden Kataloge sind das, was `catalog.ts` lädt.

## Die drei Sicherheitsregeln

Sie stehen hier, weil jede Aufgabe sie einhalten muss:

1. Der Import fasst **ausschließlich Termine an, die er selbst angelegt hat** — erkennbar an
   einer Zeile in `google_event_mappings`. Ein von Hand erstellter Ralia-Termin ist
   unerreichbar.
2. Der erste Lauf jeder Bindung ist ein **Probelauf** und schreibt nichts.
3. **Gelöscht wird nie.** Ein in Google gelöschter Termin bleibt in Ralia stehen und wird
   nur protokolliert.

---

## File Structure

**Neu in `packages/core/src/google/`** — rein, ohne Netz, ohne DOM:

| Datei               | Verantwortung                                                        |
| ------------------- | -------------------------------------------------------------------- |
| `all-day.ts`        | `isAllDay()` — die eine Ableitung, beide Konventionen (Spec 6)       |
| `zoned-time.ts`     | `zonedWallClock()` — Google-Zeitpunkt → schwebende Ortszeit (Spec 5) |
| `import-mapping.ts` | Google-Event → Ralia-Felder, Serienerkennung, Fingerabdruck (Spec 9) |
| `index.ts`          | Re-Export                                                            |

**Neu in `packages/data/src/`:**

| Datei                | Verantwortung                                     |
| -------------------- | ------------------------------------------------- |
| `google-sync-api.ts` | HTTP-Klient, nach dem Muster von `privacy-api.ts` |

**Neu in `supabase/`:**

| Datei                                 | Verantwortung                         |
| ------------------------------------- | ------------------------------------- |
| `migrations/…_add_google_import.sql`  | `private`-Schema, alle Tabellen, RPCs |
| `functions/google-sync-api/index.ts`  | Routing, Auth, CORS                   |
| `functions/google-sync-api/crypto.ts` | AES-GCM für das Refresh-Token         |
| `functions/google-sync-api/oauth.ts`  | PKCE, State, Token-Tausch             |
| `functions/google-sync-api/google.ts` | Google-Leseaufrufe                    |
| `functions/google-sync-api/run.ts`    | Der Import-Lauf inkl. Probelauf       |

**Geändert:**

| Datei                                              | Änderung                                |
| -------------------------------------------------- | --------------------------------------- |
| `packages/data/src/auth/session.ts`                | `googleSyncState` in `LEGACY_AUTH_KEYS` |
| `apps/app/src/screens/calendar/CalendarScreen.tsx` | benutzt `isAllDay()` aus core           |
| `apps/app/src/screens/settings/SyncScreen.tsx`     | Attrappe raus, echter Zustand rein      |
| `apps/app/src/mock/fixtures.ts`                    | die vier Sync-Fixtures raus             |
| `apps/app/src/data/DataProvider.tsx`               | stellt den Sync-Klienten bereit         |

---

## Task 1: `googleSyncState` überlebt die Abmeldung nicht mehr

Spec 14.2. Ein Legacy-Schlüssel aus Ralia 1.x, den `clearAuthData()` heute stehen lässt.
Muss weg, bevor neuer Google-Zustand entsteht.

**Files:**

- Modify: `packages/data/src/auth/session.ts`
- Test: `packages/data/src/auth/session.test.ts`

**Interfaces:**

- Consumes: nichts.
- Produces: nichts Neues; `clearAuthData(storage: Storage): void` bleibt in der Signatur.

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

In `packages/data/src/auth/session.test.ts`, innerhalb von `describe('clearAuthData', …)`,
mit dem Speicher-Helfer, den die umliegenden Tests dort schon benutzen:

```ts
it('raeumt den Legacy-Schluessel googleSyncState', () => {
  const storage = memoryStorage();
  storage.setItem('googleSyncState', '{"connected":true}');

  clearAuthData(storage);

  expect(storage.getItem('googleSyncState')).toBeNull();
});
```

- [ ] **Step 2: Lauf zeigen lassen, dass er fehlschlägt**

Run: `npx vitest run packages/data/src/auth/session.test.ts -t googleSyncState`
Expected: FAIL — `expected '{"connected":true}' to be null`

- [ ] **Step 3: Den Schlüssel eintragen**

In `packages/data/src/auth/session.ts`, in `LEGACY_AUTH_KEYS`:

```ts
  // Rest des Google-Syncs aus Ralia 1.x. Ohne diesen Eintrag ueberlebt alter
  // Verbindungszustand die Abmeldung und mischt sich mit dem neuen.
  'googleSyncState',
```

- [ ] **Step 4: Lauf zeigen lassen, dass er besteht**

Run: `npx vitest run packages/data/src/auth/session.test.ts`
Expected: PASS

- [ ] **Step 5: Committen**

```bash
git add packages/data/src/auth && git commit -m "fix(data): clearAuthData raeumt den Legacy-Schluessel googleSyncState"
```

---

## Task 2: `isAllDay()` nach `@ralia/core`, beide Konventionen lesend

Spec 6. `database.types.ts` behauptet, diese Ableitung liege in `@ralia/core` — sie liegt
dort nicht. In Produktion stehen 363 Zeilen als `00:00`–`23:59` und 102 als `00:00`–`00:00`;
die zweite Gruppe zeigt der Client heute als Termin von Mitternacht bis Mitternacht.

**Files:**

- Create: `packages/core/src/google/all-day.ts`
- Create: `packages/core/src/google/all-day.test.ts`
- Create: `packages/core/src/google/index.ts`
- Modify: `packages/core/src/index.ts`
- Modify: `apps/app/src/screens/calendar/CalendarScreen.tsx:523`

**Interfaces:**

- Consumes: nichts.
- Produces: `isAllDay(event: AllDayCandidate): boolean`,
  `interface AllDayCandidate { start_time: string; end_time: string }`. Task 3 benutzt beides.

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

Create `packages/core/src/google/all-day.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { isAllDay } from './all-day.js';

describe('isAllDay', () => {
  it('erkennt die Konvention des neuen Clients', () => {
    expect(isAllDay({ start_time: '00:00', end_time: '23:59' })).toBe(true);
  });

  /**
   * 102 Zeilen in Produktion tragen diese Form. Ralia 1.x hat sie so
   * geschrieben; ohne diesen Zweig zeigt der Client sie als Termin von
   * Mitternacht bis Mitternacht.
   */
  it('erkennt die Konvention aus Ralia 1.x', () => {
    expect(isAllDay({ start_time: '00:00', end_time: '00:00' })).toBe(true);
  });

  it('vertraegt die Sekunden, die Postgres mitliefert', () => {
    expect(isAllDay({ start_time: '00:00:00', end_time: '23:59:00' })).toBe(
      true,
    );
  });

  it('haelt einen echten Zeitraum nicht fuer ganztaegig', () => {
    expect(isAllDay({ start_time: '09:00', end_time: '17:30' })).toBe(false);
  });

  it('haelt einen Termin ab Mitternacht mit echtem Ende nicht fuer ganztaegig', () => {
    expect(isAllDay({ start_time: '00:00', end_time: '06:00' })).toBe(false);
  });
});
```

- [ ] **Step 2: Lauf zeigen lassen, dass er fehlschlägt**

Run: `npx vitest run packages/core/src/google/all-day.test.ts`
Expected: FAIL — `Failed to resolve import "./all-day.js"`

- [ ] **Step 3: Die Ableitung schreiben**

Create `packages/core/src/google/all-day.ts`:

```ts
export interface AllDayCandidate {
  start_time: string;
  end_time: string;
}

/**
 * Ganztaegig wird abgeleitet, nicht gespeichert — es gibt bewusst keine
 * `all_day`-Spalte.
 *
 * Gelesen werden zwei Konventionen: `00:00`–`23:59` schreibt der neue Client,
 * `00:00`–`00:00` stammt aus Ralia 1.x und steht in Produktion 102 Mal.
 * Geschrieben wird weiterhin nur die erste.
 */
export function isAllDay(event: AllDayCandidate): boolean {
  const start = event.start_time.slice(0, 5);
  const end = event.end_time.slice(0, 5);
  return start === '00:00' && (end === '23:59' || end === '00:00');
}
```

Create `packages/core/src/google/index.ts`:

```ts
export { isAllDay, type AllDayCandidate } from './all-day.js';
```

In `packages/core/src/index.ts` ergänzen, in der Form der umliegenden Zeilen:

```ts
export { isAllDay, type AllDayCandidate } from './google/index.js';
```

- [ ] **Step 4: Lauf zeigen lassen, dass er besteht**

Run: `npx vitest run packages/core/src/google/all-day.test.ts`
Expected: PASS, 5 Tests

- [ ] **Step 5: Den Client auf die gemeinsame Ableitung umstellen**

In `apps/app/src/screens/calendar/CalendarScreen.tsx`:

```ts
const allDay =
  row.start_time.startsWith('00:00') && row.end_time.startsWith('23:59');
```

wird zu

```ts
const allDay = isAllDay(row);
```

mit `isAllDay` aus `@ralia/core`, einsortiert zu den übrigen `@ralia/core`-Importen.

- [ ] **Step 6: Die ganze Suite laufen lassen**

Run: `npm test`
Expected: PASS. Schlägt ein Kalendertest fehl, weil er einen `00:00`–`00:00`-Termin bisher
als Zeitraum erwartet hat, ist **der Test** anzupassen — die neue Erwartung ist die richtige.

- [ ] **Step 7: Committen**

```bash
git add packages/core/src apps/app/src/screens/calendar && git commit -m "fix(core): isAllDay liest beide Ganztags-Konventionen"
```

---

## Task 3: Google-Termin → Ralia-Felder

Spec 5, 6 und 9. Der Kern der Sache, und komplett ohne Netz testbar.

**Files:**

- Create: `packages/core/src/google/zoned-time.ts`
- Create: `packages/core/src/google/zoned-time.test.ts`
- Create: `packages/core/src/google/import-mapping.ts`
- Create: `packages/core/src/google/import-mapping.test.ts`
- Modify: `packages/core/src/google/index.ts`, `packages/core/src/index.ts`

**Interfaces:**

- Consumes: `isAllDay` (Task 2).
- Produces:

```ts
function zonedWallClock(
  instant: string,
  timeZone: string,
): { date: string; time: string };
function addDays(isoDate: string, days: number): string;

interface GoogleEvent {
  id: string;
  status?: string;
  summary?: string;
  location?: string;
  description?: string;
  recurrence?: string[];
  recurringEventId?: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
}

interface ImportedEventFields {
  name: string;
  location: string | null;
  notes: string | null;
  start_date: string;
  start_time: string;
  end_date: string;
  end_time: string;
}

function isRecurringGoogleEvent(event: GoogleEvent): boolean;
function isCancelledGoogleEvent(event: GoogleEvent): boolean;
function fromGoogleEvent(
  event: GoogleEvent,
  timeZone: string,
): ImportedEventFields;
function fingerprintImportedEvent(fields: ImportedEventFields): string;
```

Task 6 benutzt alle sechs.

- [ ] **Step 1: Den fehlschlagenden Zeitzonen-Test schreiben**

Create `packages/core/src/google/zoned-time.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { addDays, zonedWallClock } from './zoned-time.js';

describe('zonedWallClock', () => {
  it('behaelt die Wanduhrzeit, wenn der Versatz zur Zone passt', () => {
    expect(
      zonedWallClock('2026-08-12T10:00:00+02:00', 'Europe/Berlin'),
    ).toEqual({
      date: '2026-08-12',
      time: '10:00',
    });
  });

  it('rechnet UTC in die Sommerzeit der Zone um', () => {
    expect(zonedWallClock('2026-08-12T08:00:00Z', 'Europe/Berlin')).toEqual({
      date: '2026-08-12',
      time: '10:00',
    });
  });

  it('rechnet UTC in die Winterzeit der Zone um', () => {
    expect(zonedWallClock('2026-01-15T09:00:00Z', 'Europe/Berlin')).toEqual({
      date: '2026-01-15',
      time: '10:00',
    });
  });

  /**
   * Die Umstellungsnacht ist die Stelle, an der eine selbstgebaute
   * Versatz-Rechnung schiefgeht: 2026 springt Europa am 29. Maerz um 01:00 UTC
   * von 02:00 auf 03:00 Ortszeit.
   */
  it('trifft beide Seiten der Zeitumstellung', () => {
    expect(zonedWallClock('2026-03-29T00:30:00Z', 'Europe/Berlin').time).toBe(
      '01:30',
    );
    expect(zonedWallClock('2026-03-29T01:30:00Z', 'Europe/Berlin').time).toBe(
      '03:30',
    );
  });

  it('rechnet auch in eine ganz andere Zone', () => {
    expect(
      zonedWallClock('2026-08-12T10:00:00+02:00', 'America/New_York'),
    ).toEqual({
      date: '2026-08-12',
      time: '04:00',
    });
  });

  it('schiebt ueber die Datumsgrenze, wenn die Zone es verlangt', () => {
    expect(zonedWallClock('2026-08-12T23:00:00Z', 'Europe/Berlin')).toEqual({
      date: '2026-08-13',
      time: '01:00',
    });
  });

  it('wirft bei einem unbrauchbaren Zeitpunkt, statt still etwas Falsches zu liefern', () => {
    expect(() => zonedWallClock('kein datum', 'Europe/Berlin')).toThrow();
  });
});

describe('addDays', () => {
  it('rechnet ueber die Monatsgrenze', () => {
    expect(addDays('2026-08-31', 1)).toBe('2026-09-01');
  });

  it('rechnet rueckwaerts ueber die Jahresgrenze', () => {
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31');
  });

  it('rechnet ueber den Schalttag', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  });
});
```

- [ ] **Step 2: Lauf zeigen lassen, dass er fehlschlägt**

Run: `npx vitest run packages/core/src/google/zoned-time.test.ts`
Expected: FAIL — `Failed to resolve import "./zoned-time.js"`

- [ ] **Step 3: Die Umrechnung schreiben**

Create `packages/core/src/google/zoned-time.ts`:

```ts
/**
 * Googles Zeitpunkt in die Wanduhrzeit einer Zone, danach ohne Versatz.
 *
 * Ueber `Intl.DateTimeFormat`, nicht ueber eigene Versatz-Rechnung: die Zonendaten
 * kennen die Umstellungstermine, ein selbstgebauter Offset kennt sie nicht.
 */
export function zonedWallClock(
  instant: string,
  timeZone: string,
): { date: string; time: string } {
  const at = new Date(instant);
  if (Number.isNaN(at.getTime()))
    throw new Error(`Kein gueltiger Zeitpunkt: ${instant}`);

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(at);

  const part = (type: string): string =>
    parts.find((entry) => entry.type === type)?.value ?? '';
  return {
    date: `${part('year')}-${part('month')}-${part('day')}`,
    time: `${part('hour')}:${part('minute')}`,
  };
}

/** Datumsrechnung ueber UTC, damit keine Zeitzone das Ergebnis verschiebt. */
export function addDays(isoDate: string, days: number): string {
  const at = new Date(`${isoDate}T00:00:00Z`);
  at.setUTCDate(at.getUTCDate() + days);
  return at.toISOString().slice(0, 10);
}
```

- [ ] **Step 4: Lauf zeigen lassen, dass er besteht**

Run: `npx vitest run packages/core/src/google/zoned-time.test.ts`
Expected: PASS, 10 Tests

- [ ] **Step 5: Den fehlschlagenden Abbildungs-Test schreiben**

Create `packages/core/src/google/import-mapping.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  fingerprintImportedEvent,
  fromGoogleEvent,
  isCancelledGoogleEvent,
  isRecurringGoogleEvent,
  type GoogleEvent,
} from './import-mapping.js';

function timed(overrides: Partial<GoogleEvent> = {}): GoogleEvent {
  return {
    id: 'g1',
    summary: 'Zahnarzt',
    start: { dateTime: '2026-08-12T10:00:00+02:00' },
    end: { dateTime: '2026-08-12T11:00:00+02:00' },
    ...overrides,
  };
}

describe('fromGoogleEvent', () => {
  it('uebernimmt Titel, Ort und Beschreibung', () => {
    const fields = fromGoogleEvent(
      timed({ location: 'Praxis Nord', description: 'Karte mitnehmen' }),
      'Europe/Berlin',
    );

    expect(fields.name).toBe('Zahnarzt');
    expect(fields.location).toBe('Praxis Nord');
    expect(fields.notes).toBe('Karte mitnehmen');
  });

  it('rechnet den Zeitpunkt in die Zone der Verbindung', () => {
    const fields = fromGoogleEvent(timed(), 'Europe/Berlin');

    expect(fields).toMatchObject({
      start_date: '2026-08-12',
      start_time: '10:00',
      end_date: '2026-08-12',
      end_time: '11:00',
    });
  });

  /**
   * Googles `end.date` ist ausschliesslich, Ralias `end_date` einschliesslich.
   * Ohne den Tag Abzug bekaeme jeder ganztaegige Termin einen Tag zu viel.
   */
  it('macht aus Googles ausschliesslichem Ende Ralias einschliessliches', () => {
    const fields = fromGoogleEvent(
      {
        id: 'g2',
        summary: 'Feiertag',
        start: { date: '2026-08-12' },
        end: { date: '2026-08-13' },
      },
      'Europe/Berlin',
    );

    expect(fields).toMatchObject({
      start_date: '2026-08-12',
      end_date: '2026-08-12',
      start_time: '00:00',
      end_time: '23:59',
    });
  });

  it('haelt einen mehrtaegigen Ganztags-Termin zusammen', () => {
    const fields = fromGoogleEvent(
      {
        id: 'g3',
        summary: 'Urlaub',
        start: { date: '2026-08-10' },
        end: { date: '2026-08-15' },
      },
      'Europe/Berlin',
    );

    expect(fields.start_date).toBe('2026-08-10');
    expect(fields.end_date).toBe('2026-08-14');
  });

  it('gibt einem Termin ohne Titel einen lesbaren Namen', () => {
    expect(
      fromGoogleEvent(timed({ summary: undefined }), 'Europe/Berlin').name,
    ).toBe('Ohne Titel');
  });

  it('macht aus fehlendem Ort und fehlender Beschreibung null, nicht leere Zeichenketten', () => {
    const fields = fromGoogleEvent(timed(), 'Europe/Berlin');

    expect(fields.location).toBeNull();
    expect(fields.notes).toBeNull();
  });
});

describe('isRecurringGoogleEvent', () => {
  it('erkennt den Serien-Master an der Regel', () => {
    expect(
      isRecurringGoogleEvent(timed({ recurrence: ['RRULE:FREQ=WEEKLY'] })),
    ).toBe(true);
  });

  it('erkennt eine Serien-Ausnahme an der Verknuepfung', () => {
    expect(isRecurringGoogleEvent(timed({ recurringEventId: 'g0' }))).toBe(
      true,
    );
  });

  it('haelt einen Einzeltermin nicht fuer eine Serie', () => {
    expect(isRecurringGoogleEvent(timed())).toBe(false);
  });
});

describe('isCancelledGoogleEvent', () => {
  it('erkennt einen in Google geloeschten Termin', () => {
    expect(isCancelledGoogleEvent(timed({ status: 'cancelled' }))).toBe(true);
  });

  it('haelt einen bestaetigten Termin nicht fuer geloescht', () => {
    expect(isCancelledGoogleEvent(timed({ status: 'confirmed' }))).toBe(false);
  });
});

describe('fingerprintImportedEvent', () => {
  it('bleibt gleich, solange die abgebildeten Felder gleich bleiben', () => {
    const a = fromGoogleEvent(timed(), 'Europe/Berlin');
    const b = fromGoogleEvent(timed(), 'Europe/Berlin');

    expect(fingerprintImportedEvent(a)).toBe(fingerprintImportedEvent(b));
  });

  it('aendert sich, wenn der Titel sich aendert', () => {
    expect(
      fingerprintImportedEvent(
        fromGoogleEvent(timed({ summary: 'Arzt' }), 'Europe/Berlin'),
      ),
    ).not.toBe(
      fingerprintImportedEvent(fromGoogleEvent(timed(), 'Europe/Berlin')),
    );
  });

  it('aendert sich, wenn die Uhrzeit sich aendert', () => {
    const spaeter = timed({ start: { dateTime: '2026-08-12T11:00:00+02:00' } });

    expect(
      fingerprintImportedEvent(fromGoogleEvent(spaeter, 'Europe/Berlin')),
    ).not.toBe(
      fingerprintImportedEvent(fromGoogleEvent(timed(), 'Europe/Berlin')),
    );
  });

  /**
   * Der Grund fuer den Fingerabdruck statt Googles ETag (Spec 9): an `events`
   * haengt trg_events_rebuild_reminder_jobs. Ein Schreibvorgang wegen einer
   * geaenderten Google-Erinnerung wuerde die Erinnerungs-Jobs neu bauen,
   * obwohl fachlich nichts passiert ist.
   */
  it('aendert sich nicht, wenn nur Felder ausserhalb der Abbildung sich aendern', () => {
    const mitAnhang = timed({ status: 'confirmed' });

    expect(
      fingerprintImportedEvent(fromGoogleEvent(mitAnhang, 'Europe/Berlin')),
    ).toBe(fingerprintImportedEvent(fromGoogleEvent(timed(), 'Europe/Berlin')));
  });
});
```

- [ ] **Step 6: Lauf zeigen lassen, dass er fehlschlägt**

Run: `npx vitest run packages/core/src/google/import-mapping.test.ts`
Expected: FAIL — `Failed to resolve import "./import-mapping.js"`

- [ ] **Step 7: Die Abbildung schreiben**

Create `packages/core/src/google/import-mapping.ts`:

```ts
import { addDays, zonedWallClock } from './zoned-time.js';

export interface GoogleEvent {
  id: string;
  status?: string;
  summary?: string;
  location?: string;
  description?: string;
  recurrence?: string[];
  recurringEventId?: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
}

export interface ImportedEventFields {
  name: string;
  location: string | null;
  notes: string | null;
  start_date: string;
  start_time: string;
  end_date: string;
  end_time: string;
}

/**
 * Serien werden in v1 nicht importiert (Spec 8). Googles `recurrence` traegt
 * der Master, `recurringEventId` eine abweichende Instanz — beide fallen raus.
 */
export function isRecurringGoogleEvent(event: GoogleEvent): boolean {
  return (
    (event.recurrence?.length ?? 0) > 0 ||
    typeof event.recurringEventId === 'string'
  );
}

export function isCancelledGoogleEvent(event: GoogleEvent): boolean {
  return event.status === 'cancelled';
}

export function fromGoogleEvent(
  event: GoogleEvent,
  timeZone: string,
): ImportedEventFields {
  const start = event.start ?? {};
  const end = event.end ?? {};

  if (start.date) {
    // Ganztaegig: Googles Ende ist ausschliesslich, Ralias einschliessend.
    // Geschrieben wird die Konvention des neuen Clients (Spec 6).
    return {
      name: title(event),
      location: text(event.location),
      notes: text(event.description),
      start_date: start.date,
      start_time: '00:00',
      end_date: addDays(end.date ?? addDays(start.date, 1), -1),
      end_time: '23:59',
    };
  }

  if (!start.dateTime || !end.dateTime) {
    throw new Error(`Google-Termin ohne verwertbaren Zeitraum: ${event.id}`);
  }

  const from = zonedWallClock(start.dateTime, timeZone);
  const to = zonedWallClock(end.dateTime, timeZone);
  return {
    name: title(event),
    location: text(event.location),
    notes: text(event.description),
    start_date: from.date,
    start_time: from.time,
    end_date: to.date,
    end_time: to.time,
  };
}

/**
 * Kanonische Fassung genau der Felder, die v1 abbildet.
 *
 * Bewusst nicht Googles ETag: der aendert sich auch bei Dingen, die Ralia gar
 * nicht kennt, und jeder ueberfluessige Schreibvorgang auf `events` baut ueber
 * trg_events_rebuild_reminder_jobs die Erinnerungen neu (Spec 9).
 *
 * Bewusst auch kein Hash: bei dieser Datenmenge kostet der volle String nichts,
 * er ist ohne Krypto synchron testbar, und im Fehlerfall steht lesbar im Feld,
 * worauf verglichen wurde.
 */
export function fingerprintImportedEvent(fields: ImportedEventFields): string {
  return [
    `name=${fields.name}`,
    `location=${fields.location ?? ''}`,
    `notes=${fields.notes ?? ''}`,
    `start=${fields.start_date}T${fields.start_time}`,
    `end=${fields.end_date}T${fields.end_time}`,
  ].join('\n');
}

function title(event: GoogleEvent): string {
  const value = event.summary?.trim();
  return value && value.length > 0 ? value : 'Ohne Titel';
}

function text(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}
```

In `packages/core/src/google/index.ts` und `packages/core/src/index.ts` ergänzen:

```ts
export { addDays, zonedWallClock } from './zoned-time.js';
export {
  fingerprintImportedEvent,
  fromGoogleEvent,
  isCancelledGoogleEvent,
  isRecurringGoogleEvent,
  type GoogleEvent,
  type ImportedEventFields,
} from './import-mapping.js';
```

- [ ] **Step 8: Lauf zeigen lassen, dass er besteht**

Run: `npx vitest run packages/core/src/google/`
Expected: PASS, 29 Tests

- [ ] **Step 9: `npm run verify` und committen**

```bash
npm run verify && git add packages/core/src && git commit -m "feat(core): Google-Termine auf Ralia-Felder abbilden"
```

---

## Task 4: Migration — alle Tabellen und die beiden Leseschnittstellen

Spec 11. Eine Migration, weil alles neu ist und nichts davon einzeln Sinn ergibt.

**Files:**

- Create: `supabase/migrations/20260812140000_add_google_import.sql`

**Interfaces:**

- Consumes: nichts.
- Produces: die sechs `private`-Tabellen aus Spec 11 sowie
  `public.google_connection_status()` und `public.google_import_recent()`.

- [ ] **Step 1: Die Migration schreiben**

Create `supabase/migrations/20260812140000_add_google_import.sql`:

```sql
-- Google-Kalender-Import v1.
--
-- Alles in `private`, damit PostgREST es nicht ausliefert. Der Client kommt
-- ausschliesslich ueber die beiden SECURITY-DEFINER-Funktionen unten heran,
-- und die geben weder Token noch code_verifier zurueck.

create schema if not exists private;

create table private.google_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  google_sub text not null,
  google_email text not null,
  time_zone text not null default 'Europe/Berlin',
  refresh_token_encrypted text not null,
  granted_scopes text[] not null default '{}',
  status text not null default 'active' check (status in ('active', 'needs_reauth', 'revoked')),
  failure_count integer not null default 0,
  retry_after timestamptz,
  last_run_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index google_connections_one_active_per_user
  on private.google_connections (user_id)
  where status <> 'revoked';

create table private.google_oauth_states (
  state text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  code_verifier text not null,
  nonce text not null,
  redirect_to text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index google_oauth_states_expires_at on private.google_oauth_states (expires_at);

create table private.google_import_bindings (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references private.google_connections(id) on delete cascade,
  calendar_id text not null,
  schedule text not null default 'off' check (schedule in ('off', 'active', 'paused')),
  first_real_run_allowed_at timestamptz,
  locked_at timestamptz,
  last_run_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index google_import_bindings_one_active
  on private.google_import_bindings (connection_id, calendar_id)
  where is_active;

create table private.google_import_sources (
  id uuid primary key default gen_random_uuid(),
  binding_id uuid not null references private.google_import_bindings(id) on delete cascade,
  google_calendar_id text not null,
  google_calendar_name text not null,
  -- Googles syncToken haengt am Kalender, nicht an der Bindung.
  sync_token text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (binding_id, google_calendar_id)
);

create table private.google_event_mappings (
  id uuid primary key default gen_random_uuid(),
  binding_id uuid not null references private.google_import_bindings(id) on delete cascade,
  source_id uuid not null references private.google_import_sources(id) on delete cascade,
  google_event_id text not null,
  ralia_event_id uuid not null,
  fingerprint text not null,
  last_synced_at timestamptz not null default now(),
  unique (binding_id, google_event_id),
  -- Ein Ralia-Termin gehoert hoechstens einem Import. Diese Zusicherung ist
  -- die Grundlage von Sicherheitsregel 1: was hier nicht steht, ist fuer den
  -- Import unerreichbar.
  unique (ralia_event_id)
);

create table private.google_import_runs (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references private.google_connections(id) on delete cascade,
  binding_id uuid references private.google_import_bindings(id) on delete set null,
  trigger text not null check (trigger in ('cron', 'manual')),
  dry_run boolean not null default false,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created integer not null default 0,
  updated integer not null default 0,
  unchanged integer not null default 0,
  skipped integer not null default 0,
  deletions_reported integer not null default 0,
  error text
);

create index google_import_runs_recent
  on private.google_import_runs (connection_id, started_at desc);

create table private.google_import_changes (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references private.google_import_runs(id) on delete cascade,
  mapping_id uuid references private.google_event_mappings(id) on delete set null,
  action text not null
    check (action in ('created', 'updated', 'skipped', 'deleted_in_google')),
  title text,
  reason text,
  at timestamptz not null default now()
);

create index google_import_changes_run on private.google_import_changes (run_id);

alter table private.google_connections enable row level security;
alter table private.google_oauth_states enable row level security;
alter table private.google_import_bindings enable row level security;
alter table private.google_import_sources enable row level security;
alter table private.google_event_mappings enable row level security;
alter table private.google_import_runs enable row level security;
alter table private.google_import_changes enable row level security;
-- Keine Policies, mit Absicht: nur der Service-Role-Key kommt heran, und der
-- umgeht RLS. Fuer `authenticated` und `anon` bleiben alle Tabellen zu.

create or replace function public.google_connection_status()
returns table (
  connected boolean,
  google_email text,
  time_zone text,
  status text,
  schedule text,
  first_real_run_allowed boolean,
  source_count integer,
  last_run_at timestamptz
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    true,
    c.google_email,
    c.time_zone,
    c.status,
    coalesce(b.schedule, 'off'),
    b.first_real_run_allowed_at is not null,
    (select count(*)::integer from private.google_import_sources s
      where s.binding_id = b.id and s.is_active),
    c.last_run_at
  from private.google_connections c
  left join private.google_import_bindings b
    on b.connection_id = c.id and b.is_active
  where c.user_id = auth.uid() and c.status <> 'revoked'
  union all
  select false, null, null, 'disconnected', 'off', false, 0, null
  where not exists (
    select 1 from private.google_connections c
    where c.user_id = auth.uid() and c.status <> 'revoked'
  );
$$;

create or replace function public.google_import_recent()
returns table (
  run_id uuid,
  trigger text,
  dry_run boolean,
  started_at timestamptz,
  finished_at timestamptz,
  created integer,
  updated integer,
  unchanged integer,
  skipped integer,
  deletions_reported integer,
  error text
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    r.id, r.trigger, r.dry_run, r.started_at, r.finished_at,
    r.created, r.updated, r.unchanged, r.skipped, r.deletions_reported, r.error
  from private.google_import_runs r
  join private.google_connections c on c.id = r.connection_id
  where c.user_id = auth.uid()
  order by r.started_at desc
  limit 20;
$$;

revoke all on function public.google_connection_status() from public;
revoke all on function public.google_import_recent() from public;
grant execute on function public.google_connection_status() to authenticated;
grant execute on function public.google_import_recent() to authenticated;
```

- [ ] **Step 2: Die Migration anwenden**

Über das Supabase-MCP-Werkzeug `apply_migration`, Name `add_google_import`.

- [ ] **Step 3: Prüfen, dass der Status für einen Nicht-Verbundenen sauber antwortet**

Über `execute_sql`:

```sql
select * from public.google_connection_status();
```

Expected: genau **eine** Zeile mit `connected = false`, `status = 'disconnected'`,
`schedule = 'off'`, `first_real_run_allowed = false`, `source_count = 0`. Null Zeilen wäre
falsch — der Screen unterscheidet sonst nicht zwischen „nicht verbunden" und „Abfrage
fehlgeschlagen".

- [ ] **Step 4: Prüfen, dass ein Ralia-Termin nur einmal zugeordnet werden kann**

Über `execute_sql`, in einer Transaktion, die zurückgerollt wird:

```sql
begin;
insert into private.google_connections (user_id, google_sub, google_email, refresh_token_encrypted)
  select id, 'sub', 'qa@example.com', 'x' from auth.users limit 1
  returning id \gset
insert into private.google_import_bindings (connection_id, calendar_id)
  select id, 'QA:kalender' from private.google_connections order by created_at desc limit 1;
insert into private.google_import_sources (binding_id, google_calendar_id, google_calendar_name)
  select id, 'quelle@example.com', 'Quelle' from private.google_import_bindings order by created_at desc limit 1;
insert into private.google_event_mappings (binding_id, source_id, google_event_id, ralia_event_id, fingerprint)
  select s.binding_id, s.id, 'g1', gen_random_uuid(), 'f' from private.google_import_sources s limit 1;
-- Derselbe Ralia-Termin ein zweites Mal, anderer Google-Termin:
insert into private.google_event_mappings (binding_id, source_id, google_event_id, ralia_event_id, fingerprint)
  select m.binding_id, m.source_id, 'g2', m.ralia_event_id, 'f' from private.google_event_mappings m limit 1;
rollback;
```

Expected: die **zweite** Einfügung schlägt fehl mit
`duplicate key value violates unique constraint "google_event_mappings_ralia_event_id_key"`.
Geht sie durch, fehlt die Zusicherung — dann kann ein Ralia-Termin von zwei Google-Terminen
beansprucht werden, und Sicherheitsregel 1 hat ein Loch.

- [ ] **Step 5: Den Sicherheitsberater befragen**

Über `get_advisors` mit `type: "security"`.
Expected: keine **neuen** Befunde zu `private.google_*`. Die bekannten Altlasten
(`crawled_events`, `event_reminder_jobs`, `pg_net`, `dblink`, die drei
`SECURITY DEFINER`-Partnerfunktionen) bleiben unverändert.

- [ ] **Step 6: Typen erzeugen und committen**

Über `generate_typescript_types`, Ergebnis nach `packages/data/src/database.generated.ts`.

```bash
git add supabase/migrations packages/data/src/database.generated.ts && git commit -m "feat(db): Tabellen und Leseschnittstellen fuer den Google-Import"
```

---

## Task 5: Edge Function — Verbinden und Trennen

Spec 4.

**Files:**

- Create: `supabase/functions/google-sync-api/crypto.ts`
- Create: `supabase/functions/google-sync-api/oauth.ts`
- Create: `supabase/functions/google-sync-api/index.ts`

**Interfaces:**

- Consumes: `private.google_oauth_states`, `private.google_connections` (Task 4).
- Produces: `encryptSecret` / `decryptSecret` aus `crypto.ts`, `accessTokenFor` aus
  `oauth.ts` (Task 6 benutzt beide), die Hilfsfunktionen `db()` / `userId()` / `json()` aus
  `index.ts`, sowie die Routen `POST /oauth/start`, `GET /callback`, `GET /status`,
  `POST /disconnect`.

- [ ] **Step 1: Die Token-Verschlüsselung schreiben**

Create `supabase/functions/google-sync-api/crypto.ts`:

```ts
// AES-256-GCM. Der Schluessel kommt aus dem Supabase-Secret GOOGLE_TOKEN_KEY
// (32 Byte, base64) und steht nirgends sonst.

const KEY_MATERIAL = Deno.env.get('GOOGLE_TOKEN_KEY') ?? '';

async function key(): Promise<CryptoKey> {
  if (!KEY_MATERIAL) throw new Error('GOOGLE_TOKEN_KEY fehlt');
  const raw = Uint8Array.from(atob(KEY_MATERIAL), (c) => c.charCodeAt(0));
  if (raw.byteLength !== 32)
    throw new Error('GOOGLE_TOKEN_KEY ist nicht 32 Byte');
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ]);
}

/** Ergebnis ist `base64(iv).base64(ciphertext)` — ein Feld, kein zweites Schema. */
export async function encryptSecret(plain: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    await key(),
    new TextEncoder().encode(plain),
  );
  return `${b64(iv)}.${b64(new Uint8Array(cipher))}`;
}

export async function decryptSecret(packed: string): Promise<string> {
  const [ivPart, cipherPart] = packed.split('.');
  if (!ivPart || !cipherPart) throw new Error('Token-Feld ist unlesbar');
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: unb64(ivPart) },
    await key(),
    unb64(cipherPart),
  );
  return new TextDecoder().decode(plain);
}

function b64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function unb64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
}
```

- [ ] **Step 2: Den OAuth-Teil schreiben**

Create `supabase/functions/google-sync-api/oauth.ts`:

```ts
// Ein Scope, nur lesend (Spec 3). Ralia kann in Google nichts veraendern.
export const SCOPE_READONLY =
  'https://www.googleapis.com/auth/calendar.readonly';

const CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID') ?? '';
const CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET') ?? '';
const REDIRECT_URI =
  'https://nyvripddydrzvfuateea.supabase.co/functions/v1/google-sync-api/callback';

export async function createPkce(): Promise<{
  verifier: string;
  challenge: string;
}> {
  const verifier = randomToken(64);
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(verifier),
  );
  return { verifier, challenge: base64Url(new Uint8Array(digest)) };
}

export function randomToken(bytes: number): string {
  return base64Url(crypto.getRandomValues(new Uint8Array(bytes)));
}

export function authorizeUrl(options: {
  state: string;
  challenge: string;
}): string {
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', CLIENT_ID);
  url.searchParams.set('redirect_uri', REDIRECT_URI);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', SCOPE_READONLY);
  url.searchParams.set('state', options.state);
  url.searchParams.set('code_challenge', options.challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  // Ohne beides liefert Google beim zweiten Mal kein Refresh-Token, und der
  // getaktete Lauf haette nichts zu erneuern.
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent');
  return url.toString();
}

export async function exchangeCode(
  code: string,
  verifier: string,
): Promise<{ refresh_token?: string; access_token: string; scope: string }> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code,
      code_verifier: verifier,
      grant_type: 'authorization_code',
      redirect_uri: REDIRECT_URI,
    }),
  });
  if (!response.ok) throw new Error(`token_exchange_failed_${response.status}`);
  return await response.json();
}

export async function accessTokenFor(refreshToken: string): Promise<string> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  if (!response.ok) throw new Error(`refresh_failed_${response.status}`);
  const body = (await response.json()) as { access_token: string };
  return body.access_token;
}

function base64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
```

- [ ] **Step 3: Das Gerüst mit den vier Routen schreiben**

Create `supabase/functions/google-sync-api/index.ts`:

```ts
import { encryptSecret } from './crypto.ts';
import {
  authorizeUrl,
  createPkce,
  exchangeCode,
  randomToken,
} from './oauth.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const APP_BASE_URL = 'https://ralia-app.onrender.com';
const STATE_TTL_MS = 5 * 60 * 1000;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
  });
}

function redirect(to: string): Response {
  return new Response(null, {
    status: 302,
    headers: { ...CORS_HEADERS, location: `${APP_BASE_URL}${to}` },
  });
}

/** PostgREST mit dem Service-Role-Key. `private` ist von aussen unerreichbar. */
export async function db(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('apikey', SERVICE_ROLE_KEY);
  headers.set('authorization', `Bearer ${SERVICE_ROLE_KEY}`);
  headers.set('content-type', 'application/json');
  headers.set('accept-profile', 'private');
  headers.set('content-profile', 'private');
  return await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers });
}

export async function userId(request: Request): Promise<string | null> {
  const auth = request.headers.get('authorization');
  if (!auth) return null;
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SERVICE_ROLE_KEY, authorization: auth },
  });
  if (!response.ok) return null;
  const body = (await response.json()) as { id?: string };
  return body.id ?? null;
}

interface StateRow {
  user_id: string;
  code_verifier: string;
  redirect_to: string;
  expires_at: string;
}

async function googleUserInfo(
  accessToken: string,
): Promise<{ sub: string; email: string }> {
  const response = await fetch(
    'https://openidconnect.googleapis.com/v1/userinfo',
    {
      headers: { authorization: `Bearer ${accessToken}` },
    },
  );
  if (!response.ok) throw new Error('userinfo_failed');
  return await response.json();
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS')
    return new Response('ok', { headers: CORS_HEADERS });
  const path = new URL(request.url).pathname.replace(/^\/google-sync-api/, '');

  if (path === '/oauth/start' && request.method === 'POST') {
    const user = await userId(request);
    if (!user) return json({ error: 'unauthorized' }, 401);

    const { redirectTo } = (await request.json().catch(() => ({}))) as {
      redirectTo?: string;
    };
    const { verifier, challenge } = await createPkce();
    const state = randomToken(32);

    const insert = await db('google_oauth_states', {
      method: 'POST',
      body: JSON.stringify({
        state,
        user_id: user,
        code_verifier: verifier,
        nonce: randomToken(16),
        redirect_to: redirectTo ?? '/profil/sync',
        expires_at: new Date(Date.now() + STATE_TTL_MS).toISOString(),
      }),
    });
    if (!insert.ok) return json({ error: 'state_not_stored' }, 500);

    return json({ authorizeUrl: authorizeUrl({ state, challenge }) });
  }

  if (path === '/callback' && request.method === 'GET') {
    const query = new URL(request.url).searchParams;
    const state = query.get('state') ?? '';
    const code = query.get('code') ?? '';

    // Holen und im selben Zug loeschen: ein state ist genau einmal gueltig.
    const found = await db(
      `google_oauth_states?state=eq.${encodeURIComponent(state)}`,
      {
        method: 'DELETE',
        headers: { prefer: 'return=representation' },
      },
    );
    const entry = (found.ok ? ((await found.json()) as StateRow[]) : [])[0];
    if (!entry || new Date(entry.expires_at) < new Date()) {
      return redirect('/profil/sync?google=state_invalid');
    }
    if (!code) return redirect(`${entry.redirect_to}?google=denied`);

    const token = await exchangeCode(code, entry.code_verifier);
    if (!token.refresh_token)
      return redirect(`${entry.redirect_to}?google=no_refresh_token`);

    const profile = await googleUserInfo(token.access_token);
    const stored = await db('google_connections?on_conflict=user_id', {
      method: 'POST',
      headers: { prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify({
        user_id: entry.user_id,
        google_sub: profile.sub,
        google_email: profile.email,
        refresh_token_encrypted: await encryptSecret(token.refresh_token),
        granted_scopes: token.scope.split(' '),
        status: 'active',
        failure_count: 0,
        updated_at: new Date().toISOString(),
      }),
    });
    if (!stored.ok) return redirect(`${entry.redirect_to}?google=not_stored`);

    return redirect(`${entry.redirect_to}?google=connected`);
  }

  if (path === '/status' && request.method === 'GET') {
    const user = await userId(request);
    if (!user) return json({ error: 'unauthorized' }, 401);
    // Ueber die RPC statt ueber die Tabelle: sie ist die eine Stelle, an der
    // festgelegt ist, was der Client sehen darf.
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/rpc/google_connection_status`,
      {
        method: 'POST',
        headers: {
          apikey: SERVICE_ROLE_KEY,
          authorization: request.headers.get('authorization') ?? '',
          'content-type': 'application/json',
        },
        body: '{}',
      },
    );
    if (!response.ok) return json({ error: 'status_failed' }, 500);
    const rows = (await response.json()) as unknown[];
    return json(rows[0] ?? { connected: false, status: 'disconnected' });
  }

  if (path === '/disconnect' && request.method === 'POST') {
    const user = await userId(request);
    if (!user) return json({ error: 'unauthorized' }, 401);
    await db(`google_connections?user_id=eq.${user}`, {
      method: 'PATCH',
      body: JSON.stringify({
        status: 'revoked',
        updated_at: new Date().toISOString(),
      }),
    });
    return json({ ok: true });
  }

  return json({ error: 'not_found' }, 404);
});
```

- [ ] **Step 4: Deployen**

Über `deploy_edge_function`, Name `google-sync-api`, `verify_jwt: false`, mit allen drei
Dateien.

`verify_jwt` muss **false** sein, weil `/callback` von Google ohne JWT kommt. Alle
Nutzerrouten prüfen deshalb selbst in ihrer ersten Zeile über `userId(request)`.

- [ ] **Step 5: Prüfen, dass ohne JWT nichts geht**

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST "https://nyvripddydrzvfuateea.supabase.co/functions/v1/google-sync-api/oauth/start"
```

Expected: `401`

- [ ] **Step 6: Prüfen, dass ein erfundener `state` nicht abstürzt**

```bash
curl -s -o /dev/null -w "%{http_code}\n" "https://nyvripddydrzvfuateea.supabase.co/functions/v1/google-sync-api/callback?state=erfunden&code=egal"
```

Expected: `302`, nicht `500`. Ein ungültiger `state` ist ein erwarteter Fall.

- [ ] **Step 7: Prüfen, dass keine Zeile entstanden ist**

Über `execute_sql`: `select count(*) from private.google_connections;`
Expected: `0`

- [ ] **Step 8: Committen**

```bash
git add supabase/functions/google-sync-api && git commit -m "feat(functions): google-sync-api verbindet und trennt Google-Konten"
```

---

## Task 6: Kalenderliste und der Import-Lauf

Spec 12. Der einzige Task, der nach `events` schreibt.

**Files:**

- Create: `supabase/functions/google-sync-api/google.ts`
- Create: `supabase/functions/google-sync-api/run.ts`
- Modify: `supabase/functions/google-sync-api/index.ts`

**Interfaces:**

- Consumes: `decryptSecret`, `accessTokenFor` (Task 5), die Tabellen aus Task 4, und aus
  `packages/core/src/google/` die Funktionen `fromGoogleEvent`, `fingerprintImportedEvent`,
  `isRecurringGoogleEvent`, `isCancelledGoogleEvent` (Task 3) — in Deno über relative
  Pfade, weil Edge Functions den Workspace nicht auflösen.
- Produces: `GET /calendars` → `{ id, summary, primary }[]`,
  `POST /sources` mit `{ calendarIds: string[] }`,
  `POST /run` mit `{ dryRun?: boolean }` → die Kennzahlen,
  `POST /schedule` mit `{ schedule: 'off' | 'active' | 'paused' }`.

- [ ] **Step 1: Den Google-Leseklienten schreiben**

Create `supabase/functions/google-sync-api/google.ts`:

```ts
// Ausschliesslich GET. Ein schreibender Aufruf gegen googleapis.com ist in
// diesem Projekt ein Fehler — der Scope laesst ihn ohnehin nicht zu.
const BASE = 'https://www.googleapis.com/calendar/v3';

async function get(token: string, path: string): Promise<Response> {
  return await fetch(`${BASE}${path}`, {
    headers: { authorization: `Bearer ${token}` },
  });
}

export interface GoogleCalendarEntry {
  id: string;
  summary: string;
  primary: boolean;
}

export async function listCalendars(
  token: string,
): Promise<GoogleCalendarEntry[]> {
  const response = await get(
    token,
    '/users/me/calendarList?minAccessRole=reader',
  );
  if (!response.ok) throw new Error(`calendar_list_failed_${response.status}`);
  const body = (await response.json()) as {
    items?: { id: string; summary?: string; primary?: boolean }[];
  };
  return (body.items ?? []).map((item) => ({
    id: item.id,
    summary: item.summary ?? item.id,
    primary: item.primary === true,
  }));
}

export interface EventPage {
  items: unknown[];
  nextPageToken?: string;
  nextSyncToken?: string;
  expiredToken: boolean;
}

export async function listEvents(
  token: string,
  calendarId: string,
  options: { syncToken?: string | null; pageToken?: string },
): Promise<EventPage> {
  const query = new URLSearchParams({ maxResults: '250', showDeleted: 'true' });
  if (options.syncToken) {
    query.set('syncToken', options.syncToken);
  } else {
    // Vollabgleich: 30 Tage rueckwaerts reichen. Aeltere Termine sind fuer
    // einen Kalender, den man taeglich benutzt, nicht mehr interessant.
    const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    query.set('timeMin', from.toISOString());
  }
  if (options.pageToken) query.set('pageToken', options.pageToken);

  const response = await get(
    token,
    `/calendars/${encodeURIComponent(calendarId)}/events?${query.toString()}`,
  );
  // 410 heisst: der syncToken ist verfallen. Kein Fehler, sondern die
  // Aufforderung, einmal vollstaendig zu lesen.
  if (response.status === 410) return { items: [], expiredToken: true };
  if (!response.ok) throw new Error(`events_list_failed_${response.status}`);

  const body = (await response.json()) as {
    items?: unknown[];
    nextPageToken?: string;
    nextSyncToken?: string;
  };
  return {
    items: body.items ?? [],
    nextPageToken: body.nextPageToken,
    nextSyncToken: body.nextSyncToken,
    expiredToken: false,
  };
}
```

- [ ] **Step 2: Den Lauf schreiben**

Create `supabase/functions/google-sync-api/run.ts`:

```ts
import { decryptSecret } from './crypto.ts';
import { accessTokenFor } from './oauth.ts';
import { listEvents } from './google.ts';
import {
  fingerprintImportedEvent,
  fromGoogleEvent,
  isCancelledGoogleEvent,
  isRecurringGoogleEvent,
  type GoogleEvent,
} from '../../../packages/core/src/google/import-mapping.ts';

const LOCK_TTL_MS = 15 * 60 * 1000;

export interface RunOptions {
  userId: string;
  dryRun: boolean;
  trigger: 'cron' | 'manual';
  db: (path: string, init?: RequestInit) => Promise<Response>;
  publicDb: (path: string, init?: RequestInit) => Promise<Response>;
}

export interface RunResult {
  dryRun: boolean;
  created: number;
  updated: number;
  unchanged: number;
  skipped: number;
  deletionsReported: number;
  error: string | null;
}

interface ConnectionRow {
  id: string;
  time_zone: string;
  refresh_token_encrypted: string;
}

interface BindingRow {
  id: string;
  first_real_run_allowed_at: string | null;
  locked_at: string | null;
}

interface SourceRow {
  id: string;
  google_calendar_id: string;
  sync_token: string | null;
}

interface MappingRow {
  id: string;
  google_event_id: string;
  ralia_event_id: string;
  fingerprint: string;
}

export async function runImport(options: RunOptions): Promise<RunResult> {
  const { db, publicDb, dryRun } = options;
  const rows = async <T>(path: string): Promise<T[]> => {
    const response = await db(path);
    return response.ok ? ((await response.json()) as T[]) : [];
  };

  const empty: RunResult = {
    dryRun,
    created: 0,
    updated: 0,
    unchanged: 0,
    skipped: 0,
    deletionsReported: 0,
    error: null,
  };

  const [connection] = await rows<ConnectionRow>(
    `google_connections?user_id=eq.${options.userId}&status=eq.active&select=id,time_zone,refresh_token_encrypted`,
  );
  if (!connection) return { ...empty, error: 'not_connected' };

  const [binding] = await rows<BindingRow>(
    `google_import_bindings?connection_id=eq.${connection.id}&is_active=is.true&select=id,first_real_run_allowed_at,locked_at`,
  );
  if (!binding) return { ...empty, error: 'no_binding' };

  // Sicherheitsregel 2: ohne bestandenen Probelauf laeuft kein echter Lauf.
  if (!dryRun && !binding.first_real_run_allowed_at) {
    return { ...empty, error: 'dry_run_required' };
  }

  if (
    binding.locked_at &&
    Date.now() - new Date(binding.locked_at).getTime() < LOCK_TTL_MS
  ) {
    return { ...empty, error: 'locked' };
  }
  await db(`google_import_bindings?id=eq.${binding.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ locked_at: new Date().toISOString() }),
  });

  const sources = await rows<SourceRow>(
    `google_import_sources?binding_id=eq.${binding.id}&is_active=is.true&select=id,google_calendar_id,sync_token`,
  );

  const run = await db('google_import_runs', {
    method: 'POST',
    headers: { prefer: 'return=representation' },
    body: JSON.stringify({
      connection_id: connection.id,
      binding_id: binding.id,
      trigger: options.trigger,
      dry_run: dryRun,
    }),
  });
  const runId = ((await run.json()) as { id: string }[])[0]!.id;

  const note = (
    action: string,
    title: string,
    reason?: string,
    mappingId?: string,
  ) =>
    db('google_import_changes', {
      method: 'POST',
      body: JSON.stringify({
        run_id: runId,
        mapping_id: mappingId ?? null,
        action,
        title,
        reason: reason ?? null,
      }),
    });

  const result: RunResult = { ...empty };

  try {
    const token = await accessTokenFor(
      await decryptSecret(connection.refresh_token_encrypted),
    );
    // Die calendar_id des Nutzers ist dieselbe, die die App sieht.
    const [membership] = await rows<{ calendar_id: string }>(
      `calendar_memberships?user_id=eq.${options.userId}&is_active=is.true&select=calendar_id`,
    );
    const raliaCalendarId = membership?.calendar_id ?? options.userId;

    for (const source of sources) {
      const mappings = await rows<MappingRow>(
        `google_event_mappings?source_id=eq.${source.id}&select=id,google_event_id,ralia_event_id,fingerprint`,
      );
      const byGoogleId = new Map(mappings.map((m) => [m.google_event_id, m]));

      let pageToken: string | undefined;
      let syncToken = source.sync_token;
      let nextSyncToken: string | undefined;

      do {
        const page = await listEvents(token, source.google_calendar_id, {
          syncToken,
          pageToken,
        });
        if (page.expiredToken) {
          // Token verfallen: einmal vollstaendig lesen, dann neuen Token holen.
          syncToken = null;
          pageToken = undefined;
          continue;
        }

        for (const raw of page.items) {
          const event = raw as GoogleEvent;

          if (isCancelledGoogleEvent(event)) {
            // Sicherheitsregel 3: gemeldet, nicht geloescht.
            result.deletionsReported += 1;
            await note(
              'deleted_in_google',
              event.summary ?? event.id,
              'kept_in_ralia',
            );
            continue;
          }
          if (isRecurringGoogleEvent(event)) {
            result.skipped += 1;
            await note(
              'skipped',
              event.summary ?? event.id,
              'recurring_not_supported',
            );
            continue;
          }

          let fields;
          try {
            fields = fromGoogleEvent(event, connection.time_zone);
          } catch {
            result.skipped += 1;
            await note(
              'skipped',
              event.summary ?? event.id,
              'unusable_time_range',
            );
            continue;
          }
          const fingerprint = fingerprintImportedEvent(fields);
          const existing = byGoogleId.get(event.id);

          if (existing && existing.fingerprint === fingerprint) {
            result.unchanged += 1;
            continue;
          }

          if (dryRun) {
            if (existing) {
              result.updated += 1;
              await note('updated', fields.name, 'dry_run', existing.id);
            } else {
              result.created += 1;
              await note('created', fields.name, 'dry_run');
            }
            continue;
          }

          if (existing) {
            // Nur die abgebildeten Felder. belongs_to und category bleiben, wie
            // sie in Ralia stehen (Spec 9).
            await publicDb(`events?id=eq.${existing.ralia_event_id}`, {
              method: 'PATCH',
              body: JSON.stringify(fields),
            });
            await db(`google_event_mappings?id=eq.${existing.id}`, {
              method: 'PATCH',
              body: JSON.stringify({
                fingerprint,
                last_synced_at: new Date().toISOString(),
              }),
            });
            result.updated += 1;
            await note('updated', fields.name, undefined, existing.id);
          } else {
            const created = await publicDb('events', {
              method: 'POST',
              headers: { prefer: 'return=representation' },
              body: JSON.stringify({
                ...fields,
                calendar_id: raliaCalendarId,
                belongs_to: 'both',
                created_by: options.userId,
              }),
            });
            const raliaId = ((await created.json()) as { id: string }[])[0]?.id;
            if (!raliaId) {
              result.skipped += 1;
              await note('skipped', fields.name, 'insert_failed');
              continue;
            }
            await db('google_event_mappings', {
              method: 'POST',
              body: JSON.stringify({
                binding_id: binding.id,
                source_id: source.id,
                google_event_id: event.id,
                ralia_event_id: raliaId,
                fingerprint,
              }),
            });
            result.created += 1;
            await note('created', fields.name);
          }
        }

        pageToken = page.nextPageToken;
        if (page.nextSyncToken) nextSyncToken = page.nextSyncToken;
      } while (pageToken);

      // Beim Probelauf bleibt der Token stehen — sonst saehe der erste echte
      // Lauf die Aenderungen nicht mehr, die der Probelauf gerade gemeldet hat.
      if (!dryRun && nextSyncToken) {
        await db(`google_import_sources?id=eq.${source.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ sync_token: nextSyncToken }),
        });
      }
    }
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
    if (result.error.startsWith('refresh_failed')) {
      await db(`google_connections?id=eq.${connection.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'needs_reauth' }),
      });
    }
  }

  await db(`google_import_runs?id=eq.${runId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      finished_at: new Date().toISOString(),
      created: result.created,
      updated: result.updated,
      unchanged: result.unchanged,
      skipped: result.skipped,
      deletions_reported: result.deletionsReported,
      error: result.error,
    }),
  });
  await db(`google_import_bindings?id=eq.${binding.id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      locked_at: null,
      last_run_at: new Date().toISOString(),
      // Ein fehlerfreier Probelauf gibt den echten Lauf frei (Spec 12).
      ...(dryRun && !result.error && !binding.first_real_run_allowed_at
        ? { first_real_run_allowed_at: new Date().toISOString() }
        : {}),
    }),
  });

  return result;
}
```

- [ ] **Step 3: Die vier Routen ergänzen**

In `index.ts` einen zweiten PostgREST-Helfer für das `public`-Schema anlegen — `db()` oben
setzt `accept-profile: private` und trifft `events` sonst nicht:

```ts
export async function publicDb(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('apikey', SERVICE_ROLE_KEY);
  headers.set('authorization', `Bearer ${SERVICE_ROLE_KEY}`);
  headers.set('content-type', 'application/json');
  return await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers });
}
```

Und vor `not_found`:

```ts
if (path === '/calendars' && request.method === 'GET') {
  const user = await userId(request);
  if (!user) return json({ error: 'unauthorized' }, 401);
  const [connection] = await connectionsFor(user);
  if (!connection) return json({ error: 'not_connected' }, 400);
  const token = await accessTokenFor(
    await decryptSecret(connection.refresh_token_encrypted),
  );
  return json({ calendars: await listCalendars(token) });
}

if (path === '/sources' && request.method === 'POST') {
  const user = await userId(request);
  if (!user) return json({ error: 'unauthorized' }, 401);
  const { calendarIds } = (await request.json().catch(() => ({}))) as {
    calendarIds?: string[];
  };
  return json(await setSources(user, calendarIds ?? []));
}

if (path === '/schedule' && request.method === 'POST') {
  const user = await userId(request);
  if (!user) return json({ error: 'unauthorized' }, 401);
  const { schedule } = (await request.json().catch(() => ({}))) as {
    schedule?: string;
  };
  if (schedule !== 'off' && schedule !== 'active' && schedule !== 'paused') {
    return json({ error: 'invalid_schedule' }, 400);
  }
  return json(await setSchedule(user, schedule));
}

if (path === '/run' && request.method === 'POST') {
  const user = await userId(request);
  if (!user) return json({ error: 'unauthorized' }, 401);
  const { dryRun } = (await request.json().catch(() => ({}))) as {
    dryRun?: boolean;
  };
  return json(
    await runImport({
      userId: user,
      dryRun: dryRun === true,
      trigger: 'manual',
      db,
      publicDb,
    }),
  );
}
```

Dazu die drei Helfer im selben Modul:

```ts
async function connectionsFor(
  user: string,
): Promise<{ id: string; refresh_token_encrypted: string }[]> {
  const response = await db(
    `google_connections?user_id=eq.${user}&status=eq.active&select=id,refresh_token_encrypted`,
  );
  return response.ok ? await response.json() : [];
}

/** Legt die Bindung bei Bedarf an und ersetzt die Quellenliste vollstaendig. */
async function setSources(
  user: string,
  calendarIds: string[],
): Promise<{ ok: true }> {
  const [connection] = await connectionsFor(user);
  if (!connection) return { ok: true };

  const [membership] = (await (
    await db(
      `calendar_memberships?user_id=eq.${user}&is_active=is.true&select=calendar_id`,
    )
  ).json()) as { calendar_id: string }[];
  const raliaCalendarId = membership?.calendar_id ?? user;

  let [binding] = (await (
    await db(
      `google_import_bindings?connection_id=eq.${connection.id}&is_active=is.true&select=id`,
    )
  ).json()) as { id: string }[];
  if (!binding) {
    const created = await db('google_import_bindings', {
      method: 'POST',
      headers: { prefer: 'return=representation' },
      body: JSON.stringify({
        connection_id: connection.id,
        calendar_id: raliaCalendarId,
      }),
    });
    binding = ((await created.json()) as { id: string }[])[0]!;
  }

  // Abwaehlen heisst deaktivieren, nicht loeschen: die Zuordnungen der Quelle
  // bleiben erhalten, damit ein spaeteres Wiederanwaehlen keine Dubletten legt.
  await db(`google_import_sources?binding_id=eq.${binding.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ is_active: false }),
  });
  for (const calendarId of calendarIds) {
    await db(
      'google_import_sources?on_conflict=binding_id,google_calendar_id',
      {
        method: 'POST',
        headers: { prefer: 'resolution=merge-duplicates' },
        body: JSON.stringify({
          binding_id: binding.id,
          google_calendar_id: calendarId,
          google_calendar_name: calendarId,
          is_active: true,
        }),
      },
    );
  }
  return { ok: true };
}

async function setSchedule(
  user: string,
  schedule: string,
): Promise<{ ok: true }> {
  const [connection] = await connectionsFor(user);
  if (!connection) return { ok: true };
  await db(
    `google_import_bindings?connection_id=eq.${connection.id}&is_active=is.true`,
    {
      method: 'PATCH',
      body: JSON.stringify({ schedule }),
    },
  );
  return { ok: true };
}
```

Dazu die Cron-Route. Sie prüft kein JWT, sondern das Shared Secret, und iteriert selbst über
die getakteten Bindungen — so genügt **ein** `http_post` je Zyklus, unabhängig von der Zahl
der Nutzer:

```ts
if (path === '/cron' && request.method === 'POST') {
  if (request.headers.get('x-cron-secret') !== Deno.env.get('CRON_SECRET')) {
    return json({ error: 'forbidden' }, 403);
  }
  const due = (await (
    await db(
      'google_import_bindings?schedule=eq.active&is_active=is.true&select=connection_id,google_connections(user_id)',
    )
  ).json()) as { google_connections: { user_id: string } }[];

  const results = [];
  for (const entry of due) {
    results.push(
      await runImport({
        userId: entry.google_connections.user_id,
        dryRun: false,
        trigger: 'cron',
        db,
        publicDb,
      }),
    );
  }
  return json({ bindings: due.length, results });
}
```

- [ ] **Step 4: Deployen und die Kalenderliste gegen ein Testkonto prüfen**

Über `deploy_edge_function`. Dann mit dem JWT eines der freigegebenen Testkonten, nachdem
dort einmal verbunden wurde:

```bash
curl -s "https://nyvripddydrzvfuateea.supabase.co/functions/v1/google-sync-api/calendars" -H "authorization: Bearer <JWT-des-Testkontos>"
```

Expected: die Kalender des Testkontos mit `id`, `summary` und `primary`.

- [ ] **Step 5: Eine Quelle setzen und den Probelauf fahren**

```bash
curl -s -X POST ".../google-sync-api/sources" -H "authorization: Bearer <JWT>" -H "content-type: application/json" -d '{"calendarIds":["<ID-eines-QA-Kalenders>"]}'
curl -s -X POST ".../google-sync-api/run" -H "authorization: Bearer <JWT>" -H "content-type: application/json" -d '{"dryRun":true}'
```

Expected: Kennzahlen mit `dryRun: true` und `created` größer null.

- [ ] **Step 6: Beweisen, dass der Probelauf nichts geschrieben hat**

Über `execute_sql`:

```sql
select
  (select count(*) from private.google_event_mappings) as zuordnungen,
  (select count(*) from private.google_import_sources where sync_token is not null) as tokens,
  (select count(*) from private.google_import_changes) as protokollzeilen;
```

Expected: `zuordnungen = 0`, `tokens = 0`, `protokollzeilen > 0`.

Ist `zuordnungen` oder `tokens` größer als null, hat der Probelauf geschrieben. Dann ist der
`dryRun`-Zweig falsch umgesetzt und muss korrigiert werden, **bevor** irgendein echter Lauf
stattfindet.

- [ ] **Step 7: Den echten Lauf fahren und die drei Sicherheitsregeln nachweisen**

Zuerst den Zählerstand der Ralia-Termine des QA-Kalenders merken, dann ohne `dryRun` laufen.

Danach über `execute_sql`:

```sql
-- Regel 1: nur eigene Importe angefasst. Ein von Hand angelegter Termin hat
-- keine Zuordnung und darf sich nicht geaendert haben.
select count(*) from public.events e
where e.calendar_id = '<QA-Kalender>'
  and not exists (select 1 from private.google_event_mappings m where m.ralia_event_id = e.id)
  and e.updated_at > now() - interval '10 minutes';
```

Expected: `0`.

Dann den Lauf ein **zweites** Mal fahren.
Expected: `created = 0`, `updated = 0`, `unchanged` größer null. Werden Termine erneut
angelegt, greift der Fingerabdruck nicht — das muss vor Task 7 behoben sein.

Dann in Google einen importierten Termin löschen und erneut laufen lassen.
Expected: `deletionsReported = 1`, und der Ralia-Termin steht noch (Regel 3).

- [ ] **Step 8: Den Takt einrichten**

Genau nach dem Muster von `public.invoke_reminder_worker()`, das seit Monaten fehlerfrei
läuft — dieselben drei Laufzeit-Geheimnisse, derselbe `net.http_post`. Über
`apply_migration`, Name `add_google_import_cron`:

```sql
-- Zehn-Minuten-Takt fuer den Google-Import, nach dem Muster von
-- invoke_reminder_worker(). Ein Aufruf je Zyklus: die Function iteriert selbst
-- ueber die getakteten Bindungen.

create or replace function public.invoke_google_import()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  project_url text;
  publishable_key text;
  cron_secret text;
  request_id bigint;
begin
  project_url := public.get_runtime_secret('project_url');
  publishable_key := public.get_runtime_secret('publishable_key');
  cron_secret := public.get_runtime_secret('cron_secret');

  if project_url is null or publishable_key is null or cron_secret is null then
    raise exception 'Missing required secrets for google import';
  end if;

  -- Nichts tun, wenn niemand den Takt eingeschaltet hat. Spart den Aufruf und
  -- haelt das pg_net-Protokoll lesbar.
  if not exists (
    select 1 from private.google_import_bindings
    where schedule = 'active' and is_active
  ) then
    return null;
  end if;

  select net.http_post(
    url := project_url || '/functions/v1/google-sync-api/cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || publishable_key,
      'apikey', publishable_key,
      'x-cron-secret', cron_secret
    ),
    body := jsonb_build_object('triggered_at', now()),
    timeout_milliseconds := 30000
  ) into request_id;

  return request_id;
end;
$$;

revoke all on function public.invoke_google_import() from public;

select cron.schedule('ralia-google-import', '*/10 * * * *', 'select public.invoke_google_import();');
```

Das Geheimnis `cron_secret` existiert bereits (der Reminder-Worker benutzt es). In der Edge
Function muss dazu `CRON_SECRET` als Supabase-Secret mit demselben Wert gesetzt sein —
prüfen, bevor der Takt eingeschaltet wird.

- [ ] **Step 8b: Den Takt prüfen, ohne ihn scharf zu schalten**

Solange keine Bindung `schedule = 'active'` hat, gibt die Funktion `null` zurück und ruft
nichts auf. Genau das nachweisen:

```sql
select public.invoke_google_import();
```

Expected: `null`. Kommt eine Anfrage-ID zurück, obwohl niemand den Takt eingeschaltet hat,
ist die Wächterbedingung falsch.

- [ ] **Step 9: Committen**

```bash
git add supabase && git commit -m "feat(functions): Kalenderliste, Import-Lauf und Zehn-Minuten-Takt"
```

---

## Task 7: Datenschicht und Screen

Die Attrappe verschwindet vollständig.

**Files:**

- Create: `packages/data/src/google-sync-api.ts`
- Create: `packages/data/src/google-sync-api.test.ts`
- Modify: `packages/data/src/index.ts`, `apps/app/src/data/DataProvider.tsx`
- Modify: `apps/app/src/screens/settings/SyncScreen.tsx`, `SyncScreen.test.tsx`
- Modify: `apps/app/src/mock/fixtures.ts`
- Modify: `apps/app/src/i18n/additions.json`, `de.json`, `en.json`

**Interfaces:**

- Consumes: die Routen aus Tasks 5 und 6, `public.google_import_recent()` aus Task 4.
- Produces:

```ts
interface GoogleConnectionStatus {
  connected: boolean;
  googleEmail: string | null;
  timeZone: string | null;
  status: 'active' | 'needs_reauth' | 'revoked' | 'disconnected';
  schedule: 'off' | 'active' | 'paused';
  firstRealRunAllowed: boolean;
  sourceCount: number;
  lastRunAt: string | null;
}
interface GoogleImportRunResult {
  dryRun: boolean;
  created: number;
  updated: number;
  unchanged: number;
  skipped: number;
  deletionsReported: number;
  error: string | null;
}
interface GoogleSyncApiClient {
  status(): Promise<GoogleConnectionStatus>;
  startOAuth(redirectTo: string): Promise<{ authorizeUrl: string }>;
  disconnect(): Promise<{ ok: true }>;
  calendars(): Promise<{ id: string; summary: string; primary: boolean }[]>;
  setSources(calendarIds: string[]): Promise<{ ok: true }>;
  setSchedule(schedule: 'off' | 'active' | 'paused'): Promise<{ ok: true }>;
  run(options: { dryRun: boolean }): Promise<GoogleImportRunResult>;
  recentRuns(): Promise<GoogleImportRun[]>;
}
```

- [ ] **Step 1: Den fehlschlagenden Klienten-Test schreiben**

Create `packages/data/src/google-sync-api.test.ts` mit vier Tests, nach dem Muster von
`privacy-api.test.ts`, falls vorhanden, sonst frei:

```ts
import { describe, expect, it, vi } from 'vitest';
import { createGoogleSyncApi } from './google-sync-api.js';

function api(fetchImpl: typeof fetch) {
  return createGoogleSyncApi({
    supabaseUrl: 'https://example.supabase.co',
    anonKey: 'anon',
    getAccessToken: async () => 'jwt',
    fetchImpl,
  });
}

function ok(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

describe('GoogleSyncApi', () => {
  it('uebersetzt die Antwort der Statusabfrage in die Client-Form', async () => {
    const fetchImpl = vi.fn(async () =>
      ok({
        connected: true,
        google_email: 'jemand@example.com',
        time_zone: 'Europe/Berlin',
        status: 'active',
        schedule: 'paused',
        first_real_run_allowed: true,
        source_count: 2,
        last_run_at: null,
      }),
    );

    expect(await api(fetchImpl as unknown as typeof fetch).status()).toEqual({
      connected: true,
      googleEmail: 'jemand@example.com',
      timeZone: 'Europe/Berlin',
      status: 'active',
      schedule: 'paused',
      firstRealRunAllowed: true,
      sourceCount: 2,
      lastRunAt: null,
    });
  });

  it('schickt das Zugangstoken mit, nie den Anon-Key allein', async () => {
    const fetchImpl = vi.fn(async () =>
      ok({ connected: false, status: 'disconnected' }),
    );

    await api(fetchImpl as unknown as typeof fetch).status();

    const headers = new Headers(
      (fetchImpl.mock.calls[0]?.[1] as RequestInit).headers,
    );
    expect(headers.get('authorization')).toBe('Bearer jwt');
  });

  it('gibt die Autorisierungs-URL unveraendert durch', async () => {
    const fetchImpl = vi.fn(async () =>
      ok({ authorizeUrl: 'https://accounts.google.com/o/x' }),
    );

    const result = await api(fetchImpl as unknown as typeof fetch).startOAuth(
      '/profil/sync',
    );

    expect(result.authorizeUrl).toBe('https://accounts.google.com/o/x');
  });

  it('meldet einen Fehlschlag als Fehler statt als leeren Zustand', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ error: 'unauthorized' }), {
          status: 401,
        }),
    );

    await expect(
      api(fetchImpl as unknown as typeof fetch).status(),
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Lauf zeigen lassen, dass er fehlschlägt**

Run: `npx vitest run packages/data/src/google-sync-api.test.ts`
Expected: FAIL — `Failed to resolve import "./google-sync-api.js"`

- [ ] **Step 3: Den Klienten schreiben**

Create `packages/data/src/google-sync-api.ts` in der Form von `privacy-api.ts` daneben:
eine Klasse mit privatem `json<T>(path, init)`, das `apikey` und `authorization` setzt, bei
`!response.ok` einen `GoogleSyncApiError` mit dem `error`-Code aus dem Rumpf wirft, und die
acht Methoden aus dem Interface-Block oben. `recentRuns()` geht gegen die RPC
`google_import_recent` über PostgREST, wie die Repositories in
`packages/data/src/repositories/` ihre RPCs rufen.

Alles aus `packages/data/src/index.ts` re-exportieren, wie die `privacy-api`-Zeilen dort.

- [ ] **Step 4: Lauf zeigen lassen, dass er besteht**

Run: `npx vitest run packages/data/src/google-sync-api.test.ts`
Expected: PASS, 4 Tests

- [ ] **Step 5: Den Klienten im DataProvider bereitstellen**

In `apps/app/src/data/DataProvider.tsx` genauso aufbauen und über den Kontext anbieten, wie
es dort für `privacyApi` schon geschieht — dieselbe Quelle für `supabaseUrl`, `anonKey` und
`getAccessToken`.

- [ ] **Step 6: Die fehlschlagenden Screen-Tests schreiben**

In `apps/app/src/screens/settings/SyncScreen.test.tsx`. `renderSyncScreen(status, overrides?)`
rendert den Screen mit einem Klienten-Doppel: `status()` liefert den übergebenen Zustand,
`run()`, `recentRuns()` und `calendars()` kommen aus `overrides` und fallen sonst auf
harmlose Vorgaben zurück — `run` auf einen Lauf ohne Wirkung, `recentRuns` und `calendars`
auf leere Listen. Muster: wie `SettingsScreen.test.tsx` seine Datenschicht ersetzt.

```ts
import type { GoogleConnectionStatus } from '@ralia/data';

function getrennt(): GoogleConnectionStatus {
  return {
    connected: false,
    googleEmail: null,
    timeZone: null,
    status: 'disconnected',
    schedule: 'off',
    firstRealRunAllowed: false,
    sourceCount: 0,
    lastRunAt: null,
  };
}

function verbunden(
  overrides: Partial<GoogleConnectionStatus> = {},
): GoogleConnectionStatus {
  return {
    connected: true,
    googleEmail: 'jemand@example.com',
    timeZone: 'Europe/Berlin',
    status: 'active',
    schedule: 'off',
    firstRealRunAllowed: false,
    sourceCount: 1,
    lastRunAt: null,
    ...overrides,
  };
}

it('fordert zum Verbinden auf, solange kein Konto verbunden ist', async () => {
  renderSyncScreen(getrennt());

  expect(
    await screen.findByRole('button', { name: 'Mit Google verbinden' }),
  ).toBeInTheDocument();
  expect(screen.queryByTestId('sync-account')).not.toBeInTheDocument();
});

it('verlangt eine Quelle, bevor irgendein Lauf moeglich ist', async () => {
  renderSyncScreen(verbunden({ sourceCount: 0 }));

  expect(
    await screen.findByRole('button', { name: 'Probelauf starten' }),
  ).toBeDisabled();
});

it('sperrt den echten Lauf, bis ein Probelauf gelaufen ist', async () => {
  renderSyncScreen(verbunden({ sourceCount: 1, firstRealRunAllowed: false }));

  expect(
    await screen.findByRole('button', { name: 'Probelauf starten' }),
  ).toBeEnabled();
  expect(screen.getByRole('button', { name: 'Jetzt laden' })).toBeDisabled();
});

it('zeigt nach dem Probelauf, was passieren wuerde', async () => {
  const run = vi.fn(async () => ({
    dryRun: true,
    created: 3,
    updated: 1,
    unchanged: 0,
    skipped: 2,
    deletionsReported: 0,
    error: null,
  }));
  renderSyncScreen(verbunden({ sourceCount: 1, firstRealRunAllowed: false }), {
    run,
  });

  await userEvent.click(
    await screen.findByRole('button', { name: 'Probelauf starten' }),
  );

  expect(run).toHaveBeenCalledWith({ dryRun: true });
  expect(await screen.findByText(/3/)).toBeInTheDocument();
});

it('zeigt keine erfundenen Protokollzeilen mehr', async () => {
  renderSyncScreen(verbunden(), { recentRuns: [] });

  expect(screen.queryByTestId('sync-log-row')).not.toBeInTheDocument();
});
```

- [ ] **Step 7: Lauf zeigen lassen, dass er fehlschlägt**

Run: `npx vitest run apps/app/src/screens/settings/SyncScreen.test.tsx`
Expected: FAIL — „Mit Google verbinden" existiert nicht

- [ ] **Step 8: Den Screen neu bauen**

Nach Spec 13. Die vier Fixtures aus dem Screen entfernen und danach aus
`apps/app/src/mock/fixtures.ts` löschen. Die Richtungsauswahl entfällt ersatzlos.

Neue i18n-Schlüssel, in `additions.json` **und** beide Kataloge:

| Schlüssel                | de                                                                                                                                                                | en                                                                                                                           |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `googleConnect`          | `Mit Google verbinden`                                                                                                                                            | `Connect with Google`                                                                                                        |
| `googleDisconnect`       | `Verbindung trennen`                                                                                                                                              | `Disconnect`                                                                                                                 |
| `googleNotConnected`     | `Noch kein Google-Konto verbunden.`                                                                                                                               | `No Google account connected yet.`                                                                                           |
| `googleReadOnlyNotice`   | `Ralia liest Deine Google-Kalender nur. Es wird dort nichts angelegt, geändert oder gelöscht.`                                                                    | `Ralia only reads your Google calendars. Nothing there is created, changed or deleted.`                                      |
| `googleUnverifiedNotice` | `Google zeigt beim Verbinden einen Warnhinweis, weil Ralia nicht öffentlich geprüft ist. Über „Erweitert" geht es weiter.`                                        | `Google shows a warning because Ralia is not publicly verified. Continue via "Advanced".`                                    |
| `googleOwnershipNotice`  | `Termine aus Google werden bei jedem Lauf aktualisiert. Änderungen, die Du in Ralia daran machst, gehen dabei verloren. Deine eigenen Termine bleiben unberührt.` | `Events from Google are refreshed on every run. Changes you make to them in Ralia are lost. Your own events stay untouched.` |
| `googleSources`          | `Quell-Kalender`                                                                                                                                                  | `Source calendars`                                                                                                           |
| `googleSourcesNone`      | `Noch keine Quelle gewählt.`                                                                                                                                      | `No source selected yet.`                                                                                                    |
| `googlePrimaryHint`      | `In diesem Kalender liegen noch Termine aus der alten Ralia-Version. Sie kämen als Dubletten herein.`                                                             | `This calendar still holds events from the old Ralia version. They would come in as duplicates.`                             |
| `googleDryRun`           | `Probelauf starten`                                                                                                                                               | `Start dry run`                                                                                                              |
| `googleDryRunHint`       | `Zeigt, was passieren würde. Schreibt nichts.`                                                                                                                    | `Shows what would happen. Writes nothing.`                                                                                   |
| `googleRunNow`           | `Jetzt laden`                                                                                                                                                     | `Load now`                                                                                                                   |
| `googleRunNeedsDryRun`   | `Erst nach einem Probelauf.`                                                                                                                                      | `Only after a dry run.`                                                                                                      |
| `googleEvery10`          | `Alle 10 Minuten`                                                                                                                                                 | `Every 10 minutes`                                                                                                           |
| `googlePause`            | `Pausieren`                                                                                                                                                       | `Pause`                                                                                                                      |
| `googleResume`           | `Fortsetzen`                                                                                                                                                      | `Resume`                                                                                                                     |
| `googleRunEmpty`         | `Noch kein Lauf.`                                                                                                                                                 | `No run yet.`                                                                                                                |
| `googleRunCreated`       | `neu`                                                                                                                                                             | `new`                                                                                                                        |
| `googleRunUpdated`       | `aktualisiert`                                                                                                                                                    | `updated`                                                                                                                    |
| `googleRunSkipped`       | `übersprungen`                                                                                                                                                    | `skipped`                                                                                                                    |
| `googleRunSeriesSkipped` | `Serien aus Google übersprungen`                                                                                                                                  | `series from Google skipped`                                                                                                 |
| `googleRunDeleted`       | `in Google gelöscht, in Ralia behalten`                                                                                                                           | `deleted in Google, kept in Ralia`                                                                                           |
| `googleConnectedAs`      | `Verbunden als`                                                                                                                                                   | `Connected as`                                                                                                               |
| `googleTimeZone`         | `Zeitzone`                                                                                                                                                        | `Time zone`                                                                                                                  |
| `googleLastRun`          | `Letzter Lauf`                                                                                                                                                    | `Last run`                                                                                                                   |
| `googleNeverRun`         | `noch nie`                                                                                                                                                        | `never`                                                                                                                      |

- [ ] **Step 9: Lauf zeigen lassen, dass er besteht**

Run: `npm test`
Expected: PASS

- [ ] **Step 10: Prüfen, dass die Fixtures wirklich weg sind**

```bash
grep -rn "MOCK_SYNC_ACCOUNTS\|MOCK_SYNC_LOG\|MOCK_CONFLICT\|MOCK_CALENDARS" apps/app/src
```

Expected: keine Ausgabe

- [ ] **Step 11: Im Browser prüfen**

Über `preview_start` mit `app-dev`, dann `/app/profil/sync`. Erwartet: echter
Verbindungszustand, keine erfundenen Konten oder Protokollzeilen, _Jetzt laden_ gesperrt,
keine Konsolenfehler.

- [ ] **Step 12: `npm run verify` und committen**

```bash
npm run verify && git add packages/data apps/app/src && git commit -m "feat(app): Sync-Screen mit echtem Google-Import"
```

---

## Vor dem ersten Lauf gegen den produktiven Kalender

Spec 14.4 und 15. Kein Task, sondern eine Bedingung:

1. Datenbank-Sicherung.
2. Verbinden, Quellen wählen, **Probelauf**.
3. Das Protokoll des Probelaufs durchsehen — stimmen Zahl und Art der Termine?
4. Erst dann _Jetzt laden_.
5. Den Takt erst einschalten, wenn ein echter Lauf sauber durchgelaufen ist.

## Anmerkung zur Reihenfolge

Das Release-Audit nennt als eigentliche Blocker für den ersten Release die **PWA-Hülle** und
die **Push-Registrierung** — ohne sie lässt sich die App nicht auf den Homescreen legen, und
Erinnerungen erreichen kein neu installiertes Gerät, obwohl die serverseitige Pipeline
fehlerfrei läuft. Beide sind kleine, geschlossene Pakete und fassen keine Termindaten an.

Wenn „vollfunktionale App" die Priorität ist, gehören sie vor diesen Plan.
