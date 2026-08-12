import { describe, expect, it, vi } from 'vitest';
import type { RaliaSupabaseClient } from '../client.js';
import { createPushRepo, type PushSubscriptionInput } from './push-repo.js';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const ENDPOINT = 'https://fcm.googleapis.com/fcm/send/abc123';

const SUBSCRIPTION: PushSubscriptionInput = {
  endpoint: ENDPOINT,
  p256dh: 'p256dh-key',
  auth: 'auth-secret',
  userAgent: 'Mozilla/5.0 (Test)',
};

describe('push subscriptions save', () => {
  it('legt ein Abo mit der eigenen Nutzer-ID an', async () => {
    const upsert = vi.fn().mockResolvedValue({ data: null, error: null });
    const from = vi.fn().mockReturnValue({ upsert });
    const client = { from } as unknown as RaliaSupabaseClient;

    await createPushRepo(client, USER_ID).save(SUBSCRIPTION);

    expect(from).toHaveBeenCalledWith('push_subscriptions');
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: USER_ID,
        endpoint: ENDPOINT,
        p256dh: 'p256dh-key',
        auth: 'auth-secret',
        user_agent: 'Mozilla/5.0 (Test)',
        is_active: true,
      }),
      expect.anything(),
    );
  });

  it('schreibt dasselbe Endpoint kein zweites Mal, sondern aktualisiert es', async () => {
    const upsert = vi.fn().mockResolvedValue({ data: null, error: null });
    const from = vi.fn().mockReturnValue({ upsert });
    const client = { from } as unknown as RaliaSupabaseClient;

    await createPushRepo(client, USER_ID).save(SUBSCRIPTION);

    /*
     * Der einzige passende Unique-Index heisst `push_subscriptions_user_id_endpoint_key`
     * und liegt auf (user_id, endpoint) -- nicht auf `endpoint` allein. Gegen die
     * laufende Datenbank geprueft (pg_indexes): ein falscher Name wuerde erst zur
     * Laufzeit scheitern, nicht beim Typecheck.
     */
    expect(upsert).toHaveBeenCalledWith(expect.anything(), { onConflict: 'user_id,endpoint' });
  });
});

describe('push subscriptions deactivate', () => {
  it('setzt beim Abmelden is_active auf false, statt zu loeschen', async () => {
    const eqEndpoint = vi.fn().mockResolvedValue({ error: null });
    const eqUserId = vi.fn().mockReturnValue({ eq: eqEndpoint });
    const update = vi.fn().mockReturnValue({ eq: eqUserId });
    const deleteRow = vi.fn();
    const from = vi.fn().mockReturnValue({ update, delete: deleteRow });
    const client = { from } as unknown as RaliaSupabaseClient;

    await createPushRepo(client, USER_ID).deactivate(ENDPOINT);

    // Der Server (reminder-worker) deaktiviert ein 404/410-Abo genauso -- eine
    // deaktivierte Zeile bleibt als Spur erhalten statt spurlos zu verschwinden.
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ is_active: false }));
    expect(eqUserId).toHaveBeenCalledWith('user_id', USER_ID);
    expect(eqEndpoint).toHaveBeenCalledWith('endpoint', ENDPOINT);
    expect(deleteRow).not.toHaveBeenCalled();
  });
});

describe('push subscriptions hasActive', () => {
  // Nicht Teil der vier Zusicherungen aus dem Brief, aber Teil der verbindlichen
  // Schnittstelle (Aufgabe 5 ruft sie auf) -- deshalb hier mit knapper eigener
  // Abdeckung statt ungeprueft zu bleiben.
  it('fragt nur is_active ab und meldet es als boolean zurueck', async () => {
    const activeSingle = vi.fn().mockResolvedValue({ data: { is_active: true }, error: null });
    const activeEqEndpoint = vi.fn().mockReturnValue({ maybeSingle: activeSingle });
    const activeEqUserId = vi.fn().mockReturnValue({ eq: activeEqEndpoint });
    const activeSelect = vi.fn().mockReturnValue({ eq: activeEqUserId });
    const activeFrom = vi.fn().mockReturnValue({ select: activeSelect });
    const activeClient = { from: activeFrom } as unknown as RaliaSupabaseClient;

    const missingSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const missingEqEndpoint = vi.fn().mockReturnValue({ maybeSingle: missingSingle });
    const missingEqUserId = vi.fn().mockReturnValue({ eq: missingEqEndpoint });
    const missingSelect = vi.fn().mockReturnValue({ eq: missingEqUserId });
    const missingFrom = vi.fn().mockReturnValue({ select: missingSelect });
    const missingClient = { from: missingFrom } as unknown as RaliaSupabaseClient;

    await expect(createPushRepo(activeClient, USER_ID).hasActive(ENDPOINT)).resolves.toBe(true);
    await expect(createPushRepo(missingClient, USER_ID).hasActive(ENDPOINT)).resolves.toBe(false);

    expect(activeSelect).toHaveBeenCalledWith('is_active');
    expect(activeEqUserId).toHaveBeenCalledWith('user_id', USER_ID);
    expect(activeEqEndpoint).toHaveBeenCalledWith('endpoint', ENDPOINT);
  });
});

describe('push subscriptions error handling', () => {
  it('meldet einen Fehler der Datenbank weiter, statt ihn zu schlucken', async () => {
    const deniedUpsert = vi
      .fn()
      .mockResolvedValue({ data: null, error: { code: '42501', message: 'denied' } });
    const deniedFrom = vi.fn().mockReturnValue({ upsert: deniedUpsert });
    const deniedClient = { from: deniedFrom } as unknown as RaliaSupabaseClient;

    const offlineUpsert = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const offlineFrom = vi.fn().mockReturnValue({ upsert: offlineUpsert });
    const offlineClient = { from: offlineFrom } as unknown as RaliaSupabaseClient;

    await expect(createPushRepo(deniedClient, USER_ID).save(SUBSCRIPTION)).rejects.toMatchObject({
      code: 'forbidden',
      backendCode: '42501',
    });
    await expect(createPushRepo(offlineClient, USER_ID).save(SUBSCRIPTION)).rejects.toMatchObject({
      code: 'unavailable',
    });
  });
});
