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

| #   | Schritt                             | Zustand | Tests |
| --- | ----------------------------------- | ------- | ----- |
| 1   | Schema-Typen berichtigen            | fertig  | —     |
| 2   | `invite-code`                       | fertig  | 13    |
| 3   | `auth-callback`                     | fertig  | 22    |
| 4   | `identity-snapshot`                 | fertig  | 12    |
| 5   | `mail-link-client`                  | fertig  | 6     |
| 6   | `partner-repo`                      | fertig  | 15    |
| 7   | `profile-repo`                      | fertig  | 17    |
| 8   | `session`                           | fertig  | 17    |
| 9   | i18n-Schlüssel für Auth und Partner | offen   |       |
| 10  | `AuthProvider` und Routenwache      | offen   |       |
| 11  | Anmelde- und Registrier-Screen      | offen   |       |
| 12  | Passwort-Screens                    | offen   |       |
| 13  | Verbinden-Screen                    | offen   |       |
| 14  | Jahrestag in den Einstellungen      | offen   |       |
| 15  | E2E: Wache und Rücksprung           | offen   |       |

Stand nach Schritt 8: 465 Tests in 44 Dateien, `npm run verify` grün.

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
