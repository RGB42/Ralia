# Release-Audit Ralia

Stand: 2026-08-12 · Commit `c1bdeb7` · Zweck: erster Release, ausschließlich private Nutzung

## Urteil in einem Absatz

Die App ist funktional weiter, als der Handoff vermuten lässt: `npm run verify` ist grün
(69 Testdateien, 858 Tests, Build sauber), die statische Site läuft live unter
`https://ralia-app.onrender.com`, und alle fünf Fachbereiche hängen an echten Repositories.
Was einem Release im Weg steht, ist **nicht** die Fachlogik, sondern vier Dinge: ein
öffentlich einsehbares Google-OAuth-Secret, ein Google-Sync-Screen der zu 100 % Attrappe
ist, eine fehlende Push-Registrierung (Erinnerungen werden erzeugt, erreichen aber kein
neu installiertes Gerät), und eine fehlende PWA-Hülle (die App lässt sich nicht auf den
Homescreen legen). Drei davon sind klein. Google Sync ist das eigentliche Projekt.

## Stand der Umsetzung

Der Befund unten ist der Stand bei Erstellung des Audits. Seither erledigt:

| Punkt                        | Stand                                                                                     |
| ---------------------------- | ----------------------------------------------------------------------------------------- |
| 4.1 Keine Error Boundary     | **erledigt** — `apps/app/src/ErrorBoundary.tsx`, unter `I18nProvider`, 4 Tests            |
| 4.3 Sourcemaps öffentlich    | **erledigt** — `sourcemap: false`, Regressionstest in `apps/app/src/build-config.test.ts` |
| 5 README überzeichnet        | **erledigt** — Status, Capacitor-Behauptung und Testzähler korrigiert                     |
| 5 Emoji-Reste im Katalog     | **erledigt** — 5 sichtbare Schlüssel bereinigt, Test in `i18n.test.ts` hält sie fest      |
| 2.1 Google-Secret öffentlich | offen — nur in der Google Cloud Console zu erledigen                                      |
| 2.5 Leaked-Password-Schutz   | offen — nur im Supabase-Dashboard zu erledigen                                            |
| alles Übrige                 | offen                                                                                     |

Nach diesen Änderungen: `npm run verify` Exit 0, 71 Testdateien, 864 Tests, Build ohne `.map`.

---

## 1. Was nachweislich steht

| Bereich                   | Nachweis                                                                                              |
| ------------------------- | ----------------------------------------------------------------------------------------------------- |
| Verifikation              | `npm run verify` Exit 0 — typecheck, lint, 858/858 Tests, Vite-Build                                  |
| Deploy                    | `https://ralia-app.onrender.com` liefert 200, Anmeldemaske rendert, keine Konsolenfehler              |
| CI                        | `.github/workflows/verify.yml` bei PR und Push auf `main`, inkl. `npm audit --omit=dev`               |
| Auth & Partner            | E-Mail/Passwort, Google-Identität, Recovery, Routenwache, Invite-Code, Trennen/Wiederverbinden        |
| Kalender                  | CRUD, Serien + Exceptions + Future-Split, Monat/Woche/Tag, Realtime, kontogebundene Outbox            |
| Organizer, Planer, Geld   | Persistente Listen, Wochenplan mit Zuständigkeiten, centgenaue `BigInt`-Bilanz                        |
| i18n                      | 853 Schlüssel in DE und EN, keine Lücke in beide Richtungen                                           |
| RLS                       | Exakte Mitgliedschaftsprüfung über `calendar_memberships`, nicht mehr UUID-Enthaltensein              |
| Erinnerungen serverseitig | `cron.job` `ralia-reminder-worker` läuft jede Minute; 36 gesendet, 0 Fehler, zuletzt 2026-08-11 22:00 |

Die Produktionsdatenbank ist nicht leer: 13 Profile, 709 Events, 4 gemeinsame Kalender,
8 aktive Mitgliedschaften, 29 Push-Abos. Es liegen also Daten anderer Nutzer aus Ralia 1.x
darin. Falls „privat" heißt „nur Du und Deine Partnerin", ist das eine offene Frage —
siehe Abschnitt 7.

