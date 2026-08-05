import { beforeEach, describe, expect, it } from 'vitest';
import { LEGACY_AUTH_KEYS, authErrorKey, clearAuthData, restoreSession } from './session.js';
import { IDENTITY_STORAGE_KEY, writeIdentitySnapshot } from './identity-snapshot.js';
import type { ProfilesRow } from '../database.types.js';

const ME = '11111111-1111-4111-8111-111111111111';

const PROFILE: ProfilesRow = {
  id: ME,
  name: 'Lena',
  email: 'lena@example.com',
  invite_code: 'R7K2QM',
  partner_id: null,
  timezone: 'Europe/Berlin',
  anniversary_date: null,
  plan_tier: 'free',
  plan_status: 'inactive',
  ls_customer_id: null,
  ls_subscription_id: null,
  pro_expires_at: null,
  created_at: '2026-01-01T00:00:00Z',
};

function memoryStorage(seed: Record<string, string> = {}) {
  const raw = new Map<string, string>(Object.entries(seed));
  return {
    raw,
    get length() {
      return raw.size;
    },
    clear: () => raw.clear(),
    getItem: (k: string) => raw.get(k) ?? null,
    key: (i: number) => [...raw.keys()][i] ?? null,
    removeItem: (k: string) => void raw.delete(k),
    setItem: (k: string, v: string) => void raw.set(k, v),
  } as Storage & { raw: Map<string, string> };
}

describe('authErrorKey', () => {
  it('macht aus falschen Zugangsdaten eine eigene Meldung', () => {
    expect(authErrorKey({ message: 'Invalid login credentials' })).toBe('authInvalidCredentials');
  });

  it('erkennt die unbestaetigte E-Mail', () => {
    /*
     * Der haeufigste Fall in diesem Projekt: mailer_autoconfirm ist aus, wer den
     * Link nicht geklickt hat kommt nicht rein. „Zugangsdaten falsch" waere hier
     * eine Luege und schickt den Nutzer auf die Suche nach dem Passwort.
     */
    expect(authErrorKey({ message: 'Email not confirmed' })).toBe('authEmailNotConfirmed');
  });

  it('erkennt die Bremse nach zu vielen Versuchen', () => {
    expect(
      authErrorKey({ message: 'For security purposes, you can only request this after 51s' }),
    ).toBe('authTooManyRequests');
    expect(authErrorKey({ status: 429 })).toBe('authTooManyRequests');
  });

  it('erkennt eine schon vergebene E-Mail bei der Registrierung', () => {
    expect(authErrorKey({ message: 'User already registered' })).toBe('authEmailTaken');
  });

  it('erkennt einen abgelaufenen Mail-Link', () => {
    expect(authErrorKey({ message: 'Email link is invalid or has expired' })).toBe(
      'authLinkExpired',
    );
  });

  it('erkennt den fehlenden Code-Verifier', () => {
    /*
     * Der Fall, um den sich der ganze Zwei-Client-Aufbau dreht: ein
     * PKCE-Ruecksprung, der in einem anderen Browser geoeffnet wird als dem, der
     * ihn angefordert hat. Der Verifier liegt dort nicht, `auth-js` meldet es.
     * Ein Rohtext waere hier besonders schlecht — der Nutzer koennte nicht
     * wissen, dass ein neuer Link die Antwort ist.
     */
    expect(authErrorKey({ message: 'both auth code and code verifier should be non-empty' })).toBe(
      'authVerifierMissing',
    );
  });

  it('faellt auf eine allgemeine Meldung zurueck statt den englischen Satz zu zeigen', () => {
    /*
     * Ralia 1.x zeigt error.message unverändert, auch in der deutschen
     * Oberflaeche. Der Originaltext gehoert in die Konsole, nicht in das Gesicht
     * des Nutzers.
     */
    expect(authErrorKey({ message: 'Something entirely unexpected from GoTrue' })).toBe(
      'authGenericError',
    );
    expect(authErrorKey(null)).toBe('authGenericError');
  });
});

