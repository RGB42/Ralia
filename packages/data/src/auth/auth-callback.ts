/**
 * Rücksprung-URLs der Anmeldung lesen.
 *
 * Der Client steht auf `detectSessionInUrl: false` (siehe `client.ts`), es
 * frisst also niemand die URL weg, bevor die App sie gesehen hat. Dafür muss sie
 * selbst erkennen, was zurückkommt — und das sind drei Formen, nicht eine:
 *
 *   `#access_token=…&refresh_token=…&type=recovery`  Implicit, aus dem Mail-Link
 *   `?code=…`                                        PKCE, aus dem OAuth-Rundlauf
 *   `#error=…` oder `?error=…`                        abgelehnt oder abgelaufen
 *
 * Warum beide Erfolgsformen: der Mail-Client fährt Implicit, damit ein
 * Reset-Link auf jedem Gerät einlösbar ist (Begründung im SP1-Spec), OAuth fährt
 * PKCE. Und während der Umstellung in SP9 sind zusätzlich Links von Ralia 1.x
 * unterwegs, die ebenfalls Implicit sind. Erkannt wird deshalb an der Form der
 * URL, nicht am Vertrauen darauf, welchen Link wir selbst verschickt haben.
 *
 * Reine Funktionen, kein `window`: nur so ist jede der Formen samt Grenzfällen
 * ohne Browser prüfbar.
 */

export type AuthCallback =
  | { kind: 'none' }
  /** Passwort-Reset. Die Sitzung ist gültig, darf aber nur zum Setzen des Passworts dienen. */
  | { kind: 'recovery'; accessToken: string; refreshToken: string }
  /** Bestätigte Registrierung. */
  | { kind: 'signup'; accessToken: string; refreshToken: string }
  /** Gültige Sitzung ohne besondere Bedeutung — magiclink, invite, kein `type`. */
  | { kind: 'session'; accessToken: string; refreshToken: string }
  /** PKCE-Rücksprung; einlösbar nur im Browser, der den Ablauf begonnen hat. */
  | { kind: 'code'; code: string }
  | { kind: 'error'; code: string | null; description: string | null };

/** Felder, die zur Anmeldung gehören und nach dem Lesen aus der URL müssen. */
const AUTH_QUERY_KEYS = ['code', 'error', 'error_code', 'error_description', 'state'] as const;

function paramsOf(url: URL): { hash: URLSearchParams; query: URLSearchParams } {
  // Der Fragmentteil kommt mit '#'; ein führender '/' steht in manchen
  // Router-Formen davor und gehört nicht zu den Parametern.
  const raw = url.hash.replace(/^#\/?/, '');
  return { hash: new URLSearchParams(raw), query: url.searchParams };
}

function nonEmpty(value: string | null): string | null {
  return value !== null && value.length > 0 ? value : null;
}

export function parseAuthCallback(href: string): AuthCallback {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return { kind: 'none' };
  }

  const { hash, query } = paramsOf(url);

  /*
   * Fehler zuerst. Eine URL mit Fehler *und* Token ist widersprüchlich; dann
   * eine halbe Sitzung anzunehmen ist die schlechtere Antwort, als den Nutzer
   * neu anfordern zu lassen.
   */
  const error = nonEmpty(hash.get('error')) ?? nonEmpty(query.get('error'));
  if (error !== null) {
    return {
      kind: 'error',
      // error_code ist genauer (`otp_expired`), error ist der Oberbegriff.
      code: nonEmpty(hash.get('error_code')) ?? nonEmpty(query.get('error_code')) ?? error,
      description:
        nonEmpty(hash.get('error_description')) ?? nonEmpty(query.get('error_description')),
    };
  }

  /*
   * Der Fragmentteil vor dem Code: er ist ohne den lokalen Code-Verifier
   * einlösbar. Der Code braucht ihn, und auf einem fremden Gerät gibt es ihn
   * nicht.
   */
  const accessToken = nonEmpty(hash.get('access_token'));
  const refreshToken = nonEmpty(hash.get('refresh_token'));

  // Beide oder keiner — setSession verlangt beide, eines allein ist kein Zustand.
  if (accessToken !== null && refreshToken !== null) {
    const type = hash.get('type');
    if (type === 'recovery') return { kind: 'recovery', accessToken, refreshToken };
    if (type === 'signup') return { kind: 'signup', accessToken, refreshToken };
    return { kind: 'session', accessToken, refreshToken };
  }

  const code = nonEmpty(query.get('code'));
  if (code !== null) return { kind: 'code', code };

  return { kind: 'none' };
}

/**
 * Dieselbe URL ohne die Anmeldefelder.
 *
 * Ein Zugriffstoken im Fragmentteil bleibt sonst in der Chronik stehen und
 * wandert in jeden Link, den der Nutzer von dieser Seite teilt. Aufgeräumt wird
 * über `history.replaceState`, damit kein Eintrag entsteht, auf den „Zurück"
 * wieder hineinführt.
 *
 * Was nicht zur Anmeldung gehört, bleibt: ein `?ref=newsletter` ist die
 * Herkunftsspur einer Kampagne, und ein Fragmentteil, der kein Auth-Rücksprung
 * ist, ist ein Seitenanker.
 */
export function cleanCallbackUrl(href: string): string {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return href;
  }

  const { hash } = paramsOf(url);
  const hashIsAuth =
    hash.has('access_token') || hash.has('refresh_token') || hash.has('error') || hash.has('type');
  if (hashIsAuth) url.hash = '';

  for (const key of AUTH_QUERY_KEYS) url.searchParams.delete(key);

  // `URL` schreibt ein leeres '?' und '#' nicht mit, aber ein leerer Suchteil
  // hinterlaesst bei manchen Eingaben ein '?'. Beides hier abschneiden.
  return url.toString().replace(/\?$/, '').replace(/#$/, '');
}
