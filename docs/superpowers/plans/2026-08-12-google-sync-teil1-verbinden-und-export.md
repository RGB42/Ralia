# Google-Sync Teil 1 — Verbinden und Export · Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ein Ralia-Nutzer verbindet sein Google-Konto und exportiert seine Ralia-Termine in einen von Ralia angelegten Google-Kalender — einmalig oder getaktet, mit Pflicht-Probelauf davor.

**Architecture:** Reine Abbildungs- und Vergleichslogik liegt framework-frei in `packages/core/src/google/`. Die Datenschicht spricht über `packages/data/src/google-sync-api.ts` mit der neuen, quellversionierten Edge Function `supabase/functions/google-sync-api/`. Tokens und Zuordnungen liegen im Schema `private`, für PostgREST unerreichbar; der Client sieht sie ausschließlich durch `SECURITY DEFINER`-Funktionen, die nie ein Geheimnis zurückgeben.

**Tech Stack:** TypeScript strict, React 19 + Vite, Vitest, Supabase (Postgres + Deno Edge Functions), Google Calendar API v3.

## Warum Teil 1 hier endet

Der Kalender wird seit 2024 produktiv genutzt. Teil 1 ist deshalb so geschnitten, dass er
**keine einzige Zeile in `events` schreibt** — er liest Ralia und schreibt ausschließlich in
einen frisch angelegten, leeren Google-Kalender. Selbst ein grober Fehler in diesem Teil
kann keine Termindaten beschädigen. Erst Teil 2 fasst die Gegenrichtung an.

| Teil | Inhalt                                                          | Schreibt nach `events`? |
| ---- | --------------------------------------------------------------- | ----------------------- |
| 1    | Vorarbeiten, Verbinden, Export (einmalig + getaktet), Probelauf | **nein**                |
| 2    | Import, Serien in beide Richtungen                              | ja                      |
| 3    | Sync, Konflikte, Löschungen                                     | ja                      |

Spec: [2026-08-12-google-sync-design.md](../specs/2026-08-12-google-sync-design.md). Die
Abschnittsnummern unten verweisen dorthin.

## Global Constraints

- `packages/core` darf React, DOM-APIs und Supabase **nicht** importieren.
- UI-Code greift nie direkt auf Supabase zu — nur über die Datenschicht-Grenze.
- Migrationen sind additiv und vorwärts. Eine angewandte Migration wird nie umgeschrieben.
- Supabase-Projektreferenz: `nyvripddydrzvfuateea`.
- Kein Geheimnis in Repo, Test, Fixture, Log oder Commit. Weder Refresh-Token noch
  `GOOGLE_CLIENT_SECRET` noch `GOOGLE_TOKEN_KEY`.
- Redirect-URI, exakt:
  `https://nyvripddydrzvfuateea.supabase.co/functions/v1/google-sync-api/callback`
- Scope beim Verbinden, exakt und einziger: `https://www.googleapis.com/auth/calendar.app.created`
- Zielkalender heißt exakt `Ralia` und wird immer von Ralia selbst angelegt (Spec 2.2).
- Zeitzone kommt aus `google_connections.time_zone`, Rückfall `Europe/Berlin` (Spec 2.5).
- Nach jedem Task: `npm run verify` muss grün sein.
- Tests werden auf Deutsch beschrieben, wie im übrigen Repo.
- Neue i18n-Schlüssel gehören nach `apps/app/src/i18n/additions.json` **und** nach `de.json`
  und `en.json` (alphabetisch einsortiert). `additions.json` überlebt ein `i18n:extract`,
  die beiden Kataloge sind das, was `catalog.ts` tatsächlich lädt.

---

## File Structure

**Neu in `packages/core/src/google/`** — framework-frei, rein, vollständig testbar:

| Datei              | Verantwortung                                                    |
| ------------------ | ---------------------------------------------------------------- |
| `all-day.ts`       | `isAllDay()` — die eine Ableitung, beide Konventionen (Spec 2.6) |
| `event-mapping.ts` | Ralia-Zeile → Google-Event-Rumpf; Zeitformat mit `timeZone`      |
| `fingerprint.ts`   | kanonischer Vergleichswert je Termin (Spec 2.9)                  |
| `index.ts`         | Re-Export                                                        |

**Neu in `packages/data/src/`:**

| Datei                | Verantwortung                                                       |
| -------------------- | ------------------------------------------------------------------- |
| `google-sync-api.ts` | HTTP-Klient zur Edge Function, nach dem Muster von `privacy-api.ts` |

**Neu in `supabase/`:**

| Datei                                          | Verantwortung                             |
| ---------------------------------------------- | ----------------------------------------- |
| `migrations/…_add_google_sync_connections.sql` | `private`-Schema, Verbindung, OAuth-State |
| `migrations/…_add_google_sync_bindings.sql`    | Bindung, Zuordnung, Läufe, Änderungen     |
| `functions/google-sync-api/index.ts`           | Routing, Auth, CORS                       |
| `functions/google-sync-api/oauth.ts`           | PKCE, State, Token-Tausch                 |
| `functions/google-sync-api/crypto.ts`          | AES-GCM für das Refresh-Token             |
| `functions/google-sync-api/google.ts`          | Google-REST-Aufrufe                       |
| `functions/google-sync-api/run.ts`             | Der Export-Lauf inkl. Probelauf           |

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

Spec 6.2. Ein Legacy-Schlüssel aus Ralia 1.x, den `clearAuthData()` heute stehen lässt.
Muss weg, **bevor** neuer Google-Zustand entsteht — sonst mischt sich alter mit neuem.

**Files:**

- Modify: `packages/data/src/auth/session.ts`
- Test: `packages/data/src/auth/session.test.ts`

**Interfaces:**

- Consumes: nichts.
- Produces: nichts Neues. `clearAuthData(storage: Storage): void` bleibt unverändert in der Signatur.

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

In `packages/data/src/auth/session.test.ts`, innerhalb von `describe('clearAuthData', …)`:

```ts
it('raeumt den Legacy-Schluessel googleSyncState', () => {
  const storage = memoryStorage();
  storage.setItem('googleSyncState', '{"connected":true}');

  clearAuthData(storage);

  expect(storage.getItem('googleSyncState')).toBeNull();
});
```

Benutze denselben Speicher-Helfer, den die umliegenden Tests in dieser `describe` schon
verwenden. Steht dort keiner, dann wörtlich:

```ts
function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key: string) => map.get(key) ?? null,
    key: (index: number) => [...map.keys()][index] ?? null,
    removeItem: (key: string) => void map.delete(key),
    setItem: (key: string, value: string) => void map.set(key, value),
  };
}
```

- [ ] **Step 2: Lauf zeigen lassen, dass er fehlschlägt**

Run: `npx vitest run packages/data/src/auth/session.test.ts -t googleSyncState`
Expected: FAIL — `expected '{"connected":true}' to be null`

- [ ] **Step 3: Den Schlüssel eintragen**

In `packages/data/src/auth/session.ts`, in der Liste `LEGACY_AUTH_KEYS`, ergänzen:

```ts
  // Rest des Google-Syncs aus Ralia 1.x. Ohne diesen Eintrag ueberlebt alter
  // Verbindungszustand die Abmeldung und mischt sich mit dem neuen.
  'googleSyncState',
```

- [ ] **Step 4: Lauf zeigen lassen, dass er besteht**

Run: `npx vitest run packages/data/src/auth/session.test.ts`
Expected: PASS, alle Tests der Datei

- [ ] **Step 5: Committen**

```bash
git add packages/data/src/auth/session.ts packages/data/src/auth/session.test.ts && git commit -m "fix(data): clearAuthData raeumt den Legacy-Schluessel googleSyncState"
```

---

## Task 2: `isAllDay()` nach `@ralia/core`, beide Konventionen lesend

Spec 2.6. `database.types.ts` behauptet, diese Ableitung liege in `@ralia/core` — sie liegt
dort nicht. Was es gibt, ist eine abweichende Regel direkt in `CalendarScreen.tsx:523`. In
der Produktionsdatenbank stehen 363 Zeilen als `00:00`–`23:59` und 102 als `00:00`–`00:00`;
die zweite Gruppe zeigt der Client heute falsch als Termin von Mitternacht bis Mitternacht.

**Files:**

- Create: `packages/core/src/google/all-day.ts`
- Create: `packages/core/src/google/all-day.test.ts`
- Create: `packages/core/src/google/index.ts`
- Modify: `packages/core/src/index.ts`
- Modify: `apps/app/src/screens/calendar/CalendarScreen.tsx:523`

**Interfaces:**

- Consumes: nichts.
- Produces: `isAllDay(event: AllDayCandidate): boolean` und
  `interface AllDayCandidate { start_time: string; end_time: string }`.
  Task 3 und Task 10 benutzen beides.

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
 * Geschrieben wird weiterhin nur die erste — deshalb hat diese Funktion kein
 * Gegenstueck, das Zeiten erzeugt.
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

In `packages/core/src/index.ts` die neue Gruppe re-exportieren, in der Form, die die
umliegenden Zeilen dort schon benutzen:

```ts
export { isAllDay, type AllDayCandidate } from './google/index.js';
```

- [ ] **Step 4: Lauf zeigen lassen, dass er besteht**

Run: `npx vitest run packages/core/src/google/all-day.test.ts`
Expected: PASS, 5 Tests

- [ ] **Step 5: Den Client auf die gemeinsame Ableitung umstellen**

In `apps/app/src/screens/calendar/CalendarScreen.tsx` die Zeile

```ts
const allDay =
  row.start_time.startsWith('00:00') && row.end_time.startsWith('23:59');
```

ersetzen durch

```ts
const allDay = isAllDay(row);
```

und `isAllDay` aus `@ralia/core` importieren, einsortiert zu den übrigen
`@ralia/core`-Importen der Datei.

- [ ] **Step 6: Die ganze Suite laufen lassen**

