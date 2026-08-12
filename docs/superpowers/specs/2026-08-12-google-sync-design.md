# SP5a — Google-Kalender-Import v1

Stand: 2026-08-12 · Status: Entwurf zur Abnahme · Vorgänger: [Release-Audit](../../2026-08-12-release-audit.md)

## Ziel

Ein Ralia-Nutzer verbindet sein Google-Konto, wählt aus, welche seiner Google-Kalender als
Quelle dienen, und holt deren Termine nach Ralia — **auf Knopfdruck oder alle zehn Minuten**.
Mehr nicht. Ralia schreibt nichts nach Google und bekommt dort keinen Schreibzugriff.

Der Screen unter `/profil/sync` hört auf, eine funktionierende Synchronisierung
vorzutäuschen, und zeigt den echten Zustand.

## Wie dieser Umfang zustande kam

Der ursprüngliche Entwurf war ein bidirektionaler Sync mit sechs Betriebsarten, freier
Zielwahl, Serien in beide Richtungen und Konfliktauflösung. Er ist in drei Schritten
zurückgeschnitten worden, jedes Mal auf ausdrückliche Anweisung:

| Gestrichen                    | Warum                                                                                     |
| ----------------------------- | ----------------------------------------------------------------------------------------- |
| Freie Wahl des Ziel-Kalenders | hätte den vollen `calendar`-Scope erzwungen — Schreibzugriff auf **alle** Kalender        |
| Export und beidseitiger Sync  | „Was funktionieren muss, ist der Import"                                                  |
| Konfliktauflösung             | importierte Termine gehören Google — damit gibt es keine zwei Wahrheiten                  |
| Serien (Google-RRULE → Ralia) | Googles RRULE kann weit mehr als Ralias vier Typen; ehrliches Übergehen statt Verstümmeln |

Was bleibt, ist die kleinste Fassung, die den Zweck erfüllt — und die einzige, bei der
Ralia in Google **nur liest**.

## Abgrenzung

**In Scope:** OAuth-Verbindung, Auswahl der Quell-Kalender, Import von Einzelterminen,
Laden auf Knopfdruck, Laden alle zehn Minuten mit Pause, Pflicht-Probelauf, Statusanzeige,
Änderungs- und Fehlerprotokoll.

**Nicht in Scope:** jeder Schreibvorgang nach Google, Serien, Löschen in Ralia, ICS,
Teilnehmer, Anhänge, mehr als ein Google-Konto je Nutzer, Zeitzonen je Termin, andere
Taktweiten als zehn Minuten.

## Sicherheitsrahmen

Der Kalender wird seit 2024 produktiv von mehreren Personen genutzt. Daraus folgen drei
Regeln, die den ganzen Entwurf prägen:

1. **Der Import fasst ausschließlich Termine an, die er selbst angelegt hat.** Ein von Hand
   in Ralia erstellter Termin wird nie geändert und nie gelöscht — unabhängig davon, was in
   Google passiert.
2. **Der erste Lauf jeder Bindung ist ein Probelauf.** Er zeigt, was er täte, und schreibt
   nichts. Erst danach gibt der Screen den echten Lauf frei.
3. **Gelöscht wird nie** (Abschnitt 8).

---

## 1. Ausgangslage

Geprüft am 2026-08-12 gegen das laufende Projekt.

| Befund                                                                                   | Konsequenz                                            |
| ---------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `SyncScreen.tsx` ist vollständig Attrappe, „Jetzt synchronisieren" ist ein No-op         | wird ersetzt, nicht erweitert                         |
| Kein `google-sync-api`, kein Token-Schema, kein Mapping                                  | alles neu, quellversioniert                           |
| Der alte Host `ralia.onrender.com` antwortet 503                                         | die alten `/api/google/*`-Routen sind tot             |
| 445 von 709 Events tragen eine `google_event_id` aus Ralia 1.x                           | wird ignoriert, siehe 7                               |
| `events` speichert `date` + `time without time zone`, keine Zeitzone                     | Umrechnung nötig, siehe 5                             |
| Ganztägig ist im Bestand uneinheitlich: 363 als `00:00`–`23:59`, 102 als `00:00`–`00:00` | Vorarbeit nötig, siehe 6                              |
| `pg_cron` + `pg_net` treiben `ralia-reminder-worker` jede Minute                         | Muster für den Takt steht                             |
| Trigger `trg_events_rebuild_reminder_jobs` hängt an `events`                             | jeder überflüssige Schreibvorgang hat Folgen, siehe 9 |

