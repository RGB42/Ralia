# Ralia Rebuild — Programm-Design

**Datum:** 2026-07-31
**Status:** Freigegeben (Zerlegung), SP0 in Umsetzung

## Ziel

Ralia_Opus vollständig nachbauen als eine Codebasis, die als **native Android-App**, **native iOS-App** und **Webversion mit Marketing-Homepage** ausgeliefert wird. Das Frontend übernimmt das Design der Vorlage _„Paar-Kalender und Organizer App"_. Das bestehende Supabase-Backend (`nyvripddydrzvfuateea`) bleibt **unverändert und kompatibel**.

## Ausgangslage

### Ralia_Opus (Ist)

| Artefakt                | Umfang                                                                 |
| ----------------------- | ---------------------------------------------------------------------- |
| `public/js/*.js`        | 14.618 Zeilen, 25 Module (globaler `window.*`-Namespace, kein Bundler) |
| `public/index.html`     | 2.203 Zeilen (gesamtes Markup inline)                                  |
| `public/css/styles.css` | 4.078 Zeilen + 51 KB generiertes Tailwind                              |
| `server.js`             | 1.490 Zeilen Express — **Legacy, nicht mehr im Datenpfad**             |
| `migrations/*.sql`      | 25 Migrationen                                                         |

Größte Module: `todo-notes.js` (2.950), `events.js` (2.253), `i18n.js` (1.207), `google-sync.js` (756), `week-planner.js` (725).

### Backend (bleibt wie es ist)

Der entscheidende Befund: `public/js/backend.js` routet `window.appApi` **nicht** auf `server.js`, sondern auf die Supabase Edge Function `app-api`. Verifiziert am 2026-07-31:

```
GET https://nyvripddydrzvfuateea.supabase.co/functions/v1/app-api/config → 200
{ supabaseUrl, supabaseAnonKey: "sb_publishable_…", googleClientId,
  googleRedirectUri: "postmessage", vapidPublicKey, billingEnabled: true }
```

`appApi.fetch('/api/x')` strippt das `/api`-Präfix und ruft `/functions/v1/app-api/x`. Die Route-Liste in `server.js` beschreibt damit die API-Oberfläche der Edge Function: `/config`, `/google/auth-code`, `/google/refresh-token`, `/push/{subscribe,unsubscribe,diagnostics,test,event-notification}`, `/billing/{status,create-checkout-session,create-portal-session,webhook}`, `/admin/*`, `/cron/reminders`.

**Der Quellcode der Edge Function liegt nicht im Repo** (`supabase/` enthält nur `config.toml`). Sie ist deployt und wird als externe Vertragsgrenze behandelt: Wir konsumieren sie, wir ändern sie nicht.

Datenbank: `profiles`, `events`, `recurring_event_exceptions`, `notes_todos`, `notes_todo_groups`, `recurring_tasks`, `recurring_task_logs`, `week_plans`, `shared_expenses`, `push_subscriptions`, `sent_event_reminders`, `event_reminder_jobs`. RLS auf allen Tabellen, Partner-Zugriff über `calendar_id`. RPCs: `connect_partner`, `disconnect_partner`, `set_shared_anniversary`. Reminder-Pipeline: `event_reminder_jobs` + Trigger + `pg_cron` (`* * * * *` → `invoke_reminder_worker()`).

Hosting: Render **Static Site**, Publish-Dir `public`, kein Build-Step.

### Design-Vorlage

[`docs/design-reference/Ralia-Organizer.dc.html`](../../design-reference/Ralia-Organizer.dc.html) — Design-Companion-Prototyp, 1.841 Zeilen, deklarativ (`sc-if`/`sc-for`/`{{ }}`), Styling ausschließlich über Inline-Styles auf CSS-Custom-Properties.

Quelle: Claude-Design-Projekt „Paar-Kalender und Organizer App", `5f629a7f-cfd8-49a9-8249-1e8a4e2d6239`. Ursprünglich lag die Datei nur außerhalb des Repos (`C:\Users\Ralph\Downloads\…`) und war am 2026-08-03 dort nicht mehr vorhanden. Seither ist sie **versionierter Repo-Inhalt** — nicht Umgebungsvoraussetzung. Der Token-Paritätstest aus SP0 liest sie und schlägt fehl, wenn sie fehlt.

