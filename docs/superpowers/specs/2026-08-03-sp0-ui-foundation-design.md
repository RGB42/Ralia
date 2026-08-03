# SP0 (2. Hälfte) — Design-System, AppShell und SPA

**Datum:** 2026-08-03
**Status:** Freigegeben
**Übergeordnet:** [2026-07-31-ralia-rebuild-design.md](2026-07-31-ralia-rebuild-design.md)
**Design-Vorlage:** [../../design-reference/Ralia-Organizer.dc.html](../../design-reference/Ralia-Organizer.dc.html)

## Ausgangslage

SP0 ist zur Hälfte fertig. Vorhanden und mit 103 grünen Tests abgedeckt:

- Monorepo (npm workspaces, TS strict, ESLint, Prettier, Vitest)
- `packages/core` — `ids`, `net/offline-error`, `outbox/{backoff,db,lifecycle,legacy-import,outbox,types}`
- `packages/data` — `app-api`, `calendar-id`, `client`, `config`, `database.types`

Nicht vorhanden: `packages/ui`, `apps/app`, `scripts/extract-i18n.mjs`, i18n-Kataloge, Playwright. `npm run dev` bricht ab (`No workspaces found: --workspace=@ralia/app`) — es gibt keine lauffähige App.

Zwei Altlasten: 24 Typecheck-Fehler (22 in `app-api.test.ts`, 2 in `outbox.test.ts` — `fetch`-Mock-Typisierung) und 3 Lint-Fehler (`consistent-type-imports`). Abnahmekriterium 1 des Programm-Designs ist damit unerfüllt.

Die Design-Vorlage lag ursprünglich nur außerhalb des Repos und war zeitweise verloren. Sie ist jetzt unter `docs/design-reference/` versioniert. **Neue Regel: die Vorlage ist Repo-Inhalt, nicht Umgebungsvoraussetzung.**

## Ziel

Die sichtbare Hälfte von SP0: ein Design-System, das die Vorlage wertgenau abbildet, und eine lauffähige SPA, die alle **acht Ansichten in sechs Screens** und alle acht Bottom Sheets der Vorlage zeigt. Ohne Live-Daten — mit den Demo-Daten der Vorlage.

Die sechs Screens sind Kalender (Ansichten Monat und Woche), Planer, Todos (Ansichten Übersicht und Detail), Geld, Einstellungen und Sync.

Danach ist die App vollständig sichtbar und beurteilbar, und alle folgenden Sub-Projekte hängen an einem fixierten Design-System statt an Prosa.

## Getroffene Entscheidungen

| Frage | Entscheidung | Begründung |
|---|---|---|
| Design-Treue | Vorlage 1:1; die rund 30 nicht abgedeckten Oberflächen strikt aus derselben Sprache extrapoliert | Kein eigener Stil; maximale Konsistenz über alle späteren Screens |
| Prototyp-Gerüst der Vorlage | **Nicht übernehmen** (siehe unten) | Würde eine Telefon-Attrappe auf einem echten Telefon erzeugen |
| Routing | `react-router-dom` | Android-Hardware-Back und Deep Links (SP7) müssten sonst nachgebaut werden |
| Poppins | `@fontsource/poppins` (400/500/600/700) | Normales npm-Paket mit woff2; selbst gehostet, offline- und Capacitor-fähig, kein Laufzeit-Abruf bei Google |
| Werttreue-Absicherung | Mechanischer Token-Paritätstest gegen die Vorlage | Transkription per Hand ist nicht überprüfbar; ein Test ist es |
| Demo-Daten | Fixtures der Vorlage portieren, als SP0-Platzhalter markiert | Screens sind nur gefüllt beurteilbar; Entfernung in SP2–SP4 |

## Was aus der Vorlage nicht übernommen wird

Die Vorlage ist ein Prototyp in einem Browser-Rahmen: sie zeichnet ein Telefon-Mock in eine Seite. Drei Bestandteile sind Prototyp-Bedienung, nicht Design.

| In der Vorlage | Ersatz in der App |
|---|---|
| Kopfleiste „Ralia · Paar-Organizer · Prototyp" mit `Mobil\|Desktop`-Umschalter und Theme-Knopf | entfällt. Viewport kommt vom Gerät; die Theme-Umschaltung existiert bereits in Einstellungen |
| `appMax:430px`, `appHeight:clamp(560px, calc(100vh - 90px), 860px)`, äußere Karte `border-radius:28px` + `box-shadow:var(--shadow-md)` + `border:1px solid var(--line)` | Mobil: randlos über den ganzen Viewport, `100dvh`, Safe-Area-Insets über `env(safe-area-inset-*)` |
| `shellMax:470px` im Mobil-Modus | entfällt (nur Desktop behält `shellMax:1180px`) |

