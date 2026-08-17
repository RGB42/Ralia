# Ralia (v2) — eingefroren

> ## ⛔ Dieses Repository ist seit dem 2026-08-17 eingefroren
>
> **Weiterentwickelt wird `Ralia_Opus`.** Dort läuft die produktive App.
>
> ### Warum
>
> Es soll nur eine Ralia geben. Die Wahl fiel auf `Ralia_Opus`, weil dort der Google-Kalender-Sync produktiv läuft und echte Nutzerdaten liegen — beides Dinge, die hier fehlen. Das ist eine Entscheidung über den kürzeren Weg zum Ziel, kein Urteil über diese Codebasis: die Schichtentrennung, die 864 Tests und die Token-Paritätsprüfung sind hier besser als dort.
>
> ### Der konkrete Anlass
>
> Zwei Migrationen von hier haben Schreibpfade der produktiven App gebrochen:
>
> - `20260811111003_simplify_expense_tracker` verlangt per Constraint `for_user_id` bei `split_type='single'`
> - `20260811112113_enforce_expense_category` macht `category` NOT NULL
>
> `Ralia_Opus` setzt beides nicht. Ausgaben „nur für den Zahler" und Ausgaben ohne Kategorie wurden ab dem 11. August von der Datenbank abgelehnt, ohne dass dort etwas geändert worden war. Ursache war nicht die Migration, sondern dass **eine Datenbank aus zwei Codebasen bespielt wurde, ohne Regel, wem das Schema gehört.**
>
> ### Was das für dieses Repository heißt
>
> **Keine Schemaänderungen mehr am Projekt `nyvripddydrzvfuateea`.** Die acht Migrationen unter [`supabase/migrations/`](supabase/migrations/) sind dort angewendet und liegen jetzt auch in `Ralia_Opus/supabase/migrations/`. Die MCP-Verbindung zum Produktivprojekt ist in [`.mcp.json`](.mcp.json) entfernt und in [`opencode.json`](opencode.json) auf `enabled: false` gesetzt. Bitte nicht reaktivieren.
>
> Gelöscht wird nichts. Kandidaten für eine spätere Übernahme: die Design-Tokens unter `packages/ui`, die centgenaue Ledger-Logik in `packages/core/src/money/ledger.ts`, und die Web-Push-Bausteine unter `packages/core/src/push/` und `packages/data/src/repositories/push-repo.ts`.
>
> Begründung und Vorgehen: [`Ralia_Opus/docs/superpowers/specs/2026-08-17-konsolidierung-design.md`](../Ralia_Opus/docs/superpowers/specs/2026-08-17-konsolidierung-design.md)

Teile Deine Tage gemeinsam — Kalender, Organizer und Haushaltskasse für Paare.

Programmziel war eine Codebasis für **Android**, **iOS** und **Web** mit Marketing-Homepage. Gebaut und ausgeliefert wurde die **Web-App**.

> **Status: SP0 bis SP4 abgeschlossen.** `npm run dev` startet die App unter `/app/`. Anmeldung, Identität, Partner-Verbindung und Jahrestag kommen aus Supabase. Der Kalender besitzt CRUD, mehrtägige Wochenbalken, Serien und Exceptions, Realtime sowie eine kontogebundene Offline-Outbox. Todo-Gruppen und -Einträge arbeiten mit echten, kalendergebundenen Repositories. Der Wochenplaner speichert Mahlzeiten, Aufgaben, Zuständigkeiten und Abschlussstatus. Die Haushaltskasse speichert Ausgaben, Kategorien, Budgets, individuelle Anteile und Ausgleichstransaktionen; die Bilanz wird centgenau berechnet.
>
> **Noch nicht gebaut:** Google-Sync (der Screen unter `/profil/sync` ist reine Attrappe), Push-Registrierung im Client (die serverseitige Erinnerungs-Pipeline läuft, erreicht aber kein neu installiertes Gerät), PWA-Hülle, native Projekte (SP7) und Marketing-Site (SP8). Der vollständige Befund steht im [Release-Audit](docs/2026-08-12-release-audit.md).
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
  app/      React + Vite SPA — Web /app/*, spaeter Capacitor-Webroot (SP7)
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
npm test          # Vitest — 864 Tests
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
| [`docs/2026-08-12-release-audit.md`](docs/2026-08-12-release-audit.md)                                 | Befund vor dem ersten Release: Blocker, Lücken, Reihenfolge     |
| [`docs/design-reference/`](docs/design-reference/)                                                     | Design-Vorlage, Quelle aller Tokens                             |
| [`docs/superpowers/plans/2026-08-03-sp0-abnahme.md`](docs/superpowers/plans/2026-08-03-sp0-abnahme.md) | Abnahmeprotokoll SP0 gegen die zehn Kriterien des Specs         |
| [`docs/native-rebuild-reference/`](docs/native-rebuild-reference/)                                     | Quellstand des vorherigen Expo-Anlaufs, als Referenz aufgehoben |

## Lizenz

Siehe [LICENSE](LICENSE).
