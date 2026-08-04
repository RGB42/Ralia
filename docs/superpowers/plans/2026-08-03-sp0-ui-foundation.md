# SP0 UI-Fundament — Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die sichtbare Hälfte von SP0 bauen — ein Design-System, das die Vorlage wertgenau abbildet, und eine lauffähige React-SPA mit allen 8 Ansichten und 8 Bottom Sheets, gefüllt mit Demo-Daten.

**Architecture:** `packages/ui` liefert Tokens, Primitive und AppShell als CSS-Modules-Komponenten; die Primitive werden 1:1 aus den Helferfunktionen der Vorlage abgeleitet. `apps/app` ist eine Vite-SPA, die diese Komponenten zu den Screens der Vorlage zusammensetzt. Reine Geometrie- und Dichte-Logik (Monatsraster, Wochen-Timeline) liegt in `packages/core`, damit sie ohne DOM testbar ist.

**Tech Stack:** TypeScript strict, React 19, Vite 7, CSS Modules, react-router 8, Vitest 3 + Testing Library, Playwright, `@fontsource/poppins`.

**Spec:** [../specs/2026-08-03-sp0-ui-foundation-design.md](../specs/2026-08-03-sp0-ui-foundation-design.md)
**Design-Vorlage:** [../../design-reference/Ralia-Organizer.dc.html](../../design-reference/Ralia-Organizer.dc.html)

## Global Constraints

- **TypeScript strict** mit `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, `noUnusedLocals`, `noUnusedParameters`. Indexzugriffe liefern `T | undefined` — immer prüfen. Typ-Imports immer als `import type`.
- **`@typescript-eslint/no-explicit-any` ist `error`** in Produktionscode; in `**/*.test.{ts,tsx}`, `scripts/**/*.mjs` und `vitest.setup.ts` erlaubt.
- **`packages/core` bleibt framework-frei.** Kein React, kein DOM, kein Supabase. Verstoß = Task-Ablehnung.
- **`packages/ui` kennt die Datenbank nicht.** Kein Import aus `@ralia/data`, keine `belongs_to`-Werte. Das UI-Vokabular ist `PersonSlot = 'u1' | 'u2' | 'both' | 'bday'`.
- **Keine Rohwerte in Screens.** Farben, Radien und Abstände kommen aus Tokens oder Primitiven. Ein Hex-Wert oder `px`-Radius in `apps/app/src/screens/**` ist ein Fehler. Ausnahme: Layout-Maße (`gap`, `grid-template-*`, `flex`), die keine Design-Token sind.
- **Testdatei-Benennung** (die Vitest-Projekte matchen darauf): Node-Tests `packages/{core,data,ui}/src/**/*.test.ts`, DOM-Tests `packages/ui/src/**/*.test.tsx` und `apps/app/src/**/*.test.{ts,tsx}`.
- **Vitest 3 Mock-Signatur:** `vi.fn<typeof fn>()` mit **einem** Typargument. Die Zwei-Argument-Form `vi.fn<Args, Return>()` aus Vitest 2 ist ein Typfehler.
- **Web-Basispfad ist `/app/`.** Vite `base: '/app/'`, Router `basename="/app"`. Die Marketing-Site belegt später `/` (SP8). SP7 stellt für Capacitor auf relative Pfade um.
- **Routing-Paket ist `react-router` ab `^8.3.0`, nicht `react-router-dom`.** Nachgetragen am 2026-08-04, nachdem `npm audit` nach Task 2 zwei High-Advisories meldete: GHSA-qwww-vcr4-c8h2 („RSC Mode CSRF Bypass") betrifft `react-router` in `>=7.12.0 <8.3.0`. Im gesamten 7.x-Zweig existiert **keine** gepatchte Version — 7.18.2 ist dessen letzte. In v8 wurde `react-router-dom` aufgelöst; `react-router` ist das einzige Paket und trägt `latest`. Die Lücke betrifft ausschließlich RSC-Modus mit Server-Actions, den diese App nicht nutzt (statischer Vite-Build, kein Server-Rendering) — umgestellt wird trotzdem, weil zu diesem Zeitpunkt noch keine einzige Routing-Zeile existiert und die Umstellung damit gratis ist, während sie ab Task 12 jede Routendatei berühren würde. Peer-Deps von 8.3.0 (`react >=19.2.7`) sind mit 19.2.8 erfüllt. Verifiziert vorhanden in 8.3.0: `createBrowserRouter`, `createMemoryRouter`, `RouterProvider`, `Outlet`, `Navigate`, `useLocation`, `useNavigate`, `useParams`, `Link`.
- **Sprach-Speicherschlüssel ist `appLanguage`** — derselbe wie in Ralia_Opus, damit die Sprachwahl den Umbau übersteht. Die Legacy-Migration löscht nur `ralia:*-queue:` und `ralia:*-cache:`, dieser Schlüssel bleibt also unberührt.
- **Theme-Speicherschlüssel ist `ralia.theme`**, Attribut `data-ralia-theme` auf `<html>`, Werte `light` | `dark` | `system` (gespeichert) → Attribut nur bei dunkel gesetzt.
- **Übernahme-Konvention:** Wenn ein Schritt „Vorlage Z. A–B" nennt, ist der Zeilenbereich in `docs/design-reference/Ralia-Organizer.dc.html` die **verbindliche Quelle** für Markup-Struktur und Stilwerte. Werte werden von dort gelesen, nicht aus dem Gedächtnis. Das ist bewusst kein Kopieren in den Plan — Doppelung würde genau die Transkriptionsdrift erzeugen, die der Paritätstest verhindern soll.

---

## File Structure

**`packages/core/src/calendar/`** — neue, reine Logik ohne DOM
- `month-density.ts` — Chip-gegen-Punkt-Entscheidung aus der gemessenen Rasterhöhe
- `week-geometry.ts` — `top`/`height` eines Termins in der Wochen-Timeline
- `month-grid.ts` — die 42 Rasterzellen eines Monats aus Jahr/Monat/Wochenstart

**`packages/ui/src/`**
- `tokens/` — `tokens.css`, `reset.css`, `fonts.css`, `tokens.parity.test.ts`
- `theme/` — `ThemeProvider.tsx`, `useTheme.ts`, `theme-storage.ts`
- `primitives/` — je Komponente eine `.tsx` + `.module.css`, Tests gebündelt je Gruppe
- `overlays/` — `BottomSheet.tsx`, `Modal.tsx`, `use-focus-trap.ts`, `use-scroll-lock.ts`
- `icons/` — `Icon.tsx`, `paths.ts`
- `shell/` — `AppLayout.tsx`, `Sidebar.tsx`, `BottomNav.tsx`, `AppHeader.tsx`, `Fab.tsx`, `nav-items.ts`
- `person.ts` — `PersonSlot`, Token-Namen je Slot
- `index.ts` — der einzige öffentliche Einstiegspunkt

**`apps/app/src/`**
- `boot/` — `bootstrap.ts`, `BootGate.tsx`
- `i18n/` — `I18nProvider.tsx`, `useT.ts`, `catalog.ts`, `de.json`, `en.json`
- `routes/` — `router.tsx`, `AppFrame.tsx`
- `screens/calendar/`, `screens/planner/`, `screens/todos/`, `screens/money/`, `screens/settings/`
- `sheets/` — acht Sheet-Komponenten + `SheetHost.tsx`
- `mock/fixtures.ts`

**`scripts/extract-i18n.mjs`** — Katalog-Extraktion aus `Ralia_Opus/public/js/i18n.js`

---

## Task 1: Baseline grün — Typecheck und Lint reparieren

Vor dem ersten neuen Code muss `npm run verify` eine verlässliche Aussage liefern. Aktuell: 24 Typecheck-Fehler, 3 Lint-Fehler.

**Files:**
- Modify: `packages/data/src/app-api.test.ts` (8 Stellen)
- Modify: `packages/core/src/outbox/outbox.test.ts:77`, `:102`
- Modify: `packages/core/src/outbox/outbox.ts:253`
- Modify: `packages/data/src/config.ts:1`

**Interfaces:**
- Consumes: nichts
- Produces: `npm run verify` läuft durch — Voraussetzung für jede folgende Task

- [ ] **Step 1: Fehlerbild festhalten**

Run: `npm run typecheck 2>&1 | grep -c "error TS"` → erwartet `24`
Run: `npm run lint 2>&1 | grep -c "error"` → erwartet `4` (3 Fehler + Summenzeile)

- [ ] **Step 2: `fetch`-Mocks auf die Vitest-3-Signatur umstellen**

Ursache: die Tests nutzen die Vitest-2-Form mit zwei Typargumenten. Vitest 3 erwartet den Funktionstyp.

In `packages/data/src/app-api.test.ts` alle 8 Vorkommen ersetzen:

```ts
// vorher
const fetchImpl = vi.fn<Parameters<typeof fetch>, Promise<Response>>(async () => …);
// nachher
const fetchImpl = vi.fn<typeof fetch>(async () => …);
```

Das behebt zugleich die `TS2339`-Folgefehler (`Property 'headers' does not exist on type 'never'`): sobald der Mock korrekt typisiert ist, hat `fetchImpl.mock.calls[0]` den Typ `[input: RequestInfo | URL, init?: RequestInit]` statt `never`.

- [ ] **Step 3: Executor-Mock in `outbox.test.ts:102` umstellen**

```ts
// vorher
const executor = vi.fn<[OutboxRecord<TestMutation>], Promise<void>>(async () => {});
// nachher
const executor = vi.fn<OutboxExecutor<TestMutation>>(async () => {});
```

`OutboxExecutor` ist bereits aus `./types.js` importiert oder muss als `import type` ergänzt werden.

- [ ] **Step 4: Typecheck prüfen**

Run: `npm run typecheck`
Expected: keine Ausgabe, Exit 0

- [ ] **Step 5: Die drei Lint-Fehler beheben**

1. `packages/core/src/outbox/outbox.test.ts:77` — `let clock` → `const clock` (`prefer-const`)
2. `packages/core/src/outbox/outbox.ts:253` — Inline-`import()`-Typannotation auflösen: den Typ oben als `import type { X } from '…'` importieren und an der Stelle direkt verwenden
3. `packages/data/src/config.ts:1` — `import { … }` → `import type { … }`

- [ ] **Step 6: Lint und Gesamtlauf prüfen**

Run: `npm run lint` → Exit 0, keine Ausgabe
Run: `npm test` → 103 Tests grün, 8 Dateien

- [ ] **Step 7: Commit**

```bash
git add packages/core packages/data
git commit -m "fix: Vitest-3-Mock-Signaturen und drei Lint-Verstoesse"
```

---

## Task 2: Abhängigkeiten deklarieren

`react` und `react-dom` 19.2.8 liegen im Lockfile nur als transitive **dev**-Pakete und sind in `package.json` überhaupt nicht deklariert. `react-router`, `@fontsource/poppins` und `@playwright/test` fehlen ganz. Ohne diesen Schritt hängt jede folgende Task an Zufallszuständen des `node_modules`-Baums.

**Files:**
- Modify: `package.json`
- Create: `packages/ui/package.json`
- Create: `apps/app/package.json`

**Interfaces:**
- Consumes: Task 1 (grüne Baseline)
- Produces: Workspaces `@ralia/ui` und `@ralia/app` existieren; `react@19`, `react-dom@19`, `react-router@8`, `@fontsource/poppins`, `@playwright/test` sind installiert

- [ ] **Step 1: Ausgangslage bestätigen**

```bash
node -e "const p=require('./package.json');const a={...p.dependencies,...p.devDependencies};for(const k of ['react','react-dom','react-router','@fontsource/poppins','@playwright/test'])console.log((a[k]||'NOT DECLARED').padEnd(16),k)"
```
Expected: alle fünf `NOT DECLARED`

- [ ] **Step 2: `packages/ui/package.json` anlegen**

Vorbild ist `packages/core/package.json` (gleiche Felder, gleiche `exports`-Form). React ist `peerDependency`, damit es genau eine React-Instanz gibt.

```json
{
  "name": "@ralia/ui",
  "version": "2.0.0",
  "private": true,
  "type": "module",
  "description": "Design-System aus der Ralia-Vorlage: Tokens, Primitive, Overlays, AppShell.",
  "exports": {
    ".": "./src/index.ts",
    "./*": "./src/*"
  },
  "dependencies": {
    "@fontsource/poppins": "^5.2.6"
  },
  "peerDependencies": {
    "react": "^19.2.0",
    "react-dom": "^19.2.0"
  }
}
```

- [ ] **Step 3: `apps/app/package.json` anlegen**

```json
{
  "name": "@ralia/app",
  "version": "2.0.0",
  "private": true,
  "type": "module",
  "description": "Ralia SPA — Web /app/* und Capacitor-Webroot.",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@ralia/core": "*",
    "@ralia/data": "*",
    "@ralia/ui": "*",
    "react": "^19.2.0",
    "react-dom": "^19.2.0",
    "react-router": "^8.3.0"
  }
}
```

- [ ] **Step 4: `@playwright/test` als Root-devDependency ergänzen**

In der Wurzel-`package.json` unter `devDependencies` einsortieren (alphabetisch, direkt vor `@types/react`):

```json
"@playwright/test": "^1.56.1",
```

- [ ] **Step 5: Installieren**

Run: `npm install`
Expected: Exit 0. `react`, `react-dom` erscheinen jetzt als reguläre (nicht-dev) Einträge im Lockfile.

- [ ] **Step 6: Auflösung prüfen**

```bash
node -e "console.log(require('react/package.json').version, require('react-router/package.json').version)"
npm run typecheck
```
Expected: `19.2.x 7.x.x`, Typecheck Exit 0

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json packages/ui/package.json apps/app/package.json
git commit -m "chore: Workspaces @ralia/ui und @ralia/app mit expliziten Abhaengigkeiten"
```

---

## Task 3: Tokens und Paritätstest

Das Herzstück. Der Test macht „wertgenau" zu einer geprüften Eigenschaft statt zu einer Behauptung — er liest die Vorlage und vergleicht sie mit `tokens.css`.

**Files:**
- Create: `packages/ui/src/tokens/tokens.css`
- Create: `packages/ui/src/tokens/reset.css`
- Create: `packages/ui/src/tokens/fonts.css`
- Create: `packages/ui/src/tokens/tokens.parity.test.ts`
- Create: `packages/ui/src/person.ts`
- Create: `packages/ui/src/index.ts`
- Modify: `vitest.config.ts` — Node-Projekt muss `packages/ui/src/**/*.test.ts` einschließen

**Interfaces:**
- Consumes: Task 2
- Produces:
  - `packages/ui/src/tokens/tokens.css` mit `:root` und `:root[data-ralia-theme="dark"]`
  - `export type PersonSlot = 'u1' | 'u2' | 'both' | 'bday'`
  - `export function personTokens(slot: PersonSlot): { bar: string; bg: string; fg: string }` — liefert `var(--…)`-Referenzen, keine Literale

- [ ] **Step 1: Vitest-Node-Projekt für `packages/ui` öffnen**

Der Paritätstest ist reine Dateiarbeit ohne DOM. Aktuell erfasst das `node`-Projekt nur `core` und `data`, das `dom`-Projekt nur `*.test.tsx` — eine `packages/ui/src/**/*.test.ts` liefe in keinem der beiden.

In `vitest.config.ts`, `node`-Projekt, `include` erweitern:

```ts
include: [
  'packages/core/src/**/*.test.ts',
  'packages/data/src/**/*.test.ts',
  'packages/ui/src/**/*.test.ts',
],
```

- [ ] **Step 2: Den Paritätstest schreiben — er muss zuerst fehlschlagen**

Create `packages/ui/src/tokens/tokens.parity.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = fileURLToPath(new URL('.', import.meta.url));
const templateSrc = readFileSync(
  fileURLToPath(new URL('../../../../docs/design-reference/Ralia-Organizer.dc.html', import.meta.url)),
  'utf8',
);
const tokensSrc = readFileSync(`${here}tokens.css`, 'utf8');

/** Liest alle Custom Properties eines Selektor-Blocks. */
function customProps(css: string, selector: string): Map<string, string> {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`).exec(css);
  if (!match) throw new Error(`Block nicht gefunden: ${selector}`);
  const body = match[1] ?? '';
  const out = new Map<string, string>();
  for (const decl of body.split(';')) {
    const colon = decl.indexOf(':');
    if (colon === -1) continue;
    const prop = decl.slice(0, colon).trim();
    if (!prop.startsWith('--')) continue;
    out.set(prop, decl.slice(colon + 1).trim().replace(/\s+/g, ' '));
  }
  return out;
}

/** Liest einen Eintrag der colors()-Map aus der Logik der Vorlage. */
function templatePersonColors(slot: string): {
  bar: string; bgDark: string; bgLight: string; fgDark: string; fgLight: string;
} {
  const re = new RegExp(
    `${slot}\\s*:\\s*\\{\\s*bar\\s*:\\s*'([^']+)'\\s*,\\s*` +
      `bg\\s*:\\s*dark\\s*\\?\\s*'([^']+)'\\s*:\\s*'([^']+)'\\s*,\\s*` +
      `fg\\s*:\\s*dark\\s*\\?\\s*'([^']+)'\\s*:\\s*'([^']+)'`,
  );
  const m = re.exec(templateSrc);
  if (!m) throw new Error(`colors()-Eintrag fehlt in der Vorlage: ${slot}`);
  return { bar: m[1]!, bgDark: m[2]!, bgLight: m[3]!, fgDark: m[4]!, fgLight: m[5]! };
}

describe('Token-Parität mit der Design-Vorlage', () => {
  it('deckt jede sichtbare Light-Eigenschaft der Vorlage ab', () => {
    const template = customProps(templateSrc, ':root');
    const ours = customProps(tokensSrc, ':root');
    for (const [prop, value] of template) {
      expect(ours.get(prop), `--> ${prop} fehlt oder weicht ab`).toBe(value);
    }
  });

  it('deckt jede sichtbare Dark-Eigenschaft der Vorlage ab', () => {
    const template = customProps(templateSrc, ':root[data-ralia-theme="dark"]');
    const ours = customProps(tokensSrc, ':root[data-ralia-theme="dark"]');
    for (const [prop, value] of template) {
      expect(ours.get(prop), `--> dark ${prop} fehlt oder weicht ab`).toBe(value);
    }
  });

  it.each(['u1', 'u2', 'both', 'bday'])('hebt die Personenfarben von %s in Tokens', (slot) => {
    const c = templatePersonColors(slot);
    const light = customProps(tokensSrc, ':root');
    const dark = customProps(tokensSrc, ':root[data-ralia-theme="dark"]');
    expect(light.get(`--${slot}`)).toBe(c.bar);
    expect(light.get(`--${slot}-bg`)).toBe(c.bgLight);
    expect(light.get(`--${slot}-fg`)).toBe(c.fgLight);
    expect(dark.get(`--${slot}-bg`)).toBe(c.bgDark);
    expect(dark.get(`--${slot}-fg`)).toBe(c.fgDark);
    // Die Balkenfarbe ist in beiden Themes identisch — die Vorlage überschreibt sie nicht.
    expect(dark.has(`--${slot}`)).toBe(false);
  });

  it('hebt den ausgeschalteten Toggle-Track in Tokens', () => {
    const m = /const track = \(on\) => on \? fill : \(s\.dark \? '([^']+)' : '([^']+)'\)/.exec(templateSrc);
    expect(m, 'track()-Definition fehlt in der Vorlage').not.toBeNull();
    expect(customProps(tokensSrc, ':root').get('--track-off')).toBe(m![2]);
    expect(customProps(tokensSrc, ':root[data-ralia-theme="dark"]').get('--track-off')).toBe(m![1]);
  });

  it('hebt die Heute-Markierungen in Tokens', () => {
    const border = /border: isToday \? \(s\.dark \? '([^']+)' : '([^']+)'\) : line/.exec(templateSrc);
    expect(border, 'Heute-Rand fehlt in der Vorlage').not.toBeNull();
    expect(customProps(tokensSrc, ':root').get('--today-line')).toBe(border![2]);
    expect(customProps(tokensSrc, ':root[data-ralia-theme="dark"]').get('--today-line')).toBe(border![1]);

    const col = /colBg: isToday \? \(s\.dark \? '([^']+)' : '([^']+)'\) : 'transparent'/.exec(templateSrc);
    expect(col, 'Heute-Spaltenhintergrund fehlt in der Vorlage').not.toBeNull();
    expect(customProps(tokensSrc, ':root').get('--today-col')).toBe(col![2]);
    expect(customProps(tokensSrc, ':root[data-ralia-theme="dark"]').get('--today-col')).toBe(col![1]);
  });

  it('setzt --brand-fill themenunabhängig', () => {
    expect(customProps(tokensSrc, ':root').get('--brand-fill')).toBe('#7c3aed');
    expect(customProps(tokensSrc, ':root[data-ralia-theme="dark"]').has('--brand-fill')).toBe(false);
  });
});
```

- [ ] **Step 3: Test laufen lassen — er muss fehlschlagen**

Run: `npx vitest run packages/ui/src/tokens/tokens.parity.test.ts`
Expected: FAIL — `ENOENT` auf `tokens.css`

- [ ] **Step 4: `tokens.css` schreiben**

Quelle: Vorlage Z. 16–35 (`:root` und `:root[data-ralia-theme="dark"]`), **wertgenau übernehmen**. Danach die verdeckten Tokens ergänzen — Werte aus der Tabelle „Verdeckte Tokens" im Spec, hergeleitet aus Vorlage Z. 1172–1181 (`colors()`), Z. 1243 (`track()`), Z. 1280–1281 und Z. 1345 (Heute-Markierungen).

Struktur:

```css
:root {
  /* --- Sichtbar in der Vorlage (Z. 16–26) --- */
  /* brand*, accent, u1/u2/both/bday, ink-*, line*, surface*, bg-app, chrome,
     ok, danger, warn-*, shadow-*, hov-* : wertgenau aus der Vorlage */

  /* --- In der Vorlage in der Logik hartcodiert, hier als Token --- */
  --u1-bg: #eff6ff;  --u1-fg: #1d4ed8;
  --u2-bg: #fdf2f8;  --u2-fg: #be185d;
  --both-bg: #f5f3ff; --both-fg: #6d28d9;
  --bday-bg: #fff7ed; --bday-fg: #c2410c;
  --track-off: #cbd5e1;
  --today-line: #ddd0fb;
  --today-col: rgba(124,58,237,.035);
}

:root[data-ralia-theme='dark'] {
  /* Sichtbar: Vorlage Z. 27–35 — u1/u2/both/bday werden NICHT überschrieben */

  --u1-bg: rgba(59,130,246,.17);  --u1-fg: #93c5fd;
  --u2-bg: rgba(236,72,153,.17);  --u2-fg: #f9a8d4;
  --both-bg: rgba(139,92,246,.19); --both-fg: #c4b5fd;
  --bday-bg: rgba(249,115,22,.17); --bday-fg: #fdba74;
  --track-off: #3a3450;
  --today-line: #3d3555;
  --today-col: rgba(167,139,250,.06);
}
```

Zwei Fallen: der Test normalisiert Mehrfach-Whitespace, aber **nicht** Kommata — `rgba(15,23,42,.07)` und `rgba(15, 23, 42, .07)` sind für ihn verschieden. Und der Selektor muss exakt `:root[data-ralia-theme="dark"]` lauten; bei einfachen Anführungszeichen im CSS findet der Test den Block nicht. Beides: genau wie die Vorlage schreiben.

- [ ] **Step 5: Test laufen lassen — er muss bestehen**

Run: `npx vitest run packages/ui/src/tokens/tokens.parity.test.ts`
Expected: PASS, 8 Tests

- [ ] **Step 6: `reset.css` schreiben**

Quelle: Vorlage Z. 36–47 — `*{box-sizing}`, `body`, `a`/`a:hover`, `button`, `input,textarea,select`, Scrollbar-Regeln, `@keyframes ral-up`, `@keyframes ral-fade`.

Zwei Anpassungen gegenüber der Vorlage, beide aus dem Spec:

```css
/* Fokus-Zustand: die Vorlage hat keinen. Nur bei Tastaturnutzung sichtbar. */
:where(button, a, input, textarea, select, [tabindex]):focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--hov-ring);
}

/* Mobil randlos statt Telefon-Attrappe. */
html, body { height: 100%; }
body { min-height: 100dvh; }
@supports not (min-height: 100dvh) {
  body { min-height: 100vh; }
}
```

`font-family` in `body` bleibt `'Poppins', system-ui, sans-serif` wie in der Vorlage.

- [ ] **Step 7: `fonts.css` schreiben**

```css
@import '@fontsource/poppins/400.css';
@import '@fontsource/poppins/500.css';
@import '@fontsource/poppins/600.css';
@import '@fontsource/poppins/700.css';
```

Kein Google-Fonts-`<link>` — die Vorlage lädt Poppins von Google (Z. 12–14), das funktioniert offline und in der Capacitor-WebView nicht.

- [ ] **Step 8: `person.ts` schreiben**

```ts
/**
 * Das Personen-Vokabular des UI. Die Zuordnung von `belongs_to` und
 * `event_type` der Datenbank auf diese Slots gehört nach SP2 — `packages/ui`
 * darf die Datenbank nicht kennen.
 */
export type PersonSlot = 'u1' | 'u2' | 'both' | 'bday';

export const PERSON_SLOTS: readonly PersonSlot[] = ['u1', 'u2', 'both', 'bday'];

export interface PersonTokens {
  /** Farbbalken / Punkt — in beiden Themes identisch. */
  bar: string;
  /** Flächenhintergrund für Chips und Karten. */
  bg: string;
  /** Schriftfarbe auf `bg`. */
  fg: string;
}

/** Liefert Token-Referenzen, nie Literale — damit Themes greifen. */
export function personTokens(slot: PersonSlot): PersonTokens {
  return {
    bar: `var(--${slot})`,
    bg: `var(--${slot}-bg)`,
    fg: `var(--${slot}-fg)`,
  };
}
```

- [ ] **Step 9: `index.ts` anlegen**

```ts
/**
 * @ralia/ui — das Design-System aus der Vorlage.
 *
 * Kein Import aus @ralia/data: dieses Paket kennt keine Datenbankbegriffe.
 * Alle Maße und Farben stammen aus tokens.css, abgesichert durch
 * tokens/tokens.parity.test.ts gegen docs/design-reference.
 */
export { PERSON_SLOTS, personTokens, type PersonSlot, type PersonTokens } from './person.js';
```

- [ ] **Step 10: Gesamtlauf prüfen**

Run: `npm run typecheck && npm run lint && npm test`
Expected: alles Exit 0; Testzahl 103 + 8 = 111

- [ ] **Step 11: Commit**

```bash
git add vitest.config.ts packages/ui
git commit -m "feat(ui): Tokens wertgenau aus der Vorlage, mit mechanischem Paritaetstest

Die verdeckten Farbwerte aus colors(), track() und den Heute-Markierungen
werden zu echten Custom Properties. Optik unveraendert, aber erstmals
pruefbar - der Test liest die Vorlage und vergleicht Eigenschaft fuer
Eigenschaft."
```

---

## Task 4: ThemeProvider

**Files:**
- Create: `packages/ui/src/theme/theme-storage.ts`
- Create: `packages/ui/src/theme/ThemeProvider.tsx`
- Create: `packages/ui/src/theme/useTheme.ts`
- Create: `packages/ui/src/theme/ThemeProvider.test.tsx`
- Modify: `packages/ui/src/index.ts`

**Interfaces:**
- Consumes: Task 3
- Produces:
  - `type ThemeChoice = 'light' | 'dark' | 'system'`
  - `type ResolvedTheme = 'light' | 'dark'`
  - `const THEME_STORAGE_KEY = 'ralia.theme'`, `const THEME_ATTRIBUTE = 'data-ralia-theme'`
  - `function ThemeProvider(props: { children: React.ReactNode }): React.JSX.Element`
  - `function useTheme(): { choice: ThemeChoice; resolved: ResolvedTheme; setChoice(next: ThemeChoice): void }`
  - `function readStoredChoice(storage?: Pick<Storage, 'getItem'>): ThemeChoice`
  - `function themeBootScript(): string` — der Inline-Schnipsel gegen den Flash, von Task 11 in `index.html` eingesetzt

- [ ] **Step 1: Tests schreiben**

Create `packages/ui/src/theme/ThemeProvider.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { THEME_ATTRIBUTE, THEME_STORAGE_KEY, ThemeProvider } from './ThemeProvider.js';
import { useTheme } from './useTheme.js';

function Probe() {
  const { choice, resolved, setChoice } = useTheme();
  return (
    <>
      <span data-testid="choice">{choice}</span>
      <span data-testid="resolved">{resolved}</span>
      <button onClick={() => setChoice('dark')}>dunkel</button>
      <button onClick={() => setChoice('system')}>system</button>
    </>
  );
}

