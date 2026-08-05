# SP1 — Auth & Partner

**Datum:** 2026-08-05
**Status:** Freigegeben
**Übergeordnet:** [2026-07-31-ralia-rebuild-design.md](2026-07-31-ralia-rebuild-design.md)
**Vorgänger:** [SP0](2026-08-03-sp0-ui-foundation-design.md), [Abnahme](../plans/2026-08-03-sp0-abnahme.md)

## Ausgangslage

SP0 ist abgeschlossen, zehn von zehn Kriterien belegt. Die App bootet, zeigt
acht Ansichten und acht Sheets — alles aus `apps/app/src/mock/fixtures.ts`. Es
gibt keine Anmeldung und keine Zeile echter Daten.

Am 2026-08-05 vor diesem Spec berichtigt: `packages/data` beschrieb das Schema
an drei Tabellen falsch und hätte SP1 einen Laufzeitfehler eingebaut
(`set_shared_anniversary` war mit dem falschen Parameternamen typisiert). Die
Typen kommen jetzt aus der Introspektion der laufenden Datenbank.

## Ziel

Aus der Attrappe wird eine App mit Identität: anmelden, registrieren, Passwort
zurücksetzen, mit Google anmelden, den Partner über einen Einladungscode
verbinden und wieder trennen, den gemeinsamen Jahrestag setzen.

Was SP1 **nicht** liefert: echte Termine, Todos, Geld. Die Screens hängen nach
SP1 weiter an den Fixtures. Was sie bekommen, ist die `calendar_id`, gegen die
SP2 bis SP4 dann laden.

## Belegte Tatsachen

Alles hier gegen das laufende Projekt geprüft, nicht aus dem Altcode
abgeschrieben. Wer das nachziehen will: die Abfragen stehen im Plan.

| Frage                     | Befund                                                               |
| ------------------------- | -------------------------------------------------------------------- |
| E-Mail-Bestätigung nötig? | **ja** — `mailer_autoconfirm: false`                                 |
| Registrierung offen?      | ja — `disable_signup: false`                                         |
| Anmeldeverfahren          | `email`, `google`                                                    |
| `profiles`-Spalten        | 13, **kein** `calendar_id`, **kein** `updated_at`                    |
| `connect_partner`         | `(p_invite_code text) → jsonb` (das Partnerprofil)                   |
| `disconnect_partner`      | `() → void`                                                          |
| `set_shared_anniversary`  | `(p_date date) → void` — **nicht** `p_anniversary_date`              |
| `generate_invite_code`    | existiert als RPC in der Datenbank                                   |
| `profiles` SELECT-Policy  | `auth.uid() = id OR auth.uid() = partner_id`                         |
| `profiles` UPDATE-Policy  | nur die eigene Zeile                                                 |
| Billing-Spalten           | per Trigger für Clients schreibgeschützt (`billing_fields_readonly`) |

Zwei Folgerungen, die den Entwurf tragen:

1. **Ein Einladungscode ist vom Client nicht auflösbar.** Die SELECT-Policy gibt
   nur die eigene und die Partnerzeile heraus. Deshalb ist `connect_partner`
   SECURITY DEFINER. Der Client darf gar nicht erst versuchen, über
   `invite_code` zu suchen — er bekäme leer zurück und würde es für „Code
   falsch" halten.
2. **`profiles.calendar_id` gibt es nicht.** Die `calendar_id` ist gerechnet:
   `computeCalendarId(userId, partnerId)` in `packages/data`, wortgleich zur
   Regel in `connect_partner`. Sie zu speichern wäre eine zweite Wahrheit.

## Getroffene Entscheidungen

