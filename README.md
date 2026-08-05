# Ralia

Teile Deine Tage gemeinsam — Kalender, Organizer und Haushaltskasse für Paare.

Eine Codebasis für **Android**, **iOS** und **Web** mit Marketing-Homepage.

> **Status: SP0 abgeschlossen.** `npm run dev` startet die App unter `/app/`. Alle acht Ansichten und alle acht Bottom Sheets stehen, gefüllt mit den Demo-Daten der Design-Vorlage — noch ohne Anmeldung und ohne Live-Daten. Was daran geprüft ist, steht im [Abnahmeprotokoll](docs/superpowers/plans/2026-08-03-sp0-abnahme.md).

## Architektur

```
packages/
  core/     Domain-Logik, framework-frei, ohne DOM und ohne Supabase
            outbox/    Offline-Queue auf IndexedDB, Legacy-Import
            calendar/  Monatsraster, Wochengeometrie, Zellendichte
  data/     Supabase-Client, generierte DB-Typen, appApi-Wrapper
  ui/       Design-System: Tokens, Primitive, Overlays, AppShell
apps/
  app/      React + Vite SPA — Web /app/* und Capacitor-Webroot
            boot/      Boot-Reihenfolge, Legacy-Migration, Ladezustand
            i18n/      Kataloge und Provider, DE und EN
            routes/    Router und die Naht zur AppShell
            screens/   Kalender, Planer, Todos, Geld, Einstellungen, Sync
            sheets/    die acht Bottom Sheets
            mock/      Demo-Daten der Vorlage (SP0-Platzhalter)
e2e/        Playwright-Smoke-Tests gegen den Preview-Build
```

`packages/core` darf React, DOM und Supabase nicht kennen. Diese Grenze ist der Grund, warum die schwierigen Teile — Serien-Expansion, Offline-Queue, Split-Arithmetik — als reine Funktionen testbar sind. In der Vorgängerversion lagen sie als globale Funktionen neben DOM-Code und waren es nicht.

## Backend

Unverändert übernommen und als externe Vertragsgrenze behandelt: dasselbe Supabase-Projekt, dasselbe Schema, dieselbe `app-api` Edge Function wie die Produktionsversion. 25 Migrationen, RLS auf allen Tabellen, Partner-Zugriff über `calendar_id`, Reminder-Pipeline über `pg_cron`.

Der Quellcode der Edge Function liegt nicht in diesem Repo. Wir konsumieren sie, wir ändern sie nicht.

## Entwicklung

```bash
npm install
npm run dev       # Vite, http://localhost:5173/app/
npm test          # Vitest — 363 Tests
npm run typecheck # tsc --noEmit, strict
npm run lint      # ESLint
npm run verify    # typecheck + lint + test + build
npm run e2e       # Playwright gegen den Preview-Build
```

Die Übersetzungen werden nicht getippt, sondern aus Ralia_Opus extrahiert:

```bash
npm run i18n:extract              # de.json und en.json neu schreiben
node scripts/extract-i18n.mjs --check   # nur prüfen, für CI
```

Das Skript erwartet `Ralia_Opus` als Schwesterverzeichnis; ein anderer Ort geht über `--source`.

## Design

Das Design stammt aus einem Claude-Design-Prototypen, der versioniert unter [`docs/design-reference/`](docs/design-reference/) liegt. Die Farbwerte sind nicht abgetippt, sondern per Test abgesichert: [`tokens.parity.test.ts`](packages/ui/src/tokens/tokens.parity.test.ts) liest die Vorlage und vergleicht sie eigenschaftsweise mit `tokens.css`. Weicht ein Wert ab, schlägt der Test fehl und nennt die Eigenschaft.

## Dokumentation

| Pfad | Inhalt |
|---|---|
| [`docs/superpowers/specs/`](docs/superpowers/specs/) | Programm-Design und Sub-Projekt-Spezifikationen |
| [`docs/superpowers/plans/`](docs/superpowers/plans/) | Implementierungspläne |
| [`docs/design-reference/`](docs/design-reference/) | Design-Vorlage, Quelle aller Tokens |
| [`docs/superpowers/plans/2026-08-03-sp0-abnahme.md`](docs/superpowers/plans/2026-08-03-sp0-abnahme.md) | Abnahmeprotokoll SP0 gegen die zehn Kriterien des Specs |
| [`docs/native-rebuild-reference/`](docs/native-rebuild-reference/) | Quellstand des vorherigen Expo-Anlaufs, als Referenz aufgehoben |

## Lizenz

Siehe [LICENSE](LICENSE).