Run: `npm test`
Expected: PASS. Schlägt ein Kalendertest fehl, weil er einen `00:00`–`00:00`-Termin bisher
als Zeitraum erwartet hat, ist **der Test** anzupassen, nicht die Ableitung — die neue
Erwartung ist die richtige.

- [ ] **Step 7: Committen**

```bash
git add packages/core/src/google packages/core/src/index.ts apps/app/src/screens/calendar/CalendarScreen.tsx && git commit -m "fix(core): isAllDay liest beide Ganztags-Konventionen"
```

---

## Task 3: Feldabbildung Ralia → Google

Spec 4 „Feldabbildung" und 2.5. Rein, ohne Netz. Der Zeitteil ist einfacher als erwartet:
Google akzeptiert eine **lokale** Zeit plus ein getrenntes `timeZone`-Feld. Es muss also
kein Versatz gerechnet werden — der Zeitzonen-Rechenweg entsteht erst in Teil 2 für die
Gegenrichtung.

**Files:**

- Create: `packages/core/src/google/event-mapping.ts`
- Create: `packages/core/src/google/event-mapping.test.ts`
- Modify: `packages/core/src/google/index.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**

- Consumes: `isAllDay`, `AllDayCandidate` aus Task 2.
- Produces:

```ts
interface RaliaEventForExport {
  name: string;
  location: string | null;
  notes: string | null;
  start_date: string;
  start_time: string;
  end_date: string;
  end_time: string;
}
interface GoogleEventBody {
  summary: string;
  location?: string;
  description?: string;
  start: GoogleEventTime;
  end: GoogleEventTime;
}
type GoogleEventTime =
  { date: string } | { dateTime: string; timeZone: string };
function toGoogleEvent(
  event: RaliaEventForExport,
  timeZone: string,
): GoogleEventBody;
function addDays(isoDate: string, days: number): string;
```

Task 10 baut darauf auf.

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

Create `packages/core/src/google/event-mapping.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  addDays,
  toGoogleEvent,
  type RaliaEventForExport,
} from './event-mapping.js';

function event(
  overrides: Partial<RaliaEventForExport> = {},
): RaliaEventForExport {
  return {
    name: 'Zahnarzt',
    location: null,
    notes: null,
    start_date: '2026-08-12',
    start_time: '09:00',
    end_date: '2026-08-12',
    end_time: '10:00',
    ...overrides,
  };
}

describe('toGoogleEvent', () => {
  it('schickt die Ortszeit mit getrennter Zeitzone, nicht mit Versatz', () => {
    const body = toGoogleEvent(event(), 'Europe/Berlin');

    expect(body.start).toEqual({
      dateTime: '2026-08-12T09:00:00',
      timeZone: 'Europe/Berlin',
    });
    expect(body.end).toEqual({
      dateTime: '2026-08-12T10:00:00',
      timeZone: 'Europe/Berlin',
    });
  });

  it('uebernimmt Name, Ort und Notizen', () => {
    const body = toGoogleEvent(
      event({ location: 'Praxis Nord', notes: 'Karte mitnehmen' }),
      'Europe/Berlin',
    );

    expect(body.summary).toBe('Zahnarzt');
    expect(body.location).toBe('Praxis Nord');
    expect(body.description).toBe('Karte mitnehmen');
  });

  it('laesst leere Felder weg, statt sie als leere Zeichenkette zu schicken', () => {
    const body = toGoogleEvent(event(), 'Europe/Berlin');

    expect(body).not.toHaveProperty('location');
    expect(body).not.toHaveProperty('description');
  });

  /**
   * Ralias Enddatum ist einschliesslich, Googles `end.date` ist ausschliesslich.
   * Ohne den Tag Aufschlag verliert jeder ganztaegige Termin seinen letzten Tag.
   */
  it('schickt ganztaegig als date mit ausschliesslichem Ende', () => {
    const body = toGoogleEvent(
      event({ start_time: '00:00', end_time: '23:59', end_date: '2026-08-12' }),
      'Europe/Berlin',
    );

    expect(body.start).toEqual({ date: '2026-08-12' });
    expect(body.end).toEqual({ date: '2026-08-13' });
  });

  it('behandelt die Konvention aus Ralia 1.x genauso', () => {
    const body = toGoogleEvent(
      event({ start_time: '00:00', end_time: '00:00', end_date: '2026-08-12' }),
      'Europe/Berlin',
    );

    expect(body.start).toEqual({ date: '2026-08-12' });
    expect(body.end).toEqual({ date: '2026-08-13' });
  });

  it('haelt einen mehrtaegigen Ganztags-Termin zusammen', () => {
    const body = toGoogleEvent(
      event({
        start_date: '2026-08-10',
        end_date: '2026-08-14',
        start_time: '00:00',
        end_time: '00:00',
      }),
      'Europe/Berlin',
    );

    expect(body.start).toEqual({ date: '2026-08-10' });
    expect(body.end).toEqual({ date: '2026-08-15' });
  });
});

describe('addDays', () => {
  it('rechnet ueber die Monatsgrenze', () => {
    expect(addDays('2026-08-31', 1)).toBe('2026-09-01');
  });

  it('rechnet ueber die Jahresgrenze', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('rechnet ueber den Schalttag', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  });
});
```

- [ ] **Step 2: Lauf zeigen lassen, dass er fehlschlägt**

Run: `npx vitest run packages/core/src/google/event-mapping.test.ts`
Expected: FAIL — `Failed to resolve import "./event-mapping.js"`

- [ ] **Step 3: Die Abbildung schreiben**

Create `packages/core/src/google/event-mapping.ts`:

```ts
import { isAllDay } from './all-day.js';

export interface RaliaEventForExport {
  name: string;
  location: string | null;
  notes: string | null;
  start_date: string;
  start_time: string;
  end_date: string;
  end_time: string;
}

export type GoogleEventTime =
  { date: string } | { dateTime: string; timeZone: string };

export interface GoogleEventBody {
  summary: string;
  location?: string;
  description?: string;
  start: GoogleEventTime;
  end: GoogleEventTime;
}

/** Datumsrechnung ueber UTC, damit keine Zeitzone das Ergebnis verschiebt. */
export function addDays(isoDate: string, days: number): string {
  const at = new Date(`${isoDate}T00:00:00Z`);
  at.setUTCDate(at.getUTCDate() + days);
  return at.toISOString().slice(0, 10);
}

/**
 * Ralia haelt schwebende Ortszeiten ohne Zeitzone. Google akzeptiert genau das,
 * wenn die Zone daneben steht — deshalb wird hier kein Versatz gerechnet.
 *
 * `belongs_to`, `category` und die Erinnerungen bleiben aussen vor: Google hat
 * dafuer keine Entsprechung, und ein Rueckweg wuerde sie auf einen Vorgabewert
 * zuruecksetzen.
 */
export function toGoogleEvent(
  event: RaliaEventForExport,
  timeZone: string,
): GoogleEventBody {
  const body: GoogleEventBody = {
    summary: event.name,
    ...(isAllDay(event)
      ? {
          start: { date: event.start_date },
          end: { date: addDays(event.end_date, 1) },
        }
      : {
          start: {
            dateTime: `${event.start_date}T${time(event.start_time)}`,
            timeZone,
          },
          end: {
            dateTime: `${event.end_date}T${time(event.end_time)}`,
            timeZone,
          },
        }),
  };
  if (event.location) body.location = event.location;
  if (event.notes) body.description = event.notes;
  return body;
}

/** Postgres liefert `HH:MM:SS`, das Formular `HH:MM`. Google will Sekunden. */
function time(value: string): string {
  const parts = value.split(':');
  return `${parts[0] ?? '00'}:${parts[1] ?? '00'}:${parts[2] ?? '00'}`;
}
```

In `packages/core/src/google/index.ts` ergänzen:

```ts
export {
  addDays,
  toGoogleEvent,
  type GoogleEventBody,
  type GoogleEventTime,
  type RaliaEventForExport,
} from './event-mapping.js';
```

Dieselben Namen zusätzlich in `packages/core/src/index.ts` re-exportieren.

- [ ] **Step 4: Lauf zeigen lassen, dass er besteht**

Run: `npx vitest run packages/core/src/google/event-mapping.test.ts`
Expected: PASS, 10 Tests

- [ ] **Step 5: Committen**

```bash
git add packages/core/src/google packages/core/src/index.ts && git commit -m "feat(core): Feldabbildung von Ralia-Terminen nach Google"
```

---

## Task 4: Der Vergleichswert je Termin

Spec 2.9. Die Änderungserkennung läuft über Inhalte, nicht über Zeitstempel — sonst schreibt
bei einem Paar jede Änderung im Kreis. Statt eines Hashes wird ein **kanonischer String**
gespeichert: bei ein paar hundert Terminen kostet das nichts, ist ohne Krypto rein
synchron testbar, und wenn ein Abgleich sich einmal falsch verhält, steht im Feld lesbar,
worauf verglichen wurde.

**Files:**

- Create: `packages/core/src/google/fingerprint.ts`
- Create: `packages/core/src/google/fingerprint.test.ts`
- Modify: `packages/core/src/google/index.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**

- Consumes: `isAllDay` (Task 2), `GoogleEventBody`, `addDays` (Task 3).
- Produces: `fingerprintRaliaEvent(event: RaliaEventForExport): string` und
  `fingerprintGoogleEvent(body: GoogleEventBody): string`. Task 10 vergleicht beide.

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