Auf Desktop (≥1024 px) bleibt die entworfene Struktur unverändert: Sidebar 236 px sticky + Inhaltsspalte `max-width:900px`, Shell `max-width:1180px`, zentriert, `gap:26px`.

`weekGridMin` **bleibt wie in der Vorlage**: `640px` auf Mobil, `100%` auf Desktop. Die Mindestbreite auf Mobil ist kein Prototyp-Artefakt — die Wochen-Timeline mit Zeitspalte und sieben Tagesspalten braucht sie tatsächlich und scrollt darunter horizontal.

Alle übrigen Werte — Radien, Abstände, Typo-Skala, Farben, Schatten, Übergänge, Animationen — werden unverändert übernommen.

## Tokens

### Sichtbare Tokens

`:root` und `:root[data-ralia-theme="dark"]` werden wertgenau aus der Vorlage übernommen: `brand*`, `accent`, `u1`/`u2`/`both`/`bday`, `ink-900/700/500/400`, `line`/`line-soft`, `surface`/`surface-2`/`bg-app`/`chrome`, `ok`/`danger`, `warn-soft`/`warn-line`/`warn-fg`, `shadow-sm/md/lg`, `hov-tint`/`hov-ring`/`hov-surf`/`hov-shadow`/`hov-danger`.

### Verdeckte Tokens

Ein Teil der Farbwerte steht in der Vorlage nicht in `:root`, sondern hartcodiert in der Logik (`colors(who)`, `track()`, Heute-Markierungen). Diese werden zu echten Custom Properties. **Die Optik ändert sich dadurch nicht** — aber sie wird prüfbar und für die extrapolierten Screens überhaupt erst verwendbar.

| Neues Token | Light | Dark | Quelle in der Vorlage |
|---|---|---|---|
| `--u1-bg` / `--u1-fg` | `#eff6ff` / `#1d4ed8` | `rgba(59,130,246,.17)` / `#93c5fd` | `colors('u1')` |
| `--u2-bg` / `--u2-fg` | `#fdf2f8` / `#be185d` | `rgba(236,72,153,.17)` / `#f9a8d4` | `colors('u2')` |
| `--both-bg` / `--both-fg` | `#f5f3ff` / `#6d28d9` | `rgba(139,92,246,.19)` / `#c4b5fd` | `colors('both')` |
| `--bday-bg` / `--bday-fg` | `#fff7ed` / `#c2410c` | `rgba(249,115,22,.17)` / `#fdba74` | `colors('bday')` |
| `--track-off` | `#cbd5e1` | `#3a3450` | `track(false)` |
| `--today-line` | `#ddd0fb` | `#3d3555` | Monatszelle/Wochenkopf „heute" |
| `--today-col` | `rgba(124,58,237,.035)` | `rgba(167,139,250,.06)` | Wochenspalte „heute" |

`--brand-fill:#7c3aed` bleibt in beiden Themes identisch (die Vorlage nutzt `fill` themenunabhängig für gefüllte Flächen — Primary-Button, FAB, aktives Segment, aktiver Toggle).

`--anniv` (Grün für Jahrestag, in der Altversion vorhanden, in der Vorlage nicht) wird in SP0 **reserviert, aber nicht gesetzt** — die Tonalität gehört zu SP2, wo Jahrestage entstehen.

### Token-Paritätstest

Ein Vitest-Test parst `docs/design-reference/Ralia-Organizer.dc.html` und vergleicht:

1. den `:root{…}`-Block und den `:root[data-ralia-theme="dark"]{…}`-Block eigenschaftsweise gegen `tokens.css`
2. die aus der Logik extrahierten Werte (`colors()`-Map, `track()`, `fill`, `soft`, `inkMid`, `line`, Heute-Farben) gegen die entsprechenden verdeckten Tokens

Weicht ein Wert ab oder fehlt eine Eigenschaft, schlägt der Test fehl. Damit ist „wertgenau" eine geprüfte Eigenschaft, keine Behauptung.

## `packages/ui`