---

## 2. P0 — Blocker

### 2.1 Das Google-OAuth-Client-Secret liegt öffentlich auf GitHub

Das ist der schwerwiegendste Befund des Audits.

- `RGB42/Ralia_Opus` ist ein **öffentliches** GitHub-Repository (`visibility: PUBLIC`).
- Die Datei `env/client_secret_1061137684494-….apps.googleusercontent.com.json` ist
  **in git versioniert und in HEAD vorhanden**, mit dem Klartext-Secret im Feld `client_secret`.
- Das `.gitignore` enthält zwar `env/*`, aber die Datei wurde vorher committet
  (`3363e43`). Ein nachträglicher Ignore-Eintrag entfernt nichts aus der Historie.
- Dieselbe Client-ID wird live von `/config` ausgeliefert — der Client ist also aktiv.

**Zu tun**

1. In der Google Cloud Console (Projekt `ralia-484108`) den betroffenen OAuth-Client
   **löschen oder sein Secret rotieren**. Vor dem Rotieren ist alles andere Kosmetik.
2. Datei aus dem Repo entfernen und Push. Die Historie zusätzlich zu bereinigen ist
   sauberer, aber zweitrangig — nach der Rotation ist das exponierte Secret wertlos.
3. Das neue Secret **nur** in Supabase-Secrets ablegen, nie in einem Repo, nie im Chat.

Nicht betroffen: `env/.env` wurde nie committet. Service-Role-Key, VAPID-Private-Key,
`ENCRYPTION_SECRET`, `CRON_SECRET` und die LemonSqueezy-Schlüssel liegen dort lokal, aber
nicht öffentlich. Der in `public/js/backend.js` hartkodierte Anon-Key ist unkritisch —
Anon-Keys sind öffentlich gedacht und RLS schützt dahinter.

### 2.2 Billing ist serverseitig noch an

Die Produktentscheidung ist „kostenlos, kein Gate". Der React-Client hat auch keins. Aber:

- `GET /config` liefert live `billingEnabled: true`.
- Die Edge Function `billing-webhook` ist deployt und aktiv (Version 2).
- Der i18n-Katalog trägt noch `proPlanBadge`, `freePlanName`, `planStatusLabel`, `adminTab`.

Solange `/config` `true` sagt, kann jede spätere Codezeile daran ein Gate hängen.

**Zu tun**: `/config` auf `billingEnabled: false`, Checkout-/Portal-/Webhook-Routen
serverseitig stilllegen, toten Katalog aufräumen. Billing-Spalten in `profiles` bleiben
stehen — nichts destruktiv entfernen.

### 2.3 `app-api` ist nicht versioniert und läuft ohne JWT-Prüfung

`app-api` (Version 3, `verify_jwt: false`) ist die Quelle von `/config`, der alten
Google-Routen und der Billing-Endpunkte. Ihr Quellcode liegt in **keinem** Repository.
Damit ist 2.2 gar nicht sicher durchführbar: man kann nichts kontrolliert ändern, was man
nicht hat.

**Zu tun**: Quellstand ziehen, unter `supabase/functions/app-api/` versionieren, erst dann
ändern.

### 2.4 Google Sync existiert nicht

`apps/app/src/screens/settings/SyncScreen.tsx` ist vollständig Attrappe:

- Konten, Kalenderliste, Konfliktkarte und Protokoll kommen aus `mock/fixtures.ts`.
- „Jetzt synchronisieren" ist `onClick={() => undefined}`.
- „heute 08:14" steht als Literal im JSX.

Es gibt keine `google-sync-api`, kein Token-Schema, keinen OAuth-Flow, kein Mapping.
Details und Entscheidungsbedarf in Abschnitt 6.

### 2.5 Leaked-Password-Schutz aus

Supabase Security Advisor meldet `auth_leaked_password_protection` als WARN. Ein Schalter
in den Auth-Einstellungen, kein Code.

---

## 3. P1 — Was für die tägliche Nutzung auf dem Handy fehlt