Create `packages/core/src/google/fingerprint.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  fingerprintGoogleEvent,
  fingerprintRaliaEvent,
} from './fingerprint.js';
import { toGoogleEvent, type RaliaEventForExport } from './event-mapping.js';

function event(
  overrides: Partial<RaliaEventForExport> = {},
): RaliaEventForExport {
  return {
    name: 'Zahnarzt',
    location: null,
    notes: null,
    start_date: '2026-08-12',
    start_time: '09:00',
    end_date: '2026-08-12',
    end_time: '10:00',
    ...overrides,
  };
}

describe('fingerprint', () => {
  it('gibt fuer Ralia und die daraus erzeugte Google-Fassung denselben Wert', () => {
    const source = event();

    expect(fingerprintGoogleEvent(toGoogleEvent(source, 'Europe/Berlin'))).toBe(
      fingerprintRaliaEvent(source),
    );
  });

  /**
   * Der Kern der Zusicherung aus Spec 2.6: die 102 Altzeilen duerfen durch einen
   * Hin- und Rueckweg nicht umgeschrieben werden. Beide Ganztags-Konventionen
   * muessen deshalb denselben Wert ergeben — sonst meldet der Vergleich eine
   * Aenderung, die niemand gemacht hat.
   */
  it('sieht beide Ganztags-Konventionen als denselben Inhalt', () => {
    const neu = event({ start_time: '00:00', end_time: '23:59' });
    const alt = event({ start_time: '00:00', end_time: '00:00' });

    expect(fingerprintRaliaEvent(alt)).toBe(fingerprintRaliaEvent(neu));
  });

  it('vertraegt die Sekunden aus Postgres', () => {
    expect(fingerprintRaliaEvent(event({ start_time: '09:00:00' }))).toBe(
      fingerprintRaliaEvent(event({ start_time: '09:00' })),
    );
  });

  it('meldet eine geaenderte Uhrzeit als Aenderung', () => {
    expect(fingerprintRaliaEvent(event({ start_time: '10:00' }))).not.toBe(
      fingerprintRaliaEvent(event()),
    );
  });

  it('meldet einen geaenderten Namen als Aenderung', () => {
    expect(fingerprintRaliaEvent(event({ name: 'Arzt' }))).not.toBe(
      fingerprintRaliaEvent(event()),
    );
  });

  it('behandelt fehlenden und leeren Ort als dasselbe', () => {
    expect(fingerprintRaliaEvent(event({ location: '' }))).toBe(
      fingerprintRaliaEvent(event({ location: null })),
    );
  });
});
```

- [ ] **Step 2: Lauf zeigen lassen, dass er fehlschlägt**

Run: `npx vitest run packages/core/src/google/fingerprint.test.ts`
Expected: FAIL — `Failed to resolve import "./fingerprint.js"`

- [ ] **Step 3: Den Vergleichswert schreiben**

Create `packages/core/src/google/fingerprint.ts`:

```ts
import {
  addDays,
  toGoogleEvent,
  type GoogleEventBody,
  type RaliaEventForExport,
} from './event-mapping.js';

/**
 * Kanonische Fassung dessen, was v1 tatsaechlich abgleicht.
 *
 * Bewusst kein Hash: bei dieser Datenmenge kostet der volle String nichts, er
 * ist ohne Krypto synchron testbar, und wenn ein Abgleich sich einmal falsch
 * verhaelt, steht lesbar im Feld, worauf verglichen wurde.
 *
 * Ganztaegig geht als abgeleitetes Merkmal ein, nicht als rohe Uhrzeit. Sonst
 * gaeben die beiden Konventionen aus Spec 2.6 verschiedene Werte, der Rueckweg
 * von Google meldete eine Aenderung, und die 102 Altzeilen wuerden
 * umgeschrieben, ohne dass jemand etwas geaendert haette.
 */
export function fingerprintRaliaEvent(event: RaliaEventForExport): string {
  // Ueber die Google-Fassung, damit beide Seiten garantiert dieselbe
  // Normalisierung durchlaufen. Die Zone ist hier belanglos und faellt
  // in fingerprintGoogleEvent ohnehin wieder heraus.
  return fingerprintGoogleEvent(toGoogleEvent(event, 'UTC'));
}

export function fingerprintGoogleEvent(body: GoogleEventBody): string {
  return [
    `summary=${body.summary}`,
    `location=${body.location ?? ''}`,
    `description=${body.description ?? ''}`,
    `start=${boundary(body.start)}`,
    `end=${boundary(body.end)}`,
  ].join('\n');
}

/**
 * Die Zone bleibt draussen: sie haengt an der Verbindung, nicht am Termin, und
 * ein Zonenwechsel in Google soll nicht jeden Termin als geaendert melden.
 */
function boundary(value: GoogleEventBody['start']): string {
  if ('date' in value) return `date:${value.date}`;
  return `dateTime:${value.dateTime}`;
}

/** Wird von Teil 2 gebraucht, wenn Googles Antwort zurueckgelesen wird. */
export function normalizeGoogleAllDayEnd(endDate: string): string {
  return addDays(endDate, -1);
}
```

In `packages/core/src/google/index.ts` und `packages/core/src/index.ts` ergänzen:

```ts
export {
  fingerprintGoogleEvent,
  fingerprintRaliaEvent,
  normalizeGoogleAllDayEnd,
} from './fingerprint.js';
```

- [ ] **Step 4: Lauf zeigen lassen, dass er besteht**

Run: `npx vitest run packages/core/src/google/fingerprint.test.ts`
Expected: PASS, 6 Tests

- [ ] **Step 5: Die ganze Suite und den Typcheck laufen lassen**

Run: `npm run verify`
Expected: alles grün

- [ ] **Step 6: Committen**

```bash
git add packages/core/src/google packages/core/src/index.ts && git commit -m "feat(core): kanonischer Vergleichswert je Termin"
```

---

## Task 5: Migration — Verbindung und OAuth-Zwischenstand

Spec 3. Alles im Schema `private`, das PostgREST nicht ausliefert. Der Client sieht davon
nur, was `public.google_connection_status()` freigibt — nie ein Token.

**Files:**

- Create: `supabase/migrations/20260812120000_add_google_sync_connections.sql`

**Interfaces:**

- Consumes: nichts.
- Produces: die Tabellen `private.google_connections`, `private.google_oauth_states` und
  die Funktion `public.google_connection_status()`, die
  `{ connected boolean, google_email text, time_zone text, granted_scopes text[], status text, last_run_at timestamptz }`
  als eine Zeile liefert. Tasks 6, 7 und 10 benutzen sie.

- [ ] **Step 1: Die Migration schreiben**

Create `supabase/migrations/20260812120000_add_google_sync_connections.sql`:

```sql
-- Google-Sync v1, Teil 1: Verbindung und OAuth-Zwischenstand.
--
-- Alles liegt in `private`, damit PostgREST es nicht ausliefert. Der Client
-- kommt ausschliesslich ueber die SECURITY-DEFINER-Funktion unten heran, und
-- die gibt weder Token noch code_verifier zurueck.

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

-- Eine aktive Verbindung je Nutzer. Widerrufene bleiben als Historie stehen.
create unique index google_connections_one_active_per_user
  on private.google_connections (user_id)
  where status <> 'revoked';

create table private.google_oauth_states (
  state text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  code_verifier text not null,
  nonce text not null,
  requested_scopes text[] not null,
  redirect_to text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index google_oauth_states_expires_at on private.google_oauth_states (expires_at);

alter table private.google_connections enable row level security;
alter table private.google_oauth_states enable row level security;
-- Keine Policies, mit Absicht: nur der Service-Role-Key kommt heran, und der
-- umgeht RLS. Fuer `authenticated` und `anon` bleiben beide Tabellen zu.

create or replace function public.google_connection_status()
returns table (
  connected boolean,
  google_email text,
  time_zone text,
  granted_scopes text[],
  status text,
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
    c.granted_scopes,
    c.status,
    c.last_run_at
  from private.google_connections c
  where c.user_id = auth.uid()
    and c.status <> 'revoked'
  union all
  select false, null::text, null::text, '{}'::text[], 'disconnected'::text, null::timestamptz
  where not exists (
    select 1 from private.google_connections c
    where c.user_id = auth.uid() and c.status <> 'revoked'
  );
$$;

revoke all on function public.google_connection_status() from public;
grant execute on function public.google_connection_status() to authenticated;
```

- [ ] **Step 2: Die Migration anwenden**

Über das Supabase-MCP-Werkzeug `apply_migration`, Name `add_google_sync_connections`, Inhalt
wörtlich wie oben.

- [ ] **Step 3: Prüfen, dass die Funktion für einen Nicht-Verbundenen sauber antwortet**

Run über `execute_sql`:

```sql
select * from public.google_connection_status();
```

Expected: genau eine Zeile, `connected = false`, `status = 'disconnected'`. **Nicht null
Zeilen** — der Screen unterscheidet sonst nicht zwischen „nicht verbunden" und „Abfrage
fehlgeschlagen".

- [ ] **Step 4: Den Sicherheitsberater befragen**

Über das MCP-Werkzeug `get_advisors` mit `type: "security"`.
Expected: keine **neuen** Befunde zu `private.google_*`. Die bekannten Altlasten
(`crawled_events`, `pg_net`, `dblink`, die drei `SECURITY DEFINER`-Partnerfunktionen)
bleiben unverändert stehen.

- [ ] **Step 5: Die Typen neu erzeugen und committen**

Über `generate_typescript_types`, Ergebnis nach `packages/data/src/database.generated.ts`.

```bash
git add supabase/migrations packages/data/src/database.generated.ts && git commit -m "feat(db): private Tabellen fuer die Google-Verbindung"
```

---

## Task 6: Edge Function `google-sync-api` — Gerüst und OAuth-Start

Spec 2.3. Der Browser bekommt nie ein Token zu sehen; er bekommt nur eine URL, auf die er
den Nutzer schickt.

**Files:**

- Create: `supabase/functions/google-sync-api/index.ts`
- Create: `supabase/functions/google-sync-api/crypto.ts`
- Create: `supabase/functions/google-sync-api/oauth.ts`

**Interfaces:**

- Consumes: `private.google_oauth_states` (Task 5).
- Produces: `POST /google-sync-api/oauth/start` → `{ authorizeUrl: string }`, und die
  Bausteine `encryptSecret(plain: string): Promise<string>` /
  `decryptSecret(packed: string): Promise<string>` aus `crypto.ts`, die Task 7 benutzt.