describe('restoreSession', () => {
  let storage: ReturnType<typeof memoryStorage>;

  beforeEach(() => {
    storage = memoryStorage();
  });

  it('nimmt die Sitzung, wenn eine da ist', async () => {
    const state = await restoreSession({
      getSession: async () => ({ session: { user: { id: ME, email: 'lena@example.com' } } }),
      loadIdentity: async () => ({ profile: PROFILE, partner: null }),
      storage,
      isOnline: () => true,
    });

    expect(state).toMatchObject({ status: 'signed-in', offline: false });
    expect(state.status === 'signed-in' && state.identity.profile.id).toBe(ME);
  });

  it('schreibt bei erfolgreichem Start einen frischen Abzug', async () => {
    await restoreSession({
      getSession: async () => ({ session: { user: { id: ME, email: null } } }),
      loadIdentity: async () => ({ profile: PROFILE, partner: null }),
      storage,
      isOnline: () => true,
    });

    expect(storage.raw.has(IDENTITY_STORAGE_KEY)).toBe(true);
  });

  it('bleibt ohne Netz mit Abzug angemeldet', async () => {
    /*
     * Die Regel aus session.js: nur eine echte Abmeldung meldet ab. Ein Nutzer
     * im Zug darf nicht im Anmeldebildschirm landen.
     */
    writeIdentitySnapshot(storage, PROFILE, null);

    const state = await restoreSession({
      getSession: async () => {
        throw new Error('Failed to fetch');
      },
      loadIdentity: async () => {
        throw new Error('nicht erreichbar');
      },
      storage,
      isOnline: () => false,
    });

    expect(state).toMatchObject({ status: 'signed-in', offline: true });
    expect(state.status === 'signed-in' && state.identity.profile.name).toBe('Lena');
  });

  it('meldet ohne Netz und ohne Abzug ab', async () => {
    const state = await restoreSession({
      getSession: async () => {
        throw new Error('Failed to fetch');
      },
      loadIdentity: async () => PROFILE && { profile: PROFILE, partner: null },
      storage,
      isOnline: () => false,
    });

    expect(state).toEqual({ status: 'signed-out' });
  });

  it('meldet bei fehlender Sitzung online ab', async () => {
    /*
     * Online und keine Sitzung heisst wirklich abgemeldet — hier darf der Abzug
     * nicht retten, sonst kaeme ein abgemeldeter Nutzer nie zum
     * Anmeldebildschirm.
     */
    writeIdentitySnapshot(storage, PROFILE, null);

    const state = await restoreSession({
      getSession: async () => ({ session: null }),
      loadIdentity: async () => ({ profile: PROFILE, partner: null }),
      storage,
      isOnline: () => true,
    });

    expect(state).toEqual({ status: 'signed-out' });
  });

  it('bleibt angemeldet, wenn nur das Profil-Laden am Netz scheitert', async () => {
    /*
     * Sitzung gueltig, Profil nicht erreichbar. Der Abzug traegt hier — und ohne
     * ihn waere das eine Abmeldung wegen eines Netzfehlers.
     */
    writeIdentitySnapshot(storage, PROFILE, null);

    const state = await restoreSession({
      getSession: async () => ({ session: { user: { id: ME, email: null } } }),
      loadIdentity: async () => {
        throw new Error('Load failed');
      },
      storage,
      isOnline: () => true,
    });

    expect(state).toMatchObject({ status: 'signed-in', offline: true });
  });

  it('wartet nicht auf ein haengendes Profil, wenn ein Abzug daliegt', async () => {
    /*
     * Der gemessene Fall: postgrest-js wiederholt einen fehlgeschlagenen GET
     * dreimal mit 1 s, 2 s, 4 s Backoff. Ohne Frist stand die App 7,5 s im
     * Ladezustand, obwohl Profil und Partner im Speicher lagen.
     */
    writeIdentitySnapshot(storage, PROFILE, null);
    let settled = false;

    const state = await restoreSession({
      getSession: async () => ({ session: { user: { id: ME, email: null } } }),
      // Antwortet nie — wie eine Anfrage hinter einem Captive Portal.
      loadIdentity: () =>
        new Promise(() => {
          settled = true;
        }),
      storage,
      isOnline: () => true,
      identityTimeoutMs: 20,
    });

    expect(state).toMatchObject({ status: 'signed-in', offline: true });
    expect(state.status === 'signed-in' && state.identity.profile.name).toBe('Lena');
    // Die Zusage laeuft weiter; entschieden wurde ohne sie.
    expect(settled).toBe(true);
  });

  it('meldet ohne Abzug nach der Frist ab', async () => {
    /*
     * Die andere Seite derselben Regel, und die unangenehmere: ohne Abzug gibt
     * es nichts zu zeigen, also fuehrt die abgelaufene Frist zum
     * Anmeldebildschirm. Das ist bewusst so und nicht schoen — ein Nutzer mit
     * gueltiger Sitzung und lahmem Netz muss sich neu anmelden.
     *
     * Die Alternative waere ein eigener Zustand „Profil nicht erreichbar" mit
     * Wiederholen-Knopf. Dagegen spricht, dass der Fall genau einmal auftritt:
     * beim allerersten Laden in diesem Browser. Danach liegt immer ein Abzug da,
     * denn jeder erfolgreiche Start schreibt einen. Ein eigener Zustand fuer ein
     * Zeitfenster von einem Ladevorgang ist mehr Maschinerie als Nutzen.
     */
    const state = await restoreSession({
      getSession: async () => ({ session: { user: { id: ME, email: null } } }),
      loadIdentity: () => new Promise(() => undefined),
      storage,
      isOnline: () => true,
      identityTimeoutMs: 20,
    });

    expect(state).toEqual({ status: 'signed-out' });
  });

  it('laesst die Frist mit 0 abschalten', async () => {
    const state = await restoreSession({
      getSession: async () => ({ session: { user: { id: ME, email: null } } }),
      loadIdentity: async () => ({ profile: PROFILE, partner: null }),
      storage,
      isOnline: () => true,
      identityTimeoutMs: 0,
    });
    expect(state).toMatchObject({ status: 'signed-in', offline: false });
  });

  it('rechnet die calendar_id aus Profil und Partner', async () => {
    const partnerId = '22222222-2222-4222-8222-222222222222';
    const state = await restoreSession({
      getSession: async () => ({ session: { user: { id: ME, email: null } } }),
      loadIdentity: async () => ({
        profile: { ...PROFILE, partner_id: partnerId },
        partner: { ...PROFILE, id: partnerId, partner_id: ME },
      }),
      storage,
      isOnline: () => true,
    });

    expect(state.status === 'signed-in' && state.identity.calendarId).toBe(
      [ME, partnerId].sort().join('_'),
    );
  });
});

