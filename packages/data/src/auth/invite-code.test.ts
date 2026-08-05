import { describe, expect, it, vi } from 'vitest';
import {
  INVITE_CODE_ALPHABET,
  INVITE_CODE_LENGTH,
  createProfileWithInviteCode,
  generateInviteCode,
  isUniqueViolation,
  normalizeInviteCode,
} from './invite-code.js';

describe('generateInviteCode', () => {
  it('liefert sechs Zeichen aus dem Alphabet von Ralia 1.x', () => {
    for (let i = 0; i < 200; i += 1) {
      const code = generateInviteCode();
      expect(code).toHaveLength(INVITE_CODE_LENGTH);
      expect(code).toMatch(/^[A-Z0-9]{6}$/);
      for (const char of code) expect(INVITE_CODE_ALPHABET).toContain(char);
    }
  });

  it('schoepft aus der ganzen Breite des Alphabets', () => {
    /*
     * Kein Test auf Gleichverteilung — das waere ein Test des
     * Zufallsgenerators. Geprueft wird nur, dass nicht ein Teil des Alphabets
     * strukturell unerreichbar ist, wie es bei falsch gerechnetem Modulo
     * passiert.
     */
    const seen = new Set<string>();
    for (let i = 0; i < 4000; i += 1) for (const char of generateInviteCode()) seen.add(char);
    expect(seen.size).toBe(INVITE_CODE_ALPHABET.length);
  });

  it('nimmt den Zufall aus crypto, nicht aus Math.random', () => {
    const spy = vi.spyOn(globalThis.crypto, 'getRandomValues');
    generateInviteCode();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('normalizeInviteCode', () => {
  it('trimmt und schreibt gross — so vergleicht auch connect_partner', () => {
    // Die RPC macht upper(invite_code) = upper(trim(p_invite_code)).
    expect(normalizeInviteCode('  r7k2qm ')).toBe('R7K2QM');
  });

  it('laesst einen leeren Code leer, statt daraus etwas zu erfinden', () => {
    expect(normalizeInviteCode('   ')).toBe('');
    expect(normalizeInviteCode('')).toBe('');
  });

  it('entfernt Zeichen, die beim Abtippen dazwischenrutschen', () => {
    // Bindestriche und Leerzeichen kommen vor, wenn der Code diktiert wurde.
    expect(normalizeInviteCode('r7k-2qm')).toBe('R7K2QM');
    expect(normalizeInviteCode('R7K 2QM')).toBe('R7K2QM');
  });
});

describe('isUniqueViolation', () => {
  it('erkennt Postgres 23505', () => {
    expect(isUniqueViolation({ code: '23505' })).toBe(true);
  });

  it('erkennt die Meldung, wenn der Code fehlt', () => {
    expect(isUniqueViolation({ message: 'duplicate key value violates unique constraint' })).toBe(
      true,
    );
  });

  it('haelt andere Fehler nicht dafuer', () => {
    expect(isUniqueViolation({ code: '23503', message: 'foreign key violation' })).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation(new Error('network'))).toBe(false);
  });
});

describe('createProfileWithInviteCode', () => {
  const BASE = { id: 'user-1', name: 'Lena', email: 'lena@example.com', timezone: 'Europe/Berlin' };

  it('legt das Profil in einem Insert an', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });

    const code = await createProfileWithInviteCode(insert, BASE);

    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert).toHaveBeenCalledWith({ ...BASE, invite_code: code });
    expect(code).toMatch(/^[A-Z0-9]{6}$/);
  });

  it('wiederholt mit neuem Code, wenn der erste kollidiert', async () => {
    /*
     * Der Fall, der in Ralia 1.x still scheitert: invite_code ist eindeutig,
     * der Code kommt aus dem Zufall, und ein Zusammenstoss liess das Anlegen
     * fallen — der Nutzer stand danach ohne Profil da.
     */
    const insert = vi
      .fn()
      .mockResolvedValueOnce({ error: { code: '23505' } })
      .mockResolvedValueOnce({ error: null });

    const code = await createProfileWithInviteCode(insert, BASE);

    expect(insert).toHaveBeenCalledTimes(2);
    const firstCode = insert.mock.calls[0]?.[0].invite_code;
    expect(code).not.toBe(firstCode);
    expect(insert.mock.calls[1]?.[0].invite_code).toBe(code);
  });

  it('gibt nach begrenzt vielen Kollisionen auf, statt endlos zu drehen', async () => {
    const insert = vi.fn().mockResolvedValue({ error: { code: '23505' } });

    await expect(createProfileWithInviteCode(insert, BASE)).rejects.toThrow(/Einladungscode/);
    expect(insert).toHaveBeenCalledTimes(5);
  });

  it('wiederholt bei jedem anderen Fehler nicht, sondern reicht ihn weiter', async () => {
    // Ein RLS-Verstoss oder ein Netzfehler wird durch Wiederholen nicht besser.
    const insert = vi.fn().mockResolvedValue({ error: { code: '42501', message: 'denied' } });

    await expect(createProfileWithInviteCode(insert, BASE)).rejects.toThrow(/denied/);
    expect(insert).toHaveBeenCalledTimes(1);
  });
});