- [ ] **Step 1: Die Token-Verschlüsselung schreiben**

Create `supabase/functions/google-sync-api/crypto.ts`:

```ts
// AES-256-GCM. Der Schluessel kommt aus dem Supabase-Secret GOOGLE_TOKEN_KEY
// (32 Byte, base64) und steht nirgends sonst — nicht im Repo, nicht in einer
// Migration, nicht in einem Log.

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

- [ ] **Step 2: Den OAuth-Start schreiben**

Create `supabase/functions/google-sync-api/oauth.ts`:

```ts
export const SCOPE_APP_CREATED =
  'https://www.googleapis.com/auth/calendar.app.created';
export const SCOPE_READONLY =
  'https://www.googleapis.com/auth/calendar.readonly';

const CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID') ?? '';
const CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET') ?? '';
const REDIRECT_URI =
  'https://nyvripddydrzvfuateea.supabase.co/functions/v1/google-sync-api/callback';

export interface PkcePair {
  verifier: string;
  challenge: string;
}

export async function createPkce(): Promise<PkcePair> {
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
  scopes: string[];
}): string {
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', CLIENT_ID);
  url.searchParams.set('redirect_uri', REDIRECT_URI);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', options.scopes.join(' '));
  url.searchParams.set('state', options.state);
  url.searchParams.set('code_challenge', options.challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  // offline + consent: ohne beides liefert Google beim zweiten Mal kein
  // Refresh-Token, und der serverseitige Lauf haette nichts zu erneuern.
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent');
  // Erhaelt Stufe 1, wenn spaeter Stufe 2 nachgefordert wird (Spec 2.2).
  url.searchParams.set('include_granted_scopes', 'true');
  return url.toString();
}

export async function exchangeCode(
  code: string,
  verifier: string,
): Promise<{
  refresh_token?: string;
  access_token: string;
  expires_in: number;
  scope: string;
}> {
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

- [ ] **Step 3: Das Gerüst mit der Start-Route schreiben**

Create `supabase/functions/google-sync-api/index.ts`:

```ts
import {
  authorizeUrl,
  createPkce,
  randomToken,
  SCOPE_APP_CREATED,
} from './oauth.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const STATE_TTL_MS = 5 * 60 * 1000;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
  });
}

/** Ruft PostgREST mit dem Service-Role-Key. `private` ist von aussen unerreichbar. */
async function db(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('apikey', SERVICE_ROLE_KEY);
  headers.set('authorization', `Bearer ${SERVICE_ROLE_KEY}`);
  headers.set('content-type', 'application/json');
  headers.set('accept-profile', 'private');
  headers.set('content-profile', 'private');
  return await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers });
}

/** Liest die Nutzer-ID aus dem mitgeschickten JWT. */
async function userId(request: Request): Promise<string | null> {
  const auth = request.headers.get('authorization');
  if (!auth) return null;
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SERVICE_ROLE_KEY, authorization: auth },
  });
  if (!response.ok) return null;
  const body = (await response.json()) as { id?: string };
  return body.id ?? null;
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
        requested_scopes: [SCOPE_APP_CREATED],
        redirect_to: redirectTo ?? '/profil/sync',
        expires_at: new Date(Date.now() + STATE_TTL_MS).toISOString(),
      }),
    });
    if (!insert.ok) return json({ error: 'state_not_stored' }, 500);

    return json({
      authorizeUrl: authorizeUrl({
        state,
        challenge,
        scopes: [SCOPE_APP_CREATED],
      }),
    });
  }

  return json({ error: 'not_found' }, 404);
});
```

- [ ] **Step 4: Deployen**

Über das MCP-Werkzeug `deploy_edge_function`, Name `google-sync-api`, `verify_jwt: false`.

`verify_jwt` muss **false** sein, weil `/callback` in Task 7 von Google ohne JWT kommt. Die
Nutzerrouten prüfen deshalb selbst über `userId(request)` — genau das tut `/oauth/start`
oben in seiner ersten Zeile.

- [ ] **Step 5: Prüfen, dass ohne JWT nichts geht**

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST "https://nyvripddydrzvfuateea.supabase.co/functions/v1/google-sync-api/oauth/start"
```

Expected: `401`

- [ ] **Step 6: Committen**

```bash
git add supabase/functions/google-sync-api && git commit -m "feat(functions): google-sync-api mit OAuth-Start und Token-Krypto"
```

---

## Task 7: OAuth-Rückweg und Verbindung anlegen

Spec 2.3 und 2.4. Google ruft hier ohne JWT an; die Echtheit hängt am `state`, der genau
einmal verwendbar ist.

**Files:**

- Modify: `supabase/functions/google-sync-api/index.ts`

**Interfaces:**

- Consumes: `exchangeCode`, `accessTokenFor` (Task 6), `encryptSecret` (Task 6),
  `private.google_oauth_states` und `private.google_connections` (Task 5).
- Produces: `GET /google-sync-api/callback?code&state` → Weiterleitung (302) zurück in die
  App; `GET /google-sync-api/status` → dieselbe Zeile wie
  `public.google_connection_status()`; `POST /google-sync-api/disconnect` → `{ ok: true }`.

- [ ] **Step 1: Die Callback-Route ergänzen**

In `supabase/functions/google-sync-api/index.ts`, vor dem abschließenden `not_found`:

```ts
if (path === '/callback' && request.method === 'GET') {
  const query = new URL(request.url).searchParams;
  const state = query.get('state') ?? '';
  const code = query.get('code') ?? '';

  // Erst holen, dann sofort loeschen: ein state ist genau einmal gueltig,
  // und ein zweiter Aufruf mit demselben Wert darf ins Leere laufen.
  const found = await db(
    `google_oauth_states?state=eq.${encodeURIComponent(state)}`,
    {
      method: 'DELETE',
      headers: { prefer: 'return=representation' },
    },
  );
  const rows = found.ok ? ((await found.json()) as StateRow[]) : [];
  const entry = rows[0];
  if (!entry || new Date(entry.expires_at) < new Date()) {
    return redirect('/profil/sync?google=state_invalid');
  }
  if (!code) return redirect(`${entry.redirect_to}?google=denied`);

  const token = await exchangeCode(code, entry.code_verifier);
  if (!token.refresh_token)
    return redirect(`${entry.redirect_to}?google=no_refresh_token`);

  const profile = await googleUserInfo(token.access_token);
  const upsert = await db('google_connections?on_conflict=user_id', {
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
  if (!upsert.ok) return redirect(`${entry.redirect_to}?google=not_stored`);

  return redirect(`${entry.redirect_to}?google=connected`);
}

if (path === '/status' && request.method === 'GET') {
  const user = await userId(request);
  if (!user) return json({ error: 'unauthorized' }, 401);
  const rows = await db(
    `google_connections?user_id=eq.${user}&status=neq.revoked&select=id,google_email,time_zone,granted_scopes,status,last_run_at`,
  );
  const list = rows.ok ? ((await rows.json()) as ConnectionRow[]) : [];
  const entry = list[0];
  if (!entry) {
    return json({
      connected: false,
      google_email: null,
      status: 'disconnected',
      first_real_run_allowed: false,
    });
  }
  // Der Screen sperrt „Jetzt exportieren", solange kein Probelauf gelaufen
  // ist (Spec 4). Diese Auskunft muss deshalb im Status stehen — sonst
  // muesste der Client sie raten.
  const bindings = await db(
    `google_calendar_bindings?connection_id=eq.${entry.id}&is_active=is.true&select=first_real_run_allowed_at`,
  );
  const binding = bindings.ok
    ? (
        (await bindings.json()) as {
          first_real_run_allowed_at: string | null;
        }[]
      )[0]
    : undefined;
  return json({
    connected: true,
    ...entry,
    first_real_run_allowed: Boolean(binding?.first_real_run_allowed_at),
  });
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
```

Dazu die Helfer und Typen im selben Modul:

```ts
interface StateRow {
  user_id: string;
  code_verifier: string;
  redirect_to: string;
  expires_at: string;
}

interface ConnectionRow {
  id: string;
  google_email: string;
  time_zone: string;
  granted_scopes: string[];
  status: string;
  last_run_at: string | null;
}

const APP_BASE_URL = 'https://ralia-app.onrender.com';

function redirect(to: string): Response {
  return new Response(null, {
    status: 302,
    headers: { ...CORS_HEADERS, location: `${APP_BASE_URL}${to}` },
  });
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
```

Der Import in Zeile 1 wird erweitert um `exchangeCode`, und `encryptSecret` kommt aus
`./crypto.ts`.

- [ ] **Step 2: Deployen**

Über `deploy_edge_function`, Name `google-sync-api`, `verify_jwt: false`, mit allen vier
Dateien.

- [ ] **Step 3: Den Rückweg gegen einen erfundenen `state` prüfen**

```bash
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" "https://nyvripddydrzvfuateea.supabase.co/functions/v1/google-sync-api/callback?state=erfunden&code=egal"
```

Expected: `302` und eine Ziel-URL, die auf `google=state_invalid` endet. **Nicht** 500 —
ein ungültiger `state` ist ein erwarteter Fall, kein Absturz.

- [ ] **Step 4: Prüfen, dass keine Zeile entstanden ist**

Über `execute_sql`:

```sql
select count(*) from private.google_connections;
```

Expected: `0`

- [ ] **Step 5: Committen**

```bash
git add supabase/functions/google-sync-api && git commit -m "feat(functions): OAuth-Rueckweg legt die Google-Verbindung an"
```

---

## Task 8: Datenschicht und Screen — verbunden oder nicht

Erst hier verschwindet ein Stück Attrappe. Der Screen zeigt danach den **echten**
Verbindungszustand; alles Übrige der Attrappe bleibt zunächst stehen und geht in Task 11.

**Files:**

- Create: `packages/data/src/google-sync-api.ts`
- Create: `packages/data/src/google-sync-api.test.ts`
- Modify: `packages/data/src/index.ts`
- Modify: `apps/app/src/data/DataProvider.tsx`
- Modify: `apps/app/src/screens/settings/SyncScreen.tsx`
- Modify: `apps/app/src/screens/settings/SyncScreen.test.tsx`
- Modify: `apps/app/src/i18n/additions.json`, `de.json`, `en.json`

**Interfaces:**

- Consumes: die Routen aus Task 7.
- Produces:

```ts
interface GoogleConnectionStatus {
  connected: boolean;
  googleEmail: string | null;
  timeZone: string | null;
  status: 'active' | 'needs_reauth' | 'revoked' | 'disconnected';
  lastRunAt: string | null;
}
interface GoogleSyncApiClient {
  status(): Promise<GoogleConnectionStatus>;
  startOAuth(redirectTo: string): Promise<{ authorizeUrl: string }>;
  disconnect(): Promise<{ ok: true }>;
}
function createGoogleSyncApi(
  options: GoogleSyncApiOptions,
): GoogleSyncApiClient;
```

Task 11 erweitert denselben Klienten.

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

Create `packages/data/src/google-sync-api.test.ts`:

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
  it('meldet eine bestehende Verbindung mit Konto und Zeitzone', async () => {
    const fetchImpl = vi.fn(async () =>
      ok({
        connected: true,
        google_email: 'jemand@example.com',
        time_zone: 'Europe/Berlin',
        status: 'active',
        last_run_at: null,
        first_real_run_allowed: false,
      }),
    );

    const status = await api(fetchImpl as unknown as typeof fetch).status();

    expect(status).toEqual({
      connected: true,
      googleEmail: 'jemand@example.com',
      timeZone: 'Europe/Berlin',
      status: 'active',
      lastRunAt: null,
      firstRealRunAllowed: false,
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

  it('gibt die Autorisierungs-URL durch, ohne sie zu veraendern', async () => {
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

Create `packages/data/src/google-sync-api.ts`, in der Form von `privacy-api.ts` daneben:

```ts
export interface GoogleSyncApiOptions {
  supabaseUrl: string;
  anonKey: string;
  getAccessToken(): Promise<string | null>;
  fetchImpl?: typeof fetch;
  functionName?: string;
}

export interface GoogleConnectionStatus {
  connected: boolean;
  googleEmail: string | null;
  timeZone: string | null;
  status: 'active' | 'needs_reauth' | 'revoked' | 'disconnected';
  lastRunAt: string | null;
  /** Erst nach einem fehlerfreien Probelauf true (Spec 4). */
  firstRealRunAllowed: boolean;
}

export interface GoogleSyncApiClient {
  status(): Promise<GoogleConnectionStatus>;
  startOAuth(redirectTo: string): Promise<{ authorizeUrl: string }>;
  disconnect(): Promise<{ ok: true }>;
}

export class GoogleSyncApiError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
  ) {
    super(code);
  }
}

interface StatusResponse {
  connected?: boolean;
  google_email?: string | null;
  time_zone?: string | null;
  status?: string;
  last_run_at?: string | null;
  first_real_run_allowed?: boolean;
}

export class GoogleSyncApi implements GoogleSyncApiClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: GoogleSyncApiOptions) {
    const functionName = options.functionName ?? 'google-sync-api';
    this.baseUrl = `${options.supabaseUrl.replace(/\/+$/, '')}/functions/v1/${functionName}`;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  private async json<T>(path: string, init: RequestInit = {}): Promise<T> {
    const accessToken = await this.options.getAccessToken();
    if (!accessToken) throw new GoogleSyncApiError('unauthorized', 401);

    const headers = new Headers(init.headers);
    headers.set('apikey', this.options.anonKey);
    headers.set('authorization', `Bearer ${accessToken}`);
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      ...init,
      headers,
    });
    if (!response.ok) {
      let code = 'request_failed';
      try {
        const body = (await response.json()) as { error?: unknown };
        if (typeof body.error === 'string') code = body.error;
      } catch {
        // Eine unlesbare Fehlerantwort hilft dem Aufrufer nicht weiter.
      }
      throw new GoogleSyncApiError(code, response.status);
    }
    return (await response.json()) as T;
  }

  async status(): Promise<GoogleConnectionStatus> {
    const body = await this.json<StatusResponse>('/status');
    return {
      connected: body.connected === true,
      googleEmail: body.google_email ?? null,
      timeZone: body.time_zone ?? null,
      status:
        (body.status as GoogleConnectionStatus['status']) ?? 'disconnected',
      lastRunAt: body.last_run_at ?? null,
      firstRealRunAllowed: body.first_real_run_allowed === true,
    };
  }

  startOAuth(redirectTo: string): Promise<{ authorizeUrl: string }> {
    return this.json('/oauth/start', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ redirectTo }),
    });
  }

  disconnect(): Promise<{ ok: true }> {
    return this.json('/disconnect', { method: 'POST' });
  }
}