### 3.1 Keine PWA

Es gibt kein Manifest, keinen Service Worker und kein Icon-Set — nur `favicon.png`
(369 KB, wird bei jedem Besuch geladen). Konsequenz: die App lässt sich nicht auf den
Homescreen legen, startet immer in der Browser-Leiste, und ohne Netz zeigt der Browser
seine Fehlerseite statt der App. Die Offline-Outbox in `packages/core` ist gebaut, aber
ohne App-Shell-Cache kommt man offline gar nicht erst so weit, sie zu benutzen.

Der Boot-Code entfernt aktuell aktiv alte Service Worker (Legacy-Migration) und registriert
keinen neuen.

### 3.2 Erinnerungen erreichen kein neues Gerät

Die Kette ist bis auf ein Glied vollständig:

- Das Event-Formular hat Erinnerungs-Toggle und Vorlauf (1 h / 1 Tag / 2 Tage / 1 Woche).
- `CalendarScreen` schreibt `reminder_enabled`, `reminder_offset_minutes`, `reminder_offsets`.
- Trigger `trg_events_rebuild_reminder_jobs` legt Jobs an.
- `ralia-reminder-worker` läuft jede Minute und versendet fehlerfrei.

**Aber**: nirgends im neuen Client wird ein Push-Abo registriert. `push_subscriptions` wird
in den generierten Typen geführt und sonst nirgends angefasst. Die 29 vorhandenen Abos
stammen aus Ralia 1.x. Auf einem frisch installierten neuen Client kommt die Erinnerung
also nie an — der Job wird erzeugt, gesendet, und läuft ins Leere. Der
Benachrichtigungs-Schalter in den Einstellungen speichert eine Präferenz ohne Wirkung.

`vapidPublicKey` liefert `/config` bereits. Es fehlt nur die Client-Seite.

### 3.3 Keine nativen Hüllen

Die README behauptet „Eine Codebasis für Android, iOS und Web" und nennt `apps/app` den
„Capacitor-Webroot". Es gibt im Repo keinerlei Capacitor: keine `capacitor.config.*`,
kein `apps/mobile`, keine Plattformordner. SP7 ist unangetastet.

Für private Nutzung ist eine installierbare PWA (3.1) mit sehr hoher Wahrscheinlichkeit
ausreichend und ungleich billiger als zwei Store-Pipelines. Aber die README muss aufhören,
etwas anderes zu behaupten.

---

## 4. P1 — Robustheit

### 4.1 Keine Error Boundary

Im gesamten Client existiert weder eine `ErrorBoundary`, noch `componentDidCatch`, noch ein
`unhandledrejection`-Handler. Ein einzelner Renderfehler in einem beliebigen Screen führt zu
einer weißen Seite ohne Weg zurück — der Nutzer kann nur den Tab schließen. Bei einer App,
die täglich auf dem Handy läuft, ist das der billigste große Gewinn im ganzen Audit.

### 4.2 Ein Bundle, 790 KB

`dist/assets/index-*.js` ist 789,64 KB (236,52 KB gzip) in **einem** Chunk. Vite warnt
selbst. Kein Route-Splitting, obwohl der Router die natürlichen Schnitte schon vorgibt.

### 4.3 Sourcemaps werden öffentlich ausgeliefert

`vite.config.ts` setzt `build: { sourcemap: true }`, und die Map ist live abrufbar:
`https://ralia-app.onrender.com/assets/index-*.js.map` antwortet mit 3.492.383 Bytes. Das
sind 3,4 MB öffentlicher Volltext-Quellcode neben dem Bundle. Bei einer privaten App kein
Sicherheitsdesaster, aber unnötig — `sourcemap: 'hidden'` oder `false` für Produktion.

---

## 5. P2 — Hygiene

- **README überzeichnet den Stand.** „SP2 bis SP4 in Umsetzung" — sie sind fertig. Android
  und iOS werden versprochen und existieren nicht.
