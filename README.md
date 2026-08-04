# Ralia

Teile Deine Tage gemeinsam — Kalender, Organizer und Haushaltskasse für Paare.

Eine Codebasis für **Android**, **iOS** und **Web** mit Marketing-Homepage.

> **Status: im Aufbau.** Dieser Branch ist ein Neubau. `npm run dev` startet noch nicht — die SPA entsteht in Task 12 des laufenden Sub-Projekts. Was heute steht, ist das Fundament: Datenschicht, Offline-Queue und Design-System.

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
```

`packages/core` darf React, DOM und Supabase nicht kennen. Diese Grenze ist der Grund, warum die schwierigen Teile — Serien-Expansion, Offline-Queue, Split-Arithmetik — als reine Funktionen testbar sind. In der Vorgängerversion lagen sie als globale Funktionen neben DOM-Code und waren es nicht.

## Backend

Unverändert übernommen und als externe Vertragsgrenze behandelt: dasselbe Supabase-Projekt, dasselbe Schema, dieselbe `app-api` Edge Function wie die Produktionsversion. 25 Migrationen, RLS auf allen Tabellen, Partner-Zugriff über `calendar_id`, Reminder-Pipeline über `pg_cron`.

Der Quellcode der Edge Function liegt nicht in diesem Repo. Wir konsumieren sie, wir ändern sie nicht.

## Entwicklung

```bash
npm install
npm test          # Vitest
npm run typecheck # tsc --noEmit, strict
npm run lint      # ESLint
npm run verify    # alles zusammen
```

## Design

Das Design stammt aus einem Claude-Design-Prototypen, der versioniert unter [`docs/design-reference/`](docs/design-reference/) liegt. Die Farbwerte sind nicht abgetippt, sondern per Test abgesichert: [`tokens.parity.test.ts`](packages/ui/src/tokens/tokens.parity.test.ts) liest die Vorlage und vergleicht sie eigenschaftsweise mit `tokens.css`. Weicht ein Wert ab, schlägt der Test fehl und nennt die Eigenschaft.

## Dokumentation

| Pfad | Inhalt |
|---|---|
| [`docs/superpowers/specs/`](docs/superpowers/specs/) | Programm-Design und Sub-Projekt-Spezifikationen |
| [`docs/superpowers/plans/`](docs/superpowers/plans/) | Implementierungspläne |
| [`docs/design-reference/`](docs/design-reference/) | Design-Vorlage, Quelle aller Tokens |
| [`docs/native-rebuild-reference/`](docs/native-rebuild-reference/) | Quellstand des vorherigen Expo-Anlaufs, als Referenz aufgehoben |

## Lizenz

Siehe [LICENSE](LICENSE).