Enthält: vollständiges Token-System (Light + Dark), Screens Kalender (Monat/Woche), Wochenplaner, Todos (Übersicht + Detail), Geld, Einstellungen, Sync; 8 Bottom Sheets (`day`, `event`, `item`, `plan`, `todo`, `expense`, `profile`, `new`); Desktop-Sidebar; mobile Bottom-Nav (5 Punkte); FAB.

Deckt die Design-**Sprache** ab, nicht alle App-Screens. Fehlende Oberflächen (Auth, Partner-Verbindung, Serien-Editor, Reminder-Konfiguration, Google-Sync-Detail, Premium-Modal, Account, Admin) werden aus der Sprache **extrapoliert**, nicht neu erfunden.

## Getroffene Entscheidungen

| Frage                                    | Entscheidung                                       | Konsequenz                                                                                                                                                                                          |
| ---------------------------------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Was heißt „native"?                      | **Capacitor** (React + TS + Vite in nativer Shell) | Ein UI-Code für Web/iOS/Android; Vorlagen-Design 1:1 umsetzbar, weil CSS-basiert; Android-Projekt existiert bereits                                                                                 |
| Homepage-Umfang                          | **Volle Marketing-Site**                           | Landing, `/features/*`, `/preise`, `/hilfe/*`, `/blog`, Legal — eigenes Sub-Projekt (SP8)                                                                                                           |
| Rollout                                  | **Ersetzt Ralia komplett**                         | App-ID `com.ralia.twa` bleibt, Keystore `ralia-release-key.keystore` wiederverwenden, gleiche Domain; Service-Worker-Ersetzung und localStorage-Migration sind Pflicht; Feature-Parität vor Go-Live |
| Wiederkehrende Aufgaben in der 5-Tab-Nav | **Segment-Tab in „Todos"** (`Listen                | Routinen`)                                                                                                                                                                                          | Nav bleibt bei 5 Punkten wie in der Vorlage; nutzt den Segment-Switch-Baustein der Vorlage |
| Offline-Schicht                          | **IndexedDB + Legacy-Import**                      | Neuer typisierter Outbox-Store; einmaliger Import der alten `localStorage`-Queues beim Erststart, Alt-Keys erst danach löschen — kein Datenverlust                                                  |

## Architektur

```
ralia/
├── packages/
│   ├── core/     Domain-Logik, framework-frei, 100 % unit-testbar
│   │               recurrence/  Serien-Expansion, Exceptions, Future-Split
│   │               calendar/    calendarId, belongs_to-Spiegelung, Farbzuordnung
│   │               outbox/      Offline-Queue, IndexedDB, Legacy-Import
│   │               premium/     Gating-Regeln, Feature-Limits
│   │               money/       Split-Berechnung, Budget-Aggregation
│   │               recurring-tasks/  Cadence-Perioden, Fortschritt
│   ├── data/     Supabase-Client, generierte DB-Typen, appApi-Wrapper,
│   │             Repositories, Realtime-Subscriptions
│   └── ui/       Design-System aus der Vorlage (Tokens + Komponenten)
├── apps/
│   ├── app/      React + Vite SPA  → Web /app/* und Capacitor-Webroot
│   ├── site/     Marketing-Site    → /
│   └── mobile/   Capacitor: android/ (portiert) + ios/ (neu)
└── supabase/     Migrationen als Read-only-Referenz
```

**Begründung `packages/core` framework-frei:** Die Serien-Logik ist der komplexeste Teil der App und liegt heute als globale Funktionen in `events.js`/`recurring-events.js` — nicht testbar. Als reine Funktionen ohne DOM- und ohne React-Abhängigkeit wird sie unit-testbar, und sie bliebe wiederverwendbar, falls später doch React Native gewünscht ist.

