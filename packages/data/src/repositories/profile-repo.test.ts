import { describe, expect, it, vi } from 'vitest';
import { browserTimeZone, createProfileRepo, type ProfileGateway } from './profile-repo.js';
import type { ProfilesRow } from '../database.types.js';

const ME = '11111111-1111-4111-8111-111111111111';
const PARTNER_ID = '22222222-2222-4222-8222-222222222222';

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

function gateway(overrides: Partial<ProfileGateway> = {}): ProfileGateway {
  return {
    selectById: vi.fn().mockResolvedValue({ data: PROFILE, error: null }),
    insert: vi.fn().mockResolvedValue({ error: null }),
    updateTimezone: vi.fn().mockResolvedValue({ error: null }),
    ...overrides,
  };
}

describe('load', () => {
  it('gibt das Profil zurueck', async () => {
    const gw = gateway();
    expect(await createProfileRepo(gw).load(ME)).toEqual(PROFILE);
    expect(gw.selectById).toHaveBeenCalledWith(ME);
  });

  it('gibt null zurueck, wenn keine Zeile da ist', async () => {
    const gw = gateway({ selectById: vi.fn().mockResolvedValue({ data: null, error: null }) });
    expect(await createProfileRepo(gw).load(ME)).toBeNull();
  });

  it('gibt bei PGRST116 null zurueck, statt zu werfen', async () => {
    /*
     * .single() antwortet mit PGRST116, wenn nichts passt. Das ist „kein
     * Profil", nicht „Fehler" — genau der Fall beim ersten Google-Login.
     */
    const gw = gateway({
      selectById: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
    });
    expect(await createProfileRepo(gw).load(ME)).toBeNull();
  });

  it('reicht einen echten Fehler weiter', async () => {
    /*
     * Ein Netzfehler darf nicht als „kein Profil" durchgehen — die App wuerde
     * sonst ein zweites Profil anlegen wollen und an der Unique-Verletzung auf
     * der Id scheitern.
     */
    const gw = gateway({
      selectById: vi.fn().mockResolvedValue({ data: null, error: { message: 'Failed to fetch' } }),
    });
    await expect(createProfileRepo(gw).load(ME)).rejects.toThrow(/Failed to fetch/);
  });
});

describe('ensure', () => {
  const USER = { id: ME, email: 'lena@example.com', name: 'Lena' };

  it('legt nichts an, wenn das Profil schon da ist', async () => {
    const gw = gateway();
    const profile = await createProfileRepo(gw).ensure(USER);

    expect(gw.insert).not.toHaveBeenCalled();
    expect(profile).toEqual(PROFILE);
  });

  it('legt es an, wenn es fehlt, und liest es danach', async () => {
    /*
     * Der Erstlogin ueber Google: die Anmeldung klappt, ein profiles-Eintrag
     * existiert aber nicht. Ralia 1.x macht es genauso — scheitern waere hier
     * falsch, weil der Nutzer dann ein Konto ohne Profil hat.
     */
    const selectById = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } })
      .mockResolvedValueOnce({ data: PROFILE, error: null });
    const gw = gateway({ selectById });

    const profile = await createProfileRepo(gw).ensure(USER);

    expect(gw.insert).toHaveBeenCalledTimes(1);
    expect(gw.insert).toHaveBeenCalledWith(
      expect.objectContaining({ id: ME, name: 'Lena', email: 'lena@example.com' }),
    );
    // Der Einladungscode entsteht beim Anlegen.
    expect((gw.insert as ReturnType<typeof vi.fn>).mock.calls[0]?.[0].invite_code).toMatch(
      /^[A-Z0-9]{6}$/,
    );
    expect(profile).toEqual(PROFILE);
  });

  it('nimmt einen Ersatznamen, wenn keiner mitkommt', async () => {
    // Ein Google-Konto ohne Anzeigenamen; 'User' ist der Wert aus Ralia 1.x.
    const selectById = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } })
      .mockResolvedValueOnce({ data: PROFILE, error: null });
    const gw = gateway({ selectById });

    await createProfileRepo(gw).ensure({ id: ME, email: null, name: null });

    expect((gw.insert as ReturnType<typeof vi.fn>).mock.calls[0]?.[0].name).toBe('User');
  });

  it('wirft, wenn das Profil nach dem Anlegen nicht auffindbar ist', async () => {
    const selectById = vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } });
    const gw = gateway({ selectById });

    await expect(createProfileRepo(gw).ensure(USER)).rejects.toThrow(/Profil/);
  });
});

