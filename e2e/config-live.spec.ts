import { expect, test } from '@playwright/test';

/**
 * Der Erfolgsfall von Abnahmekriterium 8, gegen den echten Endpunkt.
 *
 * `smoke.spec.ts` bricht /config bewusst ab und prueft damit die andere Haelfte
 * des Kriteriums: ein Fehlschlag blockiert den Start nicht. Was dort nicht
 * geprueft werden kann, ist, ob der Endpunkt ueberhaupt antwortet und ob der
 * zurueckgegebene Runtime-Key im Client landet. Genau das steht hier.
 *
 * Braucht Netzzugang zum Supabase-Projekt und laeuft deshalb nur mit
 * RALIA_LIVE=1. Ohne die Variable wird die Datei uebersprungen, damit eine
 * abgeschottete Umgebung nicht faelschlich rot wird — ein uebersprungener Test
 * ist ehrlicher als ein Test, der die Umgebung statt den Code misst.
 */

const LIVE = process.env.RALIA_LIVE === '1';

test.describe('GET /config gegen den echten Endpunkt', () => {
  test.skip(!LIVE, 'braucht Netzzugang zum Supabase-Projekt — mit RALIA_LIVE=1 einschalten');

  test.beforeEach(async ({ context }) => {
    await context.addInitScript(() => localStorage.setItem('appLanguage', 'de'));
  });

  test('antwortet mit 200 und der Runtime-Key landet im Client', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(String(error)));

    /*
     * Auf die Antwort warten, nicht auf die Anfrage: nur die Antwort traegt
     * Status und Nutzlast. Die Zusage wird vor dem goto aufgesetzt, sonst ist
     * die Anfrage beim Warten schon durch.
     */
    const configResponse = page.waitForResponse(
      (response) => response.url().includes('/functions/v1/app-api/config'),
      { timeout: 20_000 },
    );

    await page.goto('./kalender');
    const response = await configResponse;

    expect(response.status(), 'GET /config muss 200 liefern').toBe(200);

    const body = (await response.json()) as Record<string, unknown>;

    /*
     * Der Vertrag, auf dem der Boot aufsetzt: /config liefert einen
     * publishable Key, und zwar einen anderen als den eingebauten JWT. Waere
     * er gleich, wuerde der Austausch im Boot nichts beweisen.
     */
    expect(String(body.supabaseAnonKey)).toMatch(/^sb_publishable_/);
    expect(String(body.supabaseUrl)).toContain('supabase.co');

    /*
     * Die Gegenprobe zum Erfolg: der Boot meldet den Fehlschlag als Toast.
     * Bleibt der Toast aus, hat resolveConfig den Runtime-Key uebernommen —
     * anders kann der Zweig nicht ausgehen.
     */
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByText(/\/config nicht erreichbar/)).toHaveCount(0);

    expect(errors).toEqual([]);
  });

  test('die restlichen Felder der Nutzlast sind da, die Features darauf bauen', async ({
    page,
  }) => {
    const configResponse = page.waitForResponse(
      (response) => response.url().includes('/functions/v1/app-api/config'),
      { timeout: 20_000 },
    );
    await page.goto('./kalender');
    const body = (await (await configResponse).json()) as Record<string, unknown>;

    /*
     * Kein Test der Werte, sondern der Form: googleClientId braucht SP5 fuer
     * den Kalender-Sync, vapidPublicKey fuer Web-Push, billingEnabled schaltet
     * das Premium-Gating in SP6. Fehlt ein Feld, faellt es hier auf und nicht
     * erst im betroffenen Sub-Projekt.
     */
    expect(body).toHaveProperty('googleClientId');
    expect(body).toHaveProperty('vapidPublicKey');
    expect(body).toHaveProperty('billingEnabled');
    expect(typeof body.billingEnabled).toBe('boolean');
  });
});