**Begründung Styling via CSS Modules + Tokens (nicht Tailwind):** Die Vorlage arbeitet mit sehr spezifischen Werten (`font-size:11.5px`, `border-radius:22px`, `stroke-width:1.6`). Utility-Klassen würden dagegen arbeiten; CSS Modules geben exakte Treue bei null Runtime-Kosten und funktionieren unverändert in der Capacitor-WebView.

**Begründung Zustand + eigene Repositories (nicht TanStack Query):** Die Offline-Semantik ist sehr spezifisch (optimistischer Snapshot → Queue → Rebase temporärer IDs). TanStack Query darüberzulegen würde eine zweite Wahrheitsquelle erzeugen.

## Zerlegung in Sub-Projekte

Jedes Sub-Projekt bekommt seinen eigenen Spec→Plan→Implementierungs-Zyklus.

| #   | Sub-Projekt                   | Inhalt                                                                                                                                                             | Abhängig von |
| --- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------ |
| 0   | **Fundament & Design-System** | Monorepo, TS strict, Vitest/Playwright, Design-Tokens + Komponenten, AppShell, Light+Dark, i18n DE/EN, Routing, Supabase-Client, Legacy-Migration                  | —            |
| 1   | **Auth & Partner**            | Login/Signup/Google/Passwort-Reset, `recovery`/`signup`-URL-Abfang, Invite-Code, `connect_partner`/`disconnect_partner`, Jahrestag                                 | 0            |
| 2   | **Kalender-Kern**             | Event-CRUD, Serien-Engine + Exceptions + Future-Split, Monat (Swipe-Slider), Woche (Timeline), Tages-Sheet, Event-Sheet, Scope-Modal, Feiertage, Outbox + Realtime | 0, 1         |
| 3   | **Organizer**                 | Todos/Notizen (Gruppen, Einkaufsfelder, Zuweisung, Workflow-Status, Drag-Reorder), Routinen als Segment-Tab, Wochenplaner                                          | 0, 1         |
| 4   | **Geld**                      | `shared_expenses`, Kategorien, Budgets, Split-Typen, Ausgleich/Saldo                                                                                               | 0, 1         |
| 5   | **Reminder & Integrationen**  | Reminder-UI + `event_reminder_jobs`, Push-Abstraktion (Web-Push ↔ Capacitor-Push), Google-Calendar-Sync, ICS Import/Export/Feed                                    | 0, 2         |
| 6   | **Premium, Account, Admin**   | Gating + Upgrade-Modal, LemonSqueezy, Account-Modal, Admin-Tools                                                                                                   | 0, 1         |
| 7   | **Native Shells**             | Capacitor iOS neu + Android portiert, Safe Areas, Statusbar, Splash, Deep Links, Store-Assets, Build-Pipeline                                                      | 2, 3, 4, 5   |
| 8   | **Marketing-Site**            | Landing, Features, Preise, Hilfe, Blog, Legal, SEO/OG/Sitemap, DE/EN                                                                                               | 0            |
| 9   | **Cutover**                   | Render-Build auf `dist`, Redirects, PWA/SW-Ersetzung, Parity-Checkliste, Rollback                                                                                  | alle         |

Offene Technologiefrage in SP8: **Astro** (echtes SSG, Markdown-Content-Collections für Blog/Hilfe, bessere Core Web Vitals) gegen React + `vite-plugin-ssg` (ein Framework weniger). Entscheidung gehört in SP8.

---

# SP0 — Fundament & Design-System

## Umfang

SP0 liefert das Skelett, an dem alle weiteren Sub-Projekte hängen. Kein Feature-Screen mit echten Daten — aber eine lauffähige App mit korrekter Navigation, korrektem Design, Theme-Umschaltung, Übersetzung und funktionierender Offline-Infrastruktur.

### In Scope