```
src/
├── tokens/
│   ├── tokens.css      :root + [data-ralia-theme="dark"], sichtbare + verdeckte Tokens
│   ├── reset.css       box-sizing, body, a, button, Scrollbar, @keyframes ral-up/ral-fade
│   └── fonts.css       @fontsource/poppins 400/500/600/700
├── theme/
│   ├── ThemeProvider.tsx   light | dark | system → data-ralia-theme, localStorage
│   └── useTheme.ts
├── primitives/
│   ├── Button.tsx          primary | secondary | ghost | danger
│   ├── IconButton.tsx      34×34, radius 11
│   ├── SegmentSwitch.tsx   ← pill()
│   ├── NavItem.tsx         ← navItem()
│   ├── Chip.tsx            ← chip()
│   ├── PersonChip.tsx      ← personChip()
│   ├── Toggle.tsx          ← track()/knob(): 46×27, Knopf 21, left 3→22, .18s ease
│   ├── Input.tsx  Textarea.tsx  Select.tsx    padding 12, radius 13, surface-2
│   ├── FieldLabel.tsx      11px/600/uppercase/.7px/ink-400
│   ├── SectionLabel.tsx    11px/600/uppercase/.8px/ink-400
│   ├── Card.tsx            radius 20, border line, surface, shadow-sm
│   ├── ListRow.tsx         die Einstellungs-Zeile: Titel + Hinweis + Steuerelement
│   ├── Avatar.tsx  AvatarPair.tsx    30px, Überlappung -9px, 2px surface-Rand
│   ├── ProgressBar.tsx     einfarbig + segmentiert (Geld-Kategorien)
│   ├── Toast.tsx  ConfirmDialog.tsx  EmptyState.tsx  Skeleton.tsx
│   └── SheetHandle.tsx     38×4, radius 999
├── overlays/
│   ├── BottomSheet.tsx     Backdrop rgba(15,23,42,.42), radius 24 24 0 0,
│   │                       ral-up .22s cubic-bezier(.2,.8,.2,1), ral-fade .16s,
│   │                       Scroll-Lock, Fokus-Falle, Escape, maxHeight-Prop
│   └── Modal.tsx
├── icons/
│   └── Icon.tsx            20×20 ViewBox, stroke-width 1.6, Pfade der Vorlage
└── shell/
    ├── AppLayout.tsx       Sidebar ≥1024px / BottomNav darunter
    ├── Sidebar.tsx         236px sticky, AvatarPair, NavItems, „Diese Woche"-Panel
    ├── BottomNav.tsx       5 Punkte, min-height 52px, radius 13
    ├── AppHeader.tsx       Kicker / Titel / Back / Range-Navigation / Add
    └── Fab.tsx             54×54, radius 19, bottom 74px mobil · 20px desktop
```

Die Primitive sind aus den Helferfunktionen der Vorlage abgeleitet, nicht frei entworfen. `pill()`, `navItem()`, `chip()`, `personChip()`, `track()`/`knob()` existieren dort als Funktionen mit festen Rückgabewerten — jede wird zu genau einer Komponente. Dadurch stimmen sie zwangsläufig überein.

**Styling über CSS Modules.** Begründung steht im Programm-Design: die Vorlage arbeitet mit Werten wie `font-size:11.5px`, `border-radius:22px`, `stroke-width:1.6`, gegen die Utility-Klassen arbeiten würden.

### Barrierefreiheit

Die Vorlage hat keine Fokus-Ringe — Tastaturbedienung ist dort nicht vorgesehen. Da alle Interaktionselemente echte `<button>`/`<input>` sind, ergänzt SP0 einen Fokus-Stil auf `:focus-visible` über `--hov-ring` (`box-shadow:0 0 0 2px`). Das ist keine Design-Änderung, sondern das Nachziehen eines fehlenden Zustands im vorhandenen Token-Vokabular. Sichtbar wird er nur bei Tastaturnutzung.

## `apps/app`

