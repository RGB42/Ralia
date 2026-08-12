# SP5a — Google-Kalender-Sync v1

Stand: 2026-08-12 · Status: Entwurf zur Abnahme · Vorgänger: [Release-Audit](../../2026-08-12-release-audit.md)

## Ziel

Ein Ralia-Nutzer verbindet sein Google-Konto. Danach hält Ralia genau einen dafür
angelegten Google-Kalender namens **Ralia** bidirektional mit dem Ralia-Kalender in
Deckung, den der Nutzer gerade sieht — serverseitig, alle zehn Minuten, zusätzlich auf
Knopfdruck. Termine aus anderen Google-Kalendern kommen nur auf ausdrückliche Anweisung
herein, nie automatisch.

Der Screen unter `/profil/sync` hört auf, eine funktionierende Synchronisierung
vorzutäuschen, und zeigt den echten Zustand.

## Abgrenzung

**In Scope:** OAuth-Verbindung, dedizierter Google-Kalender, bidirektionaler Abgleich von
Einzelterminen und Serien inklusive Ausnahmen, Löschungen in beide Richtungen, manueller
Import aus ausgewählten Google-Kalendern, manueller Export, Konflikterkennung mit
Nutzerentscheidung, Statusanzeige, Fehler- und Änderungsprotokoll.

**Nicht in Scope für v1:** ICS-Import/-Export und Feed-URL (eigener Zyklus), Google-Push
über `watch`-Kanäle (Polling reicht bei zehn Minuten), Teilnehmer, Gäste,
Verfügbarkeiten, Anhänge, Farben pro Termin, mehr als ein Google-Konto je Ralia-Nutzer,
Zeitzonen je Termin.

---

## 1. Ausgangslage

Geprüft am 2026-08-12 gegen das laufende Projekt, nicht aus dem Handoff übernommen.

| Befund                                                                                 | Konsequenz                                                                       |
| -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `SyncScreen.tsx` ist vollständig Attrappe, „Jetzt synchronisieren" ist ein No-op       | Wird ersetzt, nicht erweitert                                                    |
| Kein `google-sync-api`, kein Token-Schema, kein Mapping                                | Alles neu, quellversioniert                                                      |
| Alter OAuth-Client nutzt `redirect_uri: "postmessage"`, kein Redirect-URI hinterlegt   | Neuer Client nötig, siehe [Release-Audit 2.1](../../2026-08-12-release-audit.md) |
| Der alte Host `ralia.onrender.com` antwortet 503                                       | Die alten `/api/google/*`-Routen sind tot                                        |
| **445 von 709 Events tragen bereits eine `google_event_id`** aus Ralia 1.x             | Migrationsentscheidung nötig, siehe 2.7                                          |
| `events` speichert `date` + `time without time zone`, keine Zeitzone                   | Zeitzonenentscheidung nötig, siehe 2.5                                           |
| Es gibt keine `all_day`-Spalte; die Konvention ist uneinheitlich                       | Vorarbeit nötig, siehe 2.6                                                       |
| `recurrence_type` kennt nur `daily`/`weekly`/`monthly`/`yearly` + Intervall + Enddatum | Google→Ralia ist die verlustbehaftete Richtung                                   |
| `pg_cron` + `pg_net` treiben bereits `ralia-reminder-worker` jede Minute               | Muster für den Poller steht, wird übernommen                                     |

---

## 2. Getroffene Entscheidungen

### 2.1 Veröffentlichungsstatus: Produktion, unverifiziert

Das war die einzige Frage, die das Audit offenlassen musste. Sie ist entschieden.

Google verlangt für sensible Scopes eine Verifizierung, **nennt aber ausdrücklich eine
Ausnahme für den privaten Gebrauch**: wer der einzige Nutzer ist oder „a few users, all of
whom are known personally to you" hat, braucht sie nicht. Ralia mit zwei Personen fällt
genau darunter.

Daraus folgt: Veröffentlichungsstatus **In Produktion**, ohne Verifizierung.