1. **Monorepo** — npm workspaces, TypeScript strict, Vitest (Unit), Playwright (E2E-Gerüst), Prettier, ESLint.
2. **`packages/ui`**
   - `tokens.css` — die Custom-Properties der Vorlage **wertgenau**, Light und Dark.
   - Poppins 400/500/600/700 **selbst gehostet** als woff2. Begründung: Die Vorlage lädt Poppins von Google Fonts; in einer nativen Capacitor-App und offline ist das nicht verfügbar.
   - Primitives: `Button`, `IconButton`, `SegmentSwitch`, `Card`, `Input`, `Select`, `Textarea`, `Toggle`, `Avatar`, `AvatarPair`, `Chip`, `ProgressBar`, `Toast`, `ConfirmDialog`, `EmptyState`, `Skeleton`, `ListRow`, `FieldLabel`, `SheetHandle`.
   - `Icon` — Inline-SVG-Set mit den Pfaden der Vorlage (20×20-ViewBox, `stroke-width:1.6`).
   - `BottomSheet` + `Modal` — inkl. Backdrop, `ral-up`/`ral-fade`-Animationen, Scroll-Lock, Fokus-Falle, Escape.
3. **`packages/ui` AppShell** — `AppLayout` (Desktop-Sidebar ab Breakpoint, mobile Bottom-Nav darunter), `AppHeader` (Kicker/Titel/Back/Range-Navigation/Add), `Fab`, `NavItem`.
4. **`packages/core/outbox`** — IndexedDB-Outbox (typisiert), Flush-Lifecycle (`online`, `visibilitychange`, Intervall), temporäre IDs + Rebase-Hook, und der **Legacy-Importer**.
5. **`packages/data`** — Supabase-Client (lazy, gecached), generierte DB-Typen, `appApi`-Wrapper gegen die Edge Function, Runtime-Config-Bootstrap über `/config`.
6. **`apps/app`** — Vite-SPA: Routing über die 5 Tabs, `ThemeProvider` (`data-ralia-theme`, System + manuell, persistiert), `I18nProvider` (DE/EN), Boot-Sequenz mit Legacy-Migration, Platzhalter-Screens je Tab.
7. **i18n-Katalog** — die 570 Schlüssel aus `i18n.js` mechanisch nach `de.json`/`en.json` extrahiert (Skript, kein Handabtippen).

### Explizit nicht in Scope (spätere Sub-Projekte)

Echte Auth (SP1), Event-Daten und Kalender-Rendering (SP2), Todos/Planer (SP3), Geld (SP4), Push/Google/ICS (SP5), Billing/Admin (SP6), native Projekte (SP7), Marketing-Site (SP8), Render-Umstellung (SP9).

## Design-Tokens

Wertgenau aus der Vorlage übernommen. Light:

```
--brand:#7c3aed  --brand-600:#6d28d9  --brand-500:#8b5cf6
--brand-soft:#f5f3ff  --brand-line:#ede9fe  --accent:#ec4899
--u1:#3b82f6  --u2:#ec4899  --both:#8b5cf6  --bday:#f97316
--ink-900:#0f172a  --ink-700:#334155  --ink-500:#64748b  --ink-400:#94a3b8
--line:#e2e8f0  --line-soft:#f1f5f9
--surface:#fff  --surface-2:#f8fafc  --bg-app:#f4f2fa  --chrome:#efecf6
--ok:#059669  --danger:#dc2626
```

Dark überschreibt `brand*`, `ink*`, `line*`, `surface*`, `bg-app`, `chrome`, `warn*`, `shadow*`, `hov-*` — die Personenfarben `u1`/`u2`/`both`/`bday` bleiben in beiden Themes identisch.

**Kompatibilitätshinweis:** `u1`/`u2`/`both`/`bday` entsprechen den Klassen `.event-user1`/`.event-user2`/`.event-both`/`.event-birthday` aus `public/css/styles.css`. Die Zuordnung `belongs_to → Farbe` bleibt damit identisch zur Altversion. Die Altversion hat zusätzlich Grün für Jahrestag; die Vorlage kennt dafür kein Token — SP2 ergänzt `--anniv` in derselben Tonalität.

## Offline-Outbox

```
Mutation
  → optimistisch auf Snapshot anwenden
  → in IndexedDB-Outbox anhängen (temp-ID falls Insert)
  → Flush bei online / visible / Intervall 60 s
  → bei Erfolg: temp-ID gegen echte DB-ID rebasen, Eintrag entfernen
  → bei Netzfehler: Eintrag bleibt liegen, Retry mit Backoff
  → bei fachlichem Fehler (4xx): Eintrag verwerfen, Snapshot zurückrollen, Toast
```