```
src/
├── main.tsx  App.tsx
├── boot/
│   ├── bootstrap.ts    /config lesen → Client mit Runtime-Key neu erzeugen →
│   │                   Legacy-Migration (SW deregistrieren, Caches löschen,
│   │                   localStorage-Queues importieren, Alt-Keys löschen,
│   │                   Marker setzen) → Outbox-Flush
│   └── BootGate.tsx    Skeleton bis Boot fertig; Fehler → EmptyState mit Retry
├── i18n/
│   ├── I18nProvider.tsx  useT.ts
│   └── de.json  en.json    546 Schlüssel, generiert
├── routes/
│   └── router.tsx      /kalender  /planer  /todos  /todos/:listId
│                       /geld  /profil  /profil/sync
├── screens/
│   ├── calendar/  MonthView.tsx  WeekView.tsx
│   ├── planner/   PlannerScreen.tsx
│   ├── todos/     TodoOverview.tsx  TodoDetail.tsx
│   ├── money/     MoneyScreen.tsx
│   └── settings/  SettingsScreen.tsx  SyncScreen.tsx
├── sheets/        DaySheet  EventSheet  ItemSheet  PlanSheet
│                  TodoSheet  ExpenseSheet  ProfileSheet  NewEventSheet
└── mock/
    └── fixtures.ts     Demo-Daten der Vorlage (25 Events, 11 Todos,
                        7 Planer-Tage, 5 Kategorien, 7 Ausgaben)
```

### Kalender: zwei Übersetzungsentscheidungen

**Monatsraster.** Die Vorlage entscheidet über Ereignis-Chips vs. Punkte anhand einer aus der Fenster­höhe abgeleiteten Rechnung:

```
shellH   = clamp(560, vh - 90, 860)
rowH     = (shellH - 136 - 69 - 24 - 36 - 25) / 6
chipAvail = rowH - 12 - 20 - 3
maxChips = min(3, floor(chipAvail / 19))
dotsMode = maxChips < 1     maxDots = 5
```

Die Konstanten 136/69/24/36/25 sind die Chrome-Höhen des Prototyps. In der App wird stattdessen die **tatsächliche Höhe des Rasters gemessen** (`ResizeObserver` auf dem Grid-Element), `rowH = gridHeight / 6`, und die Zellen-Innenmaße (`12` Padding + `20` Tagesnummer + `3` Gap = `35`) davon abgezogen. Regel und Schwellwerte (19 px pro Chip, max 3 Chips, max 5 Punkte, Punkte-Modus unter 1 Chip) bleiben identisch.

Raster: `grid-template-columns:repeat(7,minmax(0,1fr))`, `grid-template-rows:repeat(6,minmax(46px,1fr))`, `gap:5px`, 42 Zellen, Zellradius 11 px. Zellen außerhalb des Monats `opacity:.42`. Normale Zelle: Hintergrund `--surface-2`, Rand `--line`. „Heute": Hintergrund `--brand-soft`, Rand `--today-line`, Tagesnummer gefüllt `--brand-fill` auf `#fff`. Ereignis-Chips 16 px hoch, Radius 5 px, `border-left:2.5px solid` in der Personenfarbe; Punkte 7×7 px, Radius 2 px.

**Wochen-Timeline.** Stundenhöhe 52 px. `top = max(0, startMin - startH*60) / 60 * 52`, `height = max(26, dauerMin / 60 * 52 - 3)`. Nachtstunden 00–06 eingeklappt (`startH` 6 → 0 beim Aufklappen), Zeitspalte 42 px breit, Kopfzeile sticky. Diese Werte werden unverändert übernommen.

### i18n

`scripts/extract-i18n.mjs` liest `Ralia_Opus/public/js/i18n.js`, extrahiert die `de`- und `en`-Objektliterale und schreibt sortierte `de.json`/`en.json`.

Der Katalog enthält 552 DE- und 550 EN-Zeilen mit 6 bzw. 4 doppelten Schlüsseln — nach JS-Objektliteral-Semantik gewinnt der letzte. Das Skript wendet dieselbe Regel an, **meldet jedes Duplikat** und bricht ab, wenn die Schlüsselmengen der beiden Sprachen nicht deckungsgleich sind. Erwartetes Ergebnis: 546 Schlüssel je Sprache.

Handabtippen ist ausgeschlossen. Läuft das Skript erneut, muss es byte-identische Ausgabe erzeugen.

### Boot-Reihenfolge

```
1. Theme aus localStorage anwenden (vor dem ersten Frame, gegen Flash)
2. Sprache bestimmen (localStorage → navigator.language → de)
3. Client mit eingebautem Key erzeugen
4. GET /config → bei Erfolg Client mit Runtime-Key (sb_publishable_…) neu erzeugen
5. Legacy-Migration, falls Marker fehlt
6. Outbox-Lifecycle binden, einmal flushen
7. App rendern
```

Schritt 4 darf den Boot nicht blockieren: schlägt `/config` fehl, läuft die App mit dem eingebauten Key weiter und protokolliert eine Warnung. Schritt 5 ist idempotent (Marker), die Alt-Keys werden erst nach committetem Import gelöscht.

## Teststrategie