Der Status _Testing_ wäre die falsche Wahl: bei externem Nutzertyp widerruft Google dort
Refresh-Tokens **nach sieben Tagen**. Ein serverseitiger Sync alle zehn Minuten wäre damit
wöchentlich tot. In Produktion laufen die Tokens nicht ab.

Der Preis ist ein einmaliger Warnbildschirm beim Verbinden („Google hat diese App nicht
bestätigt" → _Erweitert_ → _Weiter_) und eine Obergrenze an Konten, die bei zwei Nutzern
nicht greift. Das ist der richtige Tausch.

### 2.2 Scopes: so eng wie möglich, Import erst bei Bedarf

Beim Verbinden fragt Ralia **einen** Scope:

```
https://www.googleapis.com/auth/calendar.app.created
```

Er erlaubt genau das, was v1 braucht: eigene Zweitkalender anlegen und die selbst
angelegten vollständig verwalten. Der übrige Google-Kalender des Nutzers bleibt für Ralia
unsichtbar. Das ist ein deutlich kleinerer Radius als das `calendar` der Altversion.

Für den manuellen Import aus anderen Kalendern kommt zusätzlich

```
https://www.googleapis.com/auth/calendar.readonly
```

dazu — aber **inkrementell**, erst wenn der Nutzer den Import wirklich benutzt, über einen
zweiten Zustimmungsdialog. Wer nie importiert, gibt Ralia nie Lesezugriff auf seine
übrigen Kalender.

Das ist der Grund, warum sich der Aufwand lohnt, obwohl die Verifizierung ohnehin entfällt:
der Schaden eines gestohlenen Tokens bleibt auf den Ralia-Kalender begrenzt.

### 2.3 OAuth: Authorization Code mit PKCE, vollständig serverseitig

Der Browser sieht nie ein Token. Ablauf:

1. Client ruft `POST /google-sync-api/oauth/start` (JWT-geschützt). Der Server erzeugt
   `state`, `code_verifier` und `nonce`, legt sie mit fünf Minuten Frist in
   `private.google_oauth_states` ab und antwortet mit der Google-Autorisierungs-URL.
2. Der Nutzer autorisiert bei Google. Google leitet auf
   `GET /google-sync-api/oauth/callback` um.
3. Der Server prüft `state`, tauscht Code gegen Tokens, verschlüsselt das Refresh-Token,
   legt die Verbindung an und leitet zurück nach `/profil/sync`.

`access_type=offline`, `prompt=consent` beim ersten Mal (sonst liefert Google kein
Refresh-Token), `include_granted_scopes=true` für die inkrementelle Erweiterung.

Redirect-URI:
`https://nyvripddydrzvfuateea.supabase.co/functions/v1/google-sync-api/callback`

### 2.4 Token-Verwahrung

- Refresh-Token: AES-GCM-verschlüsselt in `private.google_connections`. Schlüssel aus dem
  Supabase-Secret `GOOGLE_TOKEN_KEY`, nie im Repo, nie in einer Migration.
- **Access-Tokens werden nicht gespeichert.** Jeder Lauf holt sich eins aus dem
  Refresh-Token. Das kostet eine Anfrage und spart ein zweites Geheimnis mit Ablaufdatum
  samt der Fehlerklasse, die dazugehört.
- Der Client bekommt nie ein Token zu sehen, weder im Zustand noch im Netzwerkverkehr.
- `google-sync-api` läuft mit `verify_jwt: true` für alle Nutzerrouten. Nur `oauth/callback`
  und `run` sind ausgenommen — der Callback kommt von Google ohne JWT und prüft stattdessen
  `state`, `run` kommt vom Cron und prüft ein Shared Secret im Header.

### 2.5 Zeitzone: eine je Verbindung, nicht je Termin

`events` speichert `date` + `time without time zone`. Das sind schwebende Ortszeiten ohne
Zeitzone. Google verlangt für jeden Zeitpunkt eine Zone.

Entscheidung: die Verbindung trägt **eine** Zeitzone (`private.google_connections.time_zone`),
gelesen beim Anlegen aus dem Google-Kalender selbst, Rückfall `Europe/Berlin`.

- Export: die schwebende Ralia-Zeit wird in dieser Zone interpretiert.
- Import: der Google-Zeitpunkt wird in diese Zone umgerechnet, dann wird der Versatz
  fallengelassen.

Bewusst **keine** `time_zone`-Spalte auf `events`. Die würde jede Ansicht, jede
Serien-Expansion und jede Zeile in Produktion berühren — eine Umstellung des ganzen
Kalendermodells, nicht ein Sync-Feature. Für zwei Personen in einer Zeitzone ist der
Gewinn null.

Die Folge wird offen dokumentiert: legt jemand im Ausland in Google einen Termin an, kommt
in Ralia die Wanduhrzeit der Verbindungszone an. Wenn das je stört, ist die Zeitzone je
Termin ein eigenes Projekt.

### 2.6 Ganztägig: eine Ableitung, zwei Konventionen

Hier liegt ein bestehender Fehler, den der Sync sonst nach Google weiterträgt.

`database.types.ts` dokumentiert die 1.x-Ableitung als „`start_date === end_date &&
isMidnight(start_time) && isMidnight(end_time)`" und behauptet, sie liege in `@ralia/core`.
Sie liegt dort nicht — es gibt sie nirgends. Was es gibt, ist eine andere Regel, direkt in
[CalendarScreen.tsx:523](../../../apps/app/src/screens/calendar/CalendarScreen.tsx#L523):
`start_time === '00:00' && end_time === '23:59'`.

In der Produktionsdatenbank stehen beide Konventionen nebeneinander:

| Muster          | Zeilen | Vom neuen Client als ganztägig erkannt |
| --------------- | ------ | -------------------------------------- |
| `00:00`–`23:59` | 363    | ja                                     |
| `00:00`–`00:00` | 102    | **nein**                               |

Die 102 Altzeilen zeigt der neue Client also als Termin von Mitternacht bis Mitternacht.
Ohne Korrektur exportiert der Sync sie genau so nach Google.

Entscheidung, als Vorarbeit vor der Sync-Implementierung:

- `isAllDay(event)` wandert nach `@ralia/core` — dorthin, wo die Dokumentation sie ohnehin
  verortet.
- **Lesen** erkennt beide Konventionen: `00:00`–`23:59` **oder** `00:00`–`00:00`.
- **Schreiben** erzeugt weiterhin nur `00:00`–`23:59`.
- Keine Datenmigration. Die Altzeilen bleiben, wie sie sind; sie werden nur richtig
  gelesen. Das ist umkehrbar, eine Migration wäre es nicht.

Ganztägige Termine gehen als Googles `date` (statt `dateTime`) über die Leitung, mit
exklusivem Enddatum — Googles Konvention, Ralias Enddatum ist inklusiv.

### 2.7 Die 445 Alt-`google_event_id` werden ignoriert

Sie stammen aus dem 1.x-Sync, der in den **primären** Google-Kalender geschrieben hat. v1
schreibt in einen eigens angelegten Kalender und hat auf den primären gar keinen Zugriff
mehr (2.2).

Entscheidung: `events.google_event_id` wird von v1 **nicht gelesen und nicht geschrieben**.
Die Spalte bleibt stehen — sie zu leeren würde Information vernichten, die sich nicht
zurückholen lässt.

Folge, die vor dem ersten Verbinden bekannt sein muss: die alten Ralia-Termine liegen
weiterhin im primären Google-Kalender und werden nicht mehr aktualisiert. Wer sie nicht
doppelt sehen will, löscht sie in Google selbst. Ein Aufräum-Werkzeug dafür wäre nur mit
Schreibzugriff auf den primären Kalender möglich — den will v1 ausdrücklich nicht haben.
Das ist der Preis des kleinen Scopes und er ist ihn wert.

### 2.8 Paar-Semantik: die Bindung hängt am Kalender, nicht am Nutzer

Jeder Ralia-Nutzer verbindet sein eigenes Google-Konto und bekommt seinen eigenen
Google-Kalender „Ralia". Beide Partner spiegeln denselben gemeinsamen Ralia-Kalender in
zwei verschiedene Google-Kalender. Das ist gewollt: jeder sieht die gemeinsamen Termine in
seinem eigenen Google.

Die Bindung trägt deshalb **beides**: Verbindung _und_ `calendar_id`. Wechselt der
Ralia-Kalender — Partner verbinden, Partner trennen —, wechselt die aktive Bindung mit.
Alte Bindungen und ihre Mappings werden **deaktiviert, nicht gelöscht**, genau wie
`calendar_memberships` es für die Mitgliedschaft macht. Ein Wiederverbinden desselben Paars
findet dieselbe Bindung wieder vor und synchronisiert weiter, statt alles doppelt anzulegen.

Beim Trennen wird zusätzlich der Google-Kalender **nicht** geleert. Die Historie bleibt in
Google stehen; Ralia hört nur auf, sie anzufassen. Alles andere wäre eine Löschung, die der
Nutzer nicht angeordnet hat.

### 2.9 Änderungserkennung über Inhalts-Hashes, nicht über Zeitstempel

Das ist die Entscheidung, an der Schleifenfreiheit hängt.

Bei einem Paar läuft eine Änderung im Kreis: A ändert in Google → Import nach Ralia →
Ralias `updated_at` springt → B exportiert nach B-Google → **und A exportiert auch**, denn
für A hat sich Ralia seit dem letzten Abgleich ja auch geändert. Über Zeitstempel allein
schriebe A die eigene Änderung nach Google zurück, Google bumpt das `updated`, der nächste
Lauf importiert wieder — eine Schleife, die nie zur Ruhe kommt.

Deshalb hält jedes Mapping eine **Baseline** aus zwei Hashes: `ralia_hash` und
`google_hash`, jeweils über den normalisierten fachlichen Inhalt der zuletzt erfolgreich
abgeglichenen Fassung. Zeitstempel und ETag dienen nur als billiger Vorfilter, entscheiden
aber nichts.

```
ralia_geaendert  := hash(ralia_jetzt)  != mapping.ralia_hash
google_geaendert := hash(google_jetzt) != mapping.google_hash
```

| Fall                                                  | Verhalten                                  |
| ----------------------------------------------------- | ------------------------------------------ |
| keins von beidem                                      | nichts tun                                 |
| nur Ralia                                             | nach Google schreiben, Baseline neu setzen |
| nur Google                                            | nach Ralia schreiben, Baseline neu setzen  |
| beide, aber `hash(ralia_jetzt) == hash(google_jetzt)` | nichts schreiben, nur Baseline neu setzen  |
| beide, Inhalte verschieden                            | **Konflikt** — keine Seite schreiben       |

Der vierte Fall ist der, der die Schleife oben abschneidet: A exportiert nicht, weil Google
schon denselben Inhalt hat.

Der Hash geht über die fachlichen Felder, die v1 abgleicht — Name, Ort, Notizen, Start,
Ende, Ganztags-Kennung, Serienregel —, ausdrücklich **nicht** über `belongs_to`,
`category`, Erinnerungen oder IDs. Die haben in Google keine Entsprechung und dürfen keinen
Schreibvorgang auslösen.

### 2.10 Konflikte: der Nutzer entscheidet, nichts wird überschrieben

Kein Last-Write-Wins. Ein Konflikt erzeugt eine Zeile in `google_sync_conflicts` mit beiden
Fassungen und lässt **beide Seiten unangetastet**. Der betroffene Termin wird für weitere
automatische Läufe übersprungen, bis entschieden ist — sonst meldete jeder Lauf denselben
Konflikt neu.

Im Screen stehen zwei Knöpfe: _Ralia behalten_ und _Google behalten_. Die Entscheidung
schreibt die gewählte Fassung auf die andere Seite, setzt die Baseline und schließt den
Konflikt.

### 2.11 Serien: eng abbilden, Unabbildbares melden statt verstümmeln

Ralia kennt `FREQ` in vier Stufen, ein Intervall und ein Enddatum. Google kennt RRULE
vollständig. Die Abbildung ist deshalb asymmetrisch.

**Ralia → Google** ist verlustfrei:
`RRULE:FREQ={DAILY|WEEKLY|MONTHLY|YEARLY};INTERVAL={n}[;UNTIL={recurrence_end_date}]`

**Google → Ralia** akzeptiert nur, was Ralia darstellen kann:

| Google                                                               | Ralia                                       |
| -------------------------------------------------------------------- | ------------------------------------------- |
| genau eine `RRULE`, `FREQ` in den vier Stufen                        | übernommen                                  |
| `INTERVAL`                                                           | übernommen                                  |
| `UNTIL`                                                              | `recurrence_end_date`                       |
| `COUNT`                                                              | zu `UNTIL` ausgerechnet — verlustfrei genug |
| `BYDAY` mit genau dem Wochentag des Masters bei `FREQ=WEEKLY`        | akzeptiert, ist gleichbedeutend             |
| alles Übrige (`BYSETPOS`, mehrere `BYDAY`, `RDATE`, mehrere `RRULE`) | **nicht importiert**                        |

Nicht Importiertes wird nicht stillschweigend plattgeklopft und nicht als Einzeltermin
angelegt. Es bekommt eine Zeile in `google_sync_changes` mit `skipped` und einem Grund, und
der Screen zeigt es an: „3 Google-Serien nutzen Regeln, die Ralia nicht abbilden kann."

Ausnahmen bilden aufeinander ab: Ralias `recurring_event_exceptions` mit
`original_occurrence_date` entspricht Googles Instanz mit `recurringEventId` +
`originalStartTime`. `is_deleted` entspricht `status: "cancelled"`, `override_event_data`
entspricht einer geänderten Instanz. Master und Ausnahme bekommen getrennte Mappings.

### 2.12 Löschungen gehen in beide Richtungen durch

- Ralia gelöscht → der Google-Termin im Ralia-Kalender wird gelöscht.
- Google gelöscht (`status: "cancelled"` im inkrementellen Lauf) → der Ralia-Termin wird
  gelöscht.

Beides wird protokolliert. Eine Löschung in Google ist eine ausdrückliche Nutzerhandlung;
sie nicht durchzureichen wäre die größere Überraschung. Betroffen sind ausschließlich
Termine mit einem Mapping dieser Verbindung — was Ralia nie exportiert hat, kann Google
auch nicht löschen.

### 2.13 Poller nach dem Muster des Reminder-Workers

`pg_cron` alle zehn Minuten, `pg_net` ruft `google-sync-api/run` mit einem Shared Secret
im Header. Genau das Muster, das `ralia-reminder-worker` seit Monaten fehlerfrei fährt —
kein zweiter Mechanismus für dieselbe Aufgabe.

Der Lauf nutzt Googles `syncToken` je Bindung. Antwortet Google mit `410 Gone`, ist der
Token verfallen: Vollabgleich, neuer Token. Fehler zählen auf der Verbindung hoch und
verzögern exponentiell (10 min → 20 → 40 → … → max 6 h); ein erfolgreicher Lauf setzt
zurück.

### 2.14 `/config` wird nicht angefasst

Google-Sync braucht von `app-api` nichts. Die Client-ID muss der Browser nie kennen, weil
`oauth/start` die fertige Autorisierungs-URL zurückgibt; den Verbindungszustand liefert
`public.google_connection_status()`. Es gibt deshalb weder einen neuen Config-Endpunkt noch
eine Änderung am bestehenden.

Damit hängt dieses Sub-Projekt **nicht** an der Versionierung von `app-api`
([Release-Audit 2.3](../../2026-08-12-release-audit.md)). Zwei unabhängige Baustellen sind
besser als eine Reihenschaltung.

Die Felder `googleClientId` und `googleRedirectUri`, die `/config` heute noch ausliefert,
gehören zum toten 1.x-Flow. Sie verschwinden, wenn `app-api` ohnehin angefasst wird — nicht
vorher, und nicht als Teil dieses Projekts.

---

## 3. Datenmodell

Alles im Schema `private` — von PostgREST nicht erreichbar, nur die Funktion selbst kommt
mit dem Service-Role-Key heran. Keine RLS-Policies, weil kein Client-Zugriff existiert.

```
private.google_connections
  id, user_id, google_sub, google_email, time_zone,
  refresh_token_encrypted, granted_scopes[],
  status ('active' | 'needs_reauth' | 'revoked'),
  failure_count, retry_after, last_run_at, created_at, updated_at
  -- eine aktive Verbindung je Nutzer (partieller Unique-Index)

private.google_calendar_bindings
  id, connection_id, calendar_id (Ralia), google_calendar_id (der Ralia-Kalender),
  sync_token, is_active, last_full_sync_at
  -- eine aktive Bindung je (connection_id, calendar_id)

private.google_event_mappings
  id, binding_id, ralia_event_id, google_event_id,
  kind ('master' | 'exception' | 'single'),
  ralia_exception_id, occurrence_date,
  ralia_hash, google_hash, google_etag,
  state ('synced' | 'conflicted' | 'deleted'),
  last_synced_at
  -- unique (binding_id, ralia_event_id, occurrence_date) NULLS NOT DISTINCT
  --   Ohne NULLS NOT DISTINCT waere die Zusicherung wertlos: `occurrence_date`
  --   ist bei Master und Einzeltermin NULL, und Postgres haelt NULLs im
  --   Unique-Index standardmaessig fuer verschieden — zwei Mappings desselben
  --   Events kaemen anstandslos durch, und genau das soll der Index verhindern.
  -- unique (binding_id, google_event_id)

private.google_sync_conflicts
  id, mapping_id, detected_at, ralia_snapshot jsonb, google_snapshot jsonb,
  resolution ('pending' | 'kept_ralia' | 'kept_google'), resolved_at, resolved_by

private.google_sync_runs
  id, connection_id, started_at, finished_at,
  trigger ('cron' | 'manual' | 'import' | 'export'),
  imported, exported, skipped, conflicts, error

private.google_sync_changes
  id, run_id, mapping_id, direction ('import' | 'export'),
  action ('created' | 'updated' | 'deleted' | 'skipped'), reason, at

private.google_oauth_states
  state, user_id, code_verifier, nonce, redirect_to, expires_at
  -- fünf Minuten Frist, nach Gebrauch gelöscht
```

Was der Client sehen darf, kommt über `SECURITY DEFINER`-Funktionen in `public`, die auf
`auth.uid()` prüfen und **nie** ein Token, einen `code_verifier` oder ein Secret
zurückgeben:

```
public.google_connection_status()   -> Zustand, E-Mail, Zeitzone, Scopes, letzter Lauf
public.google_sync_conflicts_open() -> offene Konflikte mit beiden Fassungen
public.google_sync_recent()         -> die letzten Läufe und Änderungen fürs Protokoll
```

---

## 4. Der Abgleich

Ein Lauf je aktiver Bindung, in dieser Reihenfolge:

1. **Zugang herstellen.** Access-Token aus dem Refresh-Token. Bei `invalid_grant`:
   Verbindung auf `needs_reauth`, Lauf beenden, im Screen zum Neuverbinden auffordern.
2. **Kalender sicherstellen.** Existiert `google_calendar_id` nicht mehr (vom Nutzer
   gelöscht), einen neuen anlegen und die Bindung darauf umschreiben. Mappings der alten
   Bindung werden deaktiviert — sonst zeigten sie auf Termine, die es nicht mehr gibt.
3. **Importieren.** `events.list` mit `syncToken`, sonst Vollabgleich. Je Google-Termin das
   Mapping suchen, Hashes vergleichen, nach 2.9 handeln.
4. **Exportieren.** Alle Ralia-Events der `calendar_id`, die seit dem letzten Lauf berührt
   wurden, plus alle ohne Mapping. Hashes vergleichen, nach 2.9 handeln.
5. **Abschließen.** `syncToken` sichern, Lauf protokollieren, Fehlerzähler zurücksetzen.

Import vor Export ist Absicht: so gewinnt bei gleichzeitiger Änderung nicht die Reihenfolge
des Zufalls, sondern es entsteht ein sauberer Konflikt, den der Nutzer sieht.

Der Lauf ist **idempotent**. Bricht er nach Schritt 3 ab, macht der nächste dort weiter,
ohne etwas zu verdoppeln — dafür sorgen die beiden Unique-Indizes auf den Mappings.

### Feldabbildung

| Ralia                                  | Google                                   |
| -------------------------------------- | ---------------------------------------- |
| `name`                                 | `summary`                                |
| `location`                             | `location`                               |
| `notes`                                | `description`                            |
| `start_date` + `start_time`            | `start.dateTime` (Zone aus 2.5)          |
| `end_date` + `end_time`                | `end.dateTime`                           |
| ganztägig (2.6)                        | `start.date` / `end.date`, Ende exklusiv |
| `recurrence_*`                         | `recurrence: ["RRULE:…"]`                |
| `belongs_to`, `category`, Erinnerungen | **nicht übertragen**                     |

`belongs_to` bleibt bewusst draußen: Google kennt keine Paar-Zuordnung, und ein Import
würde sie sonst auf einen Standardwert zurücksetzen. Beim Import bekommen neue Termine
`belongs_to = 'both'` — das ist die Bedeutung, die ein von außen hereingereichter Termin in
einem Paarkalender hat.

---

## 5. Der Screen

`SyncScreen.tsx` wird ersetzt. Die Fixtures `MOCK_SYNC_ACCOUNTS`, `MOCK_CALENDARS`,
`MOCK_CONFLICT` und `MOCK_SYNC_LOG` verschwinden aus `mock/fixtures.ts`.

Zustände:

- **Nicht verbunden** — was passieren wird, welcher Zugriff erteilt wird, ein Knopf
  _Mit Google verbinden_. Der Warnbildschirm aus 2.1 wird vorher erklärt, nicht
  verschwiegen.
- **Verbunden** — Konto, Zeitzone, letzter Lauf, nächster Lauf, _Jetzt synchronisieren_.
- **Konflikte** — je Konflikt beide Fassungen nebeneinander, _Ralia behalten_ /
  _Google behalten_.
- **Hinweise** — übersprungene Serien aus 2.11, im Klartext.
- **Protokoll** — die letzten Läufe mit Zahlen und Fehlern.
- **Neuanmeldung nötig** — wenn `needs_reauth`, mit Grund.
- **Import / Export** — manuelle Aktionen. Import fragt beim ersten Mal den zusätzlichen
  Scope aus 2.2 an, listet dann die Google-Kalender zur Auswahl.

Die Richtungsauswahl der Attrappe (`both` / `toGoogle` / `fromGoogle`) entfällt. v1 ist
bidirektional; wer eine Richtung will, benutzt Import oder Export von Hand. Ein
Dauerzustand „nur eine Richtung" verdoppelt die Zustandsmatrix des Abgleichs für einen
Bedarf, den bei zwei Nutzern niemand geäußert hat.

---

## 6. Vorarbeiten

In dieser Reihenfolge, jede für sich abgeschlossen und testbar:

1. **Neuer OAuth-Client** in `ralia-484108`, alter gelöscht, Status auf _In Produktion_.
   Drei Supabase-Secrets, alle nur dort: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (aus
   dem neuen Client) und `GOOGLE_TOKEN_KEY` (frisch erzeugter Schlüssel für die
   Token-Verschlüsselung aus 2.4, hat mit Google nichts zu tun). — _nur Du_
2. **`clearAuthData()` räumt `googleSyncState`.** Ein Legacy-Schlüssel, der die Abmeldung
   überlebt. Muss weg, bevor neuer Zustand entsteht.
3. **`isAllDay()` nach `@ralia/core`**, beide Konventionen lesend (2.6). Behebt nebenbei die
   102 falsch dargestellten Altzeilen.
4. **Zeit-Helfer** für die Umrechnung schwebender Ortszeit ↔ zonierter Google-Zeit,
   framework-frei und rein testbar in `packages/core`.

---

## 7. Teststrategie

Der Abgleich ist die schwierige Stelle, und er ist rein. Deshalb liegt er als Funktionen in
`packages/core/src/google/` — ohne Netz, ohne Supabase, ohne DOM:

- **Entscheidungstabelle aus 2.9** — jeder der fünf Fälle ein Test, plus der Paar-Kreislauf
  über drei Läufe mit dem Nachweis, dass der dritte Lauf nichts mehr schreibt.
- **RRULE in beide Richtungen** — die Tabelle aus 2.11 Zeile für Zeile, inklusive der
  abgelehnten Fälle mit ihrem Grund.
- **Ganztägig** — beide Konventionen hinein, `date` mit exklusivem Ende hinaus, und zurück.
- **Zeitzonen** — Sommer-/Winterzeit-Grenze, weil die Umrechnung dort schiefgeht oder nie.
- **Ausnahmen** — Löschung und Änderung einer Instanz in beide Richtungen.

Netzgebunden, gegen einen nachgebauten Google-Client:

- `410 Gone` → Vollabgleich, `401` → Neuanmeldung, `403 rateLimitExceeded` → Backoff.
- Abbruch nach dem Import → der nächste Lauf verdoppelt nichts.

Live, mit den beiden freigegebenen Testkonten und ausschließlich `QA:`-Datensätzen: die
Sequenz aus dem Handoff, Punkt 8.

---

## 8. Abnahmekriterien

1. Verbinden legt einen Google-Kalender „Ralia" an; der Screen zeigt Konto und Zeitzone.
2. Ein neuer Ralia-Termin steht binnen zehn Minuten in Google, ohne Zutun.
3. Ein neuer Google-Termin im Ralia-Kalender steht binnen zehn Minuten in Ralia.
4. Eine Serie geht mit Regel und Enddatum hinüber; eine gelöschte Instanz bleibt gelöscht.
5. Eine Google-Serie mit `BYSETPOS` wird nicht importiert und im Screen benannt.
6. Änderung auf beiden Seiten erzeugt einen Konflikt; keine Seite wird überschrieben; beide
   Knöpfe führen zum jeweils erwarteten Ergebnis.
7. Bei einem Paar erzeugt eine Google-Änderung von A keinen Schreibvorgang zurück nach
   A-Google. Nachweisbar am Protokoll: nachdem die Änderung bei beiden Partnern angekommen
   ist, schreiben die Folgeläufe nichts mehr.
8. Trennen stoppt den Abgleich, ohne den Google-Kalender zu leeren. Wiederverbinden nimmt
   den Abgleich ohne Dubletten wieder auf.
9. Löschen in Ralia löscht in Google und umgekehrt.
10. Kein Token verlässt je den Server — nachweisbar an den Antworten der drei
    `public`-Funktionen.
11. `npm run verify` grün.

---

## 9. Was ich von Dir brauche

1. **Vorarbeit 1** — der neue OAuth-Client und der Status _In Produktion_. Ohne ihn ist
   nichts davon lauffähig. Das Secret bitte direkt in die Supabase-Secrets, nicht hierher.
2. **Bestätigung zu 2.7** — die 445 Alttermine bleiben im primären Google-Kalender liegen
   und werden nicht mehr angefasst. Wer sie loswerden will, löscht sie in Google selbst.
   Das ist die einzige Entscheidung hier mit sichtbarer Folge für Dich.
3. **Die dreizehn Profile** aus dem Audit — sind das nur Ihr beide plus Testkonten, oder
   nutzen noch andere Leute das laufende Projekt? Falls ja, ändert das nichts am Entwurf,
   aber es ändert, wie vorsichtig die Live-QA laufen muss.
