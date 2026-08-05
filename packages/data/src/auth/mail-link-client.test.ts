import { afterEach, describe, expect, it, vi } from 'vitest';
import { getMailLinkClient, resetMailLinkClient } from './mail-link-client.js';

const OPTIONS = { supabaseUrl: 'https://example.supabase.co', supabaseAnonKey: 'anon-key' };

afterEach(() => {
  resetMailLinkClient();
  vi.restoreAllMocks();
});

describe('getMailLinkClient', () => {
  it('faehrt Implicit, nicht PKCE', () => {
    /*
     * Der Kern der Entscheidung aus dem SP1-Spec. Bei PKCE legt auth-js den
     * Code-Verifier im lokalen Speicher ab und der Mail-Link ist nur in dem
     * Browser einloesbar, der ihn angefordert hat — bei „Passwort vergessen"
     * ist das fast nie derselbe.
     */
    const client = getMailLinkClient(OPTIONS);
    // @ts-expect-error -- flowType ist nicht Teil der oeffentlichen Typen.
    expect(client.auth.flowType).toBe('implicit');
  });

  it('haelt keine Sitzung und erneuert nichts', () => {
    const client = getMailLinkClient(OPTIONS);
    // @ts-expect-error -- interne Felder, hier absichtlich geprueft.
    expect(client.auth.persistSession).toBe(false);
    // @ts-expect-error -- dito.
    expect(client.auth.autoRefreshToken).toBe(false);
  });

  it('schreibt nichts in den Sitzungsspeicher', async () => {
    /*
     * Das Risiko aus dem Spec: zwei Clients am selben Origin teilen sich
     * localStorage. Wuerde dieser hier eine Sitzung ablegen, koennte er dem
     * Sitzungs-Client den Zustand unter den Fuessen wegziehen.
     *
     * Diese Suite laeuft in der Node-Umgebung, wo es kein localStorage gibt.
     * Eines hinzustellen ist hier nicht Kulisse, sondern der Kern der Pruefung:
     * auth-js greift auf globalThis.localStorage zu, wenn kein Speicher
     * uebergeben wird — waere persistSession an, landete der Zugriff genau hier.
     */
    const writes: string[] = [];
    const fake = {
      getItem: () => null,
      setItem: (key: string) => void writes.push(key),
      removeItem: () => undefined,
    };
    vi.stubGlobal('localStorage', fake);

    const client = getMailLinkClient(OPTIONS);
    // Ohne Netz schlaegt der Aufruf fehl; geprueft wird der Speicher, nicht die Antwort.
    await client.auth.resetPasswordForEmail('lena@example.com').catch(() => undefined);
    await client.auth.getSession().catch(() => undefined);

    expect(writes.filter((key) => key.startsWith('sb-'))).toEqual([]);
    vi.unstubAllGlobals();
  });

  it('gibt bei gleicher Konfiguration denselben Client zurueck', () => {
    expect(getMailLinkClient(OPTIONS)).toBe(getMailLinkClient(OPTIONS));
  });

  it('erzeugt bei neuem Schluessel einen neuen Client', () => {
    /*
     * Der Runtime-Key aus /config kommt erst nach dem Boot. Ein auf den
     * eingebauten Schluessel festgenagelter Client wuerde danach mit dem
     * falschen weiterarbeiten.
     */
    const first = getMailLinkClient(OPTIONS);
    const second = getMailLinkClient({ ...OPTIONS, supabaseAnonKey: 'sb_publishable_neu' });
    expect(second).not.toBe(first);
  });

  it('faellt nach resetMailLinkClient auf einen neuen zurueck', () => {
    const first = getMailLinkClient(OPTIONS);
    resetMailLinkClient();
    expect(getMailLinkClient(OPTIONS)).not.toBe(first);
  });
});
