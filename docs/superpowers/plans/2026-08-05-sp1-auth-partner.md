# SP1 — Plan

**Datum:** 2026-08-05
**Spec:** [../specs/2026-08-05-sp1-auth-partner-design.md](../specs/2026-08-05-sp1-auth-partner-design.md)

## Wie die Tatsachen im Spec geprüft wurden

Damit niemand sie glauben muss. Alles nur lesend, nichts davon verändert die
Datenbank.

**Spalten von `profiles`** — der Befund, der die alten Typen widerlegt hat:

```sql
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'profiles'
order by ordinal_position;
```

13 Zeilen. Kein `calendar_id`, kein `updated_at` — beide standen im
handgeführten Typ.

**Signaturen der Partner-RPCs** — der Befund zum falschen Parameternamen:

```sql
select p.proname,
       pg_get_function_identity_arguments(p.oid) as args,
       pg_get_function_result(p.oid)             as returns
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('connect_partner','disconnect_partner','set_shared_anniversary');
```

```
connect_partner         p_invite_code text   jsonb
disconnect_partner                           void
set_shared_anniversary  p_date date           void
```

**CHECK-Constraints**, für die Fach-Unions in `database.types.ts`:

```sql
select rel.relname, con.conname, pg_get_constraintdef(con.oid)
from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace n on n.oid = rel.relnamespace
where n.nspname = 'public' and con.contype = 'c';
```

**Auth-Konfiguration** — ob eine Bestätigungsmail nötig ist:

```bash
curl -s -H "apikey: $ANON" https://nyvripddydrzvfuateea.supabase.co/auth/v1/settings
```

```
mailer_autoconfirm : false      → jede Registrierung braucht einen Link
disable_signup     : false
external providers : google, email
```

**PKCE und der Code-Verifier** — die Grundlage der Zwei-Client-Entscheidung.
Nicht erfragt, sondern in der installierten Bibliothek nachgelesen,
`@supabase/auth-js` 2.111.0:

```
GoTrueClient.js  resetPasswordForEmail → if (this.flowType === 'pkce')
                                           this._getCodeChallengeAndMethod(true)
                 _getCodeChallengeAndMethod → getCodeChallengeAndMethod(this.storage, …)
```

Der Verifier landet in `this.storage`, also im Browser, der anfordert. Ein
Reset-Link ist damit nur dort einlösbar.

## Reihenfolge

Die Datenschicht zuerst, weil alles darauf sitzt, und in ihr die reinen
Funktionen zuerst, weil sie ohne Netz und ohne DOM prüfbar sind.

| #   | Schritt                                     | Zustand | Tests |
| --- | ------------------------------------------- | ------- | ----- |
| 1   | Schema-Typen berichtigen                    | fertig  | —     |
| 2   | `invite-code`                               | fertig  | 13    |
| 3   | `auth-callback`                             | fertig  | 22    |
| 4   | `identity-snapshot`                         | fertig  | 12    |
| 5   | `mail-link-client`                          | fertig  | 6     |
| 6   | `partner-repo`                              | fertig  | 15    |
| 7   | `profile-repo`                              | fertig  | 17    |
| 8   | `session`                                   | fertig  | 20    |
| 9   | i18n-Schlüssel für Auth und Partner         | fertig  | —     |
| 10  | `AuthProvider`, `BootContext`, Routenwache  | fertig  | 5     |
| 11  | Anmelde- und Registrier-Screen              | fertig  | 8     |
| 12  | Passwort-Screens                            | fertig  | 5     |
| 13  | Verbinden-Screen                            | fertig  | 5     |
| 14  | Jahrestag und Abmelden in den Einstellungen | fertig  | 6     |
| 15  | E2E: Wache und Rücksprung                   | fertig  | 8     |

Stand: 500 Unit-Tests in 45 Dateien, 19 E2E-Tests. `npm run verify` und
`npm run e2e:live` grün.

## Was während der Umsetzung dazukam

### `postgrest-js` wiederholt Lesezugriffe selbst

Aufgefallen, als die E2E-Tests nach der Routenwache scheiterten: die App
brauchte **7,5 Sekunden** bis zum ersten Inhalt, wenn kein Netz da war. Gemessen
mit einer Stapelspur um `fetch`:

```
   76 ms  rest/v1/profiles
 1100 ms  rest/v1/profiles
 3110 ms  rest/v1/profiles
 7122 ms  rest/v1/profiles
```

Die Ursache steht in `@supabase/postgrest-js` 2.111.0:

```
DEFAULT_MAX_RETRIES = 3
getRetryDelay = (i) => Math.min(1000 * 2 ** i, 30000)
retryEnabled  = builder.retry ?? true
```

Seit dieser Fassung wiederholt die Bibliothek jeden idempotenten Aufruf, der an
einem Netzfehler oder an 503/520 scheitert — dreimal mit 1 s, 2 s, 4 s. Das ist
für gewöhnliche Lesezugriffe richtig und wird **nicht** abgeschaltet: ein 503
von PostgREST beim Nachladen des Schema-Caches ist wirklich vorübergehend.

Falsch ist es nur im Start. Dort liegen Profil und Partner die ganze Zeit im
Abzug, und sieben Sekunden zu warten, um herauszufinden, dass kein Netz da ist,
ist verschwendete Zeit des Nutzers. `restoreSession` hat deshalb eine Frist
bekommen — dieselbe Antwort, die SP0 für `/config` gefunden hat:

- **mit Abzug:** 2,5 s, dann der Abzug. Der Nutzer sieht sofort seine Daten.
- **ohne Abzug:** 6 s, dann der Anmeldebildschirm. Unschön und bewusst so; der
  Fall tritt genau einmal auf, beim allerersten Laden in einem Browser, denn jeder
  erfolgreiche Start schreibt einen Abzug.

Danach: 3,5 s statt 7,5 s bis zum Kalender.

### Ein formgültiges JWT im E2E-Seed

Die Smoke-Tests brauchen ab jetzt eine Sitzung. Der erste Versuch legte
`access_token: 'test-access-token'` ab — und der Start blieb hängen. Grund:
`auth-js` dekodiert das Zugriffstoken, um die Restlaufzeit zu bestimmen; an
einer Zeichenkette, die kein JWT ist, scheitert das, die Sitzung gilt als
erneuerungsbedürftig, und die Bibliothek läuft in eine Erneuerung mit
Wiederholungen gegen ein abgeschnittenes Netz. `e2e/session.ts` baut deshalb ein
formgültiges, unsigniertes JWT. Signiert wird nicht — der Client prüft die
Signatur nicht, und der Server sieht das Token nie.

### Zwei kleine Ergänzungen an `packages/ui`

`Input` hat `name`, `autoComplete`, `required` und `ariaLabel` bekommen. Die
ersten drei, weil ein Anmeldeformular ohne sie für Passwortmanager unsichtbar
ist. `ariaLabel` für den Fall `ListRow`: dort ist der Zeilentitel die
Beschriftung, steht aber als Text daneben und nicht als `<label for>` — das
Jahrestag-Feld wäre sonst namenlos gewesen.

## Was in Schritt 1 gefunden wurde

Kein geplanter Schritt, sondern ein Befund beim Lesen. Er steht hier, weil er die
Reihenfolge geändert hat: darauf aufzubauen hätte SP1 einen Laufzeitfehler
eingebaut.

| Tabelle               | Im Typ, nicht in der DB                   | In der DB, nicht im Typ                                                                         |
| --------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `profiles`            | `calendar_id`, `updated_at`               | —                                                                                               |
| `events`              | —                                         | `subtitle`, `short_description`, `extended_data`, `category`                                    |
| `event_reminder_jobs` | `offset_minutes`, `fire_at`, `claimed_at` | `event_start_at`, `remind_at`, `reminder_offset_minutes`, `event_name`, `location`, `locked_at` |

Dazu `set_shared_anniversary` mit `p_anniversary_date` statt `p_date`.

Behoben, indem die Typen jetzt aus der Introspektion kommen und die kuratierte
Schicht daraus _ableitet_. Eine verschwundene Spalte ist damit ein Typfehler.
Gegenprobe gemacht: ein erfundenes Literal in einer Union und die nie
existierende Spalte `calendar_id` lassen `npm run typecheck` beide fallen.

## Offene Umgebungsprüfungen

Nichts davon ist eine Codeänderung; alles braucht einen Menschen mit einem
echten Postfach und wird im Abnahmeprotokoll beantwortet, nicht hier
stillschweigend als erledigt gebucht.

- Eine Registrierung mit echter Adresse: kommt die Mail, und trägt der Link den
  Fragmentteil statt `?code=`?
- Denselben Link auf einem **anderen** Gerät öffnen — das ist die Prüfung, für
  die der Mail-Client überhaupt existiert.
- Der Google-Rundlauf. Aus dieser Umgebung ist er nicht durchspielbar; geprüft
  ist bisher nur die Rücksprung-URL gegen gefälschte Eingaben.
