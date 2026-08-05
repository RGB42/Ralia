import { describe, expect, it } from 'vitest';
import { cleanCallbackUrl, parseAuthCallback } from './auth-callback.js';

const APP = 'https://ralia.app/app/kalender';

function hash(params: Record<string, string>): string {
  return `${APP}#${new URLSearchParams(params).toString()}`;
}

describe('parseAuthCallback — keine Rueckkehr', () => {
  it('erkennt eine gewoehnliche URL', () => {
    expect(parseAuthCallback(APP)).toEqual({ kind: 'none' });
  });

  it('laesst sich von einem leeren Fragmentteil nicht taeuschen', () => {
    expect(parseAuthCallback(`${APP}#`)).toEqual({ kind: 'none' });
    expect(parseAuthCallback(`${APP}#/`)).toEqual({ kind: 'none' });
  });

  it('haelt einen fremden Fragmentteil nicht fuer eine Rueckkehr', () => {
    // Ein Anker aus der Seite selbst, kein Auth-Rücksprung.
    expect(parseAuthCallback(`${APP}#abschnitt-geld`)).toEqual({ kind: 'none' });
  });

  it('ignoriert ein type ohne Token', () => {
    /*
     * Der Fall entsteht, wenn ein Link ein zweites Mal geoeffnet wird: der
     * Auth-Server hat den Token schon verbraucht. Ohne Token gibt es nichts
     * einzuloesen — und ein `kind: 'recovery'` ohne Token wuerde die App auf
     * den Passwort-Screen fuehren, wo sie nichts speichern kann.
     */
    expect(parseAuthCallback(hash({ type: 'recovery' }))).toEqual({ kind: 'none' });
  });

  it('ignoriert ein Zugriffstoken ohne Erneuerungstoken', () => {
    // setSession braucht beide. Eines allein ist kein verwertbarer Zustand.
    expect(parseAuthCallback(hash({ access_token: 'a', type: 'signup' }))).toEqual({
      kind: 'none',
    });
  });
});

describe('parseAuthCallback — Implicit-Links', () => {
  it('erkennt einen Passwort-Reset', () => {
    expect(
      parseAuthCallback(hash({ access_token: 'at', refresh_token: 'rt', type: 'recovery' })),
    ).toEqual({ kind: 'recovery', accessToken: 'at', refreshToken: 'rt' });
  });

  it('erkennt eine Registrierungsbestaetigung', () => {
    expect(
      parseAuthCallback(hash({ access_token: 'at', refresh_token: 'rt', type: 'signup' })),
    ).toEqual({ kind: 'signup', accessToken: 'at', refreshToken: 'rt' });
  });

  it('nimmt jede andere Art als gewoehnliche Anmeldung', () => {
    /*
     * magiclink, invite, email_change — Ralia nutzt sie nicht, aber ein Link
     * kann trotzdem eintreffen. Eine gueltige Sitzung wegzuwerfen, weil das
     * Wort unbekannt ist, waere die schlechtere Antwort.
     */
    expect(
      parseAuthCallback(hash({ access_token: 'at', refresh_token: 'rt', type: 'magiclink' })),
    ).toEqual({ kind: 'session', accessToken: 'at', refreshToken: 'rt' });
  });

  it('kommt auch ohne type aus, wenn beide Token da sind', () => {
    expect(parseAuthCallback(hash({ access_token: 'at', refresh_token: 'rt' }))).toEqual({
      kind: 'session',
      accessToken: 'at',
      refreshToken: 'rt',
    });
  });
});

describe('parseAuthCallback — PKCE', () => {
  it('erkennt den Rueckspruch aus OAuth an ?code=', () => {
    expect(parseAuthCallback(`${APP}?code=abc123`)).toEqual({ kind: 'code', code: 'abc123' });
  });

  it('ignoriert ein leeres code=', () => {
    expect(parseAuthCallback(`${APP}?code=`)).toEqual({ kind: 'none' });
  });

  it('laesst andere Abfrageparameter in Ruhe', () => {
    expect(parseAuthCallback(`${APP}?ref=newsletter`)).toEqual({ kind: 'none' });
  });
});

describe('parseAuthCallback — Fehler', () => {
  it('liest einen Fehler aus dem Fragmentteil', () => {
    const url = hash({
      error: 'access_denied',
      error_code: 'otp_expired',
      error_description: 'Email link is invalid or has expired',
    });
    expect(parseAuthCallback(url)).toEqual({
      kind: 'error',
      code: 'otp_expired',
      description: 'Email link is invalid or has expired',
    });
  });

  it('liest einen Fehler aus der Abfrage', () => {
    expect(parseAuthCallback(`${APP}?error=server_error&error_description=nope`)).toEqual({
      kind: 'error',
      code: 'server_error',
      description: 'nope',
    });
  });

  it('kommt ohne error_code aus', () => {
    expect(parseAuthCallback(hash({ error: 'access_denied' }))).toEqual({
      kind: 'error',
      code: 'access_denied',
      description: null,
    });
  });

  it('nimmt den Fehler vor allem anderen', () => {
    /*
     * Ein Fehler *und* ein Token in derselben URL ist widersprüchlich. Dann
     * gewinnt der Fehler: eine halbe Sitzung anzunehmen waere schlimmer, als
     * den Nutzer neu anfordern zu lassen.
     */
    const url = hash({ error: 'access_denied', access_token: 'at', refresh_token: 'rt' });
    expect(parseAuthCallback(url)).toMatchObject({ kind: 'error' });
  });
});

describe('parseAuthCallback — beide Formen gleichzeitig', () => {
  it('nimmt den Fragmentteil, nicht den Code', () => {
    /*
     * Kann bei einem Link entstehen, den der Auth-Server mit beidem beantwortet.
     * Der Fragmentteil gewinnt, weil er ohne den lokalen Code-Verifier
     * einloesbar ist — der Code braucht ihn, und auf einem fremden Geraet gibt
     * es ihn nicht.
     */
    const url = `${APP}?code=abc#${new URLSearchParams({
      access_token: 'at',
      refresh_token: 'rt',
      type: 'recovery',
    }).toString()}`;
    expect(parseAuthCallback(url)).toEqual({
      kind: 'recovery',
      accessToken: 'at',
      refreshToken: 'rt',
    });
  });
});

describe('cleanCallbackUrl', () => {
  it('nimmt den Fragmentteil mitsamt Token weg', () => {
    const url = hash({ access_token: 'at', refresh_token: 'rt', type: 'recovery' });
    expect(cleanCallbackUrl(url)).toBe(APP);
  });

  it('nimmt code und die Fehlerfelder aus der Abfrage', () => {
    expect(cleanCallbackUrl(`${APP}?code=abc`)).toBe(APP);
    expect(cleanCallbackUrl(`${APP}?error=access_denied&error_description=x`)).toBe(APP);
  });

  it('behaelt Abfrageparameter, die nicht zur Anmeldung gehoeren', () => {
    expect(cleanCallbackUrl(`${APP}?ref=newsletter&code=abc`)).toBe(`${APP}?ref=newsletter`);
  });

  it('behaelt einen Fragmentteil, der keine Anmeldung ist', () => {
    expect(cleanCallbackUrl(`${APP}#abschnitt-geld`)).toBe(`${APP}#abschnitt-geld`);
  });

  it('laesst eine saubere URL unveraendert', () => {
    expect(cleanCallbackUrl(APP)).toBe(APP);
  });
});
