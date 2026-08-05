import { expect, test } from '@playwright/test';
import { blockBackend, seedSignedIn } from './session.js';

/**
 * Die Anmeldung im echten Build.
 *
 * Kein Test registriert oder meldet sich wirklich an — das schriebe in die
 * Produktionsdatenbank und haenge an einem Postfach. Geprueft wird, was ohne
 * echtes Konto pruefbar und trotzdem wichtig ist: die Wache, der Umgang mit der
 * Ruecksprung-URL und dass keine Token in der Adresszeile liegen bleiben.
 */

test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => localStorage.setItem('appLanguage', 'de'));
  await blockBackend(context);
});

test('ohne Sitzung fuehrt jede Route auf die Anmeldung', async ({ page }) => {
  for (const path of ['./kalender', './planer', './todos', './geld', './profil']) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/app\/anmelden$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Anmelden' })).toBeVisible();
  }
});

test('mit Sitzung bleibt die Route erhalten', async ({ context, page }) => {
  await seedSignedIn(context);
  await page.goto('./geld');
  await expect(page).toHaveURL(/\/app\/geld$/);
});

test('die Anmeldung merkt sich, wohin es gehen sollte', async ({ page }) => {
  /*
   * Ohne das landet jeder nach der Anmeldung im Kalender — auch wer einen Link
   * auf die Geld-Ansicht geoeffnet hat.
   */
  await page.goto('./geld');
  await expect(page).toHaveURL(/\/app\/anmelden$/);

  const remembered = await page.evaluate(() => history.state?.usr?.from ?? null);
  expect(remembered).toBe('/geld');
});

test('ein recovery-Link fuehrt auf die Passwortseite und nicht in die App', async ({ page }) => {
  /*
   * Der Link tragt eine gueltige Sitzung im Fragmentteil. Wuerde die App ihn
   * durchlassen, waere eine weitergeleitete Mail ein Zugang zum ganzen Kalender.
   *
   * Die Token sind erfunden; `setSession` scheitert daran. Geprueft wird genau
   * das, was auch dann gelten muss: kein Durchmarsch in die App.
   */
  await page.goto(
    './#access_token=fake-access&refresh_token=fake-refresh&type=recovery&expires_in=3600',
  );

  await expect(page).not.toHaveURL(/\/app\/kalender$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/Passwort|Anmelden/);
});

test('Token verschwinden aus der Adresszeile', async ({ page }) => {
  /*
   * Sonst stehen sie in der Chronik und in jedem Link, den der Nutzer von dieser
   * Seite teilt.
   */
  await page.goto('./#access_token=fake-access&refresh_token=fake-refresh&type=signup');

  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => location.hash), { timeout: 10_000 })
    .not.toContain('access_token');
});

test('ein abgelaufener Link erklaert sich, statt Supabase-Rohtext zu zeigen', async ({ page }) => {
  await page.goto(
    './#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired',
  );

  const alert = page.getByRole('alert');
  await expect(alert).toBeVisible();
  // Deutsch, nicht der englische Satz des Auth-Servers.
  await expect(alert).toContainText('abgelaufen');
});

test('die Anmeldemaske ist per Tastatur bedienbar', async ({ page }) => {
  await page.goto('./anmelden');
  await expect(page.getByRole('heading', { level: 1, name: 'Anmelden' })).toBeVisible();

  // Erstes Tab landet auf einem Bedienelement, nicht im Nichts.
  await page.keyboard.press('Tab');
  const focused = await page.evaluate(() => document.activeElement?.tagName ?? null);
  expect(['BUTTON', 'INPUT', 'A']).toContain(focused);
});

test('mobil laeuft die Anmeldemaske nicht waagerecht ueber', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./anmelden');
  await expect(page.getByRole('heading', { level: 1, name: 'Anmelden' })).toBeVisible();

  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflows).toBe(false);
});