export function createGoogleSyncApi(
  options: GoogleSyncApiOptions,
): GoogleSyncApi {
  return new GoogleSyncApi(options);
}
```

Aus `packages/data/src/index.ts` re-exportieren, in der Form der `privacy-api`-Zeilen dort:

```ts
export {
  createGoogleSyncApi,
  GoogleSyncApi,
  GoogleSyncApiError,
  type GoogleConnectionStatus,
  type GoogleSyncApiClient,
  type GoogleSyncApiOptions,
} from './google-sync-api.js';
```

- [ ] **Step 4: Lauf zeigen lassen, dass er besteht**

Run: `npx vitest run packages/data/src/google-sync-api.test.ts`
Expected: PASS, 4 Tests

- [ ] **Step 5: Den Klienten im DataProvider bereitstellen**

In `apps/app/src/data/DataProvider.tsx` den Sync-Klienten genauso aufbauen und über den
Kontext anbieten, wie es dort für `privacyApi` schon geschieht — dieselbe Quelle für
`supabaseUrl`, `anonKey` und `getAccessToken`.

- [ ] **Step 6: Den Screen-Test für den echten Zustand schreiben**

In `apps/app/src/screens/settings/SyncScreen.test.tsx`:

```ts
import type { GoogleConnectionStatus } from '@ralia/data';

function getrennt(): GoogleConnectionStatus {
  return {
    connected: false,
    googleEmail: null,
    timeZone: null,
    status: 'disconnected',
    lastRunAt: null,
    firstRealRunAllowed: false,
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
    lastRunAt: null,
    firstRealRunAllowed: false,
    ...overrides,
  };
}

it('zeigt die Aufforderung zum Verbinden, solange kein Konto verbunden ist', async () => {
  renderSyncScreen(getrennt());

  expect(
    await screen.findByRole('button', { name: 'Mit Google verbinden' }),
  ).toBeInTheDocument();
  expect(screen.queryByTestId('sync-account')).not.toBeInTheDocument();
});

it('nennt das verbundene Konto', async () => {
  renderSyncScreen(verbunden());

  expect(await screen.findByText('jemand@example.com')).toBeInTheDocument();
});
```

`renderSyncScreen(status, overrides?)` ist ein Helfer in derselben Datei, der den Screen mit
einem Sync-Klienten-Doppel rendert: `status()` liefert den übergebenen Zustand, `run()` und
`recentRuns()` kommen aus `overrides` und fallen sonst auf harmlose Vorgaben zurück
(`run` liefert `{ dryRun: true, exported: 0, skipped: 0, error: null }`, `recentRuns` eine
leere Liste). Nutze das Muster, mit dem `SettingsScreen.test.tsx` seine Datenschicht
ersetzt. `verbunden()` und `getrennt()` benutzt auch Task 11.

- [ ] **Step 7: Lauf zeigen lassen, dass er fehlschlägt**

Run: `npx vitest run apps/app/src/screens/settings/SyncScreen.test.tsx`
Expected: FAIL — der Knopf „Mit Google verbinden" existiert noch nicht

- [ ] **Step 8: Den Screen umbauen**

In `apps/app/src/screens/settings/SyncScreen.tsx`:

- `MOCK_SYNC_ACCOUNTS` und die daraus gebaute Kontoliste entfernen.
- `status()` beim Mounten laden, Ladezustand über `Skeleton` aus `@ralia/ui`.
- Nicht verbunden: Erklärungstext plus Knopf, der `startOAuth('/profil/sync')` ruft und
  danach `globalThis.location.assign(authorizeUrl)` ausführt.
- Verbunden: E-Mail, Zeitzone, letzter Lauf, Knopf _Verbindung trennen_.
- Der Text muss den Warnbildschirm aus Spec 2.1 ankündigen — er überrascht sonst.

Neue i18n-Schlüssel, in `additions.json` **und** in beide Kataloge:

| Schlüssel                | de                                                                                                                         | en                                                                                        |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `googleConnect`          | `Mit Google verbinden`                                                                                                     | `Connect with Google`                                                                     |
| `googleDisconnect`       | `Verbindung trennen`                                                                                                       | `Disconnect`                                                                              |
| `googleNotConnected`     | `Noch kein Google-Konto verbunden.`                                                                                        | `No Google account connected yet.`                                                        |
| `googleUnverifiedNotice` | `Google zeigt beim Verbinden einen Warnhinweis, weil Ralia nicht öffentlich geprüft ist. Über „Erweitert" geht es weiter.` | `Google shows a warning because Ralia is not publicly verified. Continue via "Advanced".` |
| `googleScopeAppCreated`  | `Ralia legt dafür einen eigenen Google-Kalender an und sieht nur diesen.`                                                  | `Ralia creates its own Google calendar and sees only that one.`                           |
| `googleConnectedAs`      | `Verbunden als`                                                                                                            | `Connected as`                                                                            |
| `googleTimeZone`         | `Zeitzone`                                                                                                                 | `Time zone`                                                                               |
| `googleLastRun`          | `Letzter Lauf`                                                                                                             | `Last run`                                                                                |
| `googleNeverRun`         | `noch nie`                                                                                                                 | `never`                                                                                   |