| Ebene | Umfang |
|---|---|
| Token-Parität | `tokens.css` gegen die Vorlage, sichtbare + verdeckte Tokens |
| Primitive | Rendering, Varianten, `disabled`, Tastaturbedienung, `:focus-visible` |
| `BottomSheet` | Fokus-Falle, Escape schließt, Scroll-Lock setzt und räumt auf, Backdrop-Klick |
| `ThemeProvider` | `system` folgt `prefers-color-scheme`, manuelle Wahl übersteht Reload, `data-ralia-theme` korrekt |
| i18n | DE und EN haben identische Schlüsselmengen; Skript ist idempotent |
| Monatsraster | Chip/Punkt-Umschaltung an den Schwellwerten (gemockte Rasterhöhe) |
| Wochen-Timeline | `top`/`height` für bekannte Zeitpaare |
| Boot | `/config`-Fehler blockiert nicht; Legacy-Migration läuft genau einmal |
| E2E (Playwright) | App bootet und zeigt Kalender; alle 5 Tabs navigierbar; Theme übersteht Reload |

Die bestehenden 103 Tests bleiben grün.

## Aufräumen

- 24 Typecheck-Fehler in `app-api.test.ts` (22) und `outbox.test.ts` (2) — `fetch`-Mocks korrekt typisieren statt `as any`
- 3 Lint-Fehler (`consistent-type-imports`)

Danach läuft `npm run verify` (typecheck + lint + test + build) durchgehend grün.

## Abnahmekriterien

1. `npm run verify` fehlerfrei — typecheck, lint, test, build.
2. `npm run dev` zeigt die App. Desktop ≥1024 px mit Sidebar, darunter Bottom-Nav. Alle 5 Tabs navigierbar, `/profil/sync` über Back erreichbar.
3. Alle 8 Ansichten der Vorlage gerendert und mit Demo-Daten gefüllt: Kalender Monat, Kalender Woche, Planer, Todos Übersicht, Todos Detail, Geld, Einstellungen, Sync.
4. Alle 8 Bottom Sheets öffnen und schließen: über Backdrop-Klick, Schließen-Knopf und Escape.
5. Token-Paritätstest grün — jede Eigenschaft aus `:root` und `[data-ralia-theme="dark"]` der Vorlage stimmt, ebenso die verdeckten Farbwerte.
6. Theme Light/Dark/System funktioniert, `data-ralia-theme` wird gesetzt, Auswahl übersteht Reload, kein Flash beim Laden.
7. Sprachumschaltung DE/EN funktioniert, 546 Schlüssel je Sprache, Mengen deckungsgleich.
8. `GET /config` wird beim Boot gelesen und der Runtime-Key angewendet; ein Fehlschlag blockiert den Boot nicht.
9. Mobil randlos: kein äußerer Kartenrahmen, `100dvh`, Safe-Area-Insets berücksichtigt.
10. Jedes Interaktionselement ist per Tastatur erreichbar und zeigt einen sichtbaren Fokus.

## Risiken

| Risiko | Umgang |
|---|---|
| Vorlage geht wieder verloren | Liegt jetzt unter `docs/design-reference/` im Repo; der Paritätstest liest sie und schlägt fehl, wenn sie fehlt |
| Handübersetzung driftet von der Vorlage ab | Paritätstest für Tokens; Primitive 1:1 aus den Helferfunktionen abgeleitet |
| Monatsraster-Heuristik verhält sich nach der Umstellung auf Messung anders | Schwellwerte per Test gegen gemockte Rasterhöhen fixiert |
| `dvh` und Safe-Area in der Capacitor-WebView | In SP7 auf echten Geräten verifizieren; `100dvh` mit `100vh`-Fallback |
| Nur 8 von ~40 Ansichten abgedeckt — spätere Screens driften | Design-System ist die einzige Quelle für Maße und Farben; extrapolierte Screens dürfen keine Rohwerte enthalten |

## Nicht in Scope

Echte Anmeldung (SP1), Live-Event-Daten und Serien-Engine (SP2), Todos/Routinen/Planer mit echten Daten (SP3), Geld (SP4), Reminder/Push/Google/ICS (SP5), Premium/Account/Admin (SP6), native Hüllen (SP7), Marketing-Site (SP8), Cutover (SP9).

Zugesagter Rahmen: SP1 bis SP9 folgen vollständig, jedes mit eigenem Spec→Plan→Umsetzungs-Zyklus, bis Feature-Parität mit Ralia_Opus erreicht ist.
