# Referenz: der Expo/React-Native-Anlauf

Diese Dateien sind **kein Teil des Builds**. Sie sind der Quellstand des vorherigen Rebuild-Versuchs, der auf `main` von [RGB42/Ralia](https://github.com/RGB42/Ralia) lag, bevor dieser Branch ihn ersetzte.

Aufgehoben, weil dort Teile schon gelöst sind, die in diesem Rebuild noch anstehen — vor allem die Serien-Logik, die das Programm-Design als schwierigsten Teil der App benennt. Verworfen wurde der **technische Ansatz** (Expo/React Native gegen Capacitor + Vite), nicht die darin steckende Arbeit.

## Was hier wahrscheinlich direkt weiterverwendbar ist

Reines TypeScript ohne React-Native-Abhängigkeit, also Kandidaten für `packages/core` und `packages/data`:

| Datei | Bezug im aktuellen Plan |
|---|---|
| `src/features/calendar/recurrence.ts` | Serien-Engine — SP2 |
| `src/features/calendar/month-grid.ts` | `packages/core/src/calendar/month-grid.ts`, Task 5 |
| `src/features/calendar/ownership.ts` | `belongs_to`-Spiegelung — `packages/data/src/calendar-id.ts` |
| `src/features/calendar/holidays.ts` | Feiertage — SP2 |
| `src/lib/calendar-id.ts` | bereits umgesetzt in `packages/data/src/calendar-id.ts` |
| `src/lib/mutation-queue.ts` | bereits umgesetzt in `packages/core/src/outbox/` |
| `src/lib/local-date.ts` | Datumsarithmetik — SP2 |
| `src/lib/premium.ts` | Gating — SP6 |
| `src/features/todos/helpers.ts` | SP3 |
| `src/theme/tokens.ts` | Vergleichspunkt zu `packages/ui/src/tokens/tokens.css` |

## Was hier nicht weiterverwendbar ist

Alle `.tsx`-Dateien. Sie nutzen React-Native-Primitive (`View`, `Text`, `StyleSheet`, `Pressable`) und NativeWind. Für die DOM-Zielplattform ist davon nichts direkt übertragbar — als Referenz für Aufbau und Zustandsführung bleiben sie aber lesenswert, besonders `src/components/ui/` gegenüber den Primitiven aus Task 7 bis 10.

## Bereits geprüft: `month-grid.ts`

Gelesen am 2026-08-04, mit zwei Ergebnissen — eines gegen uns, eines für uns.

**`buildMonthGrid` nicht übernehmen.** Es erzeugt **variabel 4 bis 6 Wochen** statt feste 42 Zellen, mit der Begründung, ein starres 42er-Raster zeige bei kurzen Monaten eine komplette ausgegraute Schlusswoche. Für das damalige Design richtig — für unseres falsch: die Vorlage legt `grid-template-rows:repeat(6,minmax(46px,1fr))` fest (Z. 153) und iteriert `for (let i = 0; i < 42; i++)` (Z. 1267). Ein variables Raster würde die Kalenderhöhe von Monat zu Monat springen lassen. `packages/core/src/calendar/month-grid.ts` bleibt bei 42.

Zweiter Unterschied: die Referenz rechnet in **lokaler** Zeit (`local-date.ts`), Vorlage und unser Plan rechnen in **UTC**. UTC vermeidet, dass eine Zelle bei Sommerzeitwechsel verrutscht. Wer `local-date.ts` heranzieht, muss diesen Unterschied bewusst entscheiden, nicht übersehen.

**`layoutMonthEvents` unbedingt aufheben — für SP2.** Es löst ein Problem, das unser Plan noch nicht adressiert und die Vorlage nicht zeigt: **Mehrtagestermine**. Das Datenmodell hat `start_date` und `end_date`, aber alle Demo-Daten der Vorlage sind eintägig, also demonstriert sie nie, wie ein durchgehender Balken über mehrere Tage aussieht. Die naive Umsetzung lässt denselben Termin an verschiedenen Tagen auf verschiedenen Höhen erscheinen.

Die Referenz weist jedem Termin eine „Lane" zu, die über seine gesamte Spanne konstant bleibt, und belegt sie nur, wenn sie an **jedem** Tag der Spanne frei ist — genau das verhindert das Zeilentauschen mitten im Balken. Längere Termine werden zuerst einsortiert, damit sie die oberen Lanes belegen und kurze das Raster nicht zerreißen. Termine, für die keine Lane frei ist, wandern in einen `+N`-Zähler statt still zu verschwinden.

Das ist die durchdachtere Lösung. Wenn SP2 die Monatsansicht mit echten Daten füllt, ist das der Startpunkt — mit Tests, die es hier nicht hat.

## Vor der Übernahme prüfen

Es liegen **keine Tests** bei. Nichts hiervon ist verifiziert. Wer Code übernimmt, schreibt zuerst die Tests dafür — sonst wandert unverifizierte Logik in `packages/core`, dessen ganzer Zweck Testbarkeit ist.

Ebenso zu prüfen: `src/types/database.ts` gegen `packages/data/src/database.types.ts`. Beide beschreiben dasselbe Supabase-Schema; Abweichungen sind ein Hinweis, dass eine der beiden Fassungen veraltet ist.