- [ ] **Step 9: Lauf zeigen lassen, dass er besteht**

Run: `npm test`
Expected: PASS

- [ ] **Step 10: Im Browser prüfen**

Dev-Server über `preview_start` mit `app-dev`, dann `/app/profil/sync` öffnen. Erwartet:
die Aufforderung zum Verbinden, keine erfundenen Konten mehr, keine Konsolenfehler.

- [ ] **Step 11: Committen**

```bash
git add packages/data apps/app/src && git commit -m "feat(app): der Sync-Screen zeigt den echten Verbindungszustand"
```

---

## Task 9: Migration — Bindung, Zuordnung, Läufe

Spec 3, zweiter Block.

**Files:**

- Create: `supabase/migrations/20260812130000_add_google_sync_bindings.sql`

**Interfaces:**

- Consumes: `private.google_connections` (Task 5).
- Produces: `private.google_calendar_bindings`, `private.google_event_mappings`,
  `private.google_sync_runs`, `private.google_sync_changes` und
  `public.google_sync_recent()`, die die letzten 20 Läufe des Aufrufers liefert.

Der Spec nennt die Vergleichsfelder in 2.9 `ralia_hash` und `google_hash`. Sie heißen hier
`ralia_fingerprint` und `google_fingerprint`, weil in Task 4 entschieden wurde, den
kanonischen String zu speichern statt ihn zu hashen — „hash" wäre für den Inhalt des Feldes
schlicht der falsche Name. Gemeint ist dasselbe.

- [ ] **Step 1: Die Migration schreiben**

Create `supabase/migrations/20260812130000_add_google_sync_bindings.sql`:

```sql
-- Google-Sync v1, Teil 1: Bindung, Zuordnung, Laufprotokoll.

create table private.google_calendar_bindings (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references private.google_connections(id) on delete cascade,
  calendar_id text not null,
  google_calendar_id text,
  import_source_calendar_ids text[] not null default '{}',
  mode text not null default 'export' check (mode in ('import', 'export', 'sync')),
  schedule text not null default 'off' check (schedule in ('off', 'active', 'paused')),
  first_real_run_allowed_at timestamptz,
  sync_token text,
  locked_at timestamptz,
  is_active boolean not null default true,
  last_full_sync_at timestamptz,
  last_run_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index google_bindings_one_active
  on private.google_calendar_bindings (connection_id, calendar_id)
  where is_active;

create table private.google_event_mappings (
  id uuid primary key default gen_random_uuid(),
  binding_id uuid not null references private.google_calendar_bindings(id) on delete cascade,
  ralia_event_id uuid not null,
  google_event_id text not null,
  kind text not null default 'single' check (kind in ('master', 'exception', 'single')),
  ralia_exception_id uuid,
  occurrence_date date,
  ralia_fingerprint text not null,
  google_fingerprint text not null,
  google_etag text,
  state text not null default 'synced' check (state in ('synced', 'conflicted', 'deleted')),
  last_synced_at timestamptz not null default now()
);

-- NULLS NOT DISTINCT ist hier zwingend: `occurrence_date` ist bei Master und
-- Einzeltermin null, und Postgres haelt NULLs im Unique-Index sonst fuer
-- verschieden — zwei Zuordnungen desselben Termins kaemen anstandslos durch,
-- und genau das soll der Index verhindern.
create unique index google_mappings_one_per_event
  on private.google_event_mappings (binding_id, ralia_event_id, occurrence_date)
  nulls not distinct;

create unique index google_mappings_one_per_google_event
  on private.google_event_mappings (binding_id, google_event_id);

create table private.google_sync_runs (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references private.google_connections(id) on delete cascade,
  binding_id uuid references private.google_calendar_bindings(id) on delete set null,
  trigger text not null check (trigger in ('cron', 'manual')),
  mode text not null check (mode in ('import', 'export', 'sync')),
  dry_run boolean not null default false,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  imported integer not null default 0,
  exported integer not null default 0,
  skipped integer not null default 0,
  conflicts integer not null default 0,
  deletions_reported integer not null default 0,
  error text
);

create index google_sync_runs_recent on private.google_sync_runs (connection_id, started_at desc);

create table private.google_sync_changes (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references private.google_sync_runs(id) on delete cascade,
  mapping_id uuid references private.google_event_mappings(id) on delete set null,
  direction text not null check (direction in ('import', 'export')),
  action text not null check (action in ('created', 'updated', 'deleted', 'skipped')),
  title text,
  reason text,
  at timestamptz not null default now()
);

create index google_sync_changes_run on private.google_sync_changes (run_id);

alter table private.google_calendar_bindings enable row level security;
alter table private.google_event_mappings enable row level security;
alter table private.google_sync_runs enable row level security;
alter table private.google_sync_changes enable row level security;
-- Wie in der ersten Migration: keine Policies, weil kein Client-Zugriff besteht.

create or replace function public.google_sync_recent()
returns table (
  run_id uuid,
  trigger text,
  mode text,
  dry_run boolean,
  started_at timestamptz,
  finished_at timestamptz,
  imported integer,
  exported integer,
  skipped integer,
  conflicts integer,
  deletions_reported integer,
  error text
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    r.id, r.trigger, r.mode, r.dry_run, r.started_at, r.finished_at,
    r.imported, r.exported, r.skipped, r.conflicts, r.deletions_reported, r.error
  from private.google_sync_runs r
  join private.google_connections c on c.id = r.connection_id
  where c.user_id = auth.uid()
  order by r.started_at desc
  limit 20;
$$;

revoke all on function public.google_sync_recent() from public;
grant execute on function public.google_sync_recent() to authenticated;
```

- [ ] **Step 2: Die Migration anwenden**

Über `apply_migration`, Name `add_google_sync_bindings`.

- [ ] **Step 3: Prüfen, dass der Doppel-Schutz auf `null` greift**

Über `execute_sql`, in einer Transaktion, die am Ende zurückgerollt wird:

```sql
begin;
insert into private.google_connections (user_id, google_sub, google_email, refresh_token_encrypted)
  select id, 'sub', 'qa@example.com', 'x' from auth.users limit 1;
insert into private.google_calendar_bindings (connection_id, calendar_id)
  select id, 'QA:kalender' from private.google_connections order by created_at desc limit 1;
insert into private.google_event_mappings (binding_id, ralia_event_id, google_event_id, ralia_fingerprint, google_fingerprint)
  select id, gen_random_uuid(), 'g1', 'f', 'f' from private.google_calendar_bindings order by created_at desc limit 1;
-- Dieselbe ralia_event_id ein zweites Mal, occurrence_date beide Male null:
insert into private.google_event_mappings (binding_id, ralia_event_id, google_event_id, ralia_fingerprint, google_fingerprint)
  select m.binding_id, m.ralia_event_id, 'g2', 'f', 'f' from private.google_event_mappings m limit 1;
rollback;
```

Expected: die **zweite** Einfügung schlägt fehl mit `duplicate key value violates unique
constraint "google_mappings_one_per_event"`. Geht sie durch, fehlt `nulls not distinct` —
dann ist der Index falsch und muss korrigiert werden, bevor es weitergeht.

- [ ] **Step 4: Den Sicherheitsberater befragen**

Über `get_advisors` mit `type: "security"`.
Expected: keine neuen Befunde zu `private.google_*`.

- [ ] **Step 5: Typen neu erzeugen und committen**

```bash
git add supabase/migrations packages/data/src/database.generated.ts && git commit -m "feat(db): Bindung, Zuordnung und Laufprotokoll fuer den Google-Sync"
```

---

## Task 10: Der Export-Lauf, mit Probelauf

Spec 4. Dieser Task schreibt in Google, **nicht** in `events`.

**Files:**

- Create: `supabase/functions/google-sync-api/google.ts`
- Create: `supabase/functions/google-sync-api/run.ts`
- Modify: `supabase/functions/google-sync-api/index.ts`

**Interfaces:**

- Consumes: `accessTokenFor` (Task 6), `decryptSecret` (Task 6), die Tabellen aus Task 9,
  und aus `@ralia/core` die Funktionen `toGoogleEvent` und `fingerprintRaliaEvent` (Tasks
  3 und 4) — in Deno über einen relativen Import der Quelldateien, weil Edge Functions den
  Workspace nicht auflösen.
- Produces: `POST /google-sync-api/run` mit `{ dryRun?: boolean }` → die Kennzahlen des
  Laufs. Task 11 ruft sie.

- [ ] **Step 1: Den Google-Klienten schreiben**

Create `supabase/functions/google-sync-api/google.ts`:

```ts
const BASE = 'https://www.googleapis.com/calendar/v3';

async function call(
  token: string,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('authorization', `Bearer ${token}`);
  headers.set('content-type', 'application/json');
  return await fetch(`${BASE}${path}`, { ...init, headers });
}

/** Legt den Kalender „Ralia" an. Nur so bleibt er unter calendar.app.created erreichbar. */
export async function createRaliaCalendar(
  token: string,
  timeZone: string,
): Promise<string> {
  const response = await call(token, '/calendars', {
    method: 'POST',
    body: JSON.stringify({ summary: 'Ralia', timeZone }),
  });
  if (!response.ok)
    throw new Error(`calendar_create_failed_${response.status}`);
  const body = (await response.json()) as { id: string };
  return body.id;
}

export async function calendarExists(
  token: string,
  calendarId: string,
): Promise<boolean> {
  const response = await call(
    token,
    `/calendars/${encodeURIComponent(calendarId)}`,
  );
  return response.ok;
}

export async function calendarTimeZone(
  token: string,
  calendarId: string,
): Promise<string | null> {
  const response = await call(
    token,
    `/calendars/${encodeURIComponent(calendarId)}`,
  );
  if (!response.ok) return null;
  const body = (await response.json()) as { timeZone?: string };
  return body.timeZone ?? null;
}

export async function insertEvent(
  token: string,
  calendarId: string,
  body: unknown,
): Promise<{ id: string; etag: string }> {
  const response = await call(
    token,
    `/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
  );
  if (!response.ok) throw new Error(`event_insert_failed_${response.status}`);
  return await response.json();
}