Der Fehlerklassifikator wird 1:1 aus `offline-store.js` (`isOfflineSyncError`) übernommen — er kennt die Meldungstexte, die Supabase und die verschiedenen WebViews tatsächlich produzieren (`failed to fetch`, `load failed`, `network request failed`, `session check timeout`, …).

### Legacy-Import (Erststart)

```
1. Alten Service Worker deregistrieren (Scope /), Caches löschen
2. localStorage nach Alt-Keys scannen
     pending mutations → IndexedDB-Outbox übernehmen
     Event-Snapshots   → verwerfen (werden ohnehin neu geladen)
3. Alt-Keys löschen, Migrations-Marker setzen
4. Outbox flushen
```

Reihenfolge ist zwingend: Alt-Keys erst löschen, **nachdem** der Import committed ist. Der Marker verhindert Doppelläufe.

## Teststrategie

- **Unit (Vitest)** — `packages/core` vollständig: Outbox-Zustandsmaschine, Legacy-Importer, Fehlerklassifikator. Reine Funktionen, keine Mocks nötig außer `fake-indexeddb`.
- **Komponenten (Vitest + Testing Library)** — `packages/ui`: Primitives auf Rendering/A11y/Tastatur, `BottomSheet` auf Fokus-Falle und Escape.
- **E2E (Playwright)** — Gerüst plus zwei Smoke-Tests: App bootet und zeigt Kalender-Tab; Theme-Umschaltung persistiert über Reload.
- Ab SP1 gilt TDD pro Feature.

## Abnahmekriterien SP0

1. `npm run typecheck` fehlerfrei (TS strict, keine `any`-Escapes in `core`/`data`).
2. `npm test` grün, `packages/core/outbox` mit Tests für: Enqueue, Flush-Erfolg, Netzfehler-Retry, 4xx-Verwurf, temp-ID-Rebase, Legacy-Import inkl. Doppellauf-Schutz.
3. `npm run build` erzeugt `apps/app/dist` ohne Warnungen.
4. `npm run dev` zeigt die App: Desktop-Sidebar ab ≥1024 px, darunter Bottom-Nav; alle 5 Tabs navigierbar; Header mit Kicker/Titel; FAB sichtbar.
5. Theme-Umschaltung Light/Dark/System funktioniert, `data-ralia-theme` wird gesetzt, Auswahl übersteht Reload.
6. Sprachumschaltung DE/EN funktioniert, Katalog aus `i18n.js` vollständig extrahiert (Schlüsselzahl DE = EN).
7. Visueller Abgleich: Header, Sidebar, Bottom-Nav, FAB und ein Bottom Sheet stimmen mit der Vorlage überein (gleiche Maße, Radien, Farben).
8. `GET /config` der Edge Function wird beim Boot erfolgreich gelesen und der Runtime-Key (`sb_publishable_…`) angewendet.

## Risiken

| Risiko                                                                 | Umgang                                                                                                                   |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Edge-Function-Quellcode nicht einsehbar                                | Als externe Vertragsgrenze behandeln; Route-Liste aus `server.js` als Referenz; jede Route vor Nutzung live verifizieren |
| `sb_publishable_…`-Key aus `/config` weicht vom eingebauten JWT-Key ab | Client mit eingebautem Key booten, nach `/config` mit dem Runtime-Key neu erzeugen; beide Pfade testen                   |
| Alt-Clients halten den alten Service Worker fest                       | `registration.unregister()` + Cache-Löschung + `skipWaiting`/`clients.claim` im neuen SW; in SP9 verifizieren            |
| Vorlage deckt nur 6 von ~40 Oberflächen                                | Design-Sprache in SP0 als Komponenten fixieren, damit spätere Screens nicht driften                                      |
| 14.618 Zeilen Portierung, Verhaltensregressionen                       | Domain-Logik zuerst mit Tests nach `core`, dann UI darauf; `Ralia_Opus` bleibt als Referenz-Implementierung erhalten     |