- **Todos hängen an Mock-Typen.** `TodoDetail`, `TodoSheet`, `ItemSheet`, `todo-store` und
  `todo-duplicate` importieren `MockTodoItem`/`MockTodoList` aus `mock/fixtures.ts`,
  obwohl die Daten längst echt sind. Die Typen gehören in die Datenschicht.
- **Sichtbarer Extraktionsartefakt.** Der Katalogschlüssel `name` lautet in DE **und** EN
  `"🔤 Name"` und wird in `TodoOverview.tsx:154` als Feldbeschriftung gerendert. Das Emoji
  stammt aus der 1.x-Extraktion und steht sichtbar in der Oberfläche.
- **Toter Katalog.** `adminTab`, `adminPushToolsTitle`, `proPlanName`, `freePlanBadge`,
  `planStatusLabel` u. a. sind Billing-/Admin-Reste ohne Bildschirm.
- **`clearAuthData()` räumt `googleSyncState` nicht ab.** Muss vor dem Google-Bau passieren,
  sonst überlebt Legacy-State die Abmeldung.
- **Advisor-Restposten** (alle bekannt und vertretbar): `crawled_events` und
  `event_reminder_jobs` haben RLS ohne Policies (dienstinterne Tabellen, korrekt so);
  `pg_net` und `dblink` liegen im `public`-Schema; `connect_partner`,
  `disconnect_partner`, `set_shared_anniversary` sind bewusst `SECURITY DEFINER`.

---

## 6. Google Sync — Fundstand und was zu entscheiden ist

### 6.1 Was in Ralia_Opus gefunden wurde

| Fund                   | Wert                                                                         |
| ---------------------- | ---------------------------------------------------------------------------- |
| Google-Cloud-Projekt   | `ralia-484108`                                                               |
| OAuth-Client-ID        | `1061137684494-49scn6qq27lkoqlih951750e627q3f4a.apps.googleusercontent.com`  |
| Client-Typ             | Web                                                                          |
| `javascript_origins`   | `http://localhost:3000`, `https://Ralia.onrender.com`                        |
| `redirect_uris`        | **keine konfiguriert**                                                       |
| Secret-Datei           | `Ralia_Opus/env/client_secret_….json` — öffentlich, siehe 2.1                |
| Secret zusätzlich in   | `Ralia_Opus/env/.env` als `GOOGLE_CLIENT_SECRET` (nicht committet)           |
| Live-`/config` liefert | dieselbe Client-ID, `googleRedirectUri: "postmessage"`                       |
| Genutzte Scopes (1.x)  | `calendar`, `calendar.readonly`, `userinfo.email`, `userinfo.profile`        |
| Alte Serverrouten      | `POST /api/google/auth-code`, `GET /api/google/refresh-token` in `server.js` |

Zwei Dinge folgen daraus unmittelbar:

**Der alte Flow ist für v1 unbrauchbar.** `redirect_uri: "postmessage"` ist der
Popup-Flow von Google Identity Services: der Auth-Code landet im Browser und wird von dort
an den eigenen Server geschickt. Die v1-Anforderung (serverseitiger Sync alle 10 Minuten,
Refresh-Token nur auf dem Server) verlangt einen echten serverseitigen Redirect. Es ist
kein Redirect-URI konfiguriert, also muss ohnehin in der Cloud Console nachgezogen werden.

**Der alte Host ist tot.** `https://ralia.onrender.com` antwortet mit 503. Die alten
`/api/google/*`-Routen sind faktisch nicht mehr erreichbar. Nichts geht kaputt, wenn wir
neu bauen.

### 6.2 Empfehlung: neuer Client statt Rotation

Ich würde den alten OAuth-Client **löschen** und einen neuen anlegen, statt nur das Secret
zu rotieren. Gründe: der alte ist auf `postmessage` und zwei tote Origins konfiguriert,
seine ID steht in einem öffentlichen Repo neben dem Secret, und ein Löschen neutralisiert
das Leak vollständig statt nur den einen Faktor auszutauschen. Der Neuaufwand ist ein
Formular.

Redirect-URI des neuen Clients:
`https://nyvripddydrzvfuateea.supabase.co/functions/v1/google-sync-api/callback`