export async function patchEvent(
  token: string,
  calendarId: string,
  eventId: string,
  body: unknown,
): Promise<{ id: string; etag: string }> {
  const response = await call(
    token,
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    { method: 'PATCH', body: JSON.stringify(body) },
  );
  if (!response.ok) throw new Error(`event_patch_failed_${response.status}`);
  return await response.json();
}
```

- [ ] **Step 2: Den Lauf schreiben**

Create `supabase/functions/google-sync-api/run.ts`:

```ts
import { decryptSecret } from './crypto.ts';
import { accessTokenFor } from './oauth.ts';
import {
  calendarExists,
  calendarTimeZone,
  createRaliaCalendar,
  insertEvent,
  patchEvent,
} from './google.ts';
// Deno loest den Workspace nicht auf — die reine Logik kommt deshalb ueber
// relative Pfade in die Function, nicht ueber @ralia/core.
import {
  toGoogleEvent,
  type RaliaEventForExport,
} from '../../../packages/core/src/google/event-mapping.ts';
import { fingerprintRaliaEvent } from '../../../packages/core/src/google/fingerprint.ts';

const LOCK_TTL_MS = 15 * 60 * 1000;

export interface RunOptions {
  userId: string;
  dryRun: boolean;
  trigger: 'cron' | 'manual';
  db: (path: string, init?: RequestInit) => Promise<Response>;
}

export interface RunResult {
  dryRun: boolean;
  exported: number;
  skipped: number;
  error: string | null;
}

interface ConnectionRow {
  id: string;
  time_zone: string;
  refresh_token_encrypted: string;
}

interface BindingRow {
  id: string;
  calendar_id: string;
  google_calendar_id: string | null;
  first_real_run_allowed_at: string | null;
  locked_at: string | null;
}

interface EventRow extends RaliaEventForExport {
  id: string;
  recurrence_type: string | null;
}

interface MappingRow {
  id: string;
  ralia_event_id: string;
  google_event_id: string;
  ralia_fingerprint: string;
}

export async function runExport(options: RunOptions): Promise<RunResult> {
  const { db, dryRun } = options;
  const rows = async <T>(path: string): Promise<T[]> => {
    const response = await db(path);
    return response.ok ? ((await response.json()) as T[]) : [];
  };

  const [connection] = await rows<ConnectionRow>(
    `google_connections?user_id=eq.${options.userId}&status=eq.active&select=id,time_zone,refresh_token_encrypted`,
  );
  if (!connection)
    return { dryRun, exported: 0, skipped: 0, error: 'not_connected' };

  // Die calendar_id des Nutzers ist dieselbe, die die App sieht: der aktive
  // Paarkalender, sonst die eigene UUID (Spec 2.8).
  const [membership] = await rows<{ calendar_id: string }>(
    `calendar_memberships?user_id=eq.${options.userId}&is_active=is.true&select=calendar_id`,
  );
  const calendarId = membership?.calendar_id ?? options.userId;

  let [binding] = await rows<BindingRow>(
    `google_calendar_bindings?connection_id=eq.${connection.id}&calendar_id=eq.${encodeURIComponent(calendarId)}&is_active=is.true&select=id,calendar_id,google_calendar_id,first_real_run_allowed_at,locked_at`,
  );
  if (!binding) {
    const created = await db('google_calendar_bindings', {
      method: 'POST',
      headers: { prefer: 'return=representation' },
      body: JSON.stringify({
        connection_id: connection.id,
        calendar_id: calendarId,
        mode: 'export',
      }),
    });
    binding = ((await created.json()) as BindingRow[])[0]!;
  }

  if (
    binding.locked_at &&
    Date.now() - new Date(binding.locked_at).getTime() < LOCK_TTL_MS
  ) {
    return { dryRun, exported: 0, skipped: 0, error: 'locked' };
  }
  await db(`google_calendar_bindings?id=eq.${binding.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ locked_at: new Date().toISOString() }),
  });

  const run = await db('google_sync_runs', {
    method: 'POST',
    headers: { prefer: 'return=representation' },
    body: JSON.stringify({
      connection_id: connection.id,
      binding_id: binding.id,
      trigger: options.trigger,
      mode: 'export',
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
    db('google_sync_changes', {
      method: 'POST',
      body: JSON.stringify({
        run_id: runId,
        mapping_id: mappingId ?? null,
        direction: 'export',
        action,
        title,
        reason: reason ?? null,
      }),
    });

  let exported = 0;
  let skipped = 0;
  let failure: string | null = null;

  try {
    const token = await accessTokenFor(
      await decryptSecret(connection.refresh_token_encrypted),
    );

    // Ziel sicherstellen. Der Kalender kann in Google geloescht worden sein.
    let googleCalendarId = binding.google_calendar_id;
    if (!googleCalendarId || !(await calendarExists(token, googleCalendarId))) {
      if (googleCalendarId) {
        await db(`google_event_mappings?binding_id=eq.${binding.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ state: 'deleted' }),
        });
      }
      if (dryRun) {
        await note('created', 'Ralia', 'calendar_would_be_created');
        googleCalendarId = null;
      } else {
        googleCalendarId = await createRaliaCalendar(
          token,
          connection.time_zone,
        );
        const zone = await calendarTimeZone(token, googleCalendarId);
        await db(`google_calendar_bindings?id=eq.${binding.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ google_calendar_id: googleCalendarId }),
        });
        if (zone && zone !== connection.time_zone) {
          await db(`google_connections?id=eq.${connection.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ time_zone: zone }),
          });
        }
      }
    }

    const events = await rows<EventRow>(
      `events?calendar_id=eq.${encodeURIComponent(calendarId)}&select=id,name,location,notes,start_date,start_time,end_date,end_time,recurrence_type`,
    );
    const mappings = await rows<MappingRow>(
      `google_event_mappings?binding_id=eq.${binding.id}&state=eq.synced&select=id,ralia_event_id,google_event_id,ralia_fingerprint`,
    );
    const byEvent = new Map(mappings.map((m) => [m.ralia_event_id, m]));

    for (const event of events) {
      // Serien kommen in Teil 2. Sie werden protokolliert, nicht verschwiegen.
      if (event.recurrence_type) {
        skipped += 1;
        await note('skipped', event.name, 'recurring_event_deferred_to_part_2');
        continue;
      }
      // events.google_event_id bleibt unangetastet (Spec 2.7): die Alt-IDs
      // zeigen in den primaeren Kalender, auf den v1 keinen Zugriff hat.

      const fingerprint = fingerprintRaliaEvent(event);
      const existing = byEvent.get(event.id);

      if (existing && existing.ralia_fingerprint === fingerprint) continue;

      if (dryRun) {
        exported += 1;
        await note(
          existing ? 'updated' : 'created',
          event.name,
          'dry_run',
          existing?.id,
        );
        continue;
      }

      const body = toGoogleEvent(event, connection.time_zone);
      if (existing) {
        const patched = await patchEvent(
          token,
          googleCalendarId!,
          existing.google_event_id,
          body,
        );
        await db(`google_event_mappings?id=eq.${existing.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            ralia_fingerprint: fingerprint,
            google_fingerprint: fingerprint,
            google_etag: patched.etag,
            last_synced_at: new Date().toISOString(),
          }),
        });
        exported += 1;
        await note('updated', event.name, undefined, existing.id);
      } else {
        const inserted = await insertEvent(token, googleCalendarId!, body);
        await db('google_event_mappings', {
          method: 'POST',
          body: JSON.stringify({
            binding_id: binding.id,
            ralia_event_id: event.id,
            google_event_id: inserted.id,
            kind: 'single',
            ralia_fingerprint: fingerprint,
            google_fingerprint: fingerprint,
            google_etag: inserted.etag,
          }),
        });
        exported += 1;
        await note('created', event.name);
      }
    }
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error);
    if (failure.startsWith('refresh_failed')) {
      await db(`google_connections?id=eq.${connection.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'needs_reauth' }),
      });
    }
  }

  await db(`google_sync_runs?id=eq.${runId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      finished_at: new Date().toISOString(),
      exported,
      skipped,
      error: failure,
    }),
  });
  await db(`google_calendar_bindings?id=eq.${binding.id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      locked_at: null,
      last_run_at: new Date().toISOString(),
      // Erst ein fehlerfreier Probelauf gibt den echten Lauf frei (Spec 4).
      ...(dryRun && !failure && !binding.first_real_run_allowed_at
        ? { first_real_run_allowed_at: new Date().toISOString() }
        : {}),
    }),
  });

  return { dryRun, exported, skipped, error: failure };
}
```

Beachte: `first_real_run_allowed_at` wird **beim Probelauf** gesetzt, nicht beim echten Lauf
— es ist die Freigabe _für_ den echten Lauf, nicht dessen Quittung.

- [ ] **Step 3: Die Route ergänzen**

In `index.ts`, vor `not_found`:

```ts
if (path === '/run' && request.method === 'POST') {
  const user = await userId(request);
  if (!user) return json({ error: 'unauthorized' }, 401);
  const { dryRun } = (await request.json().catch(() => ({}))) as {
    dryRun?: boolean;
  };
  // `db` wird hereingereicht, damit run.ts weder Umgebungsvariablen noch
  // Schluessel selbst kennt — und damit ein Test es ersetzen kann.
  return json(
    await runExport({
      userId: user,
      dryRun: dryRun === true,
      trigger: 'manual',
      db,
    }),
  );
}
```

- [ ] **Step 4: Deployen und den Probelauf gegen ein Testkonto fahren**

Über `deploy_edge_function`. Dann mit dem JWT eines der freigegebenen Testkonten:

```bash
curl -s -X POST "https://nyvripddydrzvfuateea.supabase.co/functions/v1/google-sync-api/run" -H "authorization: Bearer <JWT-des-Testkontos>" -H "content-type: application/json" -d '{"dryRun":true}'
```

Expected: Kennzahlen mit `dryRun: true` und einer Zahl bei `exported`, die der Zahl der
nicht wiederkehrenden Termine des Testkalenders entspricht.

- [ ] **Step 5: Beweisen, dass der Probelauf nichts geschrieben hat**

Über `execute_sql`:

```sql
select
  (select count(*) from private.google_event_mappings) as zuordnungen,
  (select count(*) from private.google_sync_changes) as protokollzeilen;
