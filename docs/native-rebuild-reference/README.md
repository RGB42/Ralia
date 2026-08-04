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

## Vor der Übernahme prüfen

Es liegen **keine Tests** bei. Nichts hiervon ist verifiziert. Wer Code übernimmt, schreibt zuerst die Tests dafür — sonst wandert unverifizierte Logik in `packages/core`, dessen ganzer Zweck Testbarkeit ist.

Ebenso zu prüfen: `src/types/database.ts` gegen `packages/data/src/database.types.ts`. Beide beschreiben dasselbe Supabase-Schema; Abweichungen sind ein Hinweis, dass eine der beiden Fassungen veraltet ist.