/** jsdom kennt matchMedia nicht — wir setzen es mit steuerbarem Ergebnis. */
function mockMatchMedia(darkPreferred: boolean) {
  const listeners = new Set<(e: MediaQueryListEvent) => void>();
  const mql = {
    matches: darkPreferred,
    media: '(prefers-color-scheme: dark)',
    addEventListener: (_: string, fn: (e: MediaQueryListEvent) => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: (e: MediaQueryListEvent) => void) => listeners.delete(fn),
    dispatch: (matches: boolean) => {
      mql.matches = matches;
      for (const fn of listeners) fn({ matches } as MediaQueryListEvent);
    },
  };
  vi.stubGlobal('matchMedia', () => mql);
  return mql;
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute(THEME_ATTRIBUTE);
});
afterEach(() => vi.unstubAllGlobals());

describe('ThemeProvider', () => {
  it('folgt ohne gespeicherte Wahl der Systemeinstellung', () => {
    mockMatchMedia(true);
    render(<ThemeProvider><Probe /></ThemeProvider>);
    expect(screen.getByTestId('choice')).toHaveTextContent('system');
    expect(screen.getByTestId('resolved')).toHaveTextContent('dark');
    expect(document.documentElement.getAttribute(THEME_ATTRIBUTE)).toBe('dark');
  });

  it('setzt bei Hell kein Attribut', () => {
    mockMatchMedia(false);
    render(<ThemeProvider><Probe /></ThemeProvider>);
    expect(screen.getByTestId('resolved')).toHaveTextContent('light');
    expect(document.documentElement.hasAttribute(THEME_ATTRIBUTE)).toBe(false);
  });

  it('speichert eine manuelle Wahl', async () => {
    mockMatchMedia(false);
    render(<ThemeProvider><Probe /></ThemeProvider>);
    await userEvent.click(screen.getByRole('button', { name: 'dunkel' }));
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(document.documentElement.getAttribute(THEME_ATTRIBUTE)).toBe('dark');
  });

  it('stellt eine gespeicherte Wahl wieder her — Reload-Ersatz', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    mockMatchMedia(false);
    render(<ThemeProvider><Probe /></ThemeProvider>);
    expect(screen.getByTestId('choice')).toHaveTextContent('dark');
    expect(document.documentElement.getAttribute(THEME_ATTRIBUTE)).toBe('dark');
  });

  it('reagiert bei system auf einen Systemwechsel', async () => {
    const mql = mockMatchMedia(false);
    render(<ThemeProvider><Probe /></ThemeProvider>);
    expect(screen.getByTestId('resolved')).toHaveTextContent('light');
    mql.dispatch(true);
    expect(await screen.findByText('dark')).toBeInTheDocument();
  });

  it('ignoriert einen unbekannten gespeicherten Wert', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'neon');
    mockMatchMedia(false);
    render(<ThemeProvider><Probe /></ThemeProvider>);
    expect(screen.getByTestId('choice')).toHaveTextContent('system');
  });
});
```

- [ ] **Step 2: Tests laufen lassen — sie müssen fehlschlagen**

Run: `npx vitest run packages/ui/src/theme/ThemeProvider.test.tsx`
Expected: FAIL — Modul `./ThemeProvider.js` nicht auflösbar

- [ ] **Step 3: `theme-storage.ts` implementieren**

```ts
export const THEME_STORAGE_KEY = 'ralia.theme';
export const THEME_ATTRIBUTE = 'data-ralia-theme';
export const DARK_QUERY = '(prefers-color-scheme: dark)';

export type ThemeChoice = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const CHOICES: readonly ThemeChoice[] = ['light', 'dark', 'system'];

function isChoice(value: string | null): value is ThemeChoice {
  return value !== null && (CHOICES as readonly string[]).includes(value);
}

/** Unbekannte oder fehlende Werte ergeben `system`. Storage-Zugriff kann werfen (Safari, privat). */
export function readStoredChoice(storage?: Pick<Storage, 'getItem'>): ThemeChoice {
  try {
    const raw = (storage ?? globalThis.localStorage).getItem(THEME_STORAGE_KEY);
    return isChoice(raw) ? raw : 'system';
  } catch {
    return 'system';
  }
}

export function writeStoredChoice(choice: ThemeChoice, storage?: Pick<Storage, 'setItem'>): void {
  try {
    (storage ?? globalThis.localStorage).setItem(THEME_STORAGE_KEY, choice);
  } catch {
    // Kein Speicher, keine Persistenz — die App bleibt bedienbar.
  }
}

export function resolveTheme(choice: ThemeChoice, systemPrefersDark: boolean): ResolvedTheme {
  if (choice === 'system') return systemPrefersDark ? 'dark' : 'light';
  return choice;
}

/** Nur bei `dark` wird das Attribut gesetzt — genau wie in der Vorlage (Z. 1159–1163). */
export function applyTheme(resolved: ResolvedTheme, root: Element): void {
  if (resolved === 'dark') root.setAttribute(THEME_ATTRIBUTE, 'dark');
  else root.removeAttribute(THEME_ATTRIBUTE);
}

/**
 * Läuft vor dem ersten Frame in index.html und verhindert den Hell-Blitz.
 * Bewusst ES5 ohne Optional Chaining: das ist Inline-Skript ohne Transpilation.
 */
export function themeBootScript(): string {
  return [
    'try{',
    `var c=localStorage.getItem('${THEME_STORAGE_KEY}');`,
    `if(c!=='light'&&c!=='dark')c='system';`,
    `var d=c==='dark'||(c==='system'&&matchMedia('${DARK_QUERY}').matches);`,
    `if(d)document.documentElement.setAttribute('${THEME_ATTRIBUTE}','dark');`,
    '}catch(e){}',
  ].join('');
}
```

- [ ] **Step 4: `ThemeProvider.tsx` implementieren**

Kernpunkte: Kontext mit `choice`/`resolved`/`setChoice`; Startwert aus `readStoredChoice()`; `matchMedia`-Abo nur wenn `choice === 'system'`; `applyTheme` in einem `useEffect` auf `document.documentElement`; `matchMedia` defensiv behandeln (in älteren WebViews fehlt `addEventListener`).

```tsx
import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  DARK_QUERY, applyTheme, readStoredChoice, resolveTheme, writeStoredChoice,
  type ResolvedTheme, type ThemeChoice,
} from './theme-storage.js';

export { THEME_ATTRIBUTE, THEME_STORAGE_KEY } from './theme-storage.js';
export type { ResolvedTheme, ThemeChoice } from './theme-storage.js';

export interface ThemeContextValue {
  choice: ThemeChoice;
  resolved: ResolvedTheme;
  setChoice(next: ThemeChoice): void;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

function systemPrefersDark(): boolean {
  return typeof matchMedia === 'function' && matchMedia(DARK_QUERY).matches;
}

export function ThemeProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [choice, setChoiceState] = useState<ThemeChoice>(() => readStoredChoice());
  const [systemDark, setSystemDark] = useState<boolean>(systemPrefersDark);

  useEffect(() => {
    if (choice !== 'system' || typeof matchMedia !== 'function') return;
    const mql = matchMedia(DARK_QUERY);
    const onChange = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    mql.addEventListener?.('change', onChange);
    setSystemDark(mql.matches);
    return () => mql.removeEventListener?.('change', onChange);
  }, [choice]);

  const resolved = resolveTheme(choice, systemDark);

  useEffect(() => {
    applyTheme(resolved, document.documentElement);
  }, [resolved]);

  const setChoice = useCallback((next: ThemeChoice) => {
    setChoiceState(next);
    writeStoredChoice(next);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ choice, resolved, setChoice }),
    [choice, resolved, setChoice],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
```

- [ ] **Step 5: `useTheme.ts` implementieren**

```ts
import { useContext } from 'react';
import { ThemeContext, type ThemeContextValue } from './ThemeProvider.js';

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme braucht einen ThemeProvider im Baum');
  return value;
}
```

- [ ] **Step 6: Tests laufen lassen**

Run: `npx vitest run packages/ui/src/theme/ThemeProvider.test.tsx`
Expected: PASS, 6 Tests

- [ ] **Step 7: Aus `index.ts` exportieren**

```ts
export {
  THEME_ATTRIBUTE, THEME_STORAGE_KEY, ThemeProvider,
  type ResolvedTheme, type ThemeChoice, type ThemeContextValue,
} from './theme/ThemeProvider.js';
export { readStoredChoice, themeBootScript } from './theme/theme-storage.js';
export { useTheme } from './theme/useTheme.js';
```

- [ ] **Step 8: Commit**

```bash
git add packages/ui
git commit -m "feat(ui): ThemeProvider mit Light/Dark/System und Flash-Schutz"
```

---

## Task 5: Kalender-Logik in `packages/core`

Reine Arithmetik, ohne DOM testbar. Sie ersetzt die Prototyp-Rechnung der Vorlage, die aus `window.innerHeight - 90` auf die Zeilenhöhe schloss — die 90 px waren deren eigene Kopfleiste.

**Files:**
- Create: `packages/core/src/calendar/month-density.ts`
- Create: `packages/core/src/calendar/month-density.test.ts`
- Create: `packages/core/src/calendar/week-geometry.ts`
- Create: `packages/core/src/calendar/week-geometry.test.ts`
- Create: `packages/core/src/calendar/month-grid.ts`
- Create: `packages/core/src/calendar/month-grid.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Consumes: Task 1
- Produces:
  - `function monthDensity(gridHeightPx: number): MonthDensity` mit `MonthDensity = { mode: 'chips' | 'dots'; maxChips: number; maxDots: number }`
  - `function weekEventGeometry(startMinutes: number, endMinutes: number, dayStartHour: number): { topPx: number; heightPx: number }`
  - `function parseTimeToMinutes(hhmm: string): number | null`
  - `function monthGridCells(year: number, monthIndex: number, weekStart: 'mo' | 'so'): MonthGridCell[]` mit `MonthGridCell = { iso: string; dayOfMonth: number; inMonth: boolean }`
  - Konstanten `WEEK_HOUR_HEIGHT_PX = 52`, `MONTH_MAX_CHIPS = 3`, `MONTH_MAX_DOTS = 5`

- [ ] **Step 1: Test für `month-density` schreiben**

Die Schwellwerte der Vorlage (Z. 1256–1260): Chiphöhe 19 px (16 px Chip + 3 px Abstand), Zellen-Innenmaß 35 px (12 Padding + 20 Tagesnummer + 3 Abstand), höchstens 3 Chips, sonst höchstens 5 Punkte.

```ts
import { describe, expect, it } from 'vitest';
import { MONTH_MAX_CHIPS, MONTH_MAX_DOTS, monthDensity } from './month-density.js';

describe('monthDensity', () => {
  it('zeigt Punkte, wenn nicht einmal ein Chip passt', () => {
    // Zeilenhöhe 50 → 50 - 35 = 15 < 19
    expect(monthDensity(50 * 6)).toEqual({ mode: 'dots', maxChips: 0, maxDots: MONTH_MAX_DOTS });
  });

  it('zeigt genau einen Chip an der unteren Schwelle', () => {
    // Zeilenhöhe 54 → 19 verfügbar → floor(19/19) = 1
    expect(monthDensity(54 * 6)).toEqual({ mode: 'chips', maxChips: 1, maxDots: 0 });
  });

  it('zeigt zwei Chips bei mittlerer Höhe', () => {
    // Zeilenhöhe 73 → 38 verfügbar → floor(38/19) = 2
    expect(monthDensity(73 * 6)).toEqual({ mode: 'chips', maxChips: 2, maxDots: 0 });
  });

  it('deckelt bei drei Chips, egal wie hoch die Zeile ist', () => {
    expect(monthDensity(400 * 6).maxChips).toBe(MONTH_MAX_CHIPS);
  });

  it('behandelt eine noch nicht gemessene Höhe als Punkte-Modus', () => {
    expect(monthDensity(0).mode).toBe('dots');
    expect(monthDensity(-10).mode).toBe('dots');
  });

  it('stimmt mit der Vorlage bei 900 px Viewport überein', () => {
    // Vorlage: shellH = clamp(560, 900-90, 860) = 810; rowH = (810-290)/6 = 86.67
    // → chipAvail 51.67 → floor(51.67/19) = 2
    expect(monthDensity(810 - 290).maxChips).toBe(2);
  });
});
```

- [ ] **Step 2: Test laufen lassen — er muss fehlschlagen**

Run: `npx vitest run packages/core/src/calendar/month-density.test.ts`
Expected: FAIL — Modul nicht gefunden

- [ ] **Step 3: `month-density.ts` implementieren**

```ts
/**
 * Wie viele Ereignisse eine Monatszelle zeigt.
 *
 * Die Vorlage leitete das aus `window.innerHeight - 90` ab, wobei die 90 px
 * ihre eigene Prototyp-Kopfleiste waren. Hier kommt die Rasterhöhe aus einer
 * echten Messung; Regel und Schwellwerte sind unverändert.
 */

/** Chiphöhe 16 px + 3 px Abstand (Vorlage Z. 163, Z. 1258). */
export const MONTH_CHIP_HEIGHT_PX = 19;
/** 12 px Zellpadding + 20 px Tagesnummer + 3 px Abstand (Vorlage Z. 1257). */
export const MONTH_CELL_CHROME_PX = 35;
export const MONTH_MAX_CHIPS = 3;
export const MONTH_MAX_DOTS = 5;
export const MONTH_ROW_COUNT = 6;

export interface MonthDensity {
  mode: 'chips' | 'dots';
  maxChips: number;
  maxDots: number;
}

const DOTS: MonthDensity = { mode: 'dots', maxChips: 0, maxDots: MONTH_MAX_DOTS };

export function monthDensity(gridHeightPx: number): MonthDensity {
  if (!Number.isFinite(gridHeightPx) || gridHeightPx <= 0) return DOTS;
  const rowHeight = gridHeightPx / MONTH_ROW_COUNT;
  const available = rowHeight - MONTH_CELL_CHROME_PX;
  const maxChips = Math.min(MONTH_MAX_CHIPS, Math.floor(available / MONTH_CHIP_HEIGHT_PX));
  return maxChips < 1 ? DOTS : { mode: 'chips', maxChips, maxDots: 0 };
}
```

- [ ] **Step 4: Test laufen lassen**

Run: `npx vitest run packages/core/src/calendar/month-density.test.ts`
Expected: PASS, 6 Tests

- [ ] **Step 5: Test für `week-geometry` schreiben**

Werte aus Vorlage Z. 1297–1305: Stundenhöhe 52 px, `top = max(0, startMin - startH*60)/60*52`, `height = max(26, dauer/60*52 - 3)`.

```ts
import { describe, expect, it } from 'vitest';
import { WEEK_HOUR_HEIGHT_PX, parseTimeToMinutes, weekEventGeometry } from './week-geometry.js';

describe('parseTimeToMinutes', () => {
  it('liest HH:MM', () => {
    expect(parseTimeToMinutes('09:00')).toBe(540);
    expect(parseTimeToMinutes('00:00')).toBe(0);
    expect(parseTimeToMinutes('23:59')).toBe(1439);
  });

  it('gibt null für Unbrauchbares', () => {
    expect(parseTimeToMinutes('')).toBeNull();
    expect(parseTimeToMinutes('24:00')).toBeNull();
    expect(parseTimeToMinutes('9:00')).toBeNull();
    expect(parseTimeToMinutes('09:60')).toBeNull();
  });
});

describe('weekEventGeometry', () => {
  it('setzt einen Termin zur Tagesstartstunde auf top 0', () => {
    expect(weekEventGeometry(6 * 60, 7 * 60, 6)).toEqual({ topPx: 0, heightPx: 49 });
  });

  it('rechnet eine Stunde als Stundenhöhe minus 3 px Einzug', () => {
    const { heightPx } = weekEventGeometry(9 * 60, 10 * 60, 6);
    expect(heightPx).toBe(WEEK_HOUR_HEIGHT_PX - 3);
  });

  it('verschiebt nach Tagesstartstunde', () => {
    expect(weekEventGeometry(9 * 60, 10 * 60, 6).topPx).toBe(3 * WEEK_HOUR_HEIGHT_PX);
    expect(weekEventGeometry(9 * 60, 10 * 60, 0).topPx).toBe(9 * WEEK_HOUR_HEIGHT_PX);
  });

  it('klemmt Termine vor dem Tagesstart auf top 0', () => {
    expect(weekEventGeometry(2 * 60, 3 * 60, 6).topPx).toBe(0);
  });

  it('erzwingt eine Mindesthöhe für sehr kurze Termine', () => {
    expect(weekEventGeometry(9 * 60, 9 * 60 + 15, 6).heightPx).toBe(26);
  });

  it('rechnet 45 Minuten korrekt', () => {
    // 45/60*52 - 3 = 39 - 3 = 36
    expect(weekEventGeometry(510, 555, 6).heightPx).toBe(36);
  });
});
```

- [ ] **Step 6: Test laufen lassen — er muss fehlschlagen**

Run: `npx vitest run packages/core/src/calendar/week-geometry.test.ts`
Expected: FAIL

- [ ] **Step 7: `week-geometry.ts` implementieren**

```ts
/** Geometrie der Wochen-Timeline. Werte wertgenau aus der Vorlage (Z. 1297–1305). */

export const WEEK_HOUR_HEIGHT_PX = 52;
export const WEEK_MIN_EVENT_HEIGHT_PX = 26;
/** Luft nach unten, damit aufeinanderfolgende Termine nicht verkleben. */
export const WEEK_EVENT_HEIGHT_INSET_PX = 3;
/** Nachtstunden bleiben eingeklappt, bis der Nutzer sie aufklappt. */
export const WEEK_DEFAULT_START_HOUR = 6;
export const WEEK_EXPANDED_START_HOUR = 0;

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** `null` statt Wurf: die Vorlage behandelt ganztägige Termine als „keine Zeit". */
export function parseTimeToMinutes(value: string): number | null {
  const match = TIME_RE.exec(value);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export interface WeekEventGeometry {
  topPx: number;
  heightPx: number;
}

export function weekEventGeometry(
  startMinutes: number,
  endMinutes: number,
  dayStartHour: number,
): WeekEventGeometry {
  const offset = dayStartHour * 60;
  const topPx = (Math.max(0, startMinutes - offset) / 60) * WEEK_HOUR_HEIGHT_PX;
  const heightPx = Math.max(
    WEEK_MIN_EVENT_HEIGHT_PX,
    ((endMinutes - startMinutes) / 60) * WEEK_HOUR_HEIGHT_PX - WEEK_EVENT_HEIGHT_INSET_PX,
  );
  return { topPx, heightPx };
}
```

- [ ] **Step 8: Test für `month-grid` schreiben**

Regel aus Vorlage Z. 1261–1268: 42 Zellen, Start je Wochenstart verschoben, UTC-Arithmetik.

```ts
import { describe, expect, it } from 'vitest';
import { monthGridCells } from './month-grid.js';

describe('monthGridCells', () => {
  it('liefert immer 42 Zellen', () => {
    expect(monthGridCells(2026, 6, 'mo')).toHaveLength(42);
    expect(monthGridCells(2026, 1, 'mo')).toHaveLength(42);
  });

  it('beginnt bei Wochenstart Montag am richtigen Tag', () => {
    // 1. Juli 2026 ist ein Mittwoch → zwei Tage Vorlauf: 29. und 30. Juni
    const cells = monthGridCells(2026, 6, 'mo');
    expect(cells[0]?.iso).toBe('2026-06-29');
    expect(cells[0]?.inMonth).toBe(false);
    expect(cells[2]?.iso).toBe('2026-07-01');
    expect(cells[2]?.inMonth).toBe(true);
  });

  it('verschiebt bei Wochenstart Sonntag um einen Tag', () => {
    expect(monthGridCells(2026, 6, 'so')[0]?.iso).toBe('2026-06-28');
  });

  it('markiert Tage des Folgemonats als außerhalb', () => {
    const cells = monthGridCells(2026, 6, 'mo');
    const last = cells[41];
    expect(last?.inMonth).toBe(false);
    expect(last?.iso.startsWith('2026-08')).toBe(true);
  });

  it('kommt über einen Jahreswechsel', () => {
    const cells = monthGridCells(2026, 11, 'mo');
    expect(cells.some((c) => c.iso.startsWith('2027-01'))).toBe(true);
  });

  it('kommt mit einem Schaltjahr-Februar zurecht', () => {
    const cells = monthGridCells(2028, 1, 'mo');
    expect(cells.filter((c) => c.inMonth)).toHaveLength(29);
  });

  it('liefert die Tagesnummer passend zum ISO-Datum', () => {
    for (const cell of monthGridCells(2026, 6, 'mo')) {
      expect(cell.dayOfMonth).toBe(Number(cell.iso.slice(8, 10)));
    }
  });
});
```

- [ ] **Step 9: Test laufen lassen — er muss fehlschlagen**

Run: `npx vitest run packages/core/src/calendar/month-grid.test.ts`
Expected: FAIL

- [ ] **Step 10: `month-grid.ts` implementieren**

```ts
/**
 * Die 42 Zellen eines Monatsrasters.
 *
 * Durchgehend UTC — genau wie die Vorlage (Z. 1261–1268). Lokale Zeitzonen
 * würden beim Datumssprung über Mitternacht Zellen verschieben.
 */

export const MONTH_CELL_COUNT = 42;
const DAY_MS = 86_400_000;

export type WeekStart = 'mo' | 'so';

export interface MonthGridCell {
  /** `YYYY-MM-DD` */
  iso: string;
  dayOfMonth: number;
  /** Gehört die Zelle zum dargestellten Monat? Sonst ausgegraut. */
  inMonth: boolean;
}

function toIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** @param monthIndex 0-basiert, wie `Date#getUTCMonth`. */
export function monthGridCells(
  year: number,
  monthIndex: number,
  weekStart: WeekStart,
): MonthGridCell[] {
  const first = new Date(Date.UTC(year, monthIndex, 1));
  const weekday = first.getUTCDay();
  const shift = weekStart === 'mo' ? (weekday + 6) % 7 : weekday;
  const gridStart = Date.UTC(year, monthIndex, 1 - shift);

  const cells: MonthGridCell[] = [];
  for (let index = 0; index < MONTH_CELL_COUNT; index += 1) {
    const date = new Date(gridStart + index * DAY_MS);
    cells.push({
      iso: toIso(date),
      dayOfMonth: date.getUTCDate(),
      inMonth: date.getUTCMonth() === monthIndex && date.getUTCFullYear() === year,
    });
  }
  return cells;
}
```

- [ ] **Step 11: Alle drei Testdateien laufen lassen**

Run: `npx vitest run packages/core/src/calendar`
Expected: PASS, 19 Tests

- [ ] **Step 12: Aus `packages/core/src/index.ts` exportieren**

Am Ende der Datei, alphabetisch vor den Outbox-Exporten einsortiert:

```ts
export {
  MONTH_CELL_CHROME_PX, MONTH_CHIP_HEIGHT_PX, MONTH_MAX_CHIPS, MONTH_MAX_DOTS,
  MONTH_ROW_COUNT, monthDensity, type MonthDensity,
} from './calendar/month-density.js';

export {
  MONTH_CELL_COUNT, monthGridCells, type MonthGridCell, type WeekStart,
} from './calendar/month-grid.js';

export {
  WEEK_DEFAULT_START_HOUR, WEEK_EVENT_HEIGHT_INSET_PX, WEEK_EXPANDED_START_HOUR,
  WEEK_HOUR_HEIGHT_PX, WEEK_MIN_EVENT_HEIGHT_PX, parseTimeToMinutes,
  weekEventGeometry, type WeekEventGeometry,
} from './calendar/week-geometry.js';
```

- [ ] **Step 13: Gesamtlauf und Commit**

Run: `npm run typecheck && npm run lint && npm test`
Expected: alles grün, 111 + 19 = 130 Tests

```bash
git add packages/core
git commit -m "feat(core): Monatsdichte, Wochengeometrie und Monatsraster als reine Logik

Die Chip-gegen-Punkt-Entscheidung der Vorlage leitete die Zeilenhoehe aus
window.innerHeight minus der eigenen Prototyp-Kopfleiste ab. Hier kommt sie
aus einer Messung; Schwellwerte und Regel sind unveraendert und jetzt
per Test fixiert."
```

---

## Task 6: Icon-Set

**Files:**
- Create: `packages/ui/src/icons/paths.tsx`
- Create: `packages/ui/src/icons/Icon.tsx`
- Create: `packages/ui/src/icons/Icon.test.tsx`
- Modify: `packages/ui/src/index.ts`

**Interfaces:**
- Consumes: Task 3
- Produces:
  - `type IconName = 'calendar' | 'planner' | 'todos' | 'money' | 'settings' | 'meal' | 'task'`
  - `function Icon(props: { name: IconName; size?: number; title?: string }): React.JSX.Element` — Standardgröße 17, `stroke="currentColor"`, `strokeWidth={1.6}`, `viewBox="0 0 20 20"`; ohne `title` ist das SVG `aria-hidden`

- [ ] **Step 1: Test schreiben**

```tsx
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ICON_NAMES, Icon } from './Icon.js';

