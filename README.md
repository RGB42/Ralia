# Ralia

Teile Deine Tage gemeinsam — Kalender, Organizer und Haushaltskasse für Paare.

Eine Codebasis für **Android**, **iOS** und **Web** mit Marketing-Homepage.

> **Status: SP0 und SP1 abgeschlossen, SP2 bis SP4 in Umsetzung.** `npm run dev` startet die App unter `/app/`. Anmeldung, Identität, Partner-Verbindung und Jahrestag kommen aus Supabase. Der Kalender besitzt CRUD, mehrtägige Wochenbalken, Serien und Exceptions, Realtime sowie eine kontogebundene Offline-Outbox. Todo-Gruppen und -Einträge arbeiten ebenfalls mit echten, kalendergebundenen Repositories. Der Wochenplaner speichert Mahlzeiten, Aufgaben, Zuständigkeiten und Abschlussstatus. Die Haushaltskasse speichert Ausgaben, Kategorien, Budgets, individuelle Anteile und Ausgleichstransaktionen; die Bilanz wird centgenau berechnet.
>
> [SP0-Abnahmeprotokoll](docs/superpowers/plans/2026-08-03-sp0-abnahme.md) · [SP1-Spec](docs/superpowers/specs/2026-08-05-sp1-auth-partner-design.md) · [SP1-Plan](docs/superpowers/plans/2026-08-05-sp1-auth-partner.md) · [SP1-Abnahme](docs/superpowers/plans/2026-08-05-sp1-abnahme.md)

## Architektur

```
packages/
    core/     Domain-Logik, framework-frei, ohne DOM und ohne Supabase
             outbox/    Offline-Queue auf IndexedDB, Legacy-Import
             calendar/  Monatsraster, Wochengeometrie, Zellendichte
             recurrence/ Serien-Expansion und Ausnahmen
  data/     Supabase-Client, generierte DB-Typen, appApi-Wrapper
  ui/       Design-System: Tokens, Primitive, Overlays, AppShell
apps/
  app/      React + Vite SPA — Web /app/* und Capacitor-Webroot
            boot/      Boot-Reihenfolge, Legacy-Migration, Ladezustand
            i18n/      Kataloge und Provider, DE und EN
            routes/    Router und die Naht zur AppShell
             auth/      Sitzungszustand, Routenwache
             data/      gebundene Fach-Repositories
            screens/   Kalender, Planer, Todos, Geld, Einstellungen, Sync, Anmeldung
            sheets/    die acht Bottom Sheets
             mock/      verbleibende Demo-Daten fuer Planer, Geld und Tests
supabase/    versionierte Vorwaerts-Migrationen fuer den bestehenden Backendvertrag
e2e/        Playwright-Smoke-Tests gegen den Preview-Build
```

`packages/core` darf React, DOM und Supabase nicht kennen. Diese Grenze ist der Grund, warum die schwierigen Teile — Serien-Expansion und Offline-Queue — als reine Funktionen testbar sind. In der Vorgängerversion lagen sie als globale Funktionen neben DOM-Code und waren es nicht.

## Backend

Weiterverwendet werden dasselbe Supabase-Projekt und dieselben Edge Functions wie in der Produktionsversion. Neue additive Schemaänderungen liegen reproduzierbar unter [`supabase/migrations/`](supabase/migrations/). RLS schützt alle fachlichen Tabellen; Partner-Zugriff läuft weiterhin über `calendar_id`, die Reminder-Pipeline über `pg_cron`.

Der Quellcode der Edge Function liegt nicht in diesem Repo. Wir konsumieren sie, wir ändern sie nicht.

## Entwicklung

```bash
npm install
npm run dev       # Vite, http://localhost:5173/app/
npm test          # Vitest — 858 Tests
npm run typecheck # tsc --noEmit, strict
npm run lint      # ESLint
npm run verify    # typecheck + lint + test + build
npm run e2e       # Playwright gegen den Preview-Build
npm run e2e:live  # zusätzlich die Tests, die das echte Backend brauchen
```

`e2e:live` setzt `RALIA_LIVE=1` und lässt damit
[`config-live.spec.ts`](e2e/config-live.spec.ts) mitlaufen — die Tests gegen den
echten `/config`-Endpunkt. Ohne die Variable werden sie übersprungen statt rot,
damit eine Umgebung ohne Netzzugang nicht falsch Alarm schlägt.

Die Übersetzungen werden nicht getippt, sondern aus Ralia_Opus extrahiert:

```bash
npm run i18n:extract              # de.json und en.json neu schreiben
node scripts/extract-i18n.mjs --check   # nur prüfen, für CI
```

Das Skript erwartet `Ralia_Opus` als Schwesterverzeichnis; ein anderer Ort geht über `--source`.

## Design

Das Design stammt aus einem Claude-Design-Prototypen, der versioniert unter [`docs/design-reference/`](docs/design-reference/) liegt. Die Farbwerte sind nicht abgetippt, sondern per Test abgesichert: [`tokens.parity.test.ts`](packages/ui/src/tokens/tokens.parity.test.ts) liest die Vorlage und vergleicht sie eigenschaftsweise mit `tokens.css`. Weicht ein Wert ab, schlägt der Test fehl und nennt die Eigenschaft.

## Dokumentation

| Pfad                                                                                                   | Inhalt                                                          |
| ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| [`docs/superpowers/specs/`](docs/superpowers/specs/)                                                   | Programm-Design und Sub-Projekt-Spezifikationen                 |
| [`docs/superpowers/plans/`](docs/superpowers/plans/)                                                   | Implementierungspläne                                           |
| [`docs/AI_HANDOFF.md`](docs/AI_HANDOFF.md)                                                             | Aktueller Implementierungsstand und nächste Agenten-Schritte    |
| [`docs/design-reference/`](docs/design-reference/)                                                     | Design-Vorlage, Quelle aller Tokens                             |
| [`docs/superpowers/plans/2026-08-03-sp0-abnahme.md`](docs/superpowers/plans/2026-08-03-sp0-abnahme.md) | Abnahmeprotokoll SP0 gegen die zehn Kriterien des Specs         |
| [`docs/native-rebuild-reference/`](docs/native-rebuild-reference/)                                     | Quellstand des vorherigen Expo-Anlaufs, als Referenz aufgehoben |

## Lizenz

Siehe [LICENSE](LICENSE).