---

## 2. Veröffentlichungsstatus: Produktion, unverifiziert

Google verlangt für sensible Scopes eine Verifizierung, **nennt aber eine ausdrückliche
Ausnahme für den privaten Gebrauch**: wer der einzige Nutzer ist oder „a few users, all of
whom are known personally to you" hat, braucht sie nicht. Maßgeblich ist nicht, wie viele
Leute Ralia benutzen, sondern wie viele ihr Google-Konto verbinden — eine Handvoll
persönlich bekannte Personen. Die Ausnahme trägt.

Der Status _Testing_ wäre falsch: bei externem Nutzertyp widerruft Google dort
Refresh-Tokens **nach sieben Tagen**, und der Zehn-Minuten-Takt wäre wöchentlich tot. In
Produktion laufen sie nicht ab.

Der Preis ist ein einmaliger Warnbildschirm beim Verbinden („Google hat diese App nicht
bestätigt" → _Erweitert_ → _Weiter_). Der Screen kündigt ihn an, statt ihn zu überraschen.

Erledigt am 2026-08-12: neuer OAuth-Client in `ralia-484108`, alter gelöscht, Status auf
_In Produktion_, `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_TOKEN_KEY` in den
Supabase-Secrets.

---

## 3. Ein Scope, nur lesend

```
https://www.googleapis.com/auth/calendar.readonly
```

Das ist alles. Einmal beim Verbinden, keine Nachforderung, keine zweite Stufe.

`calendar.readonly` erlaubt das Auflisten der Kalender und das Lesen ihrer Termine — genau
den Umfang dieses Entwurfs. **Ralia kann in Google nichts anlegen, nichts ändern und nichts
löschen.** Kein Zugriffsfehler auf unserer Seite kann fremde Google-Daten beschädigen.

Das ist der eine Punkt, an dem der reduzierte Umfang die Sache echt besser macht und nicht
nur kleiner: die frühere Fassung brauchte zwei Scope-Stufen und einen nachgeforderten
Zustimmungsdialog.

---

## 4. OAuth: Authorization Code mit PKCE, serverseitig

Der Browser sieht nie ein Token.

1. Client ruft `POST /google-sync-api/oauth/start` (JWT-geschützt). Der Server erzeugt
   `state`, `code_verifier` und `nonce`, legt sie mit fünf Minuten Frist in
   `private.google_oauth_states` ab und antwortet mit der Google-Autorisierungs-URL.
2. Der Nutzer autorisiert. Google leitet auf `GET /google-sync-api/callback` um.
3. Der Server prüft `state`, tauscht Code gegen Tokens, verschlüsselt das Refresh-Token,
   legt die Verbindung an und leitet zurück nach `/profil/sync`.

`access_type=offline` und `prompt=consent`, sonst liefert Google beim zweiten Mal kein
Refresh-Token und der getaktete Lauf hätte nichts zu erneuern.

Redirect-URI, exakt:
`https://nyvripddydrzvfuateea.supabase.co/functions/v1/google-sync-api/callback`

**Token-Verwahrung.** Das Refresh-Token liegt AES-GCM-verschlüsselt in
`private.google_connections`; der Schlüssel kommt aus dem Supabase-Secret
`GOOGLE_TOKEN_KEY`. **Access-Tokens werden nicht gespeichert** — jeder Lauf holt sich eins
aus dem Refresh-Token. Das kostet eine Anfrage und spart ein zweites Geheimnis mit
Ablaufdatum samt der Fehlerklasse, die dazugehört.

---

## 5. Zeitzone: eine je Verbindung

`events` speichert schwebende Ortszeiten ohne Zone. Google liefert Zeitpunkte mit Versatz.
Die Verbindung trägt deshalb **eine** Zeitzone (`google_connections.time_zone`), gelesen
beim Verbinden aus den Google-Kalendereinstellungen, Rückfall `Europe/Berlin`.

Beim Import wird Googles Zeitpunkt in diese Zone umgerechnet und der Versatz dann
fallengelassen. Ein Termin, der in Google um 10:00 Uhr Berliner Zeit steht, steht in Ralia
als `10:00`.

Bewusst **keine** `time_zone`-Spalte auf `events`. Die würde jede Ansicht, jede
Serien-Expansion und jede Zeile in Produktion berühren — eine Umstellung des
Kalendermodells, nicht ein Import-Feature.

Offen dokumentierte Folge: legt jemand in einer anderen Zeitzone einen Termin an, kommt in
Ralia die Wanduhrzeit der Verbindungszone an.

---

## 6. Ganztägig: eine Ableitung, zwei Konventionen

`database.types.ts` dokumentiert eine Ableitung und behauptet, sie liege in `@ralia/core` —
sie liegt dort nicht. Was existiert, ist eine abweichende Regel in `CalendarScreen.tsx:523`.
Im Bestand stehen beide Konventionen nebeneinander:

| Muster          | Zeilen | vom neuen Client als ganztägig erkannt |
| --------------- | ------ | -------------------------------------- |
| `00:00`–`23:59` | 363    | ja                                     |
| `00:00`–`00:00` | 102    | **nein**                               |

Die 11 mehrtägigen unter den 102 laufen über 2 bis 21 Tage — ein Termin über drei Wochen
von Mitternacht bis Mitternacht ist ein Urlaub, kein Zeitfenster. Die Ganztags-Lesart ist
für alle 102 richtig.

Entscheidung, freigegeben am 2026-08-12:

- `isAllDay()` wandert nach `@ralia/core`.
- **Lesen** erkennt beide Konventionen.
- **Schreiben** — auch das des Imports — erzeugt nur `00:00`–`23:59`.
- Keine Datenmigration. Die Altzeilen bleiben, wie sie sind, und werden nur richtig gelesen.

Sichtbare Folge: die 102 Termine stehen künftig als „ganztägig" in der Oberfläche statt als
„00:00–00:00". Kein Schreibvorgang, keine geänderte Zeile.

Googles ganztägige Termine kommen als `start.date` / `end.date` mit **ausschließlichem**
Ende; Ralias Enddatum ist einschließlich. Ohne den Tag Abzug bekäme jeder importierte
Ganztags-Termin einen Tag zu viel.

---

## 7. Die 445 Alt-`google_event_id` werden ignoriert

Sie stammen aus dem 1.x-Sync und zeigen in den primären Google-Kalender. `events.google_event_id`
wird von v1 **nicht gelesen und nicht geschrieben**; die Zuordnung liegt ausschließlich in
`private.google_event_mappings`. Die Spalte bleibt stehen — sie zu leeren würde Information
vernichten, die sich nicht zurückholen lässt.

Folge: importiert jemand denselben Kalender, aus dem 1.x einst exportiert hat, entstehen
Dubletten der alten Termine. Wer das nicht will, wählt diesen Kalender nicht als Quelle.
Der Screen weist beim Auswählen darauf hin.

---

## 8. Was der Import tut — und was nicht

| Fall in Google                       | Was in Ralia passiert                              |
| ------------------------------------ | -------------------------------------------------- |
| neuer Termin                         | wird angelegt                                      |
| Termin geändert                      | die Ralia-Kopie wird überschrieben                 |
| Termin unverändert                   | nichts                                             |
| Termin gelöscht                      | **nichts** — nur eine Zeile im Protokoll           |
| Serie (Master oder Ausnahme)         | **nichts** — übersprungen und im Protokoll benannt |
| Termin, den Ralia nie importiert hat | unerreichbar — es gibt keine Zuordnung             |

### Importierte Termine gehören Google

Das ist die Entscheidung, die das gesamte Konflikt-System einspart. Ändert sich ein Termin
in Google, wird die Ralia-Kopie überschrieben — auch dann, wenn jemand sie in Ralia
bearbeitet hat.

Der Schaden ist eng begrenzt, und zwar durch die Zuordnungstabelle: **der Import fasst
ausschließlich Termine an, die er selbst angelegt hat.** Ein von Hand erstellter Ralia-Termin
hat keine Zuordnung und ist damit unerreichbar, egal was in Google passiert.

Der Screen sagt das beim Einschalten in einem Satz. Eine Regel, die man erklären kann, ist
besser als eine Konfliktoberfläche, die niemand bedienen will.

### Gelöscht wird nie

Verschwindet ein Termin in Google, bleibt die Ralia-Kopie stehen. Ein Knopf mit der
Aufschrift „Importieren" darf keine Termine löschen — auch beim zehnten Lauf nicht.

Das ist die eine Stelle, an der die Besitzregel oben nicht durchgezogen wird, und mit
Absicht: ein Überschreiben ist wiederherstellbar, weil der Inhalt in Google steht. Eine
Löschung ist es nicht.

Das Protokoll meldet „in Google gelöscht, in Ralia behalten", damit die Abweichung sichtbar
ist statt still.

### Serien werden übersprungen, nicht verstümmelt

Ralia kennt `FREQ` in vier Stufen, ein Intervall und ein Enddatum. Google kennt RRULE
vollständig — `BYSETPOS`, mehrere `BYDAY`, `RDATE`, mehrere `RRULE`. Der überwiegende Teil
davon lässt sich in Ralias Modell nicht darstellen.

v1 importiert deshalb **keine** Serien. Erkennbar sind sie an Googles `recurrence`
(der Master) beziehungsweise `recurringEventId` (eine Ausnahme). Beide werden übersprungen
und je Termin als `skipped` mit Grund protokolliert; der Screen fasst zusammen: „4 Serien
aus Google übersprungen."

Nicht importiert wird auch nichts _stattdessen_ — keine plattgeklopften Einzeltermine, keine
Teilserie. Ein fehlender Termin ist ein sichtbares Problem, ein falscher ein unsichtbares.

---

## 9. Änderungserkennung über den Inhalt, nicht über den ETag

Naheliegend wäre, Googles `etag` zu speichern und bei Abweichung neu zu schreiben. Das wäre
falsch, und zwar aus einem konkreten Grund: an `events` hängt der Trigger
`trg_events_rebuild_reminder_jobs`. Jeder Schreibvorgang baut die Erinnerungs-Jobs des
Termins neu. Googles ETag ändert sich auch bei Dingen, die Ralia gar nicht abbildet — einer
geänderten Google-Erinnerung, einem Teilnehmerstatus. Der Import würde dann Zeilen
umschreiben, die sich fachlich nicht geändert haben, und dabei Erinnerungs-Jobs neu bauen.

Deshalb speichert jede Zuordnung einen **Fingerabdruck über genau die Felder, die v1
abbildet** — Name, Ort, Notizen, Start, Ende, Ganztags-Kennung. Geschrieben wird nur, wenn
dieser sich ändert.

Der Fingerabdruck ist ein kanonischer String, kein Hash. Bei dieser Datenmenge kostet das
nichts, ist ohne Krypto synchron testbar, und wenn ein Lauf sich einmal falsch verhält,
steht lesbar im Feld, worauf verglichen wurde.

### Feldabbildung

| Google                                | Ralia                                                          |
| ------------------------------------- | -------------------------------------------------------------- |
| `summary`                             | `name` (leer → „Ohne Titel")                                   |
| `location`                            | `location`                                                     |
| `description`                         | `notes`                                                        |
| `start.dateTime`                      | `start_date` + `start_time`, umgerechnet nach 5                |
| `end.dateTime`                        | `end_date` + `end_time`                                        |
| `start.date` / `end.date` (ganztägig) | `start_date`, `end_date` = `end.date` − 1 Tag, `00:00`–`23:59` |
| —                                     | `belongs_to` = `both`                                          |
| —                                     | `created_by` = der importierende Nutzer                        |
| `attendees`, `reminders`, `colorId`   | **nicht übernommen**                                           |

`belongs_to = 'both'` ist die Bedeutung, die ein von außen hereingereichter Termin in einem
Paarkalender hat. Beim Überschreiben bleibt ein in Ralia geändertes `belongs_to` **erhalten**
— es ist kein abgebildetes Feld, also fasst der Import es nach dem Anlegen nicht mehr an.

---

## 10. Betriebsarten

Zwei, nicht sechs:

|                     | Wirkung                                        |
| ------------------- | ---------------------------------------------- |
| **Jetzt laden**     | ein Lauf, beliebig oft wiederholbar            |
| **Alle 10 Minuten** | getaktet, jederzeit pausierbar und fortsetzbar |

_Jetzt laden_ ist auch während einer Pause bedienbar — Pausieren hält den Takt an, es
schaltet nichts ab.

Der Takt läuft über `pg_cron` und `pg_net` gegen `google-sync-api/run`, mit einem Shared
Secret im Header. Dasselbe Muster, das `ralia-reminder-worker` seit Monaten fehlerfrei
fährt.

Je Quell-Kalender wird Googles `syncToken` mitgeführt. Antwortet Google mit `410 Gone`, ist
er verfallen: Vollabgleich, neuer Token. Fehler zählen auf der Verbindung hoch und verzögern
exponentiell (10 min → 20 → 40 → … → max 6 h); ein erfolgreicher Lauf setzt zurück.

Zwei Läufe derselben Bindung dürfen sich nie überlappen. Ein Lock (`locked_at`) auf der
Bindung reicht; der zweite Lauf verwirft sich selbst statt zu warten.

---

## 11. Datenmodell

Alles im Schema `private` — von PostgREST nicht erreichbar, nur die Function kommt mit dem
Service-Role-Key heran. Keine RLS-Policies, weil kein Client-Zugriff existiert.

```
private.google_connections
  id, user_id, google_sub, google_email, time_zone,
  refresh_token_encrypted, granted_scopes[],
  status ('active' | 'needs_reauth' | 'revoked'),
  failure_count, retry_after, last_run_at, created_at, updated_at
  -- eine nicht widerrufene Verbindung je Nutzer

private.google_oauth_states
  state, user_id, code_verifier, nonce, redirect_to, expires_at, created_at
  -- fuenf Minuten Frist, nach Gebrauch geloescht

private.google_import_bindings
  id, connection_id, calendar_id (Ralia),
  schedule ('off' | 'active' | 'paused'),
  first_real_run_allowed_at,       -- erst nach bestandenem Probelauf
  locked_at, last_run_at, is_active, created_at
  -- eine aktive Bindung je (connection_id, calendar_id)

private.google_import_sources
  id, binding_id, google_calendar_id, google_calendar_name,
  sync_token, is_active, created_at
  -- der syncToken haengt an der Quelle, nicht an der Bindung: Google
  --   vergibt ihn je Kalender

private.google_event_mappings
  id, binding_id, source_id, google_event_id, ralia_event_id,
  fingerprint, last_synced_at
  -- unique (binding_id, google_event_id)
  -- unique (ralia_event_id)  — ein Ralia-Termin gehoert hoechstens einem Import

private.google_import_runs
  id, connection_id, binding_id, trigger ('cron' | 'manual'), dry_run,
  started_at, finished_at,
  created, updated, unchanged, skipped, deletions_reported, error

private.google_import_changes
  id, run_id, mapping_id, action ('created' | 'updated' | 'skipped' | 'deleted_in_google'),
  title, reason, at
```

Was der Client sehen darf, kommt über `SECURITY DEFINER`-Funktionen in `public`, die auf
`auth.uid()` prüfen und nie ein Token zurückgeben:

```
public.google_connection_status()   -> Zustand, E-Mail, Zeitzone, Takt, Probelauf-Freigabe
public.google_import_recent()       -> die letzten 20 Laeufe fuers Protokoll
```

---

## 12. Der Lauf

1. **Sperren.** `locked_at` setzen; ist es jünger als 15 Minuten, verwirft sich der Lauf.
2. **Zugang.** Access-Token aus dem Refresh-Token. Bei `invalid_grant`: Verbindung auf
   `needs_reauth`, Lauf beenden, Screen verlangt Neuanmeldung.
3. **Je Quell-Kalender** `events.list` mit `syncToken`, sonst Vollabgleich ab heute minus
   30 Tage.
4. **Je Termin** entscheiden:
   - Serie (hat `recurrence` oder `recurringEventId`) → `skipped`
   - `status: "cancelled"` → `deleted_in_google`, nichts tun
   - keine Zuordnung → Ralia-Termin anlegen, Zuordnung anlegen
   - Zuordnung vorhanden, Fingerabdruck gleich → nichts
   - Zuordnung vorhanden, Fingerabdruck verschieden → Ralia-Termin überschreiben
5. **Abschließen.** `syncToken` je Quelle sichern, Lauf protokollieren, Fehlerzähler
   zurücksetzen, Sperre lösen.

**Probelauf.** Mit `dry_run` läuft alles bis Schritt 4 unverändert, aber statt zu schreiben
entsteht nur die Protokollzeile mit der Handlung, die stattgefunden hätte. Weder `events`
noch die Zuordnungen noch die `syncToken` werden angefasst.

**Der erste Lauf einer Bindung ist zwingend ein Probelauf.** Erst ein fehlerfreier Probelauf
setzt `first_real_run_allowed_at` und gibt _Jetzt laden_ frei.

Der Lauf ist **idempotent**: der zweite Druck auf den Knopf legt nichts doppelt an, dafür
sorgen die Unique-Indizes auf den Zuordnungen.

---

## 13. Der Screen

`SyncScreen.tsx` wird ersetzt. Die Fixtures `MOCK_SYNC_ACCOUNTS`, `MOCK_CALENDARS`,
`MOCK_CONFLICT` und `MOCK_SYNC_LOG` verschwinden aus `mock/fixtures.ts`.

Zustände:

- **Nicht verbunden** — was der Import tut, welcher Zugriff erteilt wird, Ankündigung des
  Warnbildschirms aus 2, Knopf _Mit Google verbinden_.
- **Verbunden, keine Quelle gewählt** — Liste der Google-Kalender mit Auswahl, dazu der
  Hinweis aus 7 zum primären Kalender.
- **Verbunden, Quellen gewählt** — Konto, Zeitzone, Quellen, letzter Lauf, _Probelauf
  starten_, _Jetzt laden_ (gesperrt bis zum Probelauf), Schalter _Alle 10 Minuten_ mit
  _Pausieren_ / _Fortsetzen_.
- **Hinweise** — übersprungene Serien und in Google gelöschte Termine, im Klartext.
- **Protokoll** — die letzten Läufe mit Zahlen und Fehlern; leer heißt `EmptyState`, nicht
  erfundene Zeilen.
- **Neuanmeldung nötig** — bei `needs_reauth`, mit Grund.

Beim Einschalten steht der Satz zur Besitzregel aus 8: „Termine aus Google werden bei jedem
Lauf aktualisiert. Änderungen, die Du in Ralia daran machst, gehen dabei verloren. Deine
eigenen Ralia-Termine bleiben unberührt."

Die Richtungsauswahl der Attrappe (`both` / `toGoogle` / `fromGoogle`) entfällt ersatzlos —
es gibt nur noch eine Richtung.

---

## 14. Vorarbeiten

1. ~~Neuer OAuth-Client, alter gelöscht, Status _In Produktion_, drei Secrets.~~
   **Erledigt am 2026-08-12.**
2. `clearAuthData()` räumt `googleSyncState` — ein Legacy-Schlüssel, der die Abmeldung
   überlebt.
3. `isAllDay()` nach `@ralia/core`, beide Konventionen lesend (6).
4. **Datenbank-Sicherung** unmittelbar vor dem ersten echten Lauf gegen den produktiven
   Kalender. Der Probelauf ersetzt sie nicht.

---

## 15. Teststrategie

Rein, ohne Netz, in `packages/core/src/google/`:

- **Zeitumrechnung** — Sommer- und Winterzeit, die Umstellungsnacht, eine andere Zone als
  die der Verbindung.
- **Ganztägig** — Googles ausschließliches Ende zurück auf Ralias einschließliches, ein-
  und mehrtägig.
- **Fingerabdruck** — gleiche Felder gleicher Wert; ein geänderter Titel ändert ihn; ein
  geänderter ETag ohne Feldänderung ändert ihn **nicht**.
- **Serienerkennung** — Master, Ausnahme, Einzeltermin.

Gegen einen nachgebauten Google-Klienten:

- `410 Gone` → Vollabgleich, `401` → Neuanmeldung, `403 rateLimitExceeded` → Backoff.
- Zweimal derselbe Lauf → beim zweiten Mal `created = 0`.
- Zwei gleichzeitige Läufe → der zweite verwirft sich.

Live nur mit den freigegebenen Testkonten und `QA:`-Datensätzen. **Der produktive Kalender
ist kein Testgelände**: dort beginnt es mit Sicherung und Probelauf.

---

## 16. Abnahmekriterien

1. Verbinden allein löst nichts aus; ohne gewählte Quelle läuft kein Import.
2. Der erste Lauf ist ein Probelauf und schreibt nachweislich nichts — `events` unverändert,
   keine Zuordnung, kein `syncToken`.
3. _Jetzt laden_ holt neue Google-Termine nach Ralia. Zweimal gedrückt legt es nichts
   doppelt an.
4. Ein in Google geänderter Termin wird beim nächsten Lauf in Ralia aktualisiert.
5. Ein in Google **unveränderter** Termin erzeugt keinen Schreibvorgang — nachweisbar an
   `events.updated_at`, das gleich bleibt.
6. Ein in Google gelöschter Termin bleibt in Ralia stehen und erscheint im Protokoll.
7. Eine Google-Serie wird nicht importiert und im Screen benannt.
8. Ein von Hand in Ralia erstellter Termin wird von keinem Lauf angefasst.
9. Ganztägige Google-Termine kommen mit dem richtigen Enddatum an, ein- und mehrtägig.
10. Ein Termin um 10:00 Berliner Zeit steht in Ralia als `10:00`, auch über die
    Zeitumstellung hinweg.
11. _Alle 10 Minuten_ läuft getaktet; _Pausieren_ stoppt binnen eines Zyklus; _Jetzt laden_
    geht auch während der Pause.
12. Kein Token verlässt je den Server.
13. `npm run verify` grün.