### 6.3 Die eine externe Unbekannte: Veröffentlichungsstatus

`https://www.googleapis.com/auth/calendar` ist bei Google ein sensibler Scope. Davon hängt
ab, ob der 10-Minuten-Sync überhaupt durchhält:

- **Status „Testing"**: keine Verifizierung nötig, Du und Deine Partnerin als Testnutzer
  eintragen — aber Refresh-Tokens laufen nach 7 Tagen ab. Der Hintergrund-Sync stirbt dann
  wöchentlich und verlangt neues Einloggen.
- **Status „In Produktion", unverifiziert**: einmaliger Warnbildschirm beim Verbinden,
  danach stabile Tokens; Nutzerobergrenze.
- **Verifiziert**: verlangt u. a. eine öffentlich erreichbare Datenschutzerklärung — die
  laut Produktentscheidung bewusst zurückgestellt ist.

Das ist die einzige Stelle des Audits, die ich nicht im Code nachprüfen konnte. Vor dem
Bau gegen die aktuelle Google-Dokumentation prüfen, denn die Antwort bestimmt, ob der
serverseitige Poller überhaupt Sinn ergibt oder ob v1 erst einmal manuell bleibt.

### 6.4 Der Rest der v1-Anforderung steht im Handoff

Datenmodell (`google_connections`, `google_calendar_bindings`, `google_event_mappings`,
`google_sync_changes`, `google_sync_runs`, `google_sync_conflicts`), PKCE, verschlüsselte
Refresh-Tokens, ETags und Sync-Tokens, Serien-Master und Ausnahmen, explizite
Konfliktentscheidung statt Last-Write-Wins — das ist in `docs/AI_HANDOFF.md` bereits
sauber festgelegt und bleibt gültig. Es fehlt ausschließlich die Umsetzung.

---

## 7. Offene Fragen an den Produktverantwortlichen

1. **Wer nutzt die Datenbank noch?** 13 Profile und 4 gemeinsame Kalender sind produktiv.
   Wenn „privat" strikt zwei Personen meint, sind das Fremddaten unter demselben RLS-Dach.
2. **PWA oder native App?** Meine Empfehlung ist klar PWA. Bitte bestätigen, damit SP7 und
   die README-Behauptung endgültig vom Tisch sind.
3. **Google-Veröffentlichungsstatus** — siehe 6.3.
4. **Alten OAuth-Client löschen oder Secret rotieren?** Empfehlung: löschen.

---

## 8. Empfohlene Reihenfolge

**Sofort, unabhängig von allem anderen (Minuten bis Stunden)**

1. Google-OAuth-Client löschen/rotieren (2.1). Blockiert nichts, wartet auf nichts.
2. Leaked-Password-Schutz einschalten (2.5).
3. Error Boundary einziehen (4.1).
4. `sourcemap` für Produktion abschalten (4.3), `favicon.png` verkleinern.
5. README auf den tatsächlichen Stand bringen (5).

**Danach, kleine geschlossene Arbeitspakete (je ein halber bis ganzer Tag)**

6. PWA-Hülle: Manifest, Icons, Service Worker mit App-Shell-Cache (3.1).
7. Push-Registrierung im neuen Client, gekoppelt an den Einstellungs-Schalter (3.2).
8. `app-api` versionieren, dann `billingEnabled: false` und Billing-Routen stilllegen (2.3, 2.2).
9. `googleSyncState` in `clearAuthData()`, Mock-Typen aus dem Todo-Pfad, `🔤` aus dem
   Katalog, toter Katalog raus (5).

**Das eigentliche Projekt**

10. Google Sync v1 — eigener Spec→Plan→Implementierungs-Zyklus. Nicht nebenbei.

Nach Schritt 9 ist die App aus meiner Sicht **release-fähig für private Nutzung**, mit
Google Sync als sichtbar deaktiviertem oder ausgeblendetem Bereich statt als Attrappe.
Der jetzige Zustand — ein Screen, der eine funktionierende Synchronisierung _vortäuscht_ —
ist schlechter als gar kein Screen.