describe('syncTimezone', () => {
  it('schreibt, wenn die Zeitzone abweicht', async () => {
    const gw = gateway();
    const changed = await createProfileRepo(gw).syncTimezone(
      { ...PROFILE, timezone: 'America/New_York' },
      'Europe/Berlin',
    );

    expect(changed).toBe(true);
    expect(gw.updateTimezone).toHaveBeenCalledWith(ME, 'Europe/Berlin');
  });

  it('schreibt nicht, wenn sie schon stimmt', async () => {
    const gw = gateway();
    const changed = await createProfileRepo(gw).syncTimezone(PROFILE, 'Europe/Berlin');

    expect(changed).toBe(false);
    expect(gw.updateTimezone).not.toHaveBeenCalled();
  });

  it('schreibt, wenn noch keine gesetzt ist', async () => {
    const gw = gateway();
    const changed = await createProfileRepo(gw).syncTimezone(
      { ...PROFILE, timezone: null },
      'Europe/Berlin',
    );
    expect(changed).toBe(true);
  });

  it('schluckt einen Fehler beim Schreiben', async () => {
    /*
     * Wie in Ralia 1.x eine Warnung, kein Abbruch: die Zeitzone dient den
     * Erinnerungen, ihr Fehlschlag darf die Anmeldung nicht mitnehmen.
     */
    const gw = gateway({
      updateTimezone: vi.fn().mockResolvedValue({ error: { message: 'denied' } }),
    });
    const changed = await createProfileRepo(gw).syncTimezone(
      { ...PROFILE, timezone: 'UTC' },
      'Europe/Berlin',
    );
    expect(changed).toBe(false);
  });
});

describe('loadPartner', () => {
  it('laedt das Partnerprofil', async () => {
    const partner = { ...PROFILE, id: PARTNER_ID, name: 'Jonas', partner_id: ME };
    const gw = gateway({ selectById: vi.fn().mockResolvedValue({ data: partner, error: null }) });

    expect(await createProfileRepo(gw).loadPartner(PARTNER_ID)).toEqual(partner);
  });

  it('gibt ohne partner_id null zurueck und fragt nicht nach', async () => {
    const gw = gateway();
    expect(await createProfileRepo(gw).loadPartner(null)).toBeNull();
    expect(gw.selectById).not.toHaveBeenCalled();
  });

  it('gibt null zurueck, wenn der Partner nicht lesbar ist', async () => {
    /*
     * Kann passieren, wenn die Verbindung einseitig geloest wurde: die
     * SELECT-Policy verlangt auth.uid() = partner_id auf der Zielzeile. Kein
     * Partner ist dann die richtige Antwort, kein Fehler.
     */
    const gw = gateway({ selectById: vi.fn().mockResolvedValue({ data: null, error: null }) });
    expect(await createProfileRepo(gw).loadPartner(PARTNER_ID)).toBeNull();
  });
});

describe('browserTimeZone', () => {
  it('liefert die Zeitzone der Umgebung', () => {
    expect(browserTimeZone()).toMatch(/^[A-Za-z]+\/[A-Za-z_+\-0-9]+$|^UTC$/);
  });

  it('faellt auf Europe/Berlin zurueck, wenn Intl nichts liefert', () => {
    // Derselbe Rückfall wie getBrowserTimeZone() in Ralia_Opus/public/js/state.js.
    const spy = vi
      .spyOn(Intl, 'DateTimeFormat')
      .mockReturnValue({ resolvedOptions: () => ({}) } as unknown as Intl.DateTimeFormat);

    expect(browserTimeZone()).toBe('Europe/Berlin');
    spy.mockRestore();
  });
});