```

Expected: `zuordnungen = 0`, `protokollzeilen > 0`. Ist `zuordnungen` größer als null, hat
der Probelauf geschrieben — dann ist Schritt 6 der Ablauflogik falsch umgesetzt und muss
korrigiert werden, bevor irgendein echter Lauf stattfindet.

- [ ] **Step 6: Den echten Lauf gegen dasselbe Testkonto fahren**

Denselben Aufruf ohne `dryRun`. Danach in Google prüfen: ein Kalender „Ralia" existiert und
enthält die Termine des Testkalenders.

- [ ] **Step 7: Den Lauf ein zweites Mal fahren**

Expected: `exported = 0`. Werden dieselben Termine erneut angelegt, greift der
Fingerabdruck-Vergleich nicht — das muss vor Task 11 behoben sein, sonst verdoppelt jeder
getaktete Lauf den Kalender.

- [ ] **Step 8: Committen**

```bash
git add supabase/functions/google-sync-api && git commit -m "feat(functions): Export-Lauf mit Probelauf"
```

---

## Task 11: Der Screen bekommt Betriebsart, Probelauf und Protokoll

Damit verschwindet der letzte Rest der Attrappe für den Export-Weg.

**Files:**

- Modify: `packages/data/src/google-sync-api.ts`
- Modify: `packages/data/src/google-sync-api.test.ts`
- Modify: `apps/app/src/screens/settings/SyncScreen.tsx`
- Modify: `apps/app/src/screens/settings/SyncScreen.test.tsx`
- Modify: `apps/app/src/mock/fixtures.ts`
- Modify: `apps/app/src/i18n/additions.json`, `de.json`, `en.json`

**Interfaces:**

- Consumes: `POST /run` (Task 10), `public.google_sync_recent()` (Task 9).
- Produces: `run(options: { dryRun: boolean }): Promise<GoogleSyncRunResult>` und
  `recentRuns(): Promise<GoogleSyncRun[]>` am Klienten aus Task 8.

- [ ] **Step 1: Den fehlschlagenden Screen-Test schreiben**

In `apps/app/src/screens/settings/SyncScreen.test.tsx`:

```ts
it('verlangt einen Probelauf, bevor der echte Lauf freigegeben wird', async () => {
  renderSyncScreen(verbunden(), { firstRealRunAllowed: false });

  expect(
    await screen.findByRole('button', { name: 'Probelauf starten' }),
  ).toBeEnabled();
  expect(
    screen.getByRole('button', { name: 'Jetzt exportieren' }),
  ).toBeDisabled();
});

it('gibt den echten Lauf nach einem Probelauf frei', async () => {
  const run = vi.fn(async () => ({
    dryRun: true,
    exported: 3,
    skipped: 0,
    error: null,
  }));
  renderSyncScreen(verbunden(), { firstRealRunAllowed: false, run });

  await userEvent.click(
    await screen.findByRole('button', { name: 'Probelauf starten' }),
  );

  expect(run).toHaveBeenCalledWith({ dryRun: true });
  expect(await screen.findByText(/3/)).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'Jetzt exportieren' }),
  ).toBeEnabled();
});

it('zeigt keine erfundenen Protokollzeilen mehr', async () => {
  renderSyncScreen(verbunden(), { recentRuns: [] });

  expect(
    await screen.findByRole('button', { name: 'Probelauf starten' }),
  ).toBeInTheDocument();
  expect(screen.queryByTestId('sync-log-row')).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Lauf zeigen lassen, dass er fehlschlägt**

Run: `npx vitest run apps/app/src/screens/settings/SyncScreen.test.tsx`
Expected: FAIL — „Probelauf starten" existiert nicht

- [ ] **Step 3: Den Klienten erweitern**

In `packages/data/src/google-sync-api.ts`:

```ts
export interface GoogleSyncRunResult {
  dryRun: boolean;
  exported: number;
  skipped: number;
  error: string | null;
}

export interface GoogleSyncRun {
  runId: string;
  trigger: 'cron' | 'manual';
  mode: 'import' | 'export' | 'sync';
  dryRun: boolean;
  startedAt: string;
  exported: number;
  skipped: number;
  error: string | null;
}
```

und die beiden Methoden `run({ dryRun })` gegen `POST /run` sowie `recentRuns()` gegen die
RPC `google_sync_recent` über PostgREST. Für die RPC benutze denselben Weg, über den die
übrigen Repositories in `packages/data/src/repositories/` ihre RPCs rufen.

- [ ] **Step 4: Den Screen umbauen**

- `MOCK_SYNC_LOG`, `MOCK_CONFLICT` und `MOCK_CALENDARS` aus dem Screen entfernen und
  anschließend aus `apps/app/src/mock/fixtures.ts` löschen. `MOCK_SYNC_ACCOUNTS` ist in
  Task 8 schon gegangen.
- Betriebsart: für Teil 1 nur **Export**, sichtbar als gesetzte Auswahl. Import und Sync
  erscheinen als Einträge mit dem Hinweis, dass sie noch nicht verfügbar sind — nicht als
  bedienbare Knöpfe, die nichts tun. Das war der Fehler der Attrappe.
- Takt: für Teil 1 nur _Einmal jetzt_. Der getaktete Lauf kommt mit dem Cron in Teil 3.
- _Probelauf starten_ ruft `run({ dryRun: true })` und zeigt danach die Kennzahlen.
- _Jetzt exportieren_ ist deaktiviert, solange kein Probelauf gelaufen ist.
- Die Konfliktkarte entfällt vollständig — es gibt in Teil 1 keine Konflikte.
- Protokoll aus `recentRuns()`; ist die Liste leer, `EmptyState` statt erfundener Zeilen.

Neue i18n-Schlüssel, in `additions.json` **und** beide Kataloge:

| Schlüssel                 | de                                             | en                                         |
| ------------------------- | ---------------------------------------------- | ------------------------------------------ |
| `googleDryRun`            | `Probelauf starten`                            | `Start dry run`                            |
| `googleDryRunHint`        | `Zeigt, was passieren würde. Schreibt nichts.` | `Shows what would happen. Writes nothing.` |
| `googleExportNow`         | `Jetzt exportieren`                            | `Export now`                               |
| `googleExportNeedsDryRun` | `Erst nach einem Probelauf.`                   | `Only after a dry run.`                    |
| `googleModeExport`        | `Export — Ralia nach Google`                   | `Export — Ralia to Google`                 |
| `googleModeSoon`          | `kommt später`                                 | `coming later`                             |
| `googleRunEmpty`          | `Noch kein Lauf.`                              | `No run yet.`                              |
| `googleRunExported`       | `exportiert`                                   | `exported`                                 |
| `googleRunSkipped`        | `übersprungen`                                 | `skipped`                                  |

- [ ] **Step 5: Lauf zeigen lassen, dass er besteht**

Run: `npm test`
Expected: PASS

- [ ] **Step 6: Prüfen, dass die Fixtures wirklich weg sind**

```bash
grep -rn "MOCK_SYNC_ACCOUNTS\|MOCK_SYNC_LOG\|MOCK_CONFLICT\|MOCK_CALENDARS" apps/app/src
```

Expected: keine Ausgabe

- [ ] **Step 7: Im Browser prüfen**

Über `preview_start` mit `app-dev`, dann `/app/profil/sync`. Erwartet: echter
Verbindungszustand, Export als einzige bedienbare Betriebsart, _Jetzt exportieren_
deaktiviert, leeres Protokoll mit `EmptyState`, keine Konsolenfehler.

- [ ] **Step 8: `npm run verify` und committen**

```bash
npm run verify && git add packages/data apps/app/src && git commit -m "feat(app): Sync-Screen mit Betriebsart Export, Probelauf und echtem Protokoll"
```

---

## Was danach kommt

**Teil 2 — Import und Serien.** Stufe-2-Scope nachfordern, Quellkalender auswählen,
`zonedWallClock()` für die Gegenrichtung der Zeitzone, Import von Einzelterminen,
RRULE-Abbildung in beide Richtungen samt Ausnahmen, das Melden nicht abbildbarer Serien.
Das ist der erste Teil, der in `events` schreibt — er beginnt mit der Datensicherung aus
Spec 6.5.

**Teil 3 — Sync, Konflikte, Takt.** Die Entscheidungstabelle aus Spec 2.9 vollständig,
Konfliktzeilen und ihre Auflösung im Screen, die Löschmatrix aus Spec 2.12, `pg_cron` alle
zehn Minuten mit Sperre und Backoff, Pausieren und Fortsetzen.

Beide bekommen ihren eigenen Plan, wenn Teil 1 abgenommen ist. Der Zuschnitt kann sich
durch das ändern, was Teil 1 an Überraschungen zutage fördert — ihn jetzt zu schreiben
hieße, ihn zweimal zu schreiben.

## Anmerkung zur Reihenfolge

Das Release-Audit nennt als eigentliche Blocker für den ersten Release nicht Google-Sync,
sondern die **PWA-Hülle** und die **Push-Registrierung** — ohne sie lässt sich die App nicht
auf den Homescreen legen, und Erinnerungen erreichen kein neu installiertes Gerät, obwohl
die serverseitige Pipeline fehlerfrei läuft. Beide sind kleine, geschlossene Arbeitspakete.

Wenn „vollfunktionale App" die Priorität ist, gehören sie vor Teil 1. Der Plan hier ist
davon unabhängig und wartet nicht.