| Frage                              | Entscheidung                                             | Konsequenz                                                                           |
| ---------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Flow für E-Mail-Links              | **zwei Clients** — PKCE für Sitzungen, Implicit für Mail | Reset- und Bestätigungslinks funktionieren auf jedem Gerät; siehe unten              |
| Wer verarbeitet die Rücksprung-URL | **wir**, `detectSessionInUrl: false` bleibt              | Beide Linkformen sind zu bedienen, dafür steuert die App den Übergang selbst         |
| Profil fehlt nach Anmeldung        | **anlegen, nicht scheitern**                             | wie Ralia 1.x; ein Google-Erstlogin hat noch kein `profiles`-Zeile                   |
| Einladungscode erzeugen            | **Client**, wie Ralia 1.x                                | die DB-Funktion `generate_invite_code` bleibt ungenutzt — Begründung unten           |
| Offline angemeldet bleiben         | **Identitäts-Abzug** unter `ralia:identity`              | derselbe Schlüssel wie Ralia 1.x, ein Nutzer im Zug bleibt über den Umbau angemeldet |
| Partner verbinden im Ablauf        | **eigener Screen nach der Anmeldung, überspringbar**     | wie Ralia 1.x (`connectionScreen` + „skip"); solo ist ein gültiger Zustand           |
| Jahrestag                          | **in den Einstellungen**, nicht im Verbinden-Screen      | die Vorlage hat dort eine Zeile dafür; ein Jahrestag ohne Partner ist zulässig       |

### Warum zwei Clients

`packages/data/src/client.ts` steht auf `flowType: 'pkce'`. Bei PKCE legt
`auth-js` den Code-Verifier in `this.storage` ab — nachgesehen in
`GoTrueClient.js` 2.111.0, `_getCodeChallengeAndMethod` → `getCodeChallengeAndMethod(this.storage, …)`.
Der Link trägt dann `?code=…`, und einlösen kann ihn nur der Browser, der ihn
angefordert hat.

Das bricht genau die zwei Wege, auf denen es am meisten weh tut:

- **Passwort vergessen.** Man ist ausgesperrt, fordert am Rechner einen Link an
  und öffnet die Mail auf dem Telefon. Anderer Browser, kein Verifier.
- **Registrierung bestätigen.** `mailer_autoconfirm` ist aus, jede Anmeldung
  läuft über einen Link. Denselben Fall.

Ralia 1.x kann das, weil es Implicit fährt: der Auth-Server hängt die Tokens an
den Fragmentteil und jeder Browser kann sie übernehmen. „Feature-Parität vor
Go-Live" steht im Programm-Spec — eine Regression hier ist keine Option.

PKCE fallen zu lassen ist aber auch keine: für `signInWithOAuth` liegen die
Tokens sonst in der URL und damit in der Chronik, und für die Deep-Link-Anmeldung
der nativen Schalen in SP7 ist PKCE praktisch Pflicht.

Also beide, getrennt nach Aufgabe:

```
getSupabaseClient()   flowType: 'pkce'      persistSession: true
                      besitzt die Sitzung, macht OAuth, liest Daten

getMailLinkClient()   flowType: 'implicit'  persistSession: false
                      autoRefreshToken: false
                      genau drei Aufrufe: signUp, resetPasswordForEmail, resend
```

Der zweite speichert nichts und erneuert nichts, kann dem ersten also den
Sitzungsspeicher nicht wegziehen. Er ist kein zweiter Zustand, sondern ein
Briefkasten.

### Warum der Einladungscode im Client entsteht

Die Datenbank hat `generate_invite_code()`. Trotzdem bleibt es beim Client:

- Das Profil wird in **einem** Insert angelegt. Den Code vorher per RPC zu holen
  wäre eine zweite Rundreise, und zwischen beiden kann die Verbindung abbrechen —
  dann liegt ein Profil ohne Code da.
- Die Kollisionswahrscheinlichkeit ist beherrschbar und der Fall behandelbar:
  `invite_code` ist eindeutig, ein Zusammenstoß kommt als Unique-Verletzung
  zurück und wird mit einem neuen Code wiederholt. Genau dieser Wiederholversuch
  fehlt in Ralia 1.x — dort scheitert das Anlegen still.

Das ist keine Ablehnung der DB-Funktion, sondern eine Einordnung: sie ist die
richtige Wahl, sobald das Anlegen serverseitig passiert (ein Trigger auf
`auth.users`). Das gehört nicht in SP1, weil es eine Migration wäre, und
Migrationen sind in diesem Umbau ausdrücklich außen vor.

## Die Rücksprung-URL

Drei Formen erreichen die App. Erkannt wird an der Form, nicht am Vertrauen
darauf, welche wir selbst erzeugt haben — während der Umstellung in SP9 sind
Links beider Versionen unterwegs.

| Form                                            | Herkunft                          | Behandlung                          |
| ----------------------------------------------- | --------------------------------- | ----------------------------------- |
| `#access_token=…&refresh_token=…&type=recovery` | unser Reset, und Ralia 1.x        | `setSession`, dann „neues Passwort" |
| `#access_token=…&refresh_token=…&type=signup`   | unsere Bestätigung, und Ralia 1.x | `setSession`, dann in die App       |
| `?code=…`                                       | unser OAuth-Rücksprung            | `exchangeCodeForSession`            |
| `#error=…` / `?error=…`                         | abgelehnt, abgelaufen             | Meldung am Anmeldeformular          |

Zwei Regeln, beide aus Fehlern der Altversion:

1. **Erst lesen, dann irgendetwas anderes tun.** `init.js` in Ralia 1.x
   kommentiert es selbst: „Capture hash params BEFORE Supabase client creation".
   Bei uns ist `detectSessionInUrl: false`, es frisst also niemand die URL weg —
   aber die Reihenfolge bleibt, weil ein Reload mitten im Ablauf sonst den
   Fragmentteil verliert.
2. **Die URL aufräumen, sobald sie gelesen ist.** Ein Zugriffstoken im
   Fragmentteil bleibt sonst in der Chronik und in jedem geteilten Link stehen.
   `history.replaceState` auf den Pfad ohne Fragment.

Ein `type=recovery`-Link liefert eine **gültige Sitzung**. Das heißt: wer den
Link hat, ist angemeldet. Die App darf ihn deshalb nicht einfach in den Kalender
lassen, sondern führt ihn auf „neues Passwort setzen" — und erst nach
`updateUser({password})` weiter. Genau so hält es Ralia 1.x.

## Aufbau

```
packages/data/
  auth/
    mail-link-client.ts   der Implicit-Client, drei Aufrufe
    auth-callback.ts      URL-Form erkennen und einlösen  (rein, testbar)
    invite-code.ts        Code erzeugen, Alphabet aus Ralia 1.x
    session.ts            AuthSession, signIn/signUp/signOut/…
    identity-snapshot.ts  ralia:identity lesen und schreiben
  repositories/
    profile-repo.ts       Profil laden, anlegen, Zeitzone abgleichen
    partner-repo.ts       connect/disconnect/Jahrestag, Fehler-Tokens
apps/app/
  auth/
    AuthProvider.tsx      Sitzungszustand, hängt am Boot
    useAuth.ts
    RequireAuth.tsx       Routenwache
  screens/auth/
    SignInScreen.tsx      Anmelden + Registrieren als Segment
    ForgotPasswordScreen.tsx
    NewPasswordScreen.tsx
    VerifyNoticeScreen.tsx
    ConnectPartnerScreen.tsx
```

`auth-callback.ts` und `invite-code.ts` sind reine Funktionen ohne Netz und ohne
DOM — die schwierigen Teile (Formerkennung, Wiederholung bei Codekollision)
werden damit unit-testbar, so wie SP0 es mit der Outbox gemacht hat.

## Fehlermeldungen

Die RPC-Fehler kommen als Wortmarken zurück (`invalid_code`,
`cant_connect_self`, `already_connected`, `partner_taken`, `not_authenticated`,
`profile_not_found`). Die Zuordnung auf i18n-Schlüssel wird aus
`Ralia_Opus/public/js/partner.js` übernommen und um `profile_not_found`
ergänzt, das dort fehlt.

Anmeldefehler von Supabase sind englische Sätze. Ralia 1.x zeigt sie
unverändert, auch in der deutschen Oberfläche. Das wird hier nicht
weitergetragen: die drei Fälle, die tatsächlich vorkommen — falsche Daten,
E-Mail nicht bestätigt, zu viele Versuche — bekommen eigene Schlüssel; alles
andere fällt auf eine allgemeine Meldung zurück, und der Originaltext geht in
die Konsole, nicht in das Gesicht des Nutzers.

## Offline

Der Identitäts-Abzug liegt unter `ralia:identity` — derselbe Schlüssel und
dieselbe Form wie in Ralia 1.x (`version: 1`, `userId`, `name`, `email`,
`calendarId`, `profile`, `partner`, `savedAt`). Wer die alte App im Zug offen
hatte und die neue lädt, bleibt angemeldet.

Regel für den Start, aus `session.js` übernommen: **nur eine echte Abmeldung
meldet ab.** Kein Netz, ein Zeitüberlauf oder ein Offline-Fehler dürfen nicht in
den Anmeldebildschirm führen, solange ein Abzug da ist. Der Klassifikator dafür
liegt schon in `packages/core/src/net/offline-error.ts`.

## Teststrategie

TDD gilt ab SP1 — Test zuerst, pro Verhalten.

- **Rein (Vitest)** — `auth-callback` gegen alle vier URL-Formen samt der
  Grenzfälle: leerer Fragmentteil, `type` ohne Token, beide Formen gleichzeitig.
  `invite-code` auf Alphabet, Länge und den Wiederholversuch.
- **Repositories (Vitest)** — gegen einen eingesetzten Supabase-Doppelgänger:
  Profil fehlt → wird angelegt; Zeitzone weicht ab → wird abgeglichen; jede
  RPC-Wortmarke → richtiger i18n-Schlüssel.
- **Sitzung (Vitest)** — kein Netz mit Abzug bleibt angemeldet; kein Netz ohne
  Abzug führt zum Anmeldebildschirm; `signOut` räumt `sb-*`, Google-Schlüssel
  und den Abzug ab.
- **Screens (Testing Library)** — Formularvalidierung, Fokus, Tastatur, und dass
  ein `recovery`-Link auf „neues Passwort" landet und nicht im Kalender.
- **E2E (Playwright)** — die Wache: `/kalender` ohne Sitzung landet auf
  `/anmelden`; mit gesetzter Sitzung nicht. Der Rücksprung wird mit einer
  gefälschten URL geprüft, nicht mit einem echten Postfach.

Kein Test schreibt in die Produktionsdatenbank. Was gegen echte Endpunkte läuft,
gehört hinter `RALIA_LIVE=1` und liest nur.

## Abnahmekriterien SP1

1. `npm run verify` fehlerfrei, `npm run e2e` grün.
2. `/kalender` ohne Sitzung leitet auf `/anmelden`; nach der Anmeldung zurück
   auf das ursprüngliche Ziel.
3. Registrieren mit neuer E-Mail zeigt den Bestätigungshinweis und erzeugt keine
   Sitzung (weil `mailer_autoconfirm` aus ist).
4. Ein `type=recovery`-Fragment führt auf „neues Passwort setzen", nicht in die
   App, und die URL ist danach vom Token befreit.
5. Ein `?code=`-Rücksprung ohne Verifier scheitert mit einer Meldung, die sagt
   was zu tun ist — nicht mit einem Rohtext von Supabase.
6. Anmelden mit falschem Passwort zeigt eine deutsche Meldung.
7. Nach der Anmeldung ohne Partner erscheint der Verbinden-Screen mit dem
   eigenen Code; „Überspringen" führt in den Kalender.
8. Ein falscher Einladungscode, der eigene Code und ein schon verbundener
   Partner ergeben je eine eigene, richtige Meldung.
9. Verbinden setzt bei beiden `partner_id`; die App rechnet danach mit der
   gemeinsamen `calendar_id`.
10. Jahrestag setzen schreibt über `set_shared_anniversary` und steht nach einem
    Reload noch da.
11. Abmelden räumt `sb-*`, `googleAccessToken`, `googleEmail`, `googleAutoSync`
    und `ralia:identity` ab.
12. Mit Abzug und ohne Netz startet die App angemeldet.

## Risiken

| Risiko                                                   | Umgang                                                                                                                                                             |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Zwei Clients teilen versehentlich den Sitzungsspeicher   | Der Mail-Client bekommt `persistSession: false` und `autoRefreshToken: false`; ein Test prüft, dass er nach seinen Aufrufen nichts in den Speicher geschrieben hat |
| Google-OAuth ist aus dieser Umgebung nicht durchspielbar | Der Rücksprung wird gegen gefälschte URLs getestet; der Rundlauf selbst ist eine Umgebungsprüfung und wird als solche benannt, nicht als erfüllt gemeldet          |
| Echte Registrierungen in der Produktionsdatenbank        | Kein Test registriert. Was mit echten Konten geprüft werden muss, macht ein Mensch und steht im Abnahmeprotokoll                                                   |
| Der Verbinden-Screen fehlt in der Design-Vorlage         | Aus der Sprache ableiten: `Card`, `Field`, `Button`, `ListRow` — keine neuen Bausteine erfinden                                                                    |
| Alt-Clients erzeugen weiter Implicit-Links               | Genau deshalb bedient der Handler beide Formen, nicht nur die eigene                                                                                               |

## Nicht in Scope

Echte Termine (SP2), Todos und Planer (SP3), Geld (SP4), Reminder und Google
Kalender (SP5), Premium und Account-Verwaltung (SP6), native Schalen (SP7),
Marketing-Site (SP8), Umstellung (SP9). Kein Konto löschen, keine
E-Mail-Änderung, keine Zwei-Faktor-Anmeldung — nichts davon hat Ralia 1.x.
