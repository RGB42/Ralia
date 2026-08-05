import { describe, expect, it, vi } from 'vitest';
import { PARTNER_ERROR_KEYS, createPartnerRepo, partnerErrorKey } from './partner-repo.js';

const PARTNER = {
  id: '22222222-2222-4222-8222-222222222222',
  name: 'Jonas',
  email: 'jonas@example.com',
  invite_code: 'JX91TB',
  partner_id: '11111111-1111-4111-8111-111111111111',
  timezone: 'Europe/Berlin',
  anniversary_date: null,
  plan_tier: 'free',
  plan_status: 'inactive',
  ls_customer_id: null,
  ls_subscription_id: null,
  pro_expires_at: null,
  created_at: '2026-01-01T00:00:00Z',
};

const ME = '11111111-1111-4111-8111-111111111111';

describe('partnerErrorKey', () => {
  it('ordnet jede Wortmarke der RPCs einem i18n-Schluessel zu', () => {
    /*
     * Die Marken stehen in migrations/018 als `raise exception '…'`. Die
     * Zuordnung ist aus Ralia_Opus/public/js/partner.js uebernommen.
     */
    expect(partnerErrorKey({ message: 'invalid_code' })).toBe('invalidInviteCode');
    expect(partnerErrorKey({ message: 'cant_connect_self' })).toBe('cantConnectYourself');
    expect(partnerErrorKey({ message: 'already_connected' })).toBe('alreadyConnected');
    expect(partnerErrorKey({ message: 'partner_taken' })).toBe('partnerTaken');
    expect(partnerErrorKey({ message: 'not_authenticated' })).toBe('sessionError');
  });

  it('kennt profile_not_found, das in Ralia 1.x fehlt', () => {
    /*
     * migrations/018 wirft es, partner.js hat keinen Eintrag dafuer — dort
     * faellt es auf 'invalidInviteCode' und behauptet damit etwas Falsches:
     * der Code war richtig, das eigene Profil fehlt.
     */
    expect(partnerErrorKey({ message: 'profile_not_found' })).toBe('profileError');
  });

  it('findet die Marke auch in einer umgebenden Meldung', () => {
    // PostgREST verpackt: 'invalid_code' wird zu einer Meldung mit Kontext.
    expect(partnerErrorKey({ message: 'ERROR: invalid_code (SQLSTATE P0001)' })).toBe(
      'invalidInviteCode',
    );
  });

  it('faellt auf eine allgemeine Meldung zurueck, statt zu raten', () => {
    expect(partnerErrorKey({ message: 'irgendwas ganz anderes' })).toBe('genericError');
    expect(partnerErrorKey(null)).toBe('genericError');
  });

  it('bildet jede Marke aus der Tabelle auf einen nicht-leeren Schluessel ab', () => {
    for (const [token, key] of Object.entries(PARTNER_ERROR_KEYS)) {
      expect(key, token).toMatch(/\S/);
    }
  });
});

describe('connect', () => {
  it('ruft connect_partner mit dem normalisierten Code', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: PARTNER, error: null });
    const repo = createPartnerRepo(rpc);

    const result = await repo.connect(' jx91tb ', ME);

    // Gross und getrimmt — so vergleicht die RPC.
    expect(rpc).toHaveBeenCalledWith('connect_partner', { p_invite_code: 'JX91TB' });
    expect(result).toEqual({ ok: true, partner: PARTNER });
  });

  it('faengt den eigenen Code ab, ohne die RPC zu fragen', async () => {
    /*
     * Eine Rundreise, deren Antwort man vorher kennt. Ralia 1.x macht es
     * genauso — und es ist die einzige Pruefung, die der Client fuehren darf:
     * einen *fremden* Code kann er nicht aufloesen, weil die SELECT-Policy nur
     * die eigene und die Partnerzeile herausgibt.
     */
    const rpc = vi.fn();
    const repo = createPartnerRepo(rpc);

    const result = await repo.connect('R7K2QM', ME, 'R7K2QM');

    expect(rpc).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: false, messageKey: 'cantConnectYourself' });
  });

  it('weist einen leeren Code ab, ohne die RPC zu fragen', async () => {
    const rpc = vi.fn();
    const result = await createPartnerRepo(rpc).connect('   ', ME);

    expect(rpc).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: false, messageKey: 'pleaseEnterCode' });
  });

  it('macht aus jeder RPC-Marke die passende Meldung', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'partner_taken' } });
    const result = await createPartnerRepo(rpc).connect('JX91TB', ME);

    expect(result).toEqual({ ok: false, messageKey: 'partnerTaken' });
  });

  it('behandelt eine leere Antwort ohne Fehler als Fehlschlag', async () => {
    /*
     * connect_partner gibt to_jsonb(v_target) zurueck; null ohne Fehler darf
     * nicht als Erfolg durchgehen, sonst stuende die App mit partner === null
     * da und haelt sich fuer verbunden.
     */
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    const result = await createPartnerRepo(rpc).connect('JX91TB', ME);

    expect(result).toEqual({ ok: false, messageKey: 'invalidInviteCode' });
  });
});

describe('disconnect', () => {
  it('ruft disconnect_partner ohne Argumente', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    const result = await createPartnerRepo(rpc).disconnect();

    expect(rpc).toHaveBeenCalledWith('disconnect_partner', {});
    expect(result).toEqual({ ok: true });
  });

  it('gibt den Fehler als Schluessel zurueck', async () => {
    const rpc = vi.fn().mockResolvedValue({ error: { message: 'not_authenticated' } });
    expect(await createPartnerRepo(rpc).disconnect()).toEqual({
      ok: false,
      messageKey: 'sessionError',
    });
  });
});

describe('setAnniversary', () => {
  it('benutzt p_date — den Namen, den die Funktion wirklich traegt', async () => {
    /*
     * Der Parameter hiess in den Typen jahrelang p_anniversary_date. PostgREST
     * loest RPC-Argumente ueber den Namen auf, der Aufruf waere zur Laufzeit
     * gescheitert. Dieser Test ist die Wache dagegen.
     */
    const rpc = vi.fn().mockResolvedValue({ error: null });
    await createPartnerRepo(rpc).setAnniversary('2019-06-14');

    expect(rpc).toHaveBeenCalledWith('set_shared_anniversary', { p_date: '2019-06-14' });
  });

  it('loescht den Jahrestag mit null', async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    await createPartnerRepo(rpc).setAnniversary(null);

    expect(rpc).toHaveBeenCalledWith('set_shared_anniversary', { p_date: null });
  });

  it('gibt den Fehler als Schluessel zurueck', async () => {
    const rpc = vi.fn().mockResolvedValue({ error: { message: 'not_authenticated' } });
    expect(await createPartnerRepo(rpc).setAnniversary('2019-06-14')).toEqual({
      ok: false,
      messageKey: 'sessionError',
    });
  });
});