describe('clearAuthData', () => {
  it('nimmt jeden Supabase-Schluessel weg', () => {
    const storage = memoryStorage({
      'sb-nyvrip-auth-token': 'x',
      'sb-other.supabase.auth': 'y',
      'my-supabase-thing': 'z',
      behalten: 'ja',
    });

    clearAuthData(storage);

    expect([...storage.raw.keys()]).toEqual(['behalten']);
  });

  it('nimmt die Google- und Identitaetsschluessel weg', () => {
    const storage = memoryStorage({
      googleAccessToken: 'a',
      googleEmail: 'b',
      googleAutoSync: 'c',
      [IDENTITY_STORAGE_KEY]: 'd',
      appLanguage: 'de',
    });

    clearAuthData(storage);

    // Die Sprachwahl gehoert nicht zur Anmeldung und bleibt.
    expect([...storage.raw.keys()]).toEqual(['appLanguage']);
    for (const key of LEGACY_AUTH_KEYS) expect(storage.raw.has(key)).toBe(false);
  });

  it('nimmt die Offline-Zwischenspeicher der Altversion weg', () => {
    /*
     * Sonst sieht der naechste Nutzer an diesem Geraet die Termine des
     * vorherigen. Die Praefixe stehen in clearAllAuthData() der Altversion.
     */
    const storage = memoryStorage({
      'ralia:event-cache:abc': '1',
      'ralia:event-queue:abc': '2',
      'ralia:todo-cache:abc': '3',
      'ralia:todo-queue:abc': '4',
      'ralia:theme': 'dark',
    });

    clearAuthData(storage);

    expect([...storage.raw.keys()]).toEqual(['ralia:theme']);
  });

  it('stoert sich nicht an einem Speicher, der wirft', () => {
    const throwing = {
      length: 1,
      key: () => 'sb-x',
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => {
        throw new Error('nope');
      },
      clear: () => undefined,
    } as unknown as Storage;

    expect(() => clearAuthData(throwing)).not.toThrow();
  });
});