describe('Icon', () => {
  it.each(ICON_NAMES)('rendert %s mit den Maßen der Vorlage', (name) => {
    const { container } = render(<Icon name={name} />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('viewBox')).toBe('0 0 20 20');
    expect(svg?.getAttribute('stroke-width')).toBe('1.6');
    expect(svg?.querySelectorAll('rect, line, circle, path, polyline').length).toBeGreaterThan(0);
  });

  it('ist ohne Titel für Screenreader unsichtbar', () => {
    const { container } = render(<Icon name="calendar" />);
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('wird mit Titel zum Bild mit Namen', () => {
    const { getByRole } = render(<Icon name="calendar" title="Kalender" />);
    expect(getByRole('img', { name: 'Kalender' })).toBeInTheDocument();
  });

  it('nutzt die Standardgröße 17 und respektiert eine eigene', () => {
    const { container: a } = render(<Icon name="todos" />);
    expect(a.querySelector('svg')?.getAttribute('width')).toBe('17');
    const { container: b } = render(<Icon name="todos" size={19} />);
    expect(b.querySelector('svg')?.getAttribute('width')).toBe('19');
  });
});
```

- [ ] **Step 2: Test laufen lassen — er muss fehlschlagen**

Run: `npx vitest run packages/ui/src/icons/Icon.test.tsx`
Expected: FAIL

- [ ] **Step 3: `paths.tsx` schreiben**

Die Pfade **wörtlich** aus der Vorlage übernehmen:

| Name | Quelle | Inhalt |
|---|---|---|
| `calendar` | Z. 84 | `rect x=2.5 y=4 w=15 h=13.5 rx=3` + `line 2.5,8→17.5,8` + zwei Henkel-`line` |
| `planner` | Z. 87 | `rect x=2.5 y=3 w=15 h=14.5 rx=3` + drei `line` |
| `todos` | Z. 90 | zwei `rect` 5×5 rx=1.5 + zwei `line` |
| `money` | Z. 93 | `circle r=7.2` + zwei `line` |
| `settings` | Z. 96 | `circle r=2.6` + `circle r=7` |
| `meal` | Z. 249 | Besteck-`path`, `stroke-linecap="round"` |
| `task` | Z. 257 | `polyline 3,10.5 6.5,14 10.5,6` + zwei `line`, `stroke-linecap`/`linejoin="round"` |

`meal` und `task` haben in der Vorlage feste Strichfarben (`#f97316`, `#3b82f6`). Hier **nicht** übernehmen: die Farbe kommt vom Aufrufer über `color` in einem Wrapper — sonst reagieren die Icons nicht auf das Theme. Die Screens setzen sie später auf `var(--bday)` bzw. `var(--u1)`, was denselben Farben entspricht.

Zusätzliche `<svg>`-Attribute je Icon (`strokeLinecap`, `strokeLinejoin`) über eine Extra-Angabe pro Eintrag:

```tsx
import type { ReactNode } from 'react';

export const ICON_NAMES = ['calendar', 'planner', 'todos', 'money', 'settings', 'meal', 'task'] as const;
export type IconName = (typeof ICON_NAMES)[number];

interface IconDef {
  body: ReactNode;
  linecap?: 'round';
  linejoin?: 'round';
}

export const ICON_DEFS: Record<IconName, IconDef> = {
  // … je Eintrag die Elemente aus der Tabelle oben
};
```

- [ ] **Step 4: `Icon.tsx` schreiben**

```tsx
import { ICON_DEFS, ICON_NAMES, type IconName } from './paths.js';

export { ICON_NAMES, type IconName } from './paths.js';

export interface IconProps {
  name: IconName;
  /** Vorlage: 17 in der Sidebar, 19 in der Bottom-Nav, 14 bei Essen/Aufgaben. */
  size?: number;
  /** Gesetzt = das Icon trägt Bedeutung. Sonst dekorativ und ausgeblendet. */
  title?: string;
}

export function Icon({ name, size = 17, title }: IconProps): React.JSX.Element {
  const def = ICON_DEFS[name];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      {...(def.linecap ? { strokeLinecap: def.linecap } : {})}
      {...(def.linejoin ? { strokeLinejoin: def.linejoin } : {})}
      {...(title ? { role: 'img' as const } : { 'aria-hidden': true as const })}
    >
      {title ? <title>{title}</title> : null}
      {def.body}
    </svg>
  );
}
```

`exactOptionalPropertyTypes` ist aktiv — deshalb die Spread-Form statt `strokeLinecap={def.linecap}`.

- [ ] **Step 5: Test laufen lassen**

Run: `npx vitest run packages/ui/src/icons/Icon.test.tsx`
Expected: PASS, 10 Tests

- [ ] **Step 6: Export und Commit**

In `packages/ui/src/index.ts`:

```ts
export { ICON_NAMES, Icon, type IconName, type IconProps } from './icons/Icon.js';
```

```bash
git add packages/ui
git commit -m "feat(ui): Icon-Set mit den Pfaden der Vorlage"
```

---

## Task 7: Interaktive Primitive

Sieben Komponenten, jede aus genau einer Helferfunktion der Vorlage abgeleitet. Sie gehören in eine Task, weil sie dasselbe Muster teilen — `on`-Zustand entscheidet über drei Farbwerte — und ein Reviewer sie sinnvoll nur gemeinsam gegen die Vorlage prüft.

**Files:**
- Create: `packages/ui/src/primitives/Button.tsx` + `.module.css`
- Create: `packages/ui/src/primitives/IconButton.tsx` + `.module.css`
- Create: `packages/ui/src/primitives/SegmentSwitch.tsx` + `.module.css`
- Create: `packages/ui/src/primitives/NavItem.tsx` + `.module.css`
- Create: `packages/ui/src/primitives/Chip.tsx` + `.module.css`
- Create: `packages/ui/src/primitives/PersonChip.tsx` + `.module.css`
- Create: `packages/ui/src/primitives/Toggle.tsx` + `.module.css`
- Create: `packages/ui/src/primitives/interactive.test.tsx`
- Modify: `packages/ui/src/index.ts`

**Interfaces:**
- Consumes: Task 3 (`personTokens`, Tokens), Task 6 (`Icon`)
- Produces:
  - `function Button(props: { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; children: ReactNode; onClick?: () => void; disabled?: boolean; fullWidth?: boolean; type?: 'button' | 'submit' })`
  - `function IconButton(props: { label: string; children: ReactNode; onClick: () => void; disabled?: boolean })` — 34×34, Radius 11
  - `function SegmentSwitch<T extends string>(props: { options: readonly { value: T; label: string }[]; value: T; onChange(next: T): void; label: string })`
  - `function NavItem(props: { active: boolean; label: string; icon: IconName; layout: 'sidebar' | 'bottom'; onClick(): void })`
  - `function Chip(props: { active: boolean; label: string; onClick(): void })`
  - `function PersonChip(props: { slot: PersonSlot; active: boolean; label: string; onClick(): void })`
  - `function Toggle(props: { checked: boolean; onChange(next: boolean): void; label: string })`

- [ ] **Step 1: Tests schreiben**

Create `packages/ui/src/primitives/interactive.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './Button.js';
import { Chip } from './Chip.js';
import { IconButton } from './IconButton.js';
import { NavItem } from './NavItem.js';
import { PersonChip } from './PersonChip.js';
import { SegmentSwitch } from './SegmentSwitch.js';
import { Toggle } from './Toggle.js';

describe('Button', () => {
  it('löst onClick aus', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Speichern</Button>);
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('löst deaktiviert nicht aus', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick} disabled>Speichern</Button>);
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('ist per Tastatur bedienbar', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Speichern</Button>);
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Speichern' })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('ist standardmäßig type=button, damit es kein Formular abschickt', () => {
    render(<Button>X</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
  });
});

describe('IconButton', () => {
  it('trägt seinen Namen für Screenreader', () => {
    render(<IconButton label="Nächster Monat" onClick={() => {}}>›</IconButton>);
    expect(screen.getByRole('button', { name: 'Nächster Monat' })).toBeInTheDocument();
  });
});

describe('SegmentSwitch', () => {
  const options = [
    { value: 'monat', label: 'Monat' },
    { value: 'woche', label: 'Woche' },
  ] as const;

  it('kennzeichnet den aktiven Eintrag', () => {
    render(<SegmentSwitch label="Ansicht" options={options} value="monat" onChange={() => {}} />);
    expect(screen.getByRole('radio', { name: 'Monat' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Woche' })).not.toBeChecked();
  });

  it('meldet einen Wechsel per Klick', async () => {
    const onChange = vi.fn();
    render(<SegmentSwitch label="Ansicht" options={options} value="monat" onChange={onChange} />);
    await userEvent.click(screen.getByRole('radio', { name: 'Woche' }));
    expect(onChange).toHaveBeenCalledWith('woche');
  });

  it('wechselt mit den Pfeiltasten', async () => {
    const onChange = vi.fn();
    render(<SegmentSwitch label="Ansicht" options={options} value="monat" onChange={onChange} />);
    screen.getByRole('radio', { name: 'Monat' }).focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenCalledWith('woche');
  });

  it('läuft am Ende wieder nach vorn', async () => {
    const onChange = vi.fn();
    render(<SegmentSwitch label="Ansicht" options={options} value="woche" onChange={onChange} />);
    screen.getByRole('radio', { name: 'Woche' }).focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenCalledWith('monat');
  });

  it('trägt den Gruppennamen', () => {
    render(<SegmentSwitch label="Ansicht" options={options} value="monat" onChange={() => {}} />);
    expect(screen.getByRole('radiogroup', { name: 'Ansicht' })).toBeInTheDocument();
  });
});

describe('NavItem', () => {
  it('markiert die aktive Seite', () => {
    render(<NavItem active label="Kalender" icon="calendar" layout="bottom" onClick={() => {}} />);
    expect(screen.getByRole('button', { name: 'Kalender' })).toHaveAttribute('aria-current', 'page');
  });

  it('lässt aria-current bei inaktiven Einträgen weg', () => {
    render(<NavItem active={false} label="Geld" icon="money" layout="bottom" onClick={() => {}} />);
    expect(screen.getByRole('button', { name: 'Geld' })).not.toHaveAttribute('aria-current');
  });
});

describe('PersonChip', () => {
  it('kennzeichnet den gedrückten Zustand', () => {
    render(<PersonChip slot="u1" active label="Jonas" onClick={() => {}} />);
    expect(screen.getByRole('button', { name: 'Jonas' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('setzt die Personenfarbe als Token, nicht als Literal', () => {
    render(<PersonChip slot="u2" active label="Lena" onClick={() => {}} />);
    const style = screen.getByRole('button', { name: 'Lena' }).getAttribute('style') ?? '';
    expect(style).toContain('var(--u2');
    expect(style).not.toMatch(/#[0-9a-f]{6}/i);
  });
});

describe('Chip', () => {
  it('meldet einen Klick', async () => {
    const onClick = vi.fn();
    render(<Chip active={false} label="Alle" onClick={onClick} />);
    await userEvent.click(screen.getByRole('button', { name: 'Alle' }));
    expect(onClick).toHaveBeenCalledOnce();
  });
});

describe('Toggle', () => {
  it('ist ein Schalter mit Zustand', () => {
    render(<Toggle checked label="Dark Mode" onChange={() => {}} />);
    expect(screen.getByRole('switch', { name: 'Dark Mode' })).toBeChecked();
  });

  it('kippt den Wert', async () => {
    const onChange = vi.fn();
    render(<Toggle checked={false} label="Push" onChange={onChange} />);
    await userEvent.click(screen.getByRole('switch', { name: 'Push' }));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('reagiert auf die Leertaste', async () => {
    const onChange = vi.fn();
    render(<Toggle checked label="Push" onChange={onChange} />);
    screen.getByRole('switch', { name: 'Push' }).focus();
    await userEvent.keyboard(' ');
    expect(onChange).toHaveBeenCalledWith(false);
  });
});
```

- [ ] **Step 2: Tests laufen lassen — sie müssen fehlschlagen**

Run: `npx vitest run packages/ui/src/primitives/interactive.test.tsx`
Expected: FAIL — keines der Module existiert

- [ ] **Step 3: `Button` implementieren**

Vier Varianten, alle in der Vorlage vorhanden:

| Variante | Quelle | Kern |
|---|---|---|
| `primary` | Z. 778 | `background:var(--brand-fill)`, `color:#fff`, Radius 14, `padding:14px`, Hover `filter:brightness(1.09)` + `box-shadow:0 10px 22px rgba(124,58,237,.34)` |
| `secondary` | Z. 656 | `border:1px solid var(--line)`, `background:var(--surface)`, `color:var(--ink-700)`, Hover `background:var(--hov-surf)` + `border-color:var(--hov-ring)` |
| `ghost` | Z. 335 | randlos, `background:transparent`, `color:var(--brand)` |
| `danger` | Z. 777 | wie `secondary`, aber `color:var(--danger)`, Hover `background:var(--hov-danger)` + `border-color:rgba(220,38,38,.45)` |

Die `style-hover`-Angaben der Vorlage werden zu echten `:hover`-Regeln im CSS-Modul. Ergänzend `:disabled { opacity:.5; cursor:not-allowed; }` — die Vorlage kennt keinen deaktivierten Zustand, aber Formulare brauchen ihn.

`type` standardmäßig `'button'`.

- [ ] **Step 4: `IconButton` implementieren**

Vorlage Z. 111 und 119–121: 34×34, Radius 11, `border:1px solid var(--line)`, `background:var(--surface)`, `color:var(--ink-700)`, `font-size:15px`, `line-height:1`. Hover wie `secondary`. Das `label` wird `aria-label`; der Inhalt (`‹`, `›`, `✕`) ist `aria-hidden`, damit Screenreader nicht das Zeichen vorlesen.

Die Schließen-Variante der Sheets ist 32×32 (Z. 719) — über `size?: 32 | 34` mit Standard 34.

- [ ] **Step 5: `SegmentSwitch` implementieren**

Hülle: Vorlage Z. 131 — `background:var(--surface-2)`, `border:1px solid var(--line)`, Radius 11, `padding:3px`, `gap:3px`. Knöpfe: `padding:6px 15px`, Radius 9, `font-size:12px`, `font-weight:600`. Zustand aus `pill()` (Z. 1241): aktiv `background:var(--brand-fill)` + `color:#fff`, sonst `background:transparent` + `color:var(--ink-500)`.

Semantik: äußeres `div` mit `role="radiogroup"` und `aria-label={label}`, Knöpfe mit `role="radio"` und `aria-checked`. Tastatur: `ArrowRight`/`ArrowDown` weiter, `ArrowLeft`/`ArrowUp` zurück, jeweils zyklisch. Nur der aktive Knopf ist `tabIndex={0}`, die übrigen `-1` — so springt Tab über die Gruppe hinweg statt in sie hinein.

```tsx
const move = (delta: number) => {
  const current = options.findIndex((o) => o.value === value);
  const next = options[(current + delta + options.length) % options.length];
  if (next) onChange(next.value);
};
```

- [ ] **Step 6: `NavItem` implementieren**

Zwei Layouts aus derselben Zustandsfunktion `navItem()` (Z. 1242): aktiv `background:var(--brand-soft)` + `color:var(--brand)`, sonst transparent + `color:var(--ink-500)`. Hover in beiden: `background:var(--hov-tint)` + `color:var(--brand-600)`.

- `layout="sidebar"` (Z. 83): waagerecht, `gap:11px`, `padding:10px 12px`, Radius 12, `font-size:13px`, Icon 17
- `layout="bottom"` (Z. 684): senkrecht, `gap:3px`, `padding:8px 2px 6px`, Radius 13, `min-height:52px`, `font-size:9.5px`, Icon 19

`aria-current="page"` nur wenn aktiv — mit `exactOptionalPropertyTypes` als Spread schreiben.

- [ ] **Step 7: `Chip` und `PersonChip` implementieren**

`Chip` aus `chip()` (Z. 1244) und Z. 318: `border:1px solid`, Radius 999, `padding:7px 13px`, `font-size:11.5px`. Aktiv: `border-color:var(--brand)`, `background:var(--brand-soft)`, `color:var(--brand)`.

`PersonChip` aus `personChip()` (Z. 1245–1249) und Z. 771–773: `border:1.5px solid`, Radius 13, `padding:11px`, `flex:1`. Aktiv: Rand `var(--{slot})`, Fläche `var(--{slot}-bg)`, Schrift `var(--{slot}-fg)`. Inaktiv: Rand `var(--line)`, Fläche transparent, Schrift `var(--ink-500)`.

Die Slot-Farben über `personTokens(slot)` als Inline-`style` mit Custom Properties setzen — nicht als CSS-Klassen pro Slot, sonst müsste das Modul jede Kombination kennen:

```tsx
const tokens = personTokens(slot);
const style = active
  ? { borderColor: tokens.bar, background: tokens.bg, color: tokens.fg }
  : undefined;
```

`aria-pressed={active}` auf beiden.

- [ ] **Step 8: `Toggle` implementieren**

Vorlage Z. 511–513: Bahn 46×27, Radius 999; Knopf 21×21, `top:3px`, `left` 3 px aus / 22 px ein (aus `knob()`, Z. 1250), `background:#fff`, `box-shadow:0 1px 3px rgba(0,0,0,.3)`, `transition:left .18s ease`. Bahnfarbe aus `track()`: ein `var(--brand-fill)`, aus `var(--track-off)`.

`<button role="switch" aria-checked={checked} aria-label={label}>`. Die Leertaste löst bei `<button>` von sich aus `click` aus — kein eigener Tastaturcode nötig.

- [ ] **Step 9: Tests laufen lassen**

Run: `npx vitest run packages/ui/src/primitives/interactive.test.tsx`
Expected: PASS, 18 Tests

- [ ] **Step 10: Exportieren, prüfen, committen**

Alle sieben in `packages/ui/src/index.ts` exportieren (Komponente + Props-Typ).

Run: `npm run typecheck && npm run lint && npx vitest run packages/ui`
Expected: grün

```bash
git add packages/ui
git commit -m "feat(ui): interaktive Primitive aus den Helferfunktionen der Vorlage

pill() -> SegmentSwitch, navItem() -> NavItem, chip()/personChip() -> Chip
und PersonChip, track()/knob() -> Toggle. Tastaturbedienung und ARIA-Rollen
ergaenzt, die der Prototyp nicht hatte."
```

---

## Task 8: Formular- und Darstellungs-Primitive

**Files:**
- Create in `packages/ui/src/primitives/`: `FieldLabel.tsx`, `SectionLabel.tsx`, `Input.tsx`, `Textarea.tsx`, `Select.tsx`, `Card.tsx`, `ListRow.tsx`, `Avatar.tsx`, `AvatarPair.tsx`, `ProgressBar.tsx`, `SheetHandle.tsx`, je mit `.module.css`
- Create: `packages/ui/src/primitives/display.test.tsx`
- Modify: `packages/ui/src/index.ts`

**Interfaces:**
- Consumes: Task 3, Task 7
- Produces:
  - `function FieldLabel(props: { htmlFor?: string; children: ReactNode })`
  - `function SectionLabel(props: { children: ReactNode })`
  - `function Input(props: { id?: string; value: string; onChange(next: string): void; type?: 'text' | 'date' | 'time' | 'number' | 'email' | 'password'; placeholder?: string; step?: string; width?: string })`
  - `function Textarea(props: { id?: string; value: string; onChange(next: string): void; rows?: number; placeholder?: string })`
  - `function Select<T extends string>(props: { id?: string; value: T; onChange(next: T): void; options: readonly { value: T; label: string }[] })`
  - `function Card(props: { children: ReactNode; padding?: string; tone?: 'surface' | 'brand' | 'warn'; flush?: boolean })`
  - `function ListRow(props: { title: string; hint?: string; children?: ReactNode; onClick?: () => void; last?: boolean })`
  - `function Avatar(props: { initial: string; slot: PersonSlot; size?: number; shape?: 'circle' | 'rounded' })`
  - `function AvatarPair(props: { first: { initial: string; slot: PersonSlot }; second: { initial: string; slot: PersonSlot } })`
  - `function ProgressBar(props: { height?: number; segments: readonly { widthPct: number; color: string }[]; label: string })`
  - `function SheetHandle(): React.JSX.Element`

- [ ] **Step 1: Tests schreiben**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Avatar } from './Avatar.js';
import { AvatarPair } from './AvatarPair.js';
import { Card } from './Card.js';
import { FieldLabel } from './FieldLabel.js';
import { Input } from './Input.js';
import { ListRow } from './ListRow.js';
import { ProgressBar } from './ProgressBar.js';
import { Select } from './Select.js';
import { Textarea } from './Textarea.js';

describe('Input', () => {
  it('meldet jede Eingabe als Klartext', async () => {
    const onChange = vi.fn();
    render(<Input id="titel" value="" onChange={onChange} />);
    await userEvent.type(screen.getByRole('textbox'), 'Yoga');
    expect(onChange).toHaveBeenLastCalledWith('Yoga');
  });

  it('verbindet sich mit einem FieldLabel', () => {
    render(
      <>
        <FieldLabel htmlFor="ort">Ort</FieldLabel>
        <Input id="ort" value="" onChange={() => {}} />
      </>,
    );
    expect(screen.getByLabelText('Ort')).toBeInTheDocument();
  });

  it('übernimmt den Typ', () => {
    render(<Input id="d" value="2026-07-29" onChange={() => {}} type="date" />);
    expect(document.querySelector('input[type="date"]')).not.toBeNull();
  });
});

describe('Textarea', () => {
  it('meldet Eingaben', async () => {
    const onChange = vi.fn();
    render(<Textarea id="n" value="" onChange={onChange} />);
    await userEvent.type(screen.getByRole('textbox'), 'Hi');
    expect(onChange).toHaveBeenLastCalledWith('Hi');
  });
});

describe('Select', () => {
  it('meldet die Auswahl', async () => {
    const onChange = vi.fn();
    render(
      <Select
        id="s"
        value="a"
        onChange={onChange}
        options={[{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }] as const}
      />,
    );
    await userEvent.selectOptions(screen.getByRole('combobox'), 'b');
    expect(onChange).toHaveBeenCalledWith('b');
  });
});

describe('ListRow', () => {
  it('ist ohne onClick kein Knopf', () => {
    render(<ListRow title="Geburtstag" hint="jährlich" />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('Geburtstag')).toBeInTheDocument();
  });

  it('ist mit onClick ein Knopf mit Titel als Name', async () => {
    const onClick = vi.fn();
    render(<ListRow title="Kalender verwalten" onClick={onClick} />);
    await userEvent.click(screen.getByRole('button', { name: /Kalender verwalten/ }));
    expect(onClick).toHaveBeenCalledOnce();
  });
});

describe('Avatar', () => {
  it('nutzt die Slot-Farbe als Token', () => {
    render(<Avatar initial="J" slot="u1" />);
    const style = screen.getByText('J').getAttribute('style') ?? '';
    expect(style).toContain('var(--u1)');
  });
});

describe('AvatarPair', () => {
  it('zeigt beide Initialen', () => {
    render(<AvatarPair first={{ initial: 'J', slot: 'u1' }} second={{ initial: 'L', slot: 'u2' }} />);
    expect(screen.getByText('J')).toBeInTheDocument();
    expect(screen.getByText('L')).toBeInTheDocument();
  });
});

describe('ProgressBar', () => {
  it('meldet den Fortschritt als Messwert', () => {
    render(<ProgressBar label="Budget" segments={[{ widthPct: 70, color: 'var(--brand)' }]} />);
    const bar = screen.getByRole('progressbar', { name: 'Budget' });
    expect(bar).toHaveAttribute('aria-valuenow', '70');
  });

  it('addiert mehrere Segmente für den Messwert', () => {
    render(
      <ProgressBar
        label="Freizeit"
        segments={[
          { widthPct: 20, color: 'var(--u1)' },
          { widthPct: 25, color: 'var(--u2)' },
        ]}
      />,
    );
    expect(screen.getByRole('progressbar', { name: 'Freizeit' })).toHaveAttribute('aria-valuenow', '45');
  });

  it('deckelt den Messwert bei 100', () => {
    render(<ProgressBar label="Wohnen" segments={[{ widthPct: 140, color: 'var(--u1)' }]} />);
    expect(screen.getByRole('progressbar', { name: 'Wohnen' })).toHaveAttribute('aria-valuenow', '100');
  });
});

describe('Card', () => {
  it('rendert seinen Inhalt', () => {
    render(<Card><p>Inhalt</p></Card>);
    expect(screen.getByText('Inhalt')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Tests laufen lassen — sie müssen fehlschlagen**

Run: `npx vitest run packages/ui/src/primitives/display.test.tsx`
Expected: FAIL

- [ ] **Step 3: Die beiden Beschriftungen implementieren**

`FieldLabel` (Vorlage Z. 751): `<label>`, `font-size:11px`, `font-weight:600`, `color:var(--ink-400)`, `text-transform:uppercase`, `letter-spacing:.7px`.
`SectionLabel` (Vorlage Z. 363): `<div>`, gleiche Optik, aber `letter-spacing:.8px`. Der Unterschied ist echt und bleibt.

- [ ] **Step 4: Die drei Eingabefelder implementieren**

Vorlage Z. 752: `width:100%`, `margin-top:6px`, `padding:12px`, Radius 13, `border:1px solid var(--line)`, `background:var(--surface-2)`, `color:var(--ink-900)`, `font-size:13.5px`, `outline:none`. Datums- und Zeitfelder nutzen `13px` (Z. 757).

`outline:none` aus der Vorlage bleibt — der Fokus kommt aus `reset.css` über `:focus-visible` und `box-shadow`.

Die `onChange`-Signatur gibt **den Wert**, nicht das Event: `onChange={(e) => onChange(e.target.value)}` intern. Das hält die Screens frei von DOM-Details.

- [ ] **Step 5: `Card` implementieren**

Drei Tonlagen, alle in der Vorlage:
- `surface` (Z. 361): `border:1px solid var(--line)`, `background:var(--surface)`, Radius 20, `box-shadow:var(--shadow-sm)`
- `brand` (Z. 404): `border:1px solid var(--brand-line)`, `background:var(--brand-soft)`, Radius 20
- `warn` (Z. 636): `border:1px solid var(--warn-line)`, `background:var(--warn-soft)`, Radius 20

`flush` schaltet das Innenpolster ab — für Karten, deren Kinder eigene Zeilen mit Trennlinien sind (Z. 426, `overflow:hidden` statt `padding`).

- [ ] **Step 6: `ListRow` implementieren**

Vorlage Z. 499–505 (statisch) und Z. 553–559 (klickbar): `display:flex`, `align-items:center`, `gap:12px`, `padding:12px 15px`, `border-bottom:1px solid var(--line-soft)` außer bei `last`. Titel `font-size:13px`/`500`/`var(--ink-900)`, Hinweis `font-size:11px`/`var(--ink-400)`/`margin-top:1px`.

Mit `onClick` wird die Zeile ein `<button>` mit Hover `background:var(--hov-tint)` und einem `›` (`font-size:17px`, `color:var(--ink-400)`) am Ende. Ohne `onClick` ein `<div>` — ein Knopf ohne Handler wäre für Tastaturnutzer eine Falle.

- [ ] **Step 7: `Avatar` und `AvatarPair` implementieren**

`Avatar` (Vorlage Z. 74): Standard 30×30, `border-radius:50%`, Slot-Farbe als Fläche, `color:#fff`, `font-size:11.5px`, `font-weight:600`, zentriert. `shape="rounded"` ergibt Radius 10–18 je Größe (Z. 285: 30px/Radius 10; Z. 446: 52px/Radius 18) — Regel: `Math.round(size / 3)`.

`AvatarPair` (Z. 73–76): zwei `Avatar` in einem `flex`, der zweite mit `margin-left:-9px` und `border:2px solid var(--surface)`.

- [ ] **Step 8: `ProgressBar` und `SheetHandle` implementieren**

`ProgressBar`: Bahn `border-radius:999px`, `background:var(--line-soft)`, `overflow:hidden`; Höhe über `height`-Prop, Standard 7 (Vorlage nutzt 6 in Todo-Karten Z. 291, 7 bei Kategorien Z. 392, 9 im Budget Z. 370). Segmente als `flex`-Kinder mit `width` in Prozent. `role="progressbar"`, `aria-label`, `aria-valuemin={0}`, `aria-valuemax={100}`, `aria-valuenow` = Summe der Segmentbreiten, auf 0–100 geklemmt und gerundet.

`SheetHandle` (Z. 713): `width:38px`, `height:4px`, `border-radius:999px`, `background:var(--line)`, `margin:0 auto 12px`. Dekorativ, also `aria-hidden`.

- [ ] **Step 9: Tests laufen lassen**

Run: `npx vitest run packages/ui/src/primitives/display.test.tsx`
Expected: PASS, 13 Tests

- [ ] **Step 10: Exportieren und committen**

```bash
npm run typecheck && npm run lint && npx vitest run packages/ui
git add packages/ui
git commit -m "feat(ui): Formular- und Darstellungs-Primitive"
```

---

## Task 9: Rückmeldungs-Primitive

Toast, ConfirmDialog, EmptyState und Skeleton kommen **nicht** aus der Vorlage — sie existieren in Ralia_Opus (`state.js`: `showToast`, `showConfirmationModal`) und werden ab SP1 überall gebraucht. Sie werden aus der Design-Sprache extrapoliert.

**Files:**
- Create: `packages/ui/src/primitives/Toast.tsx` + `.module.css`
- Create: `packages/ui/src/primitives/ToastProvider.tsx`
- Create: `packages/ui/src/primitives/useToast.ts`
- Create: `packages/ui/src/primitives/EmptyState.tsx` + `.module.css`
- Create: `packages/ui/src/primitives/Skeleton.tsx` + `.module.css`
- Create: `packages/ui/src/primitives/feedback.test.tsx`
- Modify: `packages/ui/src/index.ts`

`ConfirmDialog` folgt in Task 10, weil es auf `Modal` aufbaut.

**Interfaces:**
- Consumes: Task 3, Task 7 (`Button`)
- Produces:
  - `type ToastTone = 'info' | 'ok' | 'danger'`
  - `function ToastProvider(props: { children: ReactNode })`
  - `function useToast(): { show(message: string, tone?: ToastTone): void }`
  - `function EmptyState(props: { message: string; action?: { label: string; onClick(): void } })`
  - `function Skeleton(props: { height?: number; width?: string; radius?: number })`
  - `const TOAST_DURATION_MS = 4000`

- [ ] **Step 1: Tests schreiben**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EmptyState } from './EmptyState.js';
import { Skeleton } from './Skeleton.js';
import { TOAST_DURATION_MS, ToastProvider } from './ToastProvider.js';
import { useToast } from './useToast.js';

function Trigger() {
  const { show } = useToast();
  return <button onClick={() => show('Gespeichert', 'ok')}>melden</button>;
}

beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
afterEach(() => vi.useRealTimers());

describe('Toast', () => {
  it('zeigt eine Meldung und blendet sie nach der Standzeit aus', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<ToastProvider><Trigger /></ToastProvider>);
    await user.click(screen.getByRole('button', { name: 'melden' }));
    expect(screen.getByRole('status')).toHaveTextContent('Gespeichert');
    vi.advanceTimersByTime(TOAST_DURATION_MS + 50);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('lässt sich vorzeitig schließen', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<ToastProvider><Trigger /></ToastProvider>);
    await user.click(screen.getByRole('button', { name: 'melden' }));
    await user.click(screen.getByRole('button', { name: 'Meldung schließen' }));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('wirft ohne Provider mit klarer Meldung', () => {
    expect(() => render(<Trigger />)).toThrow(/ToastProvider/);
  });
});

describe('EmptyState', () => {
  it('zeigt die Nachricht', () => {
    render(<EmptyState message="Keine Termine an diesem Tag" />);
    expect(screen.getByText('Keine Termine an diesem Tag')).toBeInTheDocument();
  });

  it('bietet auf Wunsch eine Handlung an', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<EmptyState message="Nichts hier" action={{ label: 'Anlegen', onClick }} />);
    await user.click(screen.getByRole('button', { name: 'Anlegen' }));
    expect(onClick).toHaveBeenCalledOnce();
  });
});

describe('Skeleton', () => {
  it('ist für Screenreader unsichtbar', () => {
    const { container } = render(<Skeleton />);
    expect(container.firstElementChild?.getAttribute('aria-hidden')).toBe('true');
  });
});
```

- [ ] **Step 2: Tests laufen lassen — sie müssen fehlschlagen**

Run: `npx vitest run packages/ui/src/primitives/feedback.test.tsx`
Expected: FAIL

- [ ] **Step 3: `Toast` und `ToastProvider` implementieren**

Optik aus der Sprache abgeleitet: Karte `background:var(--surface)`, `border:1px solid var(--line)`, Radius 14, `box-shadow:var(--shadow-lg)`, `padding:12px 14px`, `font-size:12.5px`. Position `fixed`, unten zentriert, über dem FAB (`bottom: calc(74px + env(safe-area-inset-bottom) + 12px)` mobil, `20px` ab Sidebar-Breakpoint). Einblenden mit `animation: ral-up .22s cubic-bezier(.2,.8,.2,1)` — dieselbe Kurve wie die Sheets.

Tonlagen über die vorhandenen Tokens: `info` → `--brand-soft`/`--brand-line`/`--brand-600`; `ok` → `--ok` als Schriftfarbe auf `--surface`; `danger` → `--hov-danger`/`rgba(220,38,38,.45)`/`--danger`.

`role="status"` mit `aria-live="polite"` — nicht `alert`, sonst unterbricht jede Speicherbestätigung den Screenreader.

Genau ein Toast gleichzeitig: ein neuer ersetzt den alten und setzt die Standzeit zurück. Der Timer muss beim Ersetzen und beim Unmount aufgeräumt werden.

- [ ] **Step 4: `useToast` implementieren**

Kontext-Hook mit der gleichen Fehlermeldung-Konvention wie `useTheme`:

```ts
if (!value) throw new Error('useToast braucht einen ToastProvider im Baum');
```

- [ ] **Step 5: `EmptyState` implementieren**

Vorlage Z. 733 und Z. 333: `padding:26px 12px`, `text-align:center`, `font-size:12.5px`, `color:var(--ink-400)`. Optionale Handlung als `Button variant="ghost"` darunter.

- [ ] **Step 6: `Skeleton` implementieren**

`background:var(--line-soft)`, Radius aus Prop (Standard 12), `height` Standard 16, `width` Standard `100%`. Pulsieren über eine neue Keyframe in `reset.css`:

```css
@keyframes ral-pulse { 0%,100% { opacity: 1 } 50% { opacity: .55 } }
```

In `@media (prefers-reduced-motion: reduce)` die Animation abschalten.

- [ ] **Step 7: Tests laufen lassen**

Run: `npx vitest run packages/ui/src/primitives/feedback.test.tsx`
Expected: PASS, 6 Tests

- [ ] **Step 8: Exportieren und committen**

```bash
npm run typecheck && npm run lint && npx vitest run packages/ui
git add packages/ui
git commit -m "feat(ui): Toast, EmptyState und Skeleton aus der Design-Sprache abgeleitet"
```

---

## Task 10: Overlays — BottomSheet, Modal, ConfirmDialog

Der anspruchsvollste Teil des Design-Systems. Die Vorlage zeigt acht Sheets mit identischer Hülle, aber ohne Fokusverwaltung: dort ist ein Sheet ein `div` über dem Inhalt, und der Fokus bleibt hinter dem Backdrop erreichbar. Das wird hier korrigiert.

**Files:**
- Create: `packages/ui/src/overlays/use-focus-trap.ts`
- Create: `packages/ui/src/overlays/use-scroll-lock.ts`
- Create: `packages/ui/src/overlays/BottomSheet.tsx` + `.module.css`
- Create: `packages/ui/src/overlays/Modal.tsx` + `.module.css`
- Create: `packages/ui/src/overlays/ConfirmDialog.tsx`
- Create: `packages/ui/src/overlays/BottomSheet.test.tsx`
- Create: `packages/ui/src/overlays/ConfirmDialog.test.tsx`
- Modify: `packages/ui/src/index.ts`

**Interfaces:**
- Consumes: Task 7 (`Button`, `IconButton`), Task 8 (`SheetHandle`)
- Produces:
  - `function BottomSheet(props: { open: boolean; onClose(): void; title: string; kicker?: string; maxHeight?: string; children: ReactNode })` — `maxHeight` Standard `'90%'`
  - `function Modal(props: { open: boolean; onClose(): void; title: string; children: ReactNode })`
  - `function ConfirmDialog(props: { open: boolean; title: string; message: string; confirmLabel: string; cancelLabel: string; tone?: 'default' | 'danger'; onConfirm(): void; onCancel(): void })`
  - `function useFocusTrap(active: boolean): React.RefObject<HTMLDivElement | null>`
  - `function useScrollLock(active: boolean): void`

- [ ] **Step 1: Tests für `BottomSheet` schreiben**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { BottomSheet } from './BottomSheet.js';

function open(onClose = vi.fn()) {
  render(
    <BottomSheet open onClose={onClose} title="Neuer Termin" kicker="Heute">
      <input aria-label="Titel" />
      <button>Speichern</button>
    </BottomSheet>,
  );
  return onClose;
}

describe('BottomSheet', () => {
  it('rendert geschlossen nichts', () => {
    render(<BottomSheet open={false} onClose={() => {}} title="X"><p>Inhalt</p></BottomSheet>);
    expect(screen.queryByText('Inhalt')).toBeNull();
  });

  it('ist ein modaler Dialog mit Titel', () => {
    open();
    const dialog = screen.getByRole('dialog', { name: 'Neuer Termin' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('zeigt den Kicker', () => {
    open();
    expect(screen.getByText('Heute')).toBeInTheDocument();
  });

  it('schließt bei Escape', async () => {
    const onClose = open();
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('schließt bei Klick auf den Backdrop', async () => {
    const onClose = open();
    await userEvent.click(screen.getByTestId('sheet-backdrop'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('schließt nicht bei Klick in den Inhalt', async () => {
    const onClose = open();
    await userEvent.click(screen.getByLabelText('Titel'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('schließt über den Schließen-Knopf', async () => {
    const onClose = open();
    await userEvent.click(screen.getByRole('button', { name: 'Schließen' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('setzt den Fokus beim Öffnen in das Sheet', () => {
    open();
    const dialog = screen.getByRole('dialog');
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('hält Tab im Sheet gefangen', async () => {
    open();
    const dialog = screen.getByRole('dialog');
    // Viermal Tab bei drei fokussierbaren Elementen: der Fokus muss im Sheet bleiben.
    for (let i = 0; i < 4; i += 1) await userEvent.tab();
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('hält Shift+Tab ebenfalls im Sheet', async () => {
    open();
    const dialog = screen.getByRole('dialog');
    for (let i = 0; i < 4; i += 1) await userEvent.tab({ shift: true });
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('sperrt und entsperrt das Scrollen des Hintergrunds', () => {
    const { unmount } = render(
      <BottomSheet open onClose={() => {}} title="X"><p>Inhalt</p></BottomSheet>,
    );
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).toBe('');
  });

  it('gibt den Fokus beim Schließen an das auslösende Element zurück', async () => {
    function Host() {
      const [open, setOpen] = React.useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>öffnen</button>
          <BottomSheet open={open} onClose={() => setOpen(false)} title="X">
            <button>drin</button>
          </BottomSheet>
        </>
      );
    }
    render(<Host />);
    const opener = screen.getByRole('button', { name: 'öffnen' });
    await userEvent.click(opener);
    await userEvent.keyboard('{Escape}');
    expect(opener).toHaveFocus();
  });
});
```

Der letzte Test braucht `import React from 'react';` am Dateianfang.

- [ ] **Step 2: Tests laufen lassen — sie müssen fehlschlagen**

Run: `npx vitest run packages/ui/src/overlays/BottomSheet.test.tsx`
Expected: FAIL

- [ ] **Step 3: `use-scroll-lock.ts` implementieren**

```ts
import { useEffect } from 'react';

/**
 * Sperrt das Scrollen des Dokuments, solange ein Overlay offen ist.
 *
 * Merkt sich den vorherigen Wert statt blind zurückzusetzen: bei zwei
 * gestapelten Sheets darf das innere beim Schließen nicht das äußere entsperren.
 */
export function useScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [active]);
}
```

- [ ] **Step 4: `use-focus-trap.ts` implementieren**

```ts
import { useEffect, useRef } from 'react';

const FOCUSABLE = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled])',
  'select:not([disabled])', 'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function focusable(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.offsetParent !== null || el === document.activeElement,
  );
}

/**
 * Hält den Tastaturfokus in einem Overlay und gibt ihn beim Schließen zurück.
 *
 * Die Vorlage hat das nicht: dort bleibt alles hinter dem Backdrop per Tab
 * erreichbar. Für einen modalen Dialog ist das ein Fehler.
 */
export function useFocusTrap(active: boolean): React.RefObject<HTMLDivElement | null> {
  const ref = useRef<HTMLDivElement | null>(null);
  const restoreTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;
    const container = ref.current;
    if (!container) return;

    restoreTo.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const first = focusable(container)[0];
    (first ?? container).focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const items = focusable(container);
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const firstItem = items[0]!;
      const lastItem = items[items.length - 1]!;
      const activeEl = document.activeElement;

      if (event.shiftKey && (activeEl === firstItem || activeEl === container)) {
        event.preventDefault();
        lastItem.focus();
      } else if (!event.shiftKey && activeEl === lastItem) {
        event.preventDefault();
        firstItem.focus();
      }
    };

    container.addEventListener('keydown', onKeyDown);
    return () => {
      container.removeEventListener('keydown', onKeyDown);
      restoreTo.current?.focus();
    };
  }, [active]);

  return ref;
}
```

Der Container braucht `tabIndex={-1}`, damit `container.focus()` greift, wenn er kein fokussierbares Kind hat.

- [ ] **Step 5: `BottomSheet` implementieren**

Hülle aus Vorlage Z. 712–713, bei allen acht Sheets identisch:
- Backdrop: `position:absolute; inset:0; background:rgba(15,23,42,.42); z-index:50; display:flex; align-items:flex-end; animation:ral-fade .16s ease`
- Panel: `width:100%; background:var(--surface); border-radius:24px 24px 0 0; padding:16px 16px 20px; overflow-y:auto; animation:ral-up .22s cubic-bezier(.2,.8,.2,1)`
- Kopf (Z. 714–720): `SheetHandle`, dann Kicker (`font-size:11px`, `letter-spacing:.9px`, uppercase, `--ink-400`) über Titel (`font-size:19px`, `600`, `--ink-900`) bzw. bei Formular-Sheets nur ein Titel mit `font-size:17px` (Z. 746), plus `IconButton size={32}` mit `✕`

Zwei Abweichungen von der Vorlage:
1. `position:fixed` statt `absolute`, weil es keine Telefon-Attrappe als Bezugsrahmen mehr gibt. Unteres Polster `calc(20px + env(safe-area-inset-bottom))`.
2. Bei Sidebar-Breite wird das Panel auf `max-width:520px` zentriert, statt über die ganze Fensterbreite zu laufen — sonst wäre ein 1400 px breites Sheet die Folge.

Weiteres: `role="dialog"`, `aria-modal="true"`, `aria-labelledby` auf die Titel-ID (über `useId`), `tabIndex={-1}`; Escape über einen `keydown`-Listener auf `document`; Backdrop-Klick nur wenn `event.target === event.currentTarget`; `data-testid="sheet-backdrop"` auf dem Backdrop. `maxHeight` als Prop, weil die Vorlage je Sheet andere Werte nutzt: `day` 78 %, `new` 88 %, alle übrigen 90 %; `item` hat keine Begrenzung (`'none'`).

- [ ] **Step 6: Tests laufen lassen**

Run: `npx vitest run packages/ui/src/overlays/BottomSheet.test.tsx`
Expected: PASS, 12 Tests

- [ ] **Step 7: `Modal` implementieren**

Gleiche Mechanik wie `BottomSheet` (Fokus-Falle, Scroll-Lock, Escape, Backdrop), aber `align-items:center`, `justify-content:center`, Panel `border-radius:24px`, `max-width:420px`, `margin:16px`, `animation:ral-up`. Wird für `ConfirmDialog` und ab SP1 für Upgrade- und Scope-Dialoge gebraucht.

Um Doppelung zu vermeiden: die gemeinsame Logik in eine interne `OverlayFrame`-Komponente ziehen, die `placement: 'bottom' | 'center'` bekommt; `BottomSheet` und `Modal` sind dünne Hüllen darum. Das ist kein Vorgriff, sondern die Konsequenz daraus, dass beide dieselben acht Verhaltensregeln brauchen.

- [ ] **Step 8: Test für `ConfirmDialog` schreiben**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmDialog } from './ConfirmDialog.js';

const base = {
  open: true,
  title: 'Termin löschen?',
  message: 'Das lässt sich nicht rückgängig machen.',
  confirmLabel: 'Löschen',
  cancelLabel: 'Abbrechen',
} as const;

describe('ConfirmDialog', () => {
  it('meldet die Zustimmung', async () => {
    const onConfirm = vi.fn();
    render(<ConfirmDialog {...base} tone="danger" onConfirm={onConfirm} onCancel={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: 'Löschen' }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('meldet den Abbruch', async () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog {...base} onConfirm={() => {}} onCancel={onCancel} />);
    await userEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('behandelt Escape als Abbruch, nicht als Zustimmung', async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<ConfirmDialog {...base} onConfirm={onConfirm} onCancel={onCancel} />);
    await userEvent.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('legt den Startfokus auf Abbrechen, nicht auf die zerstörende Handlung', () => {
    render(<ConfirmDialog {...base} tone="danger" onConfirm={() => {}} onCancel={() => {}} />);
    expect(screen.getByRole('button', { name: 'Abbrechen' })).toHaveFocus();
  });

  it('nennt Titel und Meldung', () => {
    render(<ConfirmDialog {...base} onConfirm={() => {}} onCancel={() => {}} />);
    expect(screen.getByRole('dialog', { name: 'Termin löschen?' })).toBeInTheDocument();
    expect(screen.getByText('Das lässt sich nicht rückgängig machen.')).toBeInTheDocument();
  });
});
```

- [ ] **Step 9: `ConfirmDialog` implementieren**

`Modal` als Hülle, Meldung mit `font-size:13px`/`--ink-700`/`line-height:1.5`, darunter zwei Knöpfe im `flex` mit `gap:9px` (wie Vorlage Z. 654–657): Abbrechen als `secondary`, Zustimmen als `primary` bzw. bei `tone="danger"` als `danger`.

Damit der Startfokus auf Abbrechen liegt, muss der Abbrechen-Knopf im DOM **vor** dem Bestätigen-Knopf stehen — die Fokus-Falle nimmt das erste fokussierbare Element. Der Schließen-Knopf des `Modal` wird für `ConfirmDialog` unterdrückt (`dismissible={false}`), sonst wäre er das erste Element.

- [ ] **Step 10: Tests laufen lassen und committen**

Run: `npx vitest run packages/ui/src/overlays`
Expected: PASS, 17 Tests

```bash
npm run typecheck && npm run lint && npx vitest run packages/ui
git add packages/ui
git commit -m "feat(ui): BottomSheet, Modal und ConfirmDialog mit Fokus-Falle

Die Vorlage laesst den Fokus hinter dem Backdrop erreichbar. Hier wird er
gefangen, beim Schliessen zurueckgegeben, Escape schliesst und der Hintergrund
scrollt nicht mit. Das Panel ist ab Sidebar-Breite zentriert statt fensterbreit."
```

---

## Task 11: AppShell

**Files:**
- Create: `packages/ui/src/shell/nav-items.ts`
- Create: `packages/ui/src/shell/AppLayout.tsx` + `.module.css`
- Create: `packages/ui/src/shell/Sidebar.tsx` + `.module.css`
- Create: `packages/ui/src/shell/BottomNav.tsx` + `.module.css`
- Create: `packages/ui/src/shell/AppHeader.tsx` + `.module.css`
- Create: `packages/ui/src/shell/Fab.tsx` + `.module.css`
- Create: `packages/ui/src/shell/shell.test.tsx`
- Modify: `packages/ui/src/index.ts`

**Interfaces:**
- Consumes: Task 6 (`Icon`), Task 7 (`NavItem`, `IconButton`), Task 8 (`AvatarPair`, `Card`, `SectionLabel`)
- Produces:
  - `type TabId = 'kalender' | 'planer' | 'todos' | 'geld' | 'profil'`
  - `const TABS: readonly { id: TabId; icon: IconName; path: string; sidebarLabelKey: string; bottomLabelKey: string }[]`
  - `function AppLayout(props: { activeTab: TabId; onNavigate(tab: TabId): void; sidebarSummary?: ReactNode; pairing?: { first: …; second: …; title: string; subtitle: string }; children: ReactNode })`
  - `function AppHeader(props: { kicker: string; title: string; onBack?: () => void; range?: { onPrev(): void; onToday(): void; onNext(): void; prevLabel: string; todayLabel: string; nextLabel: string }; children?: ReactNode })`
  - `function Fab(props: { label: string; onClick(): void })`
  - `const SIDEBAR_BREAKPOINT_PX = 1024`

- [ ] **Step 1: Tests schreiben**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AppHeader } from './AppHeader.js';
import { AppLayout } from './AppLayout.js';
import { Fab } from './Fab.js';
import { TABS } from './nav-items.js';

describe('TABS', () => {
  it('hat genau fünf Einträge in der Reihenfolge der Vorlage', () => {
    expect(TABS.map((t) => t.id)).toEqual(['kalender', 'planer', 'todos', 'geld', 'profil']);
  });
});

describe('AppLayout', () => {
  it('rendert Bottom-Nav und Sidebar-Navigation je einmal', () => {
    render(
      <AppLayout activeTab="kalender" onNavigate={() => {}}>
        <p>Inhalt</p>
      </AppLayout>,
    );
    // Beide Navigationen liegen im DOM; CSS entscheidet, welche sichtbar ist.
    expect(screen.getByRole('navigation', { name: 'Hauptnavigation' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Bereiche' })).toBeInTheDocument();
    expect(screen.getByText('Inhalt')).toBeInTheDocument();
  });

  it('meldet einen Tabwechsel', async () => {
    const onNavigate = vi.fn();
    render(<AppLayout activeTab="kalender" onNavigate={onNavigate}><p>x</p></AppLayout>);
    const [geld] = screen.getAllByRole('button', { name: 'Geld' });
    await userEvent.click(geld!);
    expect(onNavigate).toHaveBeenCalledWith('geld');
  });

  it('markiert den aktiven Tab in beiden Navigationen', () => {
    render(<AppLayout activeTab="todos" onNavigate={() => {}}><p>x</p></AppLayout>);
    const current = screen.getAllByRole('button', { name: 'Todos' })
      .filter((b) => b.getAttribute('aria-current') === 'page');
    expect(current).toHaveLength(2);
  });
});

describe('AppHeader', () => {
  it('zeigt Kicker und Titel', () => {
    render(<AppHeader kicker="Gemeinsamer Kalender" title="Juli 2026" />);
    expect(screen.getByText('Gemeinsamer Kalender')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Juli 2026' })).toBeInTheDocument();
  });

  it('zeigt den Zurück-Knopf nur mit onBack', () => {
    const { rerender } = render(<AppHeader kicker="k" title="t" />);
    expect(screen.queryByRole('button', { name: 'Zurück' })).toBeNull();
    rerender(<AppHeader kicker="k" title="t" onBack={() => {}} />);
    expect(screen.getByRole('button', { name: 'Zurück' })).toBeInTheDocument();
  });

  it('bedient die Bereichsnavigation', async () => {
    const range = {
      onPrev: vi.fn(), onToday: vi.fn(), onNext: vi.fn(),
      prevLabel: 'Vorheriger Monat', todayLabel: 'Heute', nextLabel: 'Nächster Monat',
    };
    render(<AppHeader kicker="k" title="t" range={range} />);
    await userEvent.click(screen.getByRole('button', { name: 'Vorheriger Monat' }));
    await userEvent.click(screen.getByRole('button', { name: 'Heute' }));
    await userEvent.click(screen.getByRole('button', { name: 'Nächster Monat' }));
    expect(range.onPrev).toHaveBeenCalledOnce();
    expect(range.onToday).toHaveBeenCalledOnce();
    expect(range.onNext).toHaveBeenCalledOnce();
  });
});

describe('Fab', () => {
  it('trägt seinen Namen und meldet Klicks', async () => {
    const onClick = vi.fn();
    render(<Fab label="Termin hinzufügen" onClick={onClick} />);
    await userEvent.click(screen.getByRole('button', { name: 'Termin hinzufügen' }));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Tests laufen lassen — sie müssen fehlschlagen**

Run: `npx vitest run packages/ui/src/shell/shell.test.tsx`
Expected: FAIL

- [ ] **Step 3: `nav-items.ts` schreiben**

Die Vorlage nutzt in Sidebar und Bottom-Nav **unterschiedliche Beschriftungen** für dieselben Ziele (Z. 86/690: „Wochenplaner" gegen „Planer"; Z. 95/702: „Einstellungen" gegen „Profil"). Das bleibt so — kurze Beschriftungen sind in einer 5-spaltigen Bottom-Nav notwendig.

```ts
import type { IconName } from '../icons/Icon.js';

export type TabId = 'kalender' | 'planer' | 'todos' | 'geld' | 'profil';

export interface TabDef {
  id: TabId;
  icon: IconName;
  path: string;
  /** i18n-Schlüssel für die Sidebar (mehr Platz). */
  sidebarLabelKey: string;
  /** i18n-Schlüssel für die Bottom-Nav (kurz). */
  bottomLabelKey: string;
}

export const TABS: readonly TabDef[] = [
  { id: 'kalender', icon: 'calendar', path: '/kalender', sidebarLabelKey: 'navCalendar', bottomLabelKey: 'navCalendarShort' },
  { id: 'planer', icon: 'planner', path: '/planer', sidebarLabelKey: 'navPlanner', bottomLabelKey: 'navPlannerShort' },
  { id: 'todos', icon: 'todos', path: '/todos', sidebarLabelKey: 'navTodos', bottomLabelKey: 'navTodosShort' },
  { id: 'geld', icon: 'money', path: '/geld', sidebarLabelKey: 'navMoney', bottomLabelKey: 'navMoneyShort' },
  { id: 'profil', icon: 'settings', path: '/profil', sidebarLabelKey: 'navSettings', bottomLabelKey: 'navProfileShort' },
];

export const SIDEBAR_BREAKPOINT_PX = 1024;
```

Diese zehn Schlüssel existieren in `i18n.js` nicht — Task 13 legt sie als Zusatzkatalog an.

Damit die Tests ohne i18n laufen, nimmt `AppLayout` eine `labels`-Abbildung als Prop mit Standardwerten in Deutsch. Signatur: `labels?: Partial<Record<TabId, { sidebar: string; bottom: string }>>`.

- [ ] **Step 4: `AppLayout` implementieren**

Struktur (Vorlage Z. 68 und Z. 106, ohne die Prototyp-Hülle):

```
<div class=shell>                    display:flex; gap:26px; justify-content:center
  <Sidebar/>                         nur ab SIDEBAR_BREAKPOINT_PX sichtbar
  <main class=column>                flex:1; min-width:0
    {children}
  </main>
  <BottomNav/>                       nur unterhalb des Breakpoints sichtbar
</div>
```

Sichtbarkeit über `@media (min-width: 1024px)` im CSS-Modul, nicht über JS — dann gibt es kein Umspringen beim ersten Frame. Beide Navigationen stehen im DOM; die verborgene bekommt `display:none`, was sie auch für Screenreader und Tab entfernt.

Maße: `shell` `max-width:1180px`, `padding:20px 18px 0`; die Inhaltsspalte `max-width:900px`. Unterhalb des Breakpoints keine `max-width`, kein Polster, kein Rahmen — randlos, wie im Spec festgelegt. Die Bottom-Nav wird `position:sticky; bottom:0` mit `padding-bottom: calc(9px + env(safe-area-inset-bottom))`.

- [ ] **Step 5: `Sidebar` implementieren**

Vorlage Z. 71–103: `width:236px`, `flex:none`, `background:var(--surface)`, `border:1px solid var(--line)`, Radius 22, `padding:18px 14px`, `box-shadow:var(--shadow-sm)`, `position:sticky`, `top:80px` — hier `top:20px`, weil die Prototyp-Kopfleiste entfällt.

Inhalt: `AvatarPair` mit Namen und „verbunden" (Z. 72–81), die fünf `NavItem layout="sidebar"` in `nav` mit `aria-label="Bereiche"`, darunter das „Diese Woche"-Panel als `Card tone="brand"` (Z. 99–102). Panelinhalt kommt über `sidebarSummary` von außen — `packages/ui` kennt keine Termindaten.

- [ ] **Step 6: `BottomNav` implementieren**

Vorlage Z. 683–704: `display:flex`, `gap:2px`, `padding:7px 8px 9px`, `border-top:1px solid var(--line)`, `background:var(--surface)`. Fünf `NavItem layout="bottom"`, jedes `flex:1`. `nav` mit `aria-label="Hauptnavigation"`.

- [ ] **Step 7: `AppHeader` implementieren**

Vorlage Z. 108–142: `padding:18px 18px 14px`, `border-bottom:1px solid var(--line-soft)`, `background:var(--surface)`. Kicker `font-size:11px`/`600`/`letter-spacing:1.1px`/uppercase/`--ink-400`; Titel als `<h1>` mit `font-size:21px`/`600`/`letter-spacing:-.3px`/`--ink-900`.

Der Zurück-Knopf (Z. 111) und die Bereichsnavigation (Z. 119–121) als `IconButton`. Der „Heute"-Knopf ist kein `IconButton`, sondern breiter: `height:34px`, `padding:0 12px`, `font-size:11.5px` — als eigene Variante im Modul.

`children` nimmt die Zeile unter dem Titel auf (Segment-Switch plus Legende, Z. 129–141). Der Header entscheidet nicht über deren Inhalt.

Den `+`-Knopf im Header **nicht** einbauen: die Vorlage setzt `showHeaderAdd: false` (Z. 1527) — hinzugefügt wird über den FAB.

- [ ] **Step 8: `Fab` implementieren**

Vorlage Z. 708: `position:fixed`, `right:16px`, 54×54, Radius 19, `background:var(--brand-fill)`, `color:#fff`, `font-size:25px`, `box-shadow:0 10px 24px rgba(124,58,237,.42)`, Hover `transform:translateY(-2px) scale(1.04)` mit stärkerem Schatten.

`bottom`: mobil `calc(74px + env(safe-area-inset-bottom))`, ab Breakpoint `20px` (Vorlage: 74 px bzw. 20 px, Z. 1528). Das `+` ist `aria-hidden`, der Name kommt aus `aria-label={label}`.

- [ ] **Step 9: Tests laufen lassen**

Run: `npx vitest run packages/ui/src/shell/shell.test.tsx`
Expected: PASS, 8 Tests

- [ ] **Step 10: Exportieren und committen**

```bash
npm run typecheck && npm run lint && npx vitest run packages/ui
git add packages/ui
git commit -m "feat(ui): AppShell mit Sidebar ab 1024px und mobiler Bottom-Nav

Ohne die Telefon-Attrappe der Vorlage: mobil randlos mit Safe-Area-Insets,
Sidebar und Inhaltsspalte behalten ihre Maximalbreiten aus dem Entwurf."
```

---

## Task 12: `apps/app` bootet

Ab hier gibt es zum ersten Mal etwas zu sehen. Ziel dieser Task: `npm run dev` startet, die fünf Tabs sind navigierbar, jeder Tab zeigt einen Platzhalter im richtigen Rahmen.

**Files:**
- Create: `apps/app/index.html`
- Create: `apps/app/vite.config.ts`
- Create: `apps/app/src/main.tsx`
- Create: `apps/app/src/App.tsx`
- Create: `apps/app/src/routes/router.tsx`
- Create: `apps/app/src/routes/AppFrame.tsx`
- Create: `apps/app/src/routes/AppFrame.test.tsx`
- Modify: `package.json` — `build` muss `tsc` nicht doppelt laufen lassen

**Interfaces:**
- Consumes: Task 4 (`ThemeProvider`, `themeBootScript`), Task 11 (`AppLayout`, `AppHeader`, `Fab`, `TABS`)
- Produces:
  - `function AppFrame(): React.JSX.Element` — verbindet `AppLayout` mit dem Router: leitet `useLocation` auf `activeTab` und `onNavigate` auf `navigate`
  - `const router` mit den Pfaden `/kalender`, `/planer`, `/todos`, `/todos/:listId`, `/geld`, `/profil`, `/profil/sync`
  - `apps/app/dist` als Build-Ausgabe

- [ ] **Step 1: Test für `AppFrame` schreiben**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { routes } from './router.js';

function renderAt(path: string) {
  return render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />);
}

describe('Routing', () => {
  it('leitet / auf /kalender', async () => {
    renderAt('/');
    // Die Platzhalter dieser Task rendern nur ihren Namen; einen <h1> gibt es
    // erst ab Task 16, wenn die Screens den AppHeader mitbringen.
    expect(await screen.findByText('Kalender', { selector: 'p' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Kalender' })[0])
      .toHaveAttribute('aria-current', 'page');
  });

  it.each([
    ['/planer', 'Planer'],
    ['/todos', 'Todos'],
    ['/geld', 'Geld'],
    ['/profil', 'Profil'],
  ])('markiert bei %s den Tab %s', async (path, label) => {
    renderAt(path);
    const active = (await screen.findAllByRole('button', { name: label }))
      .filter((b) => b.getAttribute('aria-current') === 'page');
    expect(active.length).toBeGreaterThan(0);
  });

  it('navigiert per Klick auf einen Tab', async () => {
    renderAt('/kalender');
    const [geld] = await screen.findAllByRole('button', { name: 'Geld' });
    await userEvent.click(geld!);
    const active = screen.getAllByRole('button', { name: 'Geld' })
      .filter((b) => b.getAttribute('aria-current') === 'page');
    expect(active.length).toBeGreaterThan(0);
  });

  it('hält /profil/sync auf dem Profil-Tab', async () => {
    renderAt('/profil/sync');
    const active = (await screen.findAllByRole('button', { name: 'Profil' }))
      .filter((b) => b.getAttribute('aria-current') === 'page');
    expect(active.length).toBeGreaterThan(0);
  });

  it('zeigt bei unbekanntem Pfad den Kalender', async () => {
    renderAt('/gibtsnicht');
    expect(screen.getAllByRole('button', { name: 'Kalender' })[0])
      .toHaveAttribute('aria-current', 'page');
  });
});
```

- [ ] **Step 2: Test laufen lassen — er muss fehlschlagen**

Run: `npx vitest run apps/app/src/routes/AppFrame.test.tsx`
Expected: FAIL

- [ ] **Step 3: `vite.config.ts` schreiben**

```ts
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const resolvePath = (relative: string) => fileURLToPath(new URL(relative, import.meta.url));

export default defineConfig({
  // Web serviert die App unter /app/*; / gehört der Marketing-Site (SP8).
  // SP7 stellt für Capacitor auf './' um.
  base: '/app/',
  plugins: [react()],
  resolve: {
    alias: {
      '@ralia/core': resolvePath('../../packages/core/src/index.ts'),
      '@ralia/data': resolvePath('../../packages/data/src/index.ts'),
      '@ralia/ui': resolvePath('../../packages/ui/src/index.ts'),
    },
  },
  build: { outDir: 'dist', sourcemap: true },
  server: { port: 5173 },
});
```

- [ ] **Step 4: `index.html` schreiben**

```html
<!doctype html>
<html lang="de">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>Ralia</title>
    <script>
      // Vor dem ersten Frame: verhindert den Hell-Blitz beim Laden im Dark Mode.
      // Inhalt muss mit themeBootScript() aus @ralia/ui uebereinstimmen.
      try {
        var c = localStorage.getItem('ralia.theme');
        if (c !== 'light' && c !== 'dark') c = 'system';
        var d = c === 'dark' || (c === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
        if (d) document.documentElement.setAttribute('data-ralia-theme', 'dark');
      } catch (e) {}
    </script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`viewport-fit=cover` ist Voraussetzung dafür, dass `env(safe-area-inset-*)` überhaupt Werte liefert.

- [ ] **Step 5: Test schreiben, der das Inline-Skript gegen `themeBootScript()` prüft**

Sonst driften die zwei Kopien auseinander. Create `apps/app/src/boot/theme-boot.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { themeBootScript } from '@ralia/ui';
import { describe, expect, it } from 'vitest';

describe('Theme-Boot-Skript', () => {
  it('stimmt mit themeBootScript() überein', () => {
    const html = readFileSync(
      fileURLToPath(new URL('../../index.html', import.meta.url)),
      'utf8',
    );
    const normalize = (s: string) => s.replace(/\s+/g, '');
    expect(normalize(html)).toContain(normalize(themeBootScript()));
  });
});
```

Diese Datei liegt unter `apps/app/src/**/*.test.ts` und läuft damit im `dom`-Projekt — Dateizugriff ist dort erlaubt.

- [ ] **Step 6: `router.tsx` schreiben**

```tsx
import { Navigate, type RouteObject } from 'react-router';
import { AppFrame } from './AppFrame.js';

/** Platzhalter für SP0; die Screens kommen in Task 15 bis 21. */
function Placeholder({ name }: { name: string }): React.JSX.Element {
  return <p>{name}</p>;
}

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppFrame />,
    children: [
      { index: true, element: <Navigate to="/kalender" replace /> },
      { path: 'kalender', element: <Placeholder name="Kalender" /> },
      { path: 'planer', element: <Placeholder name="Planer" /> },
      { path: 'todos', element: <Placeholder name="Todos" /> },
      { path: 'todos/:listId', element: <Placeholder name="Liste" /> },
      { path: 'geld', element: <Placeholder name="Geld" /> },
      { path: 'profil', element: <Placeholder name="Einstellungen" /> },
      { path: 'profil/sync', element: <Placeholder name="Google Kalender" /> },
      { path: '*', element: <Navigate to="/kalender" replace /> },
    ],
  },
];
```

`routes` wird exportiert, damit Tests `createMemoryRouter` nutzen können; `main.tsx` baut daraus `createBrowserRouter(routes, { basename: '/app' })`.

- [ ] **Step 7: `AppFrame.tsx` schreiben**

```tsx
import { Outlet, useLocation, useNavigate } from 'react-router';
import { AppLayout, TABS, type TabId } from '@ralia/ui';

function tabFromPath(pathname: string): TabId {
  const match = TABS.find((tab) => pathname === tab.path || pathname.startsWith(`${tab.path}/`));
  return match?.id ?? 'kalender';
}

export function AppFrame(): React.JSX.Element {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const activeTab = tabFromPath(pathname);

  return (
    <AppLayout
      activeTab={activeTab}
      onNavigate={(tab) => {
        const target = TABS.find((t) => t.id === tab);
        if (target) navigate(target.path);
      }}
    >
      <Outlet />
    </AppLayout>
  );
}
```

- [ ] **Step 8: `App.tsx` und `main.tsx` schreiben**

`App.tsx` klammert die Provider:

```tsx
import { RouterProvider, createBrowserRouter } from 'react-router';
import { ThemeProvider, ToastProvider } from '@ralia/ui';
import { routes } from './routes/router.js';

const router = createBrowserRouter(routes, { basename: '/app' });

export function App(): React.JSX.Element {
  return (
    <ThemeProvider>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </ThemeProvider>
  );
}
```

`main.tsx` bringt die Stile in der richtigen Reihenfolge ein — Fonts vor Tokens vor Reset, sonst greifen Kaskade und `@import` nicht:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@ralia/ui/tokens/fonts.css';
import '@ralia/ui/tokens/tokens.css';
import '@ralia/ui/tokens/reset.css';
import { App } from './App.js';

const host = document.getElementById('root');
if (!host) throw new Error('#root fehlt in index.html');

createRoot(host).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 9: Tests laufen lassen**

Run: `npx vitest run apps/app`
Expected: PASS, 10 Tests

- [ ] **Step 10: Dev-Server und Build prüfen**

Run: `npm run dev`
Expected: Vite startet, `http://localhost:5173/app/` zeigt die Shell mit fünf Tabs. Bei ≥1024 px Fensterbreite links die Sidebar, darunter die Bottom-Nav. Danach beenden.

Run: `npm run build`
Expected: Exit 0, `apps/app/dist/index.html` und `dist/assets/*` entstehen, keine Warnungen.

- [ ] **Step 11: Commit**

```bash
git add apps/app package.json
git commit -m "feat(app): lauffaehige SPA-Huelle mit Routing ueber die fuenf Tabs

npm run dev startet erstmals. Basispfad /app/, Router-Basename /app,
viewport-fit=cover fuer die Safe-Area-Insets. Ein Test haelt das
Inline-Theme-Skript in index.html mit themeBootScript() synchron."
```

---

## Task 13: i18n — Extraktion und Provider

**Files:**
- Create: `scripts/extract-i18n.mjs`
- Create: `apps/app/src/i18n/de.json` (generiert)
- Create: `apps/app/src/i18n/en.json` (generiert)
- Create: `apps/app/src/i18n/additions.json` — Schlüssel, die Ralia_Opus nicht hat
- Create: `apps/app/src/i18n/catalog.ts`
- Create: `apps/app/src/i18n/I18nProvider.tsx`
- Create: `apps/app/src/i18n/useT.ts`
- Create: `apps/app/src/i18n/i18n.test.ts`
- Create: `apps/app/src/i18n/I18nProvider.test.tsx`

**Interfaces:**
- Consumes: Task 12
- Produces:
  - `type Lang = 'de' | 'en'`
  - `const LANG_STORAGE_KEY = 'appLanguage'`
  - `function I18nProvider(props: { children: ReactNode })`
  - `function useT(): { t(key: string): string; lang: Lang; setLang(next: Lang): void }`
  - `de.json`/`en.json` mit je 546 Schlüsseln aus `i18n.js`, plus die Zusätze aus `additions.json`

- [ ] **Step 1: Test für das Extraktionsskript schreiben**

Create `apps/app/src/i18n/i18n.test.ts`:

```ts
import de from './de.json' with { type: 'json' };
import en from './en.json' with { type: 'json' };
import { describe, expect, it } from 'vitest';

const deKeys = Object.keys(de);
const enKeys = Object.keys(en);

describe('Übersetzungskataloge', () => {
  it('haben identische Schlüsselmengen', () => {
    expect(new Set(deKeys)).toEqual(new Set(enKeys));
  });

  it('enthalten die 546 Schlüssel aus Ralia_Opus plus die Zusätze', () => {
    // 546 aus i18n.js; additions.json bringt die Navigations-Schlüssel dazu.
    expect(deKeys.length).toBeGreaterThanOrEqual(546);
  });

  it('haben keine leeren Werte', () => {
    for (const [key, value] of Object.entries(de)) {
      expect(value, `de.${key} ist leer`).not.toBe('');
    }
    for (const [key, value] of Object.entries(en)) {
      expect(value, `en.${key} ist leer`).not.toBe('');
    }
  });

  it('sind alphabetisch sortiert, damit Diffs lesbar bleiben', () => {
    expect(deKeys).toEqual([...deKeys].sort());
    expect(enKeys).toEqual([...enKeys].sort());
  });

  it('enthalten die Navigations-Schlüssel der AppShell', () => {
    for (const key of [
      'navCalendar', 'navCalendarShort', 'navPlanner', 'navPlannerShort',
      'navTodos', 'navTodosShort', 'navMoney', 'navMoneyShort',
      'navSettings', 'navProfileShort',
    ]) {
      expect(deKeys, `de fehlt ${key}`).toContain(key);
      expect(enKeys, `en fehlt ${key}`).toContain(key);
    }
  });

  it('übernimmt Stichproben wortgleich aus Ralia_Opus', () => {
    expect((de as Record<string, string>).appSubtitle).toBe('Teile Deine Tage gemeinsam');
    expect((de as Record<string, string>).loginButton).toBe('Anmelden');
  });
});
```

- [ ] **Step 2: Test laufen lassen — er muss fehlschlagen**

Run: `npx vitest run apps/app/src/i18n/i18n.test.ts`
Expected: FAIL — `de.json` existiert nicht

- [ ] **Step 3: `scripts/extract-i18n.mjs` schreiben**

Handarbeit ist ausgeschlossen. Das Skript liest das Objektliteral und wertet es aus, statt es mit Regex zu zerlegen — Werte enthalten Apostrophe, Emoji und Escapes, an denen ein Zeilenparser scheitert.

```js
#!/usr/bin/env node
/**
 * Holt die Übersetzungen aus Ralia_Opus nach apps/app/src/i18n/.
 *
 * Aufruf: node scripts/extract-i18n.mjs [--source <pfad-zu-i18n.js>] [--check]
 *
 * --check schreibt nicht, sondern prüft nur, ob die vorhandenen Dateien
 * dem entsprechen, was das Skript erzeugen würde. Für CI.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const DEFAULT_SOURCE = 'N:/Programme/EigeneProjekte/Ralia_Opus/public/js/i18n.js';
const OUT_DIR = fileURLToPath(new URL('../apps/app/src/i18n/', import.meta.url));
const ADDITIONS = `${OUT_DIR}additions.json`;

const args = process.argv.slice(2);
const check = args.includes('--check');
const sourceArg = args.indexOf('--source');
const source = sourceArg === -1 ? DEFAULT_SOURCE : args[sourceArg + 1];

/** Findet das schließende `}` zum `{` an `start`, unter Beachtung von Strings. */
function matchBrace(src, start) {
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let i = start; i < src.length; i += 1) {
    const ch = src[i];
    if (escaped) { escaped = false; continue; }
    if (ch === '\\') { escaped = true; continue; }
    if (quote) { if (ch === quote) quote = null; continue; }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; continue; }
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  throw new Error('Objektliteral nicht geschlossen');
}

function readTranslations(src) {
  const anchor = src.indexOf('const translations = {');
  if (anchor === -1) throw new Error('`const translations = {` nicht gefunden');
  const open = src.indexOf('{', anchor);
  const close = matchBrace(src, open);
  const literal = src.slice(open, close + 1);
  // Reine Datenliteral aus dem eigenen Repo — kein Fremdcode.
  const value = new Function(`return (${literal});`)();
  if (!value.de || !value.en) throw new Error('de oder en fehlt im Katalog');
  return { value, literal };
}

/** Doppelte Schlüssel melden: im Objektliteral gewinnt der letzte. */
function findDuplicates(literal, lang) {
  const langStart = literal.indexOf(`${lang}: {`);
  if (langStart === -1) return [];
  const open = literal.indexOf('{', langStart);
  const block = literal.slice(open, matchBrace(literal, open) + 1);
  const seen = new Set();
  const dupes = [];
  for (const match of block.matchAll(/^\s{8}([A-Za-z0-9_]+)\s*:/gm)) {
    const key = match[1];
    if (seen.has(key)) dupes.push(key);
    else seen.add(key);
  }
  return dupes;
}

function sortedJson(record) {
  const sorted = {};
  for (const key of Object.keys(record).sort()) sorted[key] = record[key];
  return `${JSON.stringify(sorted, null, 2)}\n`;
}

const src = readFileSync(source, 'utf8');
const { value, literal } = readTranslations(src);

for (const lang of ['de', 'en']) {
  const dupes = findDuplicates(literal, lang);
  if (dupes.length > 0) {
    console.warn(`[${lang}] ${dupes.length} doppelte Schlüssel, letzter gewinnt: ${dupes.join(', ')}`);
  }
}

const additions = JSON.parse(readFileSync(ADDITIONS, 'utf8'));
const merged = {
  de: { ...value.de, ...additions.de },
  en: { ...value.en, ...additions.en },
};

const deKeys = Object.keys(merged.de).sort();
const enKeys = Object.keys(merged.en).sort();
const onlyDe = deKeys.filter((k) => !(k in merged.en));
const onlyEn = enKeys.filter((k) => !(k in merged.de));
if (onlyDe.length > 0 || onlyEn.length > 0) {
  console.error(`Schlüsselmengen weichen ab.\n  nur de: ${onlyDe.join(', ')}\n  nur en: ${onlyEn.join(', ')}`);
  process.exit(1);
}

let failed = false;
for (const lang of ['de', 'en']) {
  const target = `${OUT_DIR}${lang}.json`;
  const next = sortedJson(merged[lang]);
  if (check) {
    const current = readFileSync(target, 'utf8');
    if (current !== next) {
      console.error(`${lang}.json ist nicht aktuell — führe \`npm run i18n:extract\` aus`);
      failed = true;
    }
  } else {
    writeFileSync(target, next, 'utf8');
  }
}
if (failed) process.exit(1);

console.log(`${deKeys.length} Schlüssel je Sprache${check ? ' geprüft' : ' geschrieben'}`);
```

- [ ] **Step 4: `additions.json` schreiben**

Die zehn Navigations-Schlüssel, die `i18n.js` nicht hat. Beschriftungen wortgleich aus der Vorlage (Sidebar Z. 84–96, Bottom-Nav Z. 686–702):

```json
{
  "de": {
    "navCalendar": "Kalender",
    "navCalendarShort": "Kalender",
    "navPlanner": "Wochenplaner",
    "navPlannerShort": "Planer",
    "navTodos": "Todos",
    "navTodosShort": "Todos",
    "navMoney": "Geld",
    "navMoneyShort": "Geld",
    "navSettings": "Einstellungen",
    "navProfileShort": "Profil"
  },
  "en": {
    "navCalendar": "Calendar",
    "navCalendarShort": "Calendar",
    "navPlanner": "Week planner",
    "navPlannerShort": "Planner",
    "navTodos": "To-dos",
    "navTodosShort": "To-dos",
    "navMoney": "Money",
    "navMoneyShort": "Money",
    "navSettings": "Settings",
    "navProfileShort": "Profile"
  }
}
```

Weitere Schlüssel für Screen-Texte kommen in den Tasks 15–21 hier hinzu. Regel: alles, was Ralia_Opus schon kennt, wird **nicht** dupliziert — erst in `i18n.js` nachsehen.

- [ ] **Step 5: Skript ausführen und Ergebnis prüfen**

Run: `npm run i18n:extract`
Expected: Warnungen zu 6 doppelten DE- und 4 doppelten EN-Schlüsseln, danach `556 Schlüssel je Sprache geschrieben` (546 + 10).

Run: `node scripts/extract-i18n.mjs --check`
Expected: `556 Schlüssel je Sprache geprüft`, Exit 0 — belegt, dass das Skript reproduzierbar arbeitet.

- [ ] **Step 6: Test laufen lassen**

Run: `npx vitest run apps/app/src/i18n/i18n.test.ts`
Expected: PASS, 6 Tests

- [ ] **Step 7: `catalog.ts` und `I18nProvider` schreiben**

```ts
import de from './de.json' with { type: 'json' };
import en from './en.json' with { type: 'json' };

export type Lang = 'de' | 'en';
export const LANGS: readonly Lang[] = ['de', 'en'];

/** Derselbe Schlüssel wie in Ralia_Opus — die Sprachwahl übersteht den Umbau. */
export const LANG_STORAGE_KEY = 'appLanguage';

export const CATALOG: Record<Lang, Record<string, string>> = { de, en };

export function isLang(value: unknown): value is Lang {
  return value === 'de' || value === 'en';
}

/** Gespeicherte Wahl → Browsersprache → Deutsch. */
export function detectLang(stored: string | null, navigatorLang: string | undefined): Lang {
  if (isLang(stored)) return stored;
  return navigatorLang?.toLowerCase().startsWith('en') ? 'en' : 'de';
}

/** Fällt auf Englisch zurück, dann auf den Schlüssel — wie `t()` in Ralia_Opus (Z. 1149–1155). */
export function translate(lang: Lang, key: string): string {
  return CATALOG[lang][key] ?? CATALOG.en[key] ?? key;
}
```

`I18nProvider` hält `lang` im State (Startwert aus `detectLang`), schreibt bei `setLang` in `localStorage` und setzt `document.documentElement.lang`. Der Kontextwert wird memoisiert.

- [ ] **Step 8: Test für den Provider schreiben und bestehen lassen**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { I18nProvider } from './I18nProvider.js';
import { LANG_STORAGE_KEY } from './catalog.js';
import { useT } from './useT.js';

function Probe() {
  const { t, lang, setLang } = useT();
  return (
    <>
      <span data-testid="lang">{lang}</span>
      <span data-testid="text">{t('loginButton')}</span>
      <span data-testid="fallback">{t('gibtsNichtInDe')}</span>
      <button onClick={() => setLang('en')}>en</button>
    </>
  );
}

beforeEach(() => localStorage.clear());

describe('I18nProvider', () => {
  it('startet auf Deutsch, wenn nichts gespeichert ist', () => {
    render(<I18nProvider><Probe /></I18nProvider>);
    expect(screen.getByTestId('lang')).toHaveTextContent('de');
    expect(screen.getByTestId('text')).toHaveTextContent('Anmelden');
  });

  it('wechselt die Sprache und speichert sie', async () => {
    render(<I18nProvider><Probe /></I18nProvider>);
    await userEvent.click(screen.getByRole('button', { name: 'en' }));
    expect(screen.getByTestId('lang')).toHaveTextContent('en');
    expect(localStorage.getItem(LANG_STORAGE_KEY)).toBe('en');
  });

  it('stellt eine gespeicherte Sprache wieder her', () => {
    localStorage.setItem(LANG_STORAGE_KEY, 'en');
    render(<I18nProvider><Probe /></I18nProvider>);
    expect(screen.getByTestId('lang')).toHaveTextContent('en');
  });

  it('gibt bei unbekanntem Schlüssel den Schlüssel zurück', () => {
    render(<I18nProvider><Probe /></I18nProvider>);
    expect(screen.getByTestId('fallback')).toHaveTextContent('gibtsNichtInDe');
  });

  it('setzt das lang-Attribut am Dokument', () => {
    render(<I18nProvider><Probe /></I18nProvider>);
    expect(document.documentElement.lang).toBe('de');
  });
});
```

- [ ] **Step 9: `AppFrame` an i18n anschließen**

`AppFrame` übergibt `labels` an `AppLayout`, gefüllt aus `useT()` über `TABS`:

```tsx
const { t } = useT();
const labels = Object.fromEntries(
  TABS.map((tab) => [tab.id, { sidebar: t(tab.sidebarLabelKey), bottom: t(tab.bottomLabelKey) }]),
) as Record<TabId, { sidebar: string; bottom: string }>;
```

`App.tsx` klammert `I18nProvider` um `RouterProvider`.

- [ ] **Step 10: Alles prüfen und committen**

Run: `npm run typecheck && npm run lint && npm test`
Expected: grün

```bash
git add scripts apps/app package.json
git commit -m "feat(app): i18n-Kataloge mechanisch aus Ralia_Opus extrahiert

546 Schluessel aus i18n.js plus 10 Navigations-Schluessel, die es dort nicht
gab. Das Skript wertet das Objektliteral aus statt es mit Regex zu zerlegen,
meldet die 6 bzw. 4 doppelten Schluessel und bricht ab, wenn DE und EN
auseinanderlaufen. --check belegt Reproduzierbarkeit."
```

---

## Task 14: Boot-Sequenz

**Files:**
- Create: `apps/app/src/boot/bootstrap.ts`
- Create: `apps/app/src/boot/BootGate.tsx`
- Create: `apps/app/src/boot/bootstrap.test.ts`
- Modify: `apps/app/src/App.tsx`

**Interfaces:**
- Consumes: `@ralia/data` (`loadRuntimeConfig`, `mergeRuntimeConfig`, `getSupabaseClient`, `resetSupabaseClient`), `@ralia/core` (`importLegacyOutbox`, `Outbox`, `bindLifecycle`, `openRaliaDB`)
- Produces:
  - `type BootState = { phase: 'pending' } | { phase: 'ready'; config: RuntimeConfig; warnings: string[] } | { phase: 'failed'; error: Error }`
  - `function runBoot(deps?: BootDeps): Promise<BootResult>` — `BootDeps` erlaubt das Einsetzen von Testdoppeln für `loadRuntimeConfig`, `storage`, `serviceWorker`, `caches`
  - `function BootGate(props: { children: ReactNode })`

- [ ] **Step 1: Tests schreiben**

Die Reihenfolge aus dem Spec ist das Prüfobjekt: `/config` darf nicht blockieren, die Legacy-Migration läuft genau einmal, Alt-Keys fallen erst nach dem Import.

```ts
import { LEGACY_MIGRATION_META_KEY } from '@ralia/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runBoot } from './bootstrap.js';

function memoryStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    key: (i: number) => [...map.keys()][i] ?? null,
    get length() { return map.size; },
    clear: () => map.clear(),
    snapshot: () => Object.fromEntries(map),
  };
}

const okConfig = {
  supabaseUrl: 'https://nyvripddydrzvfuateea.supabase.co',
  supabaseAnonKey: 'sb_publishable_test',
};

beforeEach(() => vi.restoreAllMocks());

describe('runBoot', () => {
  it('übernimmt den Runtime-Key aus /config', async () => {
    const result = await runBoot({
      storage: memoryStorage(),
      loadRuntimeConfig: async () => okConfig,
    });
    expect(result.phase).toBe('ready');
    if (result.phase !== 'ready') return;
    expect(result.config.supabaseAnonKey).toBe('sb_publishable_test');
    expect(result.warnings).toHaveLength(0);
  });

  it('bootet trotz fehlgeschlagenem /config und meldet eine Warnung', async () => {
    const result = await runBoot({
      storage: memoryStorage(),
      loadRuntimeConfig: async () => { throw new Error('offline'); },
    });
    expect(result.phase).toBe('ready');
    if (result.phase !== 'ready') return;
    expect(result.warnings.join(' ')).toMatch(/config/i);
    // Der eingebaute Key bleibt in Kraft.
    expect(result.config.supabaseAnonKey).toBeTruthy();
  });

  it('importiert Alt-Queues und löscht die Alt-Keys erst danach', async () => {
    const storage = memoryStorage({
      'ralia:event-queue:abc_def': JSON.stringify([
        { id: 'm1', type: 'insert', payload: { name: 'Yoga' } },
      ]),
      appLanguage: 'de',
    });
    const result = await runBoot({ storage, loadRuntimeConfig: async () => okConfig });
    expect(result.phase).toBe('ready');
    const after = storage.snapshot();
    expect(after['ralia:event-queue:abc_def']).toBeUndefined();
    expect(after[LEGACY_MIGRATION_META_KEY]).toBeDefined();
    // Fremde Schlüssel bleiben unberührt.
    expect(after.appLanguage).toBe('de');
  });

  it('läuft die Migration bei einem zweiten Boot nicht erneut', async () => {
    const storage = memoryStorage({
      'ralia:event-queue:abc_def': JSON.stringify([
        { id: 'm1', type: 'insert', payload: {} },
      ]),
    });
    const first = await runBoot({ storage, loadRuntimeConfig: async () => okConfig });
    const marker = storage.snapshot()[LEGACY_MIGRATION_META_KEY];
    storage.setItem('ralia:event-queue:xyz', JSON.stringify([{ id: 'm2', type: 'insert', payload: {} }]));
    const second = await runBoot({ storage, loadRuntimeConfig: async () => okConfig });
    expect(first.phase).toBe('ready');
    expect(second.phase).toBe('ready');
    // Marker unverändert: der zweite Lauf hat nicht migriert.
    expect(storage.snapshot()[LEGACY_MIGRATION_META_KEY]).toBe(marker);
    expect(storage.snapshot()['ralia:event-queue:xyz']).toBeDefined();
  });

  it('deregistriert den alten Service Worker und löscht dessen Caches', async () => {
    const unregister = vi.fn(async () => true);
    const deleteCache = vi.fn(async () => true);
    await runBoot({
      storage: memoryStorage(),
      loadRuntimeConfig: async () => okConfig,
      serviceWorker: { getRegistrations: async () => [{ unregister }] },
      caches: { keys: async () => ['ralia-static-v3', 'fremd-cache'], delete: deleteCache },
    });
    expect(unregister).toHaveBeenCalledOnce();
    expect(deleteCache).toHaveBeenCalledWith('ralia-static-v3');
    expect(deleteCache).not.toHaveBeenCalledWith('fremd-cache');
  });

  it('scheitert nicht, wenn Service Worker und Caches fehlen', async () => {
    const result = await runBoot({
      storage: memoryStorage(),
      loadRuntimeConfig: async () => okConfig,
      serviceWorker: undefined,
      caches: undefined,
    });
    expect(result.phase).toBe('ready');
  });
});
```

- [ ] **Step 2: Tests laufen lassen — sie müssen fehlschlagen**

Run: `npx vitest run apps/app/src/boot/bootstrap.test.ts`
Expected: FAIL

- [ ] **Step 3: `bootstrap.ts` implementieren**

Die Reihenfolge ist zwingend und im Code zu kommentieren. Alle Außenkanten kommen über `BootDeps` mit Standardwerten aus der Umgebung — nur so ist die Sequenz testbar, ohne einen Browser zu fahren.

```ts
export interface BootDeps {
  storage?: Storage;
  loadRuntimeConfig?: () => Promise<Partial<RuntimeConfig>>;
  serviceWorker?: { getRegistrations(): Promise<{ unregister(): Promise<boolean> }[]> } | undefined;
  caches?: { keys(): Promise<string[]>; delete(key: string): Promise<boolean> } | undefined;
}
```

Ablauf:

1. **Alten Service Worker abräumen.** Alle Registrierungen `unregister()`, dann alle Cache-Namen löschen, die mit einem Präfix aus `LEGACY_CACHE_PREFIXES` beginnen **oder** mit `ralia-` anfangen. Fremde Caches nicht anfassen. Jeder Fehler hier wird zur Warnung, nicht zum Abbruch — ein hängender alter SW darf den Start nicht verhindern.
2. **`/config` lesen.** `loadRuntimeConfig()` in `try/catch`; bei Erfolg `mergeRuntimeConfig(bootstrapConfig, geladen)` und `resetSupabaseClient()`, damit der nächste `getSupabaseClient()` den Runtime-Key nutzt. Bei Fehler: `bootstrapConfig` behalten und `warnings.push(...)`.
3. **Legacy-Import.** `importLegacyOutbox` aus `@ralia/core` erledigt Marker-Prüfung, Übernahme und das Löschen der Alt-Keys in der richtigen Reihenfolge — hier nur aufrufen und das Ergebnis den Warnungen zuschlagen, wenn Einträge verworfen wurden.
4. **Outbox anbinden.** `openRaliaDB()`, `new Outbox(...)`, `bindLifecycle(...)` mit `DEFAULT_FLUSH_INTERVAL_MS`, dann ein erster `flush()`. Der Flush wird **nicht** abgewartet: bei fehlender Verbindung würde der Start sonst hängen. Fehler landen in den Warnungen.

Der Rückgabewert enthält `config`, `warnings` und die `Outbox`-Instanz, damit spätere Sub-Projekte sie über einen Kontext beziehen können.

- [ ] **Step 4: Tests laufen lassen**

Run: `npx vitest run apps/app/src/boot/bootstrap.test.ts`
Expected: PASS, 6 Tests

- [ ] **Step 5: `BootGate` implementieren**

`useEffect` mit einem `ref`-Wächter, damit `runBoot` unter `StrictMode` nicht zweimal läuft. Drei Zustände:

- `pending`: die Shell mit `Skeleton`-Platzhaltern — kein Spinner, kein Layoutsprung
- `ready`: `children`, und jede Warnung einmal als Toast (`tone="info"`)
- `failed`: `EmptyState` mit der Fehlermeldung und einem „Erneut versuchen"-Knopf, der `runBoot` neu anstößt

- [ ] **Step 6: `App.tsx` erweitern**

Reihenfolge der Provider: `ThemeProvider` → `I18nProvider` → `ToastProvider` → `BootGate` → `RouterProvider`. `BootGate` muss innerhalb von `ToastProvider` liegen, weil es Warnungen als Toast meldet, und innerhalb von `I18nProvider`, weil seine Texte übersetzt sind.

- [ ] **Step 7: Prüfen und committen**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: grün

```bash
git add apps/app
git commit -m "feat(app): Boot-Sequenz mit Legacy-Migration und weichem /config-Fehler

Reihenfolge wie im Spec: alten Service Worker abraeumen, /config lesen,
Alt-Queues uebernehmen, dann erst Alt-Keys loeschen, Outbox anbinden.
Ein fehlgeschlagenes /config wird zur Warnung, nicht zum Abbruch."
```

---

## Task 15: Demo-Daten

**Files:**
- Create: `apps/app/src/mock/fixtures.ts`
- Create: `apps/app/src/mock/fixtures.test.ts`

**Interfaces:**
- Consumes: Task 3 (`PersonSlot`)
- Produces:
  - `const MOCK_TODAY = '2026-07-29'`
  - `interface MockEvent { iso: string; title: string; start: string; end: string; slot: PersonSlot; location: string }`
  - `interface MockTodoItem { id: string; listId: string; text: string; done: boolean; slot: PersonSlot; note: string }`
  - `interface MockPlannerDay { weekday: string; dayOfMonth: number; meal: string; tasks: { id: string; text: string; done: boolean; slot: PersonSlot }[] }`
  - `interface MockCategory { name: string; limit: number; shares: Record<'u1' | 'u2' | 'both', number> }`
  - `interface MockExpense { title: string; slot: PersonSlot; category: string; date: string; amount: number; split: string }`
  - `const MOCK_EVENTS`, `MOCK_TODOS`, `MOCK_TODO_LISTS`, `MOCK_PLANNER`, `MOCK_CATEGORIES`, `MOCK_EXPENSES`, `MOCK_PROFILE`

- [ ] **Step 1: Test schreiben**

```ts
import { describe, expect, it } from 'vitest';
import {
  MOCK_CATEGORIES, MOCK_EVENTS, MOCK_EXPENSES, MOCK_PLANNER, MOCK_TODAY, MOCK_TODOS,
} from './fixtures.js';

describe('Demo-Daten', () => {
  it('hat den Umfang der Vorlage', () => {
    expect(MOCK_EVENTS).toHaveLength(25);
    expect(MOCK_TODOS).toHaveLength(11);
    expect(MOCK_PLANNER).toHaveLength(7);
    expect(MOCK_CATEGORIES).toHaveLength(5);
    expect(MOCK_EXPENSES).toHaveLength(7);
  });

  it('nutzt durchgehend ISO-Datumsangaben', () => {
    for (const event of MOCK_EVENTS) {
      expect(event.iso).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('enthält Termine am fiktiven Heute', () => {
    expect(MOCK_EVENTS.filter((e) => e.iso === MOCK_TODAY)).toHaveLength(3);
  });

  it('enthält einen Geburtstag als eigenen Slot', () => {
    expect(MOCK_EVENTS.filter((e) => e.slot === 'bday')).toHaveLength(1);
  });

  it('hat für ganztägige Termine leere Zeiten', () => {
    const bday = MOCK_EVENTS.find((e) => e.slot === 'bday');
    expect(bday?.start).toBe('');
    expect(bday?.end).toBe('');
  });

  it('verteilt Kategorieanteile auf u1, u2 und both', () => {
    for (const category of MOCK_CATEGORIES) {
      const sum = category.shares.u1 + category.shares.u2 + category.shares.both;
      expect(sum).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Test laufen lassen — er muss fehlschlagen**

Run: `npx vitest run apps/app/src/mock/fixtures.test.ts`
Expected: FAIL

- [ ] **Step 3: Fixtures übernehmen**

Quelle: Vorlage Z. 1079–1147 (`baseEvents`, `baseTodos`, `basePlanner`, `categories`, `expenses`) und Z. 1063 (`me`). Feldnamen ausschreiben: `d` → `iso`, `t` → `title`, `s` → `start`, `e` → `end`, `who` → `slot`, `loc` → `location`, `g` → `listId`.

Die drei Todo-Listen aus Vorlage Z. 1356–1380 (`einkauf`, `erled`, `urlaub`) als `MOCK_TODO_LISTS` mit Titel, Farbe (Token-Referenz) und Initiale.

Dateikopf:

```ts
/**
 * Demo-Daten aus der Design-Vorlage (Z. 1079–1147).
 *
 * NUR FÜR SP0: sie füllen die Screens, damit sie beurteilbar sind. SP2 bis SP4
 * ersetzen sie durch Repositories gegen Supabase; diese Datei fällt dann weg.
 * Nichts außerhalb von apps/app/src/screens und apps/app/src/sheets darf sie
 * importieren.
 */
```

- [ ] **Step 4: Test laufen lassen und committen**

Run: `npx vitest run apps/app/src/mock/fixtures.test.ts`
Expected: PASS, 6 Tests

```bash
git add apps/app
git commit -m "feat(app): Demo-Daten der Vorlage als SP0-Platzhalter"
```

---

## Task 16: Kalender — Monatsansicht

**Files:**
- Create: `apps/app/src/screens/calendar/CalendarScreen.tsx`
- Create: `apps/app/src/screens/calendar/MonthView.tsx` + `.module.css`
- Create: `apps/app/src/screens/calendar/use-element-height.ts`
- Create: `apps/app/src/screens/calendar/calendar-labels.ts`
- Create: `apps/app/src/screens/calendar/MonthView.test.tsx`
- Modify: `apps/app/src/routes/router.tsx`
- Modify: `apps/app/src/i18n/additions.json`

**Interfaces:**
- Consumes: Task 5 (`monthDensity`, `monthGridCells`), Task 8 (Primitive), Task 11 (`AppHeader`, `Fab`), Task 15 (`MOCK_EVENTS`)
- Produces:
  - `function useElementHeight(): [ref: (node: HTMLElement | null) => void, height: number]` — `ResizeObserver`, 0 bis zur ersten Messung
  - `function MonthView(props: { year: number; monthIndex: number; weekStart: WeekStart; today: string; events: readonly MockEvent[]; onSelectDay(iso: string): void })`
  - `function monthTitle(year: number, monthIndex: number, lang: Lang): string`

- [ ] **Step 1: Tests schreiben**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { MOCK_EVENTS, MOCK_TODAY } from '../../mock/fixtures.js';
import { MonthView } from './MonthView.js';

/** jsdom hat kein ResizeObserver und meldet immer Höhe 0. */
function stubResizeObserver(height: number) {
  vi.stubGlobal('ResizeObserver', class {
    constructor(private cb: ResizeObserverCallback) {}
    observe(target: Element) {
      this.cb([{ target, contentRect: { height } } as unknown as ResizeObserverEntry], this as never);
    }
    unobserve() {}
    disconnect() {}
  });
}

function renderMonth(gridHeight: number, onSelectDay = vi.fn()) {
  stubResizeObserver(gridHeight);
  render(
    <MonthView
      year={2026}
      monthIndex={6}
      weekStart="mo"
      today={MOCK_TODAY}
      events={MOCK_EVENTS}
      onSelectDay={onSelectDay}
    />,
  );
  return onSelectDay;
}

describe('MonthView', () => {
  it('rendert 42 Tageszellen', () => {
    renderMonth(600);
    expect(screen.getAllByRole('button', { name: /^\d+\./ })).toHaveLength(42);
  });

  it('zeigt sieben Wochentagsköpfe', () => {
    renderMonth(600);
    for (const wd of ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']) {
      expect(screen.getByText(wd)).toBeInTheDocument();
    }
  });

  it('markiert heute', () => {
    renderMonth(600);
    expect(screen.getByRole('button', { name: /29\. Juli/ })).toHaveAttribute('aria-current', 'date');
  });

  it('meldet den angetippten Tag als ISO-Datum', async () => {
    const onSelectDay = renderMonth(600);
    await userEvent.click(screen.getByRole('button', { name: /29\. Juli/ }));
    expect(onSelectDay).toHaveBeenCalledWith('2026-07-29');
  });

  it('zeigt bei viel Platz Ereignis-Chips mit Titel', () => {
    renderMonth(900);
    expect(screen.getByText('Zahnarzt')).toBeInTheDocument();
  });

  it('zeigt bei wenig Platz Punkte statt Chips', () => {
    renderMonth(240); // Zeilenhöhe 40 → kein Chip passt
    expect(screen.queryByText('Zahnarzt')).toBeNull();
    expect(screen.getAllByTestId('event-dot').length).toBeGreaterThan(0);
  });

  it('nennt die Zahl der Termine im Namen der Zelle', () => {
    renderMonth(900);
    // Der 29. Juli hat drei Termine.
    expect(screen.getByRole('button', { name: /29\. Juli.*3 Termine/ })).toBeInTheDocument();
  });

  it('kennzeichnet Tage außerhalb des Monats', () => {
    renderMonth(600);
    // 29. Juni liegt vor dem Monat.
    expect(screen.getByRole('button', { name: /29\. Juni/ })).toHaveAttribute('data-outside', 'true');
  });

  it('folgt dem Wochenstart Sonntag', () => {
    stubResizeObserver(600);
    render(
      <MonthView
        year={2026} monthIndex={6} weekStart="so" today={MOCK_TODAY}
        events={MOCK_EVENTS} onSelectDay={() => {}}
      />,
    );
    const heads = screen.getAllByTestId('weekday-head');
    expect(heads[0]).toHaveTextContent('So');
  });
});
```

- [ ] **Step 2: Tests laufen lassen — sie müssen fehlschlagen**

Run: `npx vitest run apps/app/src/screens/calendar/MonthView.test.tsx`
Expected: FAIL

- [ ] **Step 3: `use-element-height.ts` implementieren**

```ts
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Misst die Höhe eines Elements laufend.
 *
 * Ersetzt die Prototyp-Rechnung der Vorlage, die aus `window.innerHeight - 90`
 * auf die Rasterhöhe schloss — die 90 px waren deren eigene Kopfleiste.
 */
export function useElementHeight(): [(node: HTMLElement | null) => void, number] {
  const [height, setHeight] = useState(0);
  const observer = useRef<ResizeObserver | null>(null);

  const ref = useCallback((node: HTMLElement | null) => {
    observer.current?.disconnect();
    if (!node) return;
    if (typeof ResizeObserver !== 'function') {
      setHeight(node.getBoundingClientRect().height);
      return;
    }
    observer.current = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setHeight(entry.contentRect.height);
    });
    observer.current.observe(node);
  }, []);

  useEffect(() => () => observer.current?.disconnect(), []);

  return [ref, height];
}
```

- [ ] **Step 4: `MonthView` implementieren**

Raster und Zellen: Vorlage Z. 148–174. Werte im CSS-Modul: Kopfzeile `grid-template-columns:repeat(7,minmax(0,1fr))`, `gap:5px`; Raster zusätzlich `grid-template-rows:repeat(6,minmax(46px,1fr))`, `flex:1`, `min-height:0`; Zelle `padding:5px 4px`, Radius 11, `border:1px solid`; Tagesnummer 20×20 Kreis, `font-size:11px`; Chip `height:16px`, Radius 5, `border-left:2.5px solid`, Titel `font-size:9px`; Punkt 7×7, Radius 2.

Farben ausschließlich über Tokens: Zelle `--surface-2`/`--line`, heute `--brand-soft`/`--today-line` mit Nummer auf `--brand-fill`/`#fff`, außerhalb des Monats `opacity:.42`, Chips über `personTokens(slot)`.

Dichte:

```tsx
const [gridRef, gridHeight] = useElementHeight();
const density = monthDensity(gridHeight);
const cells = monthGridCells(year, monthIndex, weekStart);
```

Zugänglichkeit — hier geht der Plan über die Vorlage hinaus, weil eine Zelle dort nur eine Zahl vorliest:

```tsx
const label = `${cell.dayOfMonth}. ${monthName}${count > 0 ? `, ${count} ${count === 1 ? 'Termin' : 'Termine'}` : ''}`;
```

Dazu `aria-current="date"` am heutigen Tag, `data-outside="true"` außerhalb des Monats, `data-testid="event-dot"` an Punkten und `data-testid="weekday-head"` an den Wochentagsköpfen. Die Chip-Titel im Inneren sind `aria-hidden`, damit der Zellname nicht doppelt vorgelesen wird.

Wochentagsnamen und Monatsnamen aus `calendar-labels.ts` über `Intl.DateTimeFormat` mit der aktiven Sprache — nicht als hartcodierte Arrays wie in der Vorlage (Z. 1076–1077), sonst wäre die englische Fassung deutsch.

- [ ] **Step 5: `CalendarScreen` implementieren**

Hält `year`/`monthIndex`/`calMode` im State, rendert `AppHeader` mit `kicker` und `title` (Monatsname plus Jahr), Bereichsnavigation über `range` und darunter als `children` den `SegmentSwitch` `Monat | Woche` plus die Personenlegende (Vorlage Z. 129–141). Der FAB steht im Screen, nicht im Layout — die Vorlage blendet ihn auf Profil und Sync aus (Z. 1526).

Bis Task 17 zeigt `calMode === 'woche'` einen `EmptyState`.

Router: `/kalender` auf `CalendarScreen` umstellen.

- [ ] **Step 6: Tests laufen lassen**

Run: `npx vitest run apps/app/src/screens/calendar`
Expected: PASS, 9 Tests

- [ ] **Step 7: Im Browser gegen die Vorlage abgleichen**

Run: `npm run dev` und `/app/kalender` öffnen.
Prüfen: 6×7-Raster füllt die Höhe; heute violett hinterlegt mit gefüllter Nummer; Chips zeigen Titel in Personenfarbe; Fenster schmaler ziehen → Chips werden zu Punkten; Tage außerhalb blass.

- [ ] **Step 8: Commit**

```bash
git add apps/app
git commit -m "feat(app): Monatsansicht mit gemessener Zeilenhoehe

Chip-gegen-Punkt entscheidet monthDensity aus der real gemessenen
Rasterhoehe statt aus der Fensterhoehe. Zellen tragen einen sprechenden
Namen mit Terminzahl - die Vorlage liest dort nur eine Zahl vor."
```

---

## Task 17: Kalender — Wochenansicht

**Files:**
- Create: `apps/app/src/screens/calendar/WeekView.tsx` + `.module.css`
- Create: `apps/app/src/screens/calendar/WeekView.test.tsx`
- Modify: `apps/app/src/screens/calendar/CalendarScreen.tsx`
- Modify: `apps/app/src/i18n/additions.json`

**Interfaces:**
- Consumes: Task 5 (`weekEventGeometry`, `parseTimeToMinutes`, `WEEK_HOUR_HEIGHT_PX`, `WEEK_DEFAULT_START_HOUR`, `WEEK_EXPANDED_START_HOUR`), Task 15
- Produces:
  - `function WeekView(props: { weekStartIso: string; today: string; events: readonly MockEvent[]; nightExpanded: boolean; onToggleNight(): void; onSelectDay(iso: string): void })`
  - `function addDaysIso(iso: string, days: number): string` in `apps/app/src/screens/calendar/calendar-labels.ts`

- [ ] **Step 1: Tests schreiben**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WEEK_HOUR_HEIGHT_PX } from '@ralia/core';
import { describe, expect, it, vi } from 'vitest';
import { MOCK_EVENTS, MOCK_TODAY } from '../../mock/fixtures.js';
import { WeekView } from './WeekView.js';

function renderWeek(nightExpanded = false, onToggleNight = vi.fn(), onSelectDay = vi.fn()) {
  render(
    <WeekView
      weekStartIso="2026-07-27"
      today={MOCK_TODAY}
      events={MOCK_EVENTS}
      nightExpanded={nightExpanded}
      onToggleNight={onToggleNight}
      onSelectDay={onSelectDay}
    />,
  );
  return { onToggleNight, onSelectDay };
}

describe('WeekView', () => {
  it('zeigt sieben Tagesspalten', () => {
    renderWeek();
    expect(screen.getAllByTestId('week-day-head')).toHaveLength(7);
  });

  it('zeigt eingeklappt 18 Stunden ab 06:00', () => {
    renderWeek(false);
    expect(screen.getByText('06:00')).toBeInTheDocument();
    expect(screen.queryByText('00:00')).toBeNull();
    expect(screen.getAllByTestId('hour-label')).toHaveLength(18);
  });

  it('zeigt aufgeklappt 24 Stunden ab 00:00', () => {
    renderWeek(true);
    expect(screen.getByText('00:00')).toBeInTheDocument();
    expect(screen.getAllByTestId('hour-label')).toHaveLength(24);
  });

  it('meldet das Umschalten der Nachtstunden', async () => {
    const { onToggleNight } = renderWeek(false);
    await userEvent.click(screen.getByRole('button', { name: /Nacht/ }));
    expect(onToggleNight).toHaveBeenCalledOnce();
  });

  it('setzt einen 09:00-Termin auf drei Stundenhöhen unter den Tagesanfang', () => {
    renderWeek(false);
    const [zahnarzt] = screen.getAllByRole('button', { name: /Zahnarzt/ });
    expect(zahnarzt?.style.top).toBe(`${3 * WEEK_HOUR_HEIGHT_PX}px`);
  });

  it('gibt einem einstündigen Termin die Stundenhöhe minus Einzug', () => {
    renderWeek(false);
    const [zahnarzt] = screen.getAllByRole('button', { name: /Zahnarzt/ });
    expect(zahnarzt?.style.height).toBe(`${WEEK_HOUR_HEIGHT_PX - 3}px`);
  });

  it('lässt ganztägige Termine aus der Timeline weg', () => {
    renderWeek(false);
    // „Lenas Geburtstag" hat keine Zeit und liegt außerdem in einer anderen Woche.
    expect(screen.queryByRole('button', { name: /Geburtstag/ })).toBeNull();
  });

  it('markiert die heutige Spalte', () => {
    renderWeek();
    const heads = screen.getAllByTestId('week-day-head');
    const today = heads.filter((h) => h.getAttribute('aria-current') === 'date');
    expect(today).toHaveLength(1);
  });

  it('nennt Titel und Zeitraum im Namen eines Termins', () => {
    renderWeek(false);
    expect(screen.getAllByRole('button', { name: 'Zahnarzt, 09:00–10:00' }).length).toBeGreaterThan(0);
  });

  it('meldet den angetippten Termin mit dem ISO-Datum seines Tages', async () => {
    const { onSelectDay } = renderWeek(false);
    const [zahnarzt] = screen.getAllByRole('button', { name: /Zahnarzt/ });
    await userEvent.click(zahnarzt!);
    expect(onSelectDay).toHaveBeenCalledWith('2026-07-29');
  });
});
```

- [ ] **Step 2: Tests laufen lassen — sie müssen fehlschlagen**

Run: `npx vitest run apps/app/src/screens/calendar/WeekView.test.tsx`
Expected: FAIL

- [ ] **Step 3: `WeekView` implementieren**

Struktur und Werte: Vorlage Z. 179–217.

- Kopfzeile `position:sticky; top:0; background:var(--surface); border-bottom:1px solid var(--line-soft)`, Zeitspalten-Platzhalter `width:42px`
- Tageskopf: Radius 11, `margin:0 2px`, Wochentag `font-size:9.5px` uppercase `--ink-400`, Zahl `font-size:15px`; heute `background:var(--brand-soft)`, `border-color:var(--today-line)`, Zahl in `--brand`
- Nacht-Umschalter: volle Breite, `background:var(--surface-2)`, `color:var(--brand)`, `font-size:11px`, `padding:8px 14px`. Beschriftung aus Vorlage Z. 1591 mit `▾`/`▴`; die Dreiecke `aria-hidden`, der Knopf bekommt `aria-expanded`
- Zeitspalte `width:42px`, `border-right:1px solid var(--line-soft)`, Stundenmarken `height:52px`, Beschriftung `position:absolute; top:-6px; right:6px; font-size:9.5px; font-variant-numeric:tabular-nums`
- Tagesspalte `position:relative`, `border-right:1px solid var(--line-soft)`, Stundenlinien `height:52px; border-bottom:1px solid var(--line-soft)`; heute `background:var(--today-col)`
- Termin: `position:absolute; left:3px; right:3px`, Radius 7, `border-left:3px solid`, `padding:4px 5px`; Titel `font-size:10px`, Zeitraum `font-size:9px; opacity:.75`

Die Vorlage hängt nach der letzten Stunde eine Zusatzmarke `24:00` an (Z. 198–200) — mit übernehmen, sonst endet die Achse unbeschriftet.

Mindestbreite `640px` unterhalb des Sidebar-Breakpoints, `100%` darüber (Vorlage Z. 1590). Der Container scrollt darunter waagerecht.

Geometrie ausschließlich über `weekEventGeometry`; Termine ohne Zeit (`parseTimeToMinutes` liefert `null`) werden übersprungen. Der Name eines Termins ist `` `${title}, ${start}–${end}` `` — der innere Text `aria-hidden`.

- [ ] **Step 4: `CalendarScreen` erweitern**

`weekStartIso` und `nightExpanded` in den State. Bei `calMode === 'woche'` verschiebt die Bereichsnavigation um sieben Tage statt um einen Monat, und Kicker/Titel wechseln auf Kalenderwoche und Datumsspanne (Vorlage Z. 1472, 1480). „Heute" springt in beiden Modi auf `MOCK_TODAY`.

- [ ] **Step 5: Tests laufen lassen, im Browser prüfen, committen**

Run: `npx vitest run apps/app/src/screens/calendar`
Expected: PASS, 19 Tests

Im Browser: `Woche` wählen, Nachtstunden auf- und zuklappen, waagerechtes Scrollen bei schmalem Fenster.

```bash
git add apps/app
git commit -m "feat(app): Wochenansicht als Timeline mit einklappbaren Nachtstunden"
```

---

## Task 18: Wochenplaner

**Files:**
- Create: `apps/app/src/screens/planner/PlannerScreen.tsx` + `.module.css`
- Create: `apps/app/src/screens/planner/PlannerScreen.test.tsx`
- Modify: `apps/app/src/routes/router.tsx`, `apps/app/src/i18n/additions.json`

**Interfaces:**
- Consumes: Task 8 (`Card`, `Button`), Task 6 (`Icon` mit `meal`/`task`), Task 15 (`MOCK_PLANNER`)
- Produces: `function PlannerScreen(): React.JSX.Element`

- [ ] **Step 1: Tests schreiben**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { PlannerScreen } from './PlannerScreen.js';

describe('PlannerScreen', () => {
  it('zeigt sieben Tageskarten', () => {
    render(<PlannerScreen />);
    expect(screen.getAllByTestId('planner-day')).toHaveLength(7);
  });

  it('klappt vergangene Tage zu und künftige auf', () => {
    render(<PlannerScreen />);
    // Fiktives Heute ist der 29. (Index 2) — davor zwei zugeklappte Tage.
    const collapsed = screen.getAllByTestId('planner-day')
      .filter((d) => d.querySelector('[aria-expanded="false"]'));
    expect(collapsed).toHaveLength(2);
  });

  it('lässt einen Tag auf- und zuklappen', async () => {
    render(<PlannerScreen />);
    const [firstDay] = screen.getAllByTestId('planner-day');
    const toggle = firstDay!.querySelector('button')!;
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });

  it('zeigt Mahlzeit und Aufgaben eines aufgeklappten Tages', () => {
    render(<PlannerScreen />);
    expect(screen.getByText('Auswärts: Trattoria Sole')).toBeInTheDocument();
    expect(screen.getByText('Bad putzen')).toBeInTheDocument();
  });

  it('hakt eine Aufgabe ab', async () => {
    render(<PlannerScreen />);
    const task = screen.getByRole('checkbox', { name: 'Bad putzen' });
    expect(task).not.toBeChecked();
    await userEvent.click(task);
    expect(screen.getByRole('checkbox', { name: 'Bad putzen' })).toBeChecked();
  });

  it('zeigt bei einem Tag ohne Aufgaben einen Hinweis', () => {
    render(<PlannerScreen />);
    expect(screen.getByText('Keine Aufgaben')).toBeInTheDocument();
  });

  it('zeigt bei zugeklapptem Tag eine Vorschau', () => {
    render(<PlannerScreen />);
    expect(screen.getByText(/Ofengemüse mit Feta/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Test laufen lassen — er muss fehlschlagen**

Run: `npx vitest run apps/app/src/screens/planner`
Expected: FAIL

- [ ] **Step 3: `PlannerScreen` implementieren**

Struktur und Werte: Vorlage Z. 221–276.

- Kopfkarte `Card tone="brand"`: Wochennummer und Zeitraum `font-size:12.5px` in `--brand-600`, Zusammenfassung `font-size:11px` in `--ink-500`, rechts ein `Button` „Einkaufsliste"
- Tageskarte: `border:1px solid`, Radius 18, `overflow:hidden`
- Kopfzeile als `<button>`: Datumsplakette 36×36 Radius 12 mit Wochentag (`font-size:9px` uppercase) über Zahl (`font-size:13px`), langer Wochentag `font-size:12px` in `--ink-500`, rechts Zusammenfassung `font-size:10.5px` und Pfeil
- Inhalt zweispaltig `grid-template-columns:repeat(2,minmax(0,1fr))`, links Essen mit `Icon name="meal"` in `var(--bday)`, rechts Aufgaben mit `Icon name="task"` in `var(--u1)`, Trennlinie `border-right:1px solid var(--line-soft)`
- Aufgabe: Kästchen 16×16 Radius 5 `border:1.5px solid`, Text `font-size:12.5px`, rechts ein 7×7-Punkt in der Personenfarbe

Das Auf- und Zuklappen: Standard aus der Vorlage (Z. 1327) — Tage vor heute zu, ab heute auf, überschreibbar pro Tag. `aria-expanded` am Kopfknopf, `aria-controls` auf die Inhalts-ID.

Aufgaben als echte `<input type="checkbox">` mit sichtbar gestaltetem Kästchen — die Vorlage nutzt `<button>` mit `✓`-Zeichen, was Screenreadern den Zustand verschweigt. Die Optik bleibt identisch; der Zustand kommt aus `:checked`.

Icons: die Vorlage codiert `stroke="#f97316"` und `stroke="#3b82f6"` hart. Hier über `color` auf dem Elternelement plus `currentColor` im Icon, gesetzt auf `var(--bday)` und `var(--u1)` — dieselben Farben, aber themenfähig.

- [ ] **Step 4: Tests laufen lassen und committen**

Run: `npx vitest run apps/app/src/screens/planner`
Expected: PASS, 7 Tests

```bash
git add apps/app
git commit -m "feat(app): Wochenplaner mit auf- und zuklappbaren Tageskarten

Aufgaben sind echte Checkboxen statt Knoepfe mit Haken-Zeichen - gleiche
Optik, aber der Zustand ist fuer Screenreader lesbar."
```

---

## Task 19: Todos — Übersicht und Detail

**Files:**
- Create: `apps/app/src/screens/todos/TodoOverview.tsx` + `.module.css`
- Create: `apps/app/src/screens/todos/TodoDetail.tsx` + `.module.css`
- Create: `apps/app/src/screens/todos/todo-store.ts`
- Create: `apps/app/src/screens/todos/TodoOverview.test.tsx`
- Create: `apps/app/src/screens/todos/TodoDetail.test.tsx`
- Modify: `apps/app/src/routes/router.tsx`, `apps/app/src/i18n/additions.json`

**Interfaces:**
- Consumes: Task 8 (`Card`, `ProgressBar`, `Avatar`, `SectionLabel`), Task 7 (`Chip`), Task 15
- Produces:
  - `function TodoOverview(): React.JSX.Element` — Kachelraster, Klick navigiert auf `/todos/:listId`
  - `function TodoDetail(): React.JSX.Element` — liest `listId` aus `useParams`
  - `function useTodoStore(): { items; lists; toggle(id: string): void; filter; setFilter }` — SP0-interner Zustand über `useState`, ersetzt in SP3 durch ein Repository

- [ ] **Step 1: Tests für die Übersicht schreiben**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { routes } from '../../routes/router.js';

function renderAt(path: string) {
  return render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />);
}

describe('TodoOverview', () => {
  it('zeigt eine Kachel je Liste plus die Anlegen-Kachel', async () => {
    renderAt('/todos');
    expect(await screen.findAllByTestId('todo-list-card')).toHaveLength(3);
    expect(screen.getByRole('button', { name: /Neue Liste/ })).toBeInTheDocument();
  });

  it('nennt die Zahl der offenen Einträge', async () => {
    renderAt('/todos');
    // einkauf: 5 Einträge, 1 erledigt → 4 offen
    expect(await screen.findByRole('button', { name: /Einkauf.*4 offen/ })).toBeInTheDocument();
  });

  it('öffnet eine Liste', async () => {
    renderAt('/todos');
    await userEvent.click(await screen.findByRole('button', { name: /Einkauf/ }));
    expect(await screen.findByRole('button', { name: 'Zurück' })).toBeInTheDocument();
  });

  it('zeigt den Fortschritt als Messwert', async () => {
    renderAt('/todos');
    const bars = await screen.findAllByRole('progressbar');
    expect(bars).toHaveLength(3);
  });
});
```

- [ ] **Step 2: Tests für das Detail schreiben**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { routes } from '../../routes/router.js';

function renderDetail() {
  return render(
    <RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/todos/einkauf'] })} />,
  );
}

describe('TodoDetail', () => {
  it('zeigt die offenen Einträge der Liste', async () => {
    renderDetail();
    expect(await screen.findByRole('checkbox', { name: /Haferflocken/ })).toBeInTheDocument();
  });

  it('hält Erledigtes hinter einem Aufklapper', async () => {
    renderDetail();
    expect(screen.queryByRole('checkbox', { name: /Spülmaschinentabs/ })).toBeNull();
    await userEvent.click(await screen.findByRole('button', { name: /Erledigt/ }));
    expect(await screen.findByRole('checkbox', { name: /Spülmaschinentabs/ })).toBeInTheDocument();
  });

  it('hakt einen Eintrag ab und verschiebt ihn nach Erledigt', async () => {
    renderDetail();
    const item = await screen.findByRole('checkbox', { name: /Haferflocken/ });
    await userEvent.click(item);
    expect(screen.queryByRole('checkbox', { name: /Haferflocken/ })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /Erledigt · 2/ }));
    expect(await screen.findByRole('checkbox', { name: /Haferflocken/ })).toBeChecked();
  });

  it('filtert nach Person', async () => {
    renderDetail();
    await userEvent.click(await screen.findByRole('button', { name: 'Jonas' }));
    expect(screen.queryByRole('checkbox', { name: /Haferflocken/ })).toBeNull();
    expect(screen.getByRole('checkbox', { name: /Tomaten & Basilikum/ })).toBeInTheDocument();
  });

  it('zeigt bei leerer Auswahl den Hinweis der Vorlage', async () => {
    renderDetail();
    for (const name of ['Haferflocken', 'Tomaten & Basilikum', 'Kaffeebohnen', 'Hafermilch']) {
      await userEvent.click(await screen.findByRole('checkbox', { name: new RegExp(name) }));
    }
    expect(await screen.findByText('Nichts offen – alles abgehakt')).toBeInTheDocument();
  });

  it('kehrt über Zurück zur Übersicht', async () => {
    renderDetail();
    await userEvent.click(await screen.findByRole('button', { name: 'Zurück' }));
    expect(await screen.findByRole('button', { name: /Neue Liste/ })).toBeInTheDocument();
  });

  it('zeigt die Notiz eines Eintrags', async () => {
    renderDetail();
    expect(await screen.findByText('2 Pack')).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Tests laufen lassen — sie müssen fehlschlagen**

Run: `npx vitest run apps/app/src/screens/todos`
Expected: FAIL

- [ ] **Step 4: `todo-store.ts` implementieren**

Ein `useState`-Speicher mit den Fixtures als Startwert, `toggle(id)` kippt `done`, `filter` ist `'alle' | 'u1' | 'u2' | 'offen'` (Vorlage Z. 1382–1400).

Der Zustand muss in einem Kontext auf `/todos`-Ebene liegen, damit Übersicht und Detail dieselbe Wahrheit sehen — sonst verpufft ein Abhaken im Detail beim Zurückgehen. Also `TodoStoreProvider` als Elternroute für `/todos` und `/todos/:listId`; `useTodoStore` liest daraus. Mehr als das braucht es nicht: SP3 ersetzt den Speicher durch ein Repository.

- [ ] **Step 5: `TodoOverview` implementieren**

Vorlage Z. 280–311: Raster `repeat(2,minmax(0,1fr))`, `gap:12px`; Kachel Radius 20, `padding:14px`, `min-height:152px`, Hover `transform:translateY(-2px)` mit Schatten und `border-color:var(--hov-ring)`; Initiale 30×30 Radius 10 in Listenfarbe; Zähler `font-size:20px`; Titel `font-size:15px`; `ProgressBar height={6}`; `AvatarPair`-artige Überlappung mit `margin-left:-5px` und 20×20-Avataren. Anlegen-Kachel `border:1.5px dashed var(--line)`.

Darunter die Karte „Zuletzt erledigt" (Z. 307–310).

Zellenname für Screenreader: `` `${titel}, ${offen} offen` `` — die Vorlage liest Titel und Zahl getrennt vor.

- [ ] **Step 6: `TodoDetail` implementieren**

Vorlage Z. 315–356: Filterleiste als waagerecht scrollende `Chip`-Reihe; Liste in einer `Card flush` mit Zeilen `padding:14px 15px`, Kästchen 22×22 Radius 8, Text `font-size:14px`, Notiz `font-size:10.5px` in `--ink-400`, Avatar 24×24; darunter „+ Eintrag hinzufügen" als `Button variant="ghost"`; dann der Erledigt-Aufklapper (`Card` auf `--surface-2`) mit `aria-expanded`; zuletzt die Metazeile.

Auch hier echte Checkboxen statt Knöpfe. Das lange Drücken zum Bearbeiten kommt in Task 22 mit dem Item-Sheet; hier bleibt es beim Abhaken.

- [ ] **Step 7: Router und Header verdrahten**

`/todos` → `TodoOverview`, `/todos/:listId` → `TodoDetail` unter einer gemeinsamen Elternroute mit `TodoStoreProvider`. Der Header bekommt bei einer geöffneten Liste `onBack` (Vorlage Z. 1587–1588) und als Kicker `` `${offen} offen · geteilt mit …` ``.

- [ ] **Step 8: Tests laufen lassen und committen**

Run: `npx vitest run apps/app/src/screens/todos`
Expected: PASS, 11 Tests

```bash
git add apps/app
git commit -m "feat(app): Todo-Uebersicht und -Detail mit gemeinsamem Zustand

Der Zustand liegt in einer Elternroute, damit Abhaken im Detail beim
Zurueckgehen erhalten bleibt."
```

---

## Task 20: Geld

**Files:**
- Create: `apps/app/src/screens/money/MoneyScreen.tsx` + `.module.css`
- Create: `apps/app/src/screens/money/money-math.ts`
- Create: `apps/app/src/screens/money/money-math.test.ts`
- Create: `apps/app/src/screens/money/MoneyScreen.test.tsx`
- Modify: `apps/app/src/routes/router.tsx`, `apps/app/src/i18n/additions.json`

**Interfaces:**
- Consumes: Task 8 (`Card`, `ProgressBar`, `SectionLabel`), Task 15
- Produces:
  - `function formatEur(value: number, lang: Lang): string` — `de-DE` bzw. `en-GB`, immer zwei Dezimalstellen
  - `function categoryTotals(categories: readonly MockCategory[]): { name: string; limit: number; spent: number; pct: number; segments: { widthPct: number; color: string }[] }[]`
  - `function budgetSummary(categories, budget): { spent: number; pct: number; remaining: number }`
  - `function MoneyScreen(): React.JSX.Element`

- [ ] **Step 1: Test für die Rechnung schreiben**

Die Arithmetik zuerst, getrennt von der Darstellung — sie ist die einzige Stelle im Screen, die falsch rechnen kann.

```ts
import { describe, expect, it } from 'vitest';
import { budgetSummary, categoryTotals, formatEur } from './money-math.js';

const categories = [
  { name: 'Wohnen', limit: 800, shares: { u1: 780, u2: 0, both: 0 } },
  { name: 'Freizeit', limit: 300, shares: { u1: 52.2, u2: 42, both: 120 } },
] as const;

describe('formatEur', () => {
  it('formatiert deutsch mit zwei Dezimalstellen', () => {
    expect(formatEur(1024.1, 'de')).toBe('1.024,10 €');
    expect(formatEur(0, 'de')).toBe('0,00 €');
  });

  it('formatiert englisch', () => {
    expect(formatEur(1024.1, 'en')).toContain('1,024.10');
  });
});

describe('categoryTotals', () => {
  it('summiert die Anteile je Kategorie', () => {
    const [wohnen, freizeit] = categoryTotals(categories);
    expect(wohnen?.spent).toBeCloseTo(780);
    expect(freizeit?.spent).toBeCloseTo(214.2);
  });

  it('rechnet den Prozentsatz gegen das Limit', () => {
    const [wohnen] = categoryTotals(categories);
    expect(wohnen?.pct).toBeCloseTo(97.5);
  });

  it('erzeugt ein Segment je Person mit Anteil über null', () => {
    const [wohnen, freizeit] = categoryTotals(categories);
    expect(wohnen?.segments).toHaveLength(1);
    expect(freizeit?.segments).toHaveLength(3);
  });

  it('gibt Segmentbreiten relativ zum Limit an', () => {
    const [wohnen] = categoryTotals(categories);
    expect(wohnen?.segments[0]?.widthPct).toBeCloseTo(97.5);
  });

  it('deckelt bei Überschreitung auf 100 Prozent', () => {
    const over = [{ name: 'X', limit: 100, shares: { u1: 150, u2: 0, both: 0 } }] as const;
    expect(categoryTotals(over)[0]?.pct).toBe(100);
  });

  it('kommt mit Limit null ohne Division durch null zurecht', () => {
    const zero = [{ name: 'X', limit: 0, shares: { u1: 10, u2: 0, both: 0 } }] as const;
    expect(categoryTotals(zero)[0]?.pct).toBe(100);
  });
});

describe('budgetSummary', () => {
  it('summiert alle Kategorien', () => {
    const summary = budgetSummary(categories, 2400);
    expect(summary.spent).toBeCloseTo(994.2);
    expect(summary.remaining).toBeCloseTo(1405.8);
    expect(summary.pct).toBeCloseTo(41.425);
  });

  it('meldet bei Überschreitung null übrig statt negativ', () => {
    expect(budgetSummary(categories, 500).remaining).toBe(0);
  });
});
```

- [ ] **Step 2: Test für den Screen schreiben**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { MoneyScreen } from './MoneyScreen.js';

describe('MoneyScreen', () => {
  it('zeigt das Budget mit Fortschritt', () => {
    render(<MoneyScreen />);
    expect(screen.getByRole('progressbar', { name: /Budget/ })).toBeInTheDocument();
  });

  it('zeigt fünf Kategorien mit segmentiertem Balken', () => {
    render(<MoneyScreen />);
    expect(screen.getAllByTestId('category-row')).toHaveLength(5);
  });

  it('zeigt die Bilanz beider Personen', () => {
    render(<MoneyScreen />);
    expect(screen.getByText('Jonas')).toBeInTheDocument();
    expect(screen.getByText('Lena')).toBeInTheDocument();
  });

  it('bucht den Ausgleich und wechselt die Beschriftung', async () => {
    render(<MoneyScreen />);
    const button = screen.getByRole('button', { name: 'Ausgleich buchen' });
    await userEvent.click(button);
    expect(screen.getByRole('button', { name: /Ausgleich notiert/ })).toBeInTheDocument();
  });

  it('listet die letzten Ausgaben', () => {
    render(<MoneyScreen />);
    expect(screen.getAllByTestId('expense-row')).toHaveLength(7);
    expect(screen.getByText('Rewe Großeinkauf')).toBeInTheDocument();
  });

  it('zeigt Beträge in Euro', () => {
    render(<MoneyScreen />);
    expect(screen.getByText('780,00 €')).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Tests laufen lassen — sie müssen fehlschlagen**

Run: `npx vitest run apps/app/src/screens/money`
Expected: FAIL

- [ ] **Step 4: `money-math.ts` implementieren**

Regel aus Vorlage Z. 1413–1458. Segmentfarben über `personTokens`, nie als Literal. Division durch null ergibt 100 Prozent, wenn ausgegeben wurde, sonst 0.

- [ ] **Step 5: `MoneyScreen` implementieren**

Vorlage Z. 360–439, vier Blöcke:
1. Budgetkarte: `SectionLabel` „Budget <Monat>", Betrag `font-size:27px` mit `letter-spacing:-.5px`, `ProgressBar height={9}`, Restzeile `font-size:11.5px`
2. Kategorien: Legende mit drei Punkten, je Kategorie eine Karte Radius 15 mit Name/Betrag/Limit und `ProgressBar height={7}` mit Segmenten
3. Bilanz: `Card tone="brand"` mit zwei Personenkarten (Radius 14) und der Schuldzeile, darunter der Ausgleichsknopf
4. Letzte Ausgaben: `Card flush` mit Zeilen aus Plakette 26×26 Radius 9, Titel, Meta und Betrag

- [ ] **Step 6: Tests laufen lassen und committen**

Run: `npx vitest run apps/app/src/screens/money`
Expected: PASS, 15 Tests

```bash
git add apps/app
git commit -m "feat(app): Geld-Screen mit Budget, Kategorien, Bilanz und Ausgaben

Die Arithmetik liegt getrennt in money-math.ts und ist einzeln getestet -
inklusive Division durch null und Ueberschreitung des Limits."
```

---

## Task 21: Einstellungen

Der erste Screen, der echte Funktion trägt: hier hängen Theme- und Sprachumschaltung, also zwei der Abnahmekriterien.

**Files:**
- Create: `apps/app/src/screens/settings/SettingsScreen.tsx` + `.module.css`
- Create: `apps/app/src/screens/settings/SettingsScreen.test.tsx`
- Modify: `apps/app/src/routes/router.tsx`, `apps/app/src/i18n/additions.json`

**Interfaces:**
- Consumes: Task 4 (`useTheme`), Task 7 (`Toggle`, `SegmentSwitch`, `Button`), Task 8 (`Card`, `ListRow`, `Avatar`, `SectionLabel`), Task 9 (`useToast`), Task 13 (`useT`)
- Produces: `function SettingsScreen(): React.JSX.Element`

- [ ] **Step 1: Tests schreiben**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { THEME_ATTRIBUTE, THEME_STORAGE_KEY, ThemeProvider, ToastProvider } from '@ralia/ui';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../i18n/I18nProvider.js';
import { LANG_STORAGE_KEY } from '../../i18n/catalog.js';
import { SettingsScreen } from './SettingsScreen.js';

function renderScreen() {
  vi.stubGlobal('matchMedia', () => ({
    matches: false, media: '', addEventListener() {}, removeEventListener() {},
  }));
  return render(
    <MemoryRouter>
      <ThemeProvider>
        <I18nProvider>
          <ToastProvider>
            <SettingsScreen />
          </ToastProvider>
        </I18nProvider>
      </ThemeProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute(THEME_ATTRIBUTE);
});

describe('SettingsScreen', () => {
  it('zeigt Profilkarte und drei Kennzahlen', () => {
    renderScreen();
    expect(screen.getByText('Jonas Berger')).toBeInTheDocument();
    expect(screen.getAllByTestId('profile-stat')).toHaveLength(3);
  });

  it('schaltet das Theme auf dunkel und speichert es', async () => {
    renderScreen();
    await userEvent.click(screen.getByRole('switch', { name: /Dark Mode/ }));
    expect(document.documentElement.getAttribute(THEME_ATTRIBUTE)).toBe('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });

  it('schaltet das Theme wieder zurück', async () => {
    renderScreen();
    const toggle = screen.getByRole('switch', { name: /Dark Mode/ });
    await userEvent.click(toggle);
    await userEvent.click(screen.getByRole('switch', { name: /Dark Mode/ }));
    expect(document.documentElement.hasAttribute(THEME_ATTRIBUTE)).toBe(false);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });

  it('wechselt die Sprache auf Englisch', async () => {
    renderScreen();
    // Vorher steht die Abschnittsüberschrift auf Deutsch da.
    expect(screen.getByText('Persönlich')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: 'EN' }));
    expect(localStorage.getItem(LANG_STORAGE_KEY)).toBe('en');
    // Der Screen-Titel lebt im AppHeader, nicht hier — geprüft wird eine
    // Beschriftung, die dieser Screen selbst rendert.
    expect(screen.queryByText('Persönlich')).toBeNull();
    expect(screen.getByText('Personal')).toBeInTheDocument();
  });

  it('zeigt den Einladungscode', () => {
    renderScreen();
    expect(screen.getByText('R7K2QM')).toBeInTheDocument();
  });

  it('meldet das Kopieren des Codes per Toast', async () => {
    const writeText = vi.fn(async () => {});
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    renderScreen();
    await userEvent.click(screen.getByRole('button', { name: /Kopieren/ }));
    expect(writeText).toHaveBeenCalledWith('R7K2QM');
    expect(await screen.findByRole('status')).toBeInTheDocument();
  });

  it('schaltet den Wochenstart um', async () => {
    renderScreen();
    await userEvent.click(screen.getByRole('radio', { name: 'So' }));
    expect(screen.getByRole('radio', { name: 'So' })).toBeChecked();
  });

  it('führt zur Sync-Unterseite', () => {
    renderScreen();
    expect(screen.getByRole('button', { name: /Kalender & Konflikte verwalten/ })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Tests laufen lassen — sie müssen fehlschlagen**

Run: `npx vitest run apps/app/src/screens/settings`
Expected: FAIL

- [ ] **Step 3: `SettingsScreen` implementieren**

Vorlage Z. 443–563, sechs Blöcke:

1. **Profilkarte** (Z. 444–467): `Avatar` 52 px Radius 18, Name `font-size:15px`, E-Mail `font-size:11.5px`, „Bearbeiten"-Knopf; darunter drei Kennzahlen im `repeat(3,...)`-Raster auf `--surface-2`, Radius 13, Zahl `font-size:17px`, Beschriftung `font-size:10px`. Jede Kennzahl trägt `data-testid="profile-stat"`.
2. **Partner** (Z. 469–495): Partnerzeile mit „verbunden seit …" in `--ok` und „Trennen" als `Button variant="danger"`; darunter der Einladungscode `font-size:21px`, `letter-spacing:4px`, `font-variant-numeric:tabular-nums` in `--brand-600`, daneben der QR-Platzhalter 66×66 mit `border:1px dashed`; drei Knöpfe Kopieren/Teilen/Neuer Code.
3. **Persönlich** (Z. 497–533): `ListRow` für Geburtstag; `ListRow` mit `Toggle` für Dark Mode, beschriftet nach `useTheme().resolved`; `ListRow` mit `Toggle` für Push-Erinnerungen; `ListRow` mit `SegmentSwitch` `Mo | So` für den Wochenstart.

Jede Abschnittsüberschrift braucht einen i18n-Schlüssel in `additions.json` — die Vorlage hat sie nur deutsch hartcodiert. Mindestens: `settingsPartner` (Partner / Partner), `settingsPersonal` (Persönlich / Personal), `settingsGoogle` (Google Kalender / Google Calendar), `settingsLanguage` (Sprache / Language). Der Test in Step 1 prüft den Wechsel an `settingsPersonal`, weil der Screen-Titel im `AppHeader` liegt und hier nicht mitgerendert wird.
4. **Sprache** — in der Vorlage nicht vorhanden, aus der Sprache abgeleitet: eine `ListRow` mit `SegmentSwitch` `DE | EN`, gebaut wie der Wochenstart-Schalter. Abnahmekriterium 7 verlangt eine erreichbare Umschaltung.
5. **Google Kalender** (Z. 535–560): Zeile „Verbunden" mit `Toggle`, zwei Knöpfe Importieren/Exportieren, darunter die klickbare `ListRow` „Kalender & Konflikte verwalten", die auf `/profil/sync` navigiert.
6. **Fußzeile** (Z. 562): `font-size:10.5px`, zentriert, `--ink-400`.

Der Dark-Mode-`Toggle` bildet `resolved === 'dark'` ab und setzt beim Umschalten explizit `'dark'` bzw. `'light'` — nicht `'system'`. Wer `system` will, hat es als Ausgangszustand; ein Dreizustands-Schalter ist in der Vorlage nicht vorgesehen und wäre eine Design-Erfindung.

Beim Kopieren `navigator.clipboard.writeText` in `try/catch` und in beiden Fällen einen Toast: Erfolg oder Hinweis, den Code abzuschreiben.

- [ ] **Step 4: Tests laufen lassen und committen**

Run: `npx vitest run apps/app/src/screens/settings`
Expected: PASS, 8 Tests

```bash
git add apps/app
git commit -m "feat(app): Einstellungen mit Theme- und Sprachumschaltung

Die Sprachumschaltung fehlt in der Vorlage und ist aus deren Bausteinen
abgeleitet - Abnahmekriterium 7 verlangt sie erreichbar."
```

---

## Task 22: Google-Sync-Unterseite

**Files:**
- Create: `apps/app/src/screens/settings/SyncScreen.tsx` + `.module.css`
- Create: `apps/app/src/screens/settings/SyncScreen.test.tsx`
- Modify: `apps/app/src/routes/router.tsx`, `apps/app/src/i18n/additions.json`

**Interfaces:**
- Consumes: Task 7, Task 8, Task 11 (`AppHeader` mit `onBack`)
- Produces: `function SyncScreen(): React.JSX.Element`

- [ ] **Step 1: Tests schreiben**

```tsx
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { routes } from '../../routes/router.js';

function renderSync() {
  return render(
    <RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/profil/sync'] })} />,
  );
}

describe('SyncScreen', () => {
  it('zeigt zwei verbundene Konten', async () => {
    renderSync();
    expect(await screen.findAllByTestId('sync-account')).toHaveLength(2);
  });

  it('zeigt fünf Kalender mit Schaltern', async () => {
    renderSync();
    // Nur die fünf Kalender: der Auto-Sync-Schalter sitzt in den
    // Einstellungen, nicht hier (Vorlage Z. 542 gegen Z. 594–604).
    expect(await screen.findAllByRole('switch')).toHaveLength(5);
  });

  it('schaltet einen Kalender aus', async () => {
    renderSync();
    const [first] = await screen.findAllByRole('switch');
    expect(first).toBeChecked();
    await userEvent.click(first!);
    expect(screen.getAllByRole('switch')[0]).not.toBeChecked();
  });

  it('bietet die drei Sync-Richtungen als Radiogruppe an', async () => {
    renderSync();
    const group = await screen.findByRole('radiogroup', { name: 'Richtung' });
    expect(within(group).getAllByRole('radio')).toHaveLength(3);
  });

  it('wechselt die Sync-Richtung mit den Pfeiltasten', async () => {
    renderSync();
    const group = await screen.findByRole('radiogroup', { name: 'Richtung' });
    const checked = within(group).getAllByRole('radio').find((r) => r.getAttribute('aria-checked') === 'true');
    checked!.focus();
    await userEvent.keyboard('{ArrowDown}');
    const nowChecked = within(group).getAllByRole('radio').filter((r) => r.getAttribute('aria-checked') === 'true');
    expect(nowChecked).toHaveLength(1);
    expect(nowChecked[0]).not.toBe(checked);
  });

  it('zeigt den offenen Konflikt mit beiden Fassungen', async () => {
    renderSync();
    expect(await screen.findByText(/auf beiden Seiten geändert/)).toBeInTheDocument();
    expect(screen.getByText('09:00 – 10:00')).toBeInTheDocument();
    expect(screen.getByText('09:30 – 10:30')).toBeInTheDocument();
  });

  it('löst den Konflikt und zeigt die Bestätigung mit Rückgängig', async () => {
    renderSync();
    await userEvent.click(await screen.findByRole('button', { name: 'Ralia behalten' }));
    expect(await screen.findByRole('button', { name: 'Rückgängig' })).toBeInTheDocument();
    expect(screen.queryByText(/auf beiden Seiten geändert/)).toBeNull();
  });

  it('nimmt die Konfliktlösung zurück', async () => {
    renderSync();
    await userEvent.click(await screen.findByRole('button', { name: 'Google übernehmen' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Rückgängig' }));
    expect(await screen.findByText(/auf beiden Seiten geändert/)).toBeInTheDocument();
  });

  it('zeigt das Protokoll', async () => {
    renderSync();
    expect(await screen.findAllByTestId('sync-log-row')).toHaveLength(4);
  });

  it('kehrt über Zurück zu den Einstellungen', async () => {
    renderSync();
    await userEvent.click(await screen.findByRole('button', { name: 'Zurück' }));
    expect(await screen.findByText('Jonas Berger')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Tests laufen lassen — sie müssen fehlschlagen**

Run: `npx vitest run apps/app/src/screens/settings/SyncScreen.test.tsx`
Expected: FAIL

- [ ] **Step 3: `SyncScreen` implementieren**

Vorlage Z. 567–678, sechs Blöcke: Statuskarte mit „G"-Plakette und Sync-Knopf; verbundene Konten; Kalenderliste mit Farbpunkt und Schalter (44×25, Knopf 19 px — kleiner als der Standard-`Toggle`, also über eine `size`-Variante); Richtungsauswahl als Radiogruppe mit `border:1.5px solid` und Radiopunkt 19 px; Konfliktkarte `Card tone="warn"` mit zwei Gegenüberstellungen und zwei Knöpfen; Protokoll mit Zeitspalte `min-width:80px` und `font-variant-numeric:tabular-nums`.

Die Richtungsauswahl der Vorlage ist eine Liste von Knöpfen mit Punktmarkierung — hier als echte Radiogruppe (`role="radiogroup"` plus `role="radio"`), damit Pfeiltasten funktionieren. Optik unverändert.

Der Konflikt hat drei Zustände (`open` → `done` → zurück auf `open`), wie in der Vorlage (Z. 635–666).

Alle Fixtures dieses Screens (Konten, Kalender, Protokoll, Konflikt) nach `apps/app/src/mock/fixtures.ts` verschieben, damit der Screen keine Literale trägt — Vorlage Z. 1072 (`cals`) und die `syncAccounts`/`syncLog`/`syncDirs`-Blöcke.

- [ ] **Step 4: Tests laufen lassen und committen**

Run: `npx vitest run apps/app/src/screens/settings`
Expected: PASS, 18 Tests (8 aus Task 21, 10 hier)

```bash
git add apps/app
git commit -m "feat(app): Google-Sync-Unterseite mit Konfliktaufloesung

Die Richtungsauswahl ist eine echte Radiogruppe statt einer Knopfliste -
gleiche Optik, aber mit Pfeiltasten bedienbar."
```

---

## Task 23: Sheets der Kalender-Familie

Drei Sheets: `day`, `new`, `event`. Sie hängen zusammen — aus dem Tages-Sheet führt langes Drücken ins Event-Sheet, und der FAB öffnet das Neu-Sheet mit dem gewählten Tag.

**Files:**
- Create: `apps/app/src/sheets/DaySheet.tsx`
- Create: `apps/app/src/sheets/NewEventSheet.tsx`
- Create: `apps/app/src/sheets/EventSheet.tsx`
- Create: `apps/app/src/sheets/use-long-press.ts`
- Create: `apps/app/src/sheets/sheets.module.css` — die gemeinsamen Formularmaße
- Create: `apps/app/src/sheets/calendar-sheets.test.tsx`
- Modify: `apps/app/src/screens/calendar/CalendarScreen.tsx`

**Interfaces:**
- Consumes: Task 10 (`BottomSheet`), Task 7/8 (Primitive), Task 15
- Produces:
  - `function useLongPress(onLongPress: () => void, delayMs?: number): { onPointerDown; onPointerUp; onPointerLeave; onClickCapture }` — Standard 480 ms wie in der Vorlage (Z. 1194)
  - `function DaySheet(props: { open: boolean; iso: string | null; events: readonly MockEvent[]; onClose(): void; onEdit(event: MockEvent): void; onAdd(): void })`
  - `function NewEventSheet(props: { open: boolean; defaultIso: string; onClose(): void; onSave(draft: EventDraft): void })`
  - `function EventSheet(props: { open: boolean; event: MockEvent | null; onClose(): void; onSave(next: MockEvent): void; onDelete(): void })`
  - `interface EventDraft { title: string; iso: string; time: string; slot: PersonSlot; toGoogle: boolean }`

- [ ] **Step 1: Tests schreiben**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { MOCK_EVENTS, MOCK_TODAY } from '../mock/fixtures.js';
import { DaySheet } from './DaySheet.js';
import { NewEventSheet } from './NewEventSheet.js';

describe('DaySheet', () => {
  it('listet die Termine des Tages nach Zeit', () => {
    render(
      <DaySheet open iso={MOCK_TODAY} events={MOCK_EVENTS}
        onClose={() => {}} onEdit={() => {}} onAdd={() => {}} />,
    );
    const titles = screen.getAllByTestId('day-event').map((el) => el.textContent ?? '');
    expect(titles[0]).toContain('Zahnarzt');
    expect(titles[2]).toContain('Abendessen Marco');
  });

  it('nennt heute im Kicker', () => {
    render(
      <DaySheet open iso={MOCK_TODAY} events={MOCK_EVENTS}
        onClose={() => {}} onEdit={() => {}} onAdd={() => {}} />,
    );
    expect(screen.getByText('Heute')).toBeInTheDocument();
  });

  it('zeigt an einem leeren Tag den Hinweis der Vorlage', () => {
    render(
      <DaySheet open iso="2026-07-02" events={MOCK_EVENTS}
        onClose={() => {}} onEdit={() => {}} onAdd={() => {}} />,
    );
    expect(screen.getByText('Keine Termine an diesem Tag')).toBeInTheDocument();
  });

  it('öffnet nach langem Drücken das Bearbeiten', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const onEdit = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <DaySheet open iso={MOCK_TODAY} events={MOCK_EVENTS}
        onClose={() => {}} onEdit={onEdit} onAdd={() => {}} />,
    );
    const [first] = screen.getAllByTestId('day-event');
    await user.pointer({ target: first!, keys: '[MouseLeft>]' });
    act(() => void vi.advanceTimersByTime(500));
    expect(onEdit).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it('meldet einen kurzen Tipp nicht als lange gedrückt', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const onEdit = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <DaySheet open iso={MOCK_TODAY} events={MOCK_EVENTS}
        onClose={() => {}} onEdit={onEdit} onAdd={() => {}} />,
    );
    await user.click(screen.getAllByTestId('day-event')[0]!);
    expect(onEdit).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('meldet Termin hinzufügen', async () => {
    const onAdd = vi.fn();
    render(
      <DaySheet open iso={MOCK_TODAY} events={MOCK_EVENTS}
        onClose={() => {}} onEdit={() => {}} onAdd={onAdd} />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Termin hinzufügen' }));
    expect(onAdd).toHaveBeenCalledOnce();
  });
});

describe('NewEventSheet', () => {
  it('übernimmt den gewählten Tag als Vorgabe', () => {
    render(<NewEventSheet open defaultIso="2026-07-31" onClose={() => {}} onSave={() => {}} />);
    expect(screen.getByLabelText('Datum')).toHaveValue('2026-07-31');
  });

  it('sammelt Titel, Zeit, Zuordnung und Google-Schalter', async () => {
    const onSave = vi.fn();
    render(<NewEventSheet open defaultIso="2026-07-31" onClose={() => {}} onSave={onSave} />);
    await userEvent.type(screen.getByLabelText('Titel'), 'Kino');
    await userEvent.click(screen.getByRole('button', { name: 'Beide' }));
    await userEvent.click(screen.getByRole('switch', { name: /Google/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Kino', slot: 'both', toGoogle: false }),
    );
  });

  it('speichert nicht ohne Titel', async () => {
    const onSave = vi.fn();
    render(<NewEventSheet open defaultIso="2026-07-31" onClose={() => {}} onSave={onSave} />);
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Titel')).toHaveAccessibleDescription(/Titel/i);
  });

  it('hat genau eine Zuordnung gleichzeitig gedrückt', async () => {
    render(<NewEventSheet open defaultIso="2026-07-31" onClose={() => {}} onSave={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: 'Jonas' }));
    const pressed = ['Jonas', 'Lena', 'Beide']
      .map((n) => screen.getByRole('button', { name: n }))
      .filter((b) => b.getAttribute('aria-pressed') === 'true');
    expect(pressed).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Tests laufen lassen — sie müssen fehlschlagen**

Run: `npx vitest run apps/app/src/sheets`
Expected: FAIL

- [ ] **Step 3: `use-long-press.ts` implementieren**

Vorlage Z. 1189–1196: 480 ms Schwelle, Timer bei `pointerup` und `pointerleave` löschen. Ergänzung gegenüber der Vorlage: nach dem Auslösen muss der folgende `click` unterdrückt werden, sonst würde ein langes Drücken zusätzlich das Abhaken auslösen. Dafür ein `ref`-Merker und `onClickCapture` mit `stopPropagation()`.

```ts
export function useLongPress(onLongPress: () => void, delayMs = 480) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fired = useRef(false);

  const clear = () => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  };

  useEffect(() => clear, []);

  return {
    onPointerDown: () => {
      fired.current = false;
      clear();
      timer.current = setTimeout(() => {
        fired.current = true;
        onLongPress();
      }, delayMs);
    },
    onPointerUp: clear,
    onPointerLeave: clear,
    onClickCapture: (event: React.MouseEvent) => {
      if (fired.current) {
        event.preventDefault();
        event.stopPropagation();
        fired.current = false;
      }
    },
  };
}
```

- [ ] **Step 4: `sheets.module.css` schreiben**

Die Formularmaße, die alle acht Sheets teilen (Vorlage Z. 749–780): Feldstapel `display:flex; flex-direction:column; gap:11px; margin-top:15px`; Zeile mit zwei Feldern `display:flex; gap:10px`, das schmale Feld je nach Sheet `width:104px`, `110px` oder `112px`; Knopfzeile `display:flex; gap:9px; margin-top:2px`; Personenwahl `display:flex; gap:8px; margin-top:7px`.

- [ ] **Step 5: `DaySheet` implementieren**

Vorlage Z. 711–739. `BottomSheet maxHeight="78%"`, Kicker aus Vorlage Z. 1511 („Heute" oder Wochentag plus „tag"), Titel als ausgeschriebenes Datum. Termine nach Startzeit sortiert; Zeile `padding:12px`, Radius 14, `border-left:3px solid`, Zeit `min-width:44px` mit `font-variant-numeric:tabular-nums`, Titel `font-size:13.5px`, Untertitel `font-size:11px`. Hinweiszeile „Lange drücken zum Bearbeiten oder Löschen" (Z. 736), darunter der Knopf „Termin hinzufügen".

Jede Terminzeile trägt `data-testid="day-event"` und die `useLongPress`-Handler. Ganztägige Termine zeigen statt der Zeit eine Kennzeichnung — die Vorlage lässt das Feld leer, was in einer Liste sortierter Zeiten verwirrt.

- [ ] **Step 6: `NewEventSheet` und `EventSheet` implementieren**

`NewEventSheet` aus Vorlage Z. 984–1025: Titel, Datum plus Zeit in einer Zeile, drei `PersonChip` für „Gilt für", eine `ListRow` mit `Toggle` für den Google-Export, Speichern-Knopf. `maxHeight="88%"`.

`EventSheet` aus Vorlage Z. 742–782: wie oben, zusätzlich ein Ort-Feld, und die Knopfzeile hat links „Löschen" als `Button variant="danger"`. `maxHeight="90%"`.

Beide: jedes Feld über `useId` mit seinem `FieldLabel` verbunden. Leerer Titel verhindert das Speichern und setzt `aria-describedby` auf eine Fehlermeldung — die Vorlage speichert dann still den alten Titel weiter (Z. 1555), was ein Fehler ist.

- [ ] **Step 7: An `CalendarScreen` anschließen**

Ein `sheet`-Zustand vom Typ `{ kind: 'day' | 'new' | 'event'; iso?: string; event?: MockEvent } | null`. Zellklick in Monat und Woche öffnet `day`; der FAB öffnet `new` mit dem gewählten oder dem heutigen Tag; langes Drücken im Tages-Sheet öffnet `event`. Beim Schließen von `event` geht es zurück auf `day`, wie in der Vorlage (Z. 1559).

Änderungen wirken auf einen lokalen `useState`-Abzug der Fixtures, damit die Interaktion sichtbar ist.

- [ ] **Step 8: Tests laufen lassen und committen**

Run: `npx vitest run apps/app/src/sheets`
Expected: PASS, 10 Tests

```bash
git add apps/app
git commit -m "feat(app): Tages-, Neu- und Event-Sheet mit langem Druecken

Nach langem Druecken wird der folgende Klick unterdrueckt - sonst loest
dieselbe Geste zusaetzlich die Kurzaktion aus. Leerer Titel verhindert das
Speichern; die Vorlage schrieb dort still den alten Titel zurueck."
```

---

## Task 24: Sheets der Organizer-Familie

Fünf Sheets: `todo`, `item`, `plan`, `expense`, `profile`.

**Files:**
- Create: `apps/app/src/sheets/TodoSheet.tsx`, `ItemSheet.tsx`, `PlanSheet.tsx`, `ExpenseSheet.tsx`, `ProfileSheet.tsx`
- Create: `apps/app/src/sheets/organizer-sheets.test.tsx`
- Modify: `apps/app/src/screens/todos/TodoDetail.tsx`, `apps/app/src/screens/planner/PlannerScreen.tsx`, `apps/app/src/screens/money/MoneyScreen.tsx`, `apps/app/src/screens/settings/SettingsScreen.tsx`

**Interfaces:**
- Consumes: Task 10, Task 23 (`useLongPress`, `sheets.module.css`)
- Produces:
  - `function TodoSheet(props: { open: boolean; lists; defaultListId: string; existing: readonly MockTodoItem[]; onClose(); onSave(draft) })` — mit Duplikatwarnung
  - `function ItemSheet(props: { open: boolean; item: MockTodoItem | null; onClose(); onSave(next); onDelete() })`
  - `function PlanSheet(props: { open: boolean; onClose(); onSave(draft) })` — Umschaltung Mahlzeit/Aufgabe
  - `function ExpenseSheet(props: { open: boolean; categories; onClose(); onSave(draft) })`
  - `function ProfileSheet(props: { open: boolean; profile; onClose(); onSave(next) })`

- [ ] **Step 1: Tests schreiben**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MOCK_CATEGORIES, MOCK_TODOS, MOCK_TODO_LISTS } from '../mock/fixtures.js';
import { ExpenseSheet } from './ExpenseSheet.js';
import { PlanSheet } from './PlanSheet.js';
import { TodoSheet } from './TodoSheet.js';

function renderTodoSheet(onSave = vi.fn()) {
  render(
    <TodoSheet open lists={MOCK_TODO_LISTS} defaultListId="einkauf"
      existing={MOCK_TODOS} onClose={() => {}} onSave={onSave} />,
  );
  return onSave;
}

describe('TodoSheet', () => {
  it('bietet jede Liste als Chip an', () => {
    renderTodoSheet();
    expect(screen.getAllByTestId('list-chip')).toHaveLength(3);
  });

  it('warnt bei einem offenen Duplikat und ändert die Knopfbeschriftung', async () => {
    renderTodoSheet();
    await userEvent.type(screen.getByLabelText('Eintrag'), 'Haferflocken');
    expect(screen.getByRole('alert')).toHaveTextContent(/steht schon offen/);
    expect(screen.getByRole('button', { name: 'Vorhandenen Eintrag anzeigen' })).toBeInTheDocument();
  });

  it('warnt bei einem erledigten Duplikat mit anderem Text', async () => {
    renderTodoSheet();
    await userEvent.type(screen.getByLabelText('Eintrag'), 'Spülmaschinentabs');
    expect(screen.getByRole('alert')).toHaveTextContent(/bereits erledigt/);
    expect(screen.getByRole('button', { name: 'Eintrag wieder öffnen' })).toBeInTheDocument();
  });

  it('erkennt Duplikate unabhängig von Groß- und Kleinschreibung', async () => {
    renderTodoSheet();
    await userEvent.type(screen.getByLabelText('Eintrag'), '  HAFERFLOCKEN ');
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('speichert einen neuen Eintrag', async () => {
    const onSave = renderTodoSheet();
    await userEvent.type(screen.getByLabelText('Eintrag'), 'Olivenöl');
    await userEvent.type(screen.getByLabelText('Notiz'), '1 l');
    await userEvent.click(screen.getByRole('button', { name: 'Zur Liste hinzufügen' }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'Olivenöl', note: '1 l', listId: 'einkauf' }),
    );
  });
});

describe('PlanSheet', () => {
  it('wechselt zwischen Mahlzeit und Aufgabe und zeigt die Personenwahl nur bei Aufgabe', async () => {
    render(<PlanSheet open onClose={() => {}} onSave={() => {}} />);
    expect(screen.queryByText('Wer macht es?')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Aufgabe' }));
    expect(screen.getByText('Wer macht es?')).toBeInTheDocument();
  });

  it('bietet sieben Tage zur Wahl', () => {
    render(<PlanSheet open onClose={() => {}} onSave={() => {}} />);
    expect(screen.getAllByTestId('plan-day-chip')).toHaveLength(7);
  });
});

describe('ExpenseSheet', () => {
  it('bietet Kategorien, Zahler und Aufteilung an', () => {
    render(
      <ExpenseSheet open categories={MOCK_CATEGORIES} onClose={() => {}} onSave={() => {}} />,
    );
    expect(screen.getAllByTestId('category-chip')).toHaveLength(5);
    expect(screen.getByRole('button', { name: 'Gem. Konto' })).toBeInTheDocument();
    expect(screen.getAllByTestId('split-chip')).toHaveLength(3);
  });

  it('speichert nicht ohne Betrag', async () => {
    const onSave = vi.fn();
    render(
      <ExpenseSheet open categories={MOCK_CATEGORIES} onClose={() => {}} onSave={onSave} />,
    );
    await userEvent.type(screen.getByLabelText('Beschreibung'), 'Rewe');
    await userEvent.click(screen.getByRole('button', { name: 'Ausgabe speichern' }));
    expect(onSave).not.toHaveBeenCalled();
  });

  it('speichert mit Beschreibung und Betrag', async () => {
    const onSave = vi.fn();
    render(
      <ExpenseSheet open categories={MOCK_CATEGORIES} onClose={() => {}} onSave={onSave} />,
    );
    await userEvent.type(screen.getByLabelText('Beschreibung'), 'Rewe');
    await userEvent.type(screen.getByLabelText(/Betrag/), '42.50');
    await userEvent.click(screen.getByRole('button', { name: 'Ausgabe speichern' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ amount: 42.5 }));
  });
});
```

- [ ] **Step 2: Tests laufen lassen — sie müssen fehlschlagen**

Run: `npx vitest run apps/app/src/sheets/organizer-sheets.test.tsx`
Expected: FAIL

- [ ] **Step 3: `TodoSheet` implementieren**

Vorlage Z. 859–898. Die Duplikaterkennung ist die einzige Logik hier und stammt aus Z. 1582–1584: Vergleich innerhalb der gewählten Liste, getrimmt und ohne Groß-/Kleinschreibung. Drei Zustände für die Knopfbeschriftung — kein Treffer „Zur Liste hinzufügen", offener Treffer „Vorhandenen Eintrag anzeigen", erledigter Treffer „Eintrag wieder öffnen".

Die Warnung als `Card tone="warn"` mit `role="alert"`; die Vorlage nutzt nur eine gefärbte Box, die Screenreader nicht ankündigen.

Die Vergleichsfunktion in `apps/app/src/sheets/todo-duplicate.ts` auslagern und dort mitgetestet — sie ist reine Logik.

- [ ] **Step 4: `ItemSheet` implementieren**

Vorlage Z. 785–816: Text plus Notiz in einer Zeile, zwei `PersonChip` für „Zugewiesen an", Löschen und Speichern. Kein `maxHeight` (die Vorlage begrenzt dieses Sheet nicht) — also `maxHeight="none"`.

- [ ] **Step 5: `PlanSheet` implementieren**

Vorlage Z. 819–856: oben zwei `PersonChip`-artige Umschalter Mahlzeit/Aufgabe, dann sieben Tages-Chips, ein Textfeld mit wechselnder Beschriftung und Platzhalter, bei „Aufgabe" zusätzlich drei `PersonChip`. Die Umschalter sind kein `SegmentSwitch`, weil die Vorlage sie als große Chips zeigt.

- [ ] **Step 6: `ExpenseSheet` implementieren**

Vorlage Z. 901–947: Beschreibung plus Betrag (`type="number"`, `step="0.01"`), Kategorie-Chips, drei Zahler-Chips (der dritte „Gem. Konto" mit kleinerer Schrift), drei Aufteilungs-Chips, ein Hinweisfeld auf `--brand-soft`, Speichern.

Betrag über `Number.parseFloat` mit Komma-Ersetzung, damit `42,50` genauso funktioniert wie `42.50`. Ohne gültigen Betrag über null wird nicht gespeichert.

- [ ] **Step 7: `ProfileSheet` implementieren**

Vorlage Z. 950–981: Name, E-Mail, Geburtstag, dazu die Farbwahl als vier 44 px hohe Felder mit `border:2px solid` und Haken im gewählten. Die Farben kommen aus `PERSON_SLOTS` über `personTokens`.

- [ ] **Step 8: Alle fünf anschließen**

- `TodoDetail`: FAB und „+ Eintrag hinzufügen" öffnen `TodoSheet`; langes Drücken auf eine Zeile öffnet `ItemSheet`
- `PlannerScreen`: FAB und „+ Aufgabe" öffnen `PlanSheet`; das Stift-Zeichen an einer Mahlzeit öffnet es im Mahlzeit-Modus
- `MoneyScreen`: FAB öffnet `ExpenseSheet`
- `SettingsScreen`: „Bearbeiten" öffnet `ProfileSheet`

- [ ] **Step 9: Tests laufen lassen und committen**

Run: `npx vitest run apps/app/src/sheets`
Expected: PASS, 20 Tests

```bash
git add apps/app
git commit -m "feat(app): Todo-, Item-, Plan-, Ausgaben- und Profil-Sheet

Die Duplikatpruefung liegt als reine Funktion in todo-duplicate.ts. Warnungen
sind role=alert - die Vorlage nutzt nur eine gefaerbte Box, die Screenreader
nicht ankuendigen."
```

---

## Task 25: Playwright

**Files:**
- Create: `playwright.config.ts`
- Create: `e2e/smoke.spec.ts`
- Modify: `package.json` — Skripte `e2e` und `e2e:install`
- Modify: `.gitignore` — `test-results/`, `playwright-report/`
- Modify: `eslint.config.js` — `e2e/**` mit Node-Globals

**Interfaces:**
- Consumes: alle vorigen Tasks
- Produces: `npm run e2e` startet den Vite-Preview-Server und prüft zwei Abläufe in Chromium

- [ ] **Step 1: `playwright.config.ts` schreiben**

```ts
import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}/app/`,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run build --workspace @ralia/app && npm run preview --workspace @ralia/app -- --port 4173 --strictPort',
    url: `http://localhost:${PORT}/app/`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
```

Gegen den Preview-Build statt den Dev-Server, damit der Test auch die Build-Ausgabe prüft.

- [ ] **Step 2: Skripte und Ignores ergänzen**

In der Wurzel-`package.json`:

```json
"e2e": "playwright test",
"e2e:install": "playwright install --with-deps chromium",
```

In `.gitignore`: `test-results/` und `playwright-report/`.

In `eslint.config.js` den Testdatei-Block um `'e2e/**/*.ts'` erweitern, damit `no-console` und `no-explicit-any` dort nicht greifen.

- [ ] **Step 3: Browser installieren**

Run: `npm run e2e:install`
Expected: Chromium wird geladen. Bei fehlender Netzverbindung: Task hier abbrechen und melden — der Rest hängt daran.

- [ ] **Step 4: Die zwei Smoke-Tests schreiben**

```ts
import { expect, test } from '@playwright/test';

test('bootet und zeigt den Kalender', async ({ page }) => {
  await page.goto('./');
  // / leitet auf /kalender um
  await expect(page).toHaveURL(/\/app\/kalender$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  // 42 Tageszellen im Monatsraster
  await expect(page.getByRole('button', { name: /^\d+\./ })).toHaveCount(42);
  // Keine Fehler in der Konsole
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  await page.reload();
  expect(errors).toEqual([]);
});

test('Theme-Wahl übersteht einen Reload', async ({ page }) => {
  await page.goto('./profil');
  const toggle = page.getByRole('switch', { name: /Dark Mode/ });
  await toggle.click();
  await expect(page.locator('html')).toHaveAttribute('data-ralia-theme', 'dark');

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-ralia-theme', 'dark');

  // Kein Hell-Blitz: das Attribut steht schon vor dem ersten Frame.
  const beforeHydration = await page.evaluate(() =>
    document.documentElement.getAttribute('data-ralia-theme'),
  );
  expect(beforeHydration).toBe('dark');
});

test('alle fünf Tabs sind erreichbar', async ({ page }) => {
  await page.goto('./');
  for (const [label, path] of [
    ['Planer', 'planer'], ['Todos', 'todos'], ['Geld', 'geld'], ['Profil', 'profil'],
    ['Kalender', 'kalender'],
  ] as const) {
    await page.getByRole('button', { name: label }).first().click();
    await expect(page).toHaveURL(new RegExp(`/app/${path}$`));
  }
});

test('mobil gibt es keine waagerechte Scrollleiste', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./');
  const overflows = await page.evaluate(() =>
    document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflows).toBe(false);
});
```

- [ ] **Step 5: Tests laufen lassen**

Run: `npm run e2e`
Expected: 4 Tests grün

- [ ] **Step 6: Commit**

```bash
git add playwright.config.ts e2e package.json .gitignore eslint.config.js
git commit -m "test: Playwright-Geruest mit vier Smoke-Tests gegen den Preview-Build"
```

---

## Task 26: Abnahme

Kein neuer Code — ein Durchgang durch die zehn Abnahmekriterien des Specs mit Belegen. Ergebnis ist ein Abnahmeprotokoll im Repo.

**Files:**
- Create: `docs/superpowers/plans/2026-08-03-sp0-abnahme.md`

**Interfaces:**
- Consumes: alle vorigen Tasks
- Produces: Abnahmeprotokoll mit einer Zeile je Kriterium: erfüllt / nicht erfüllt, mit Befehl und Beobachtung

- [ ] **Step 1: Kriterium 1 — `npm run verify`**

Run: `npm run verify`
Erwartung: typecheck, lint, test und build ohne Fehler und ohne Build-Warnungen. Ausgabe in das Protokoll übernehmen, inklusive Testzahl.

- [ ] **Step 2: Kriterium 2 — Navigation und Layout**

Run: `npm run dev`
Prüfen bei 1280 px Breite: Sidebar links sichtbar, keine Bottom-Nav. Bei 900 px: Bottom-Nav sichtbar, keine Sidebar. Bei 1024 px genau: Sidebar erscheint. Alle fünf Tabs navigierbar; `/profil/sync` über „Kalender & Konflikte verwalten" erreichbar und über Zurück verlassbar.

- [ ] **Step 3: Kriterium 3 — alle acht Ansichten mit Daten**

Der Reihe nach aufrufen und je einen Datenwert bestätigen: Monat (Chips mit Titel), Woche (Termine in der Timeline), Planer (7 Tage), Todos-Übersicht (3 Kacheln), Todos-Detail (Einträge), Geld (5 Kategorien), Einstellungen (Profil und Code), Sync (2 Konten, 1 Konflikt).

- [ ] **Step 4: Kriterium 4 — alle acht Sheets, drei Schließwege**

Für jedes der acht Sheets: öffnen, mit Escape schließen, wieder öffnen, mit Backdrop-Klick schließen, wieder öffnen, mit dem ✕-Knopf schließen. 24 Prüfungen, tabellarisch protokollieren.

- [ ] **Step 5: Kriterium 5 — Token-Parität**

Run: `npx vitest run packages/ui/src/tokens/tokens.parity.test.ts`
Erwartung: 8 Tests grün. Zusätzlich gegenprüfen, dass der Test wirklich greift: einen Wert in `tokens.css` versuchsweise verfälschen, Test muss fehlschlagen, Änderung zurücknehmen.

- [ ] **Step 6: Kriterium 6 — Theme**

Light, Dark und System durchschalten; `data-ralia-theme` im Inspektor prüfen; Reload; auf Betriebssystemebene zwischen hell und dunkel wechseln, während `system` aktiv ist. Auf kein Aufblitzen achten: mit gedrosseltem Netz (DevTools „Slow 3G") neu laden und beobachten.

- [ ] **Step 7: Kriterium 7 — Sprache**

DE und EN umschalten; Navigation, Kopfzeilen und Screens auf Übersetzung prüfen. Schlüsselzahl belegen:

```bash
node -e "const d=require('./apps/app/src/i18n/de.json'),e=require('./apps/app/src/i18n/en.json');console.log(Object.keys(d).length,Object.keys(e).length)"
```
Erwartung: zwei gleiche Zahlen, mindestens 546.

- [ ] **Step 8: Kriterium 8 — `/config`**

Im Netzwerk-Tab bestätigen, dass `GET .../functions/v1/app-api/config` beim Boot einmal läuft und 200 liefert. Dann im DevTools-Netzwerk auf „Offline" stellen und neu laden: die App muss trotzdem starten und eine Warnung als Toast zeigen.

- [ ] **Step 9: Kriterium 9 — mobil randlos**

Mit iPhone-14-Emulation prüfen: kein äußerer Kartenrahmen, kein Rand um den Inhalt, Inhalt reicht bis an die Kanten, Bottom-Nav sitzt über der Home-Anzeige. Der Playwright-Test aus Task 25 belegt zusätzlich, dass nichts waagerecht überläuft.

- [ ] **Step 10: Kriterium 10 — Tastatur und Fokus**

Ausschließlich mit Tab, Shift+Tab, Pfeiltasten, Enter, Leertaste und Escape durch alle fünf Tabs, einen geöffneten Sheet und die Einstellungen navigieren. Jede fokussierte Stelle muss einen sichtbaren Ring zeigen. In einem offenen Sheet darf der Fokus nicht dahinter geraten.

- [ ] **Step 11: Protokoll schreiben und committen**

Für jedes Kriterium: Nummer, Kurztext, Befund, Belegbefehl oder Beobachtung. Nicht erfüllte Punkte mit genauer Beschreibung — und zwar als offene Punkte stehen lassen, nicht stillschweigend nacharbeiten.

```bash
git add docs/superpowers/plans/2026-08-03-sp0-abnahme.md
git commit -m "docs: Abnahmeprotokoll SP0 gegen die zehn Kriterien des Specs"
```

---

## Self-Review

**Spec-Abdeckung.** Jeder Abschnitt des Specs hat eine Task:

| Spec-Abschnitt | Task |
|---|---|
| Aufräumen (24 Typecheck-, 3 Lint-Fehler) | 1 |
| Tokens sichtbar + verdeckt, Paritätstest | 3 |
| `reset.css`, Fokus-Zustand, `100dvh` | 3 |
| `fonts.css` über `@fontsource` | 2, 3 |
| ThemeProvider | 4 |
| Monatsraster-Heuristik, Wochen-Geometrie | 5 |
| Icons | 6 |
| Primitive (alle 20) | 7, 8, 9 |
| `BottomSheet`, `Modal`, `ConfirmDialog` | 10 |
| AppShell, Prototyp-Gerüst nicht übernehmen | 11 |
| `apps/app`, Routing, Basispfad `/app/` | 12 |
| i18n mit 546 Schlüsseln, Skript | 13 |
| Boot-Reihenfolge, Legacy-Migration | 14 |
| Demo-Daten | 15 |
| Die acht Ansichten | 16, 17, 18, 19, 20, 21, 22 |
| Die acht Sheets | 23, 24 |
| Playwright | 25 |
| Die zehn Abnahmekriterien | 26 |

**Namenskonsistenz geprüft.** `PersonSlot` und `personTokens` durchgehend aus Task 3. `monthDensity`/`monthGridCells`/`weekEventGeometry` aus Task 5, in Tasks 16 und 17 unverändert benutzt. `TabId`/`TABS` aus Task 11, in Task 12 und 13 unverändert. `Lang`/`LANG_STORAGE_KEY`/`useT` aus Task 13, in Tasks 20 und 21 unverändert. `useLongPress` aus Task 23, in Task 24 wiederverwendet. `MockEvent`/`MOCK_EVENTS` aus Task 15 in allen Screen-Tasks.

**Zwei bewusste Abweichungen von der Vorlage**, beide im Spec begründet und in den Tasks erneut vermerkt: das Prototyp-Gerüst entfällt (Task 11), und Zustände, die die Vorlage nicht kennt — Fokus, `aria-*`, `disabled`, Pflichtfeldprüfung — werden ergänzt (Tasks 3, 7, 10, 18, 22, 23, 24).

**Reihenfolge.** Tasks 1–2 sind Voraussetzung für alles. 3–11 bauen `packages/ui` von unten auf. 12–15 stellen die App auf die Beine. 16–24 füllen sie. 25–26 sichern ab. Innerhalb von 16–22 sind die Screens unabhängig und könnten parallel laufen; 23 muss vor 24 kommen, weil `useLongPress` und `sheets.module.css` dort entstehen.

