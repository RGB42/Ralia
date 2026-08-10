import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  IDENTITY_SNAPSHOT_MAX_AGE_MS,
  IDENTITY_STORAGE_KEY,
  clearIdentitySnapshot,
  readIdentitySnapshot,
  writeIdentitySnapshot,
} from './identity-snapshot.js';
import type { ProfilesRow } from '../database.types.js';

function memoryStorage(): Storage & { raw: Map<string, string> } {
  const raw = new Map<string, string>();
  return {
    raw,
    length: 0,
    clear: () => raw.clear(),
    getItem: (k: string) => raw.get(k) ?? null,
    key: () => null,
    removeItem: (k: string) => void raw.delete(k),
    setItem: (k: string, v: string) => void raw.set(k, v),
  } as Storage & { raw: Map<string, string> };
}

const LENA: ProfilesRow = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Lena',
  email: 'lena@example.com',
  invite_code: 'R7K2QM',
  partner_id: '22222222-2222-4222-8222-222222222222',
  timezone: 'Europe/Berlin',
  anniversary_date: '2019-06-14',
  plan_tier: 'pro',
  plan_status: 'active',
  ls_customer_id: null,
  ls_subscription_id: null,
  pro_expires_at: null,
  created_at: '2026-01-01T00:00:00Z',
};

const JONAS: ProfilesRow = { ...LENA, id: LENA.partner_id!, name: 'Jonas', partner_id: LENA.id };

describe('writeIdentitySnapshot', () => {
  let storage: ReturnType<typeof memoryStorage>;

  beforeEach(() => {
    storage = memoryStorage();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-05T09:00:00Z'));
  });

  it('schreibt unter demselben Schluessel wie Ralia 1.x', () => {
    writeIdentitySnapshot(storage, LENA, JONAS);
    expect(IDENTITY_STORAGE_KEY).toBe('ralia:identity');
    expect(storage.raw.has('ralia:identity')).toBe(true);
  });

  it('schreibt die Form, die Ralia 1.x liest', () => {
    writeIdentitySnapshot(storage, LENA, JONAS);

    const written = JSON.parse(storage.raw.get(IDENTITY_STORAGE_KEY) as string);
    expect(written).toEqual({
      version: 1,
      userId: LENA.id,
      name: 'Lena',
      email: 'lena@example.com',
      // Gerechnet, nicht aus einer Spalte: profiles hat kein calendar_id.
      calendarId: [LENA.id, JONAS.id].sort().join('_'),
      profile: { ...LENA, ls_customer_id: null, ls_subscription_id: null },
      partner: {
        ...JONAS,
        email: null,
        invite_code: null,
        ls_customer_id: null,
        ls_subscription_id: null,
        plan_status: null,
        plan_tier: null,
        pro_expires_at: null,
      },
      savedAt: '2026-08-05T09:00:00.000Z',
    });
  });

  it('nimmt ohne Partner die eigene Id als Kalender', () => {
    writeIdentitySnapshot(storage, { ...LENA, partner_id: null }, null);

    const written = JSON.parse(storage.raw.get(IDENTITY_STORAGE_KEY) as string);
    expect(written.calendarId).toBe(LENA.id);
    expect(written.partner).toBeNull();
  });

  it('schweigt, wenn der Speicher voll ist', () => {
    /*
     * Im privaten Modus mancher Browser wirft setItem. Der Abzug ist eine
     * Annehmlichkeit fuer den Offline-Start — sein Fehlschlag darf die
     * Anmeldung nicht mitnehmen.
     */
    const throwing = {
      ...memoryStorage(),
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    } as unknown as Storage;

    expect(() => writeIdentitySnapshot(throwing, LENA, JONAS)).not.toThrow();
  });
});

describe('readIdentitySnapshot', () => {
  let storage: ReturnType<typeof memoryStorage>;

  beforeEach(() => {
    storage = memoryStorage();
  });

  it('liest zurueck, was geschrieben wurde', () => {
    writeIdentitySnapshot(storage, LENA, JONAS);
    const snapshot = readIdentitySnapshot(storage);
    expect(snapshot?.profile.id).toBe(LENA.id);
    expect(snapshot?.partner?.name).toBe('Jonas');
  });

  it('legt weder Billing-Daten noch Partnerkontakt im Browser ab', () => {
    writeIdentitySnapshot(
      storage,
      { ...LENA, ls_customer_id: 'customer', ls_subscription_id: 'subscription' },
      { ...JONAS, email: 'jonas@example.com', invite_code: 'SECRET' },
    );

    const snapshot = readIdentitySnapshot(storage);
    expect(snapshot?.profile.ls_customer_id).toBeNull();
    expect(snapshot?.profile.ls_subscription_id).toBeNull();
    expect(snapshot?.partner?.email).toBeNull();
    expect(snapshot?.partner?.invite_code).toBeNull();
  });

  it('verwirft einen abgelaufenen Abzug', () => {
    writeIdentitySnapshot(storage, LENA, JONAS);
    const now = Date.parse('2026-08-05T09:00:00.000Z');
    expect(readIdentitySnapshot(storage, now + IDENTITY_SNAPSHOT_MAX_AGE_MS + 1)).toBeNull();
  });

  it('liefert null ohne Eintrag', () => {
    expect(readIdentitySnapshot(storage)).toBeNull();
  });

  it('liefert null bei kaputtem JSON, statt zu werfen', () => {
    storage.setItem(IDENTITY_STORAGE_KEY, '{nicht: json');
    expect(readIdentitySnapshot(storage)).toBeNull();
  });

  it('verwirft einen Abzug ohne Profil-Id', () => {
    // Genau die Pruefung aus restoreIdentityFromSnapshot in Ralia 1.x.
    storage.setItem(IDENTITY_STORAGE_KEY, JSON.stringify({ version: 1, profile: {} }));
    expect(readIdentitySnapshot(storage)).toBeNull();
  });

  it('verwirft eine unbekannte Version', () => {
    /*
     * Nach oben offen zu sein waere hier falsch: eine spaetere Fassung koennte
     * die Bedeutung eines Feldes aendern, und ein halb verstandener Abzug ist
     * schlimmer als keiner.
     */
    storage.setItem(IDENTITY_STORAGE_KEY, JSON.stringify({ version: 2, profile: LENA }));
    expect(readIdentitySnapshot(storage)).toBeNull();
  });

  it('liest einen Abzug, den Ralia 1.x geschrieben hat', () => {
    /*
     * Der Fall beim ersten Start der neuen App: der Nutzer hatte die alte offen.
     * Ohne Netz haengt seine Anmeldung an genau diesem Eintrag.
     */
    storage.setItem(
      IDENTITY_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        userId: LENA.id,
        name: 'Lena',
        email: 'lena@example.com',
        calendarId: `${LENA.id}_${JONAS.id}`,
        profile: LENA,
        partner: JONAS,
        savedAt: '2026-07-30T20:11:00.000Z',
      }),
    );

    const snapshot = readIdentitySnapshot(storage);
    expect(snapshot?.userId).toBe(LENA.id);
    expect(snapshot?.calendarId).toContain('_');
  });
});

describe('clearIdentitySnapshot', () => {
  it('nimmt den Eintrag weg', () => {
    const storage = memoryStorage();
    writeIdentitySnapshot(storage, LENA, JONAS);
    clearIdentitySnapshot(storage);
    expect(storage.raw.has(IDENTITY_STORAGE_KEY)).toBe(false);
  });

  it('stoert sich nicht daran, wenn nichts da ist', () => {
    expect(() => clearIdentitySnapshot(memoryStorage())).not.toThrow();
  });
});
