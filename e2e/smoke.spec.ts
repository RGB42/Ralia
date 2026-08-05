import { expect, test } from '@playwright/test';
import { blockBackend, seedSignedIn } from './session.js';

test.beforeEach(async ({ context }) => {
  /*
   * Sprache festnageln: sonst haengt jede Beschriftungspruefung an der
   * Sprache des Testbrowsers.
   */
  await context.addInitScript(() => localStorage.setItem('appLanguage', 'de'));

  /*
   * Jeden Netzweg zum Backend abschneiden statt in die Sechs-Sekunden-Frist des
   * Boots zu laufen. Damit pruefen diese Tests gleich den Fall ohne Netz —
   * und das ist genau die Zusicherung aus Abnahmekriterium 8: ein
   * fehlgeschlagenes /config blockiert den Start nicht.
   */
  await blockBackend(context);

  /*
   * Ab SP1 liegt jede Route hinter der Anmeldewache. Diese Tests pruefen die
   * Screens, nicht die Anmeldung — sie bekommen eine Sitzung mitgegeben. Der Weg
   * dorthin ist derselbe wie bei einem Nutzer ohne Empfang: Sitzung im Speicher,
   * Identitaet aus dem Abzug.
   */
  await seedSignedIn(context, { partnerId: '22222222-2222-4222-8222-222222222222' });
});

test('bootet und zeigt den Kalender', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(String(error)));

  await page.goto('./');
  // / leitet auf /kalender um
  await expect(page).toHaveURL(/\/app\/kalender$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  // 42 Tageszellen im Monatsraster
  await expect(page.getByRole('button', { name: /^\d+\./ })).toHaveCount(42);
  expect(errors).toEqual([]);
});

test('Theme-Wahl uebersteht einen Reload', async ({ page }) => {
  await page.goto('./profil');
  await page.getByRole('switch', { name: /Dark Mode/ }).click();
  await expect(page.locator('html')).toHaveAttribute('data-ralia-theme', 'dark');

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-ralia-theme', 'dark');

  /*
   * Kein Hell-Blitz: das Inline-Skript in index.html setzt das Attribut vor
   * dem ersten Frame. Geprueft wird der Zustand direkt nach dem Dokumentstart,
   * bevor React ueberhaupt geladen ist.
   */
  const early = page.waitForFunction(
    () => document.documentElement.getAttribute('data-ralia-theme') === 'dark',
    undefined,
    { timeout: 5000 },
  );
  await page.goto('./profil', { waitUntil: 'commit' });
  await expect(early).resolves.toBeTruthy();
});

/*
 * Zwei Beschriftungssaetze, weil die Vorlage dasselbe Ziel je Navigation
 * anders benennt: in der Sidebar 'Wochenplaner' und 'Einstellungen', in der
 * Bottom-Nav 'Planer' und 'Profil'. Der Standard-Viewport zeigt die Sidebar.
 */
const SIDEBAR_TABS = [
  ['Wochenplaner', 'planer'],
  ['Todos', 'todos'],
  ['Geld', 'geld'],
  ['Einstellungen', 'profil'],
  ['Kalender', 'kalender'],
] as const;

const BOTTOM_TABS = [
  ['Planer', 'planer'],
  ['Todos', 'todos'],
  ['Geld', 'geld'],
  ['Profil', 'profil'],
  ['Kalender', 'kalender'],
] as const;

test('alle fuenf Tabs sind ueber die Sidebar erreichbar', async ({ page }) => {
  await page.goto('./');
  for (const [label, path] of SIDEBAR_TABS) {
    await page
      .getByRole('navigation', { name: 'Bereiche' })
      .getByRole('button', { name: label, exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`/app/${path}$`));
  }
});

test('alle fuenf Tabs sind ueber die Bottom-Nav erreichbar', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./');
  for (const [label, path] of BOTTOM_TABS) {
    await page
      .getByRole('navigation', { name: 'Hauptnavigation' })
      .getByRole('button', { name: label, exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`/app/${path}$`));
  }
});

test('die Sync-Unterseite ist erreichbar und wieder verlassbar', async ({ page }) => {
  await page.goto('./profil');
  await page.getByRole('button', { name: /Kalender & Konflikte verwalten/ }).click();
  await expect(page).toHaveURL(/\/app\/profil\/sync$/);
  await page.getByRole('button', { name: 'Zurück' }).click();
  await expect(page).toHaveURL(/\/app\/profil$/);
});

test('ein Sheet oeffnet und schlieszt auf drei Wegen', async ({ page }) => {
  await page.goto('./kalender');
  const cell = page.getByRole('button', { name: /29\. Juli/ });
  const dialog = page.getByRole('dialog');

  await cell.click();
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);

  await cell.click();
  await expect(dialog).toBeVisible();
  await page.getByTestId('sheet-backdrop').click({ position: { x: 12, y: 12 } });
  await expect(dialog).toHaveCount(0);

  await cell.click();
  await expect(dialog).toBeVisible();
  // exact: Playwright sucht sonst nach Teilstrings, und der Warn-Toast tragt
  // 'Meldung schließen'.
  await page.getByRole('button', { name: 'Schließen', exact: true }).click();
  await expect(dialog).toHaveCount(0);
});

test('der Fokus bleibt in einem offenen Sheet', async ({ page }) => {
  await page.goto('./kalender');
  await page.getByRole('button', { name: /29\. Juli/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  for (let i = 0; i < 8; i += 1) await page.keyboard.press('Tab');
  const inside = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    return dialog !== null && dialog.contains(document.activeElement);
  });
  expect(inside).toBe(true);
});

test('mobil gibt es keine waagerechte Scrollleiste', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ['./kalender', './planer', './todos', './geld', './profil']) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflows, `waagerechter Ueberlauf auf ${path}`).toBe(false);
  }
});

test('ab 1024 px erscheint die Sidebar, darunter die Bottom-Nav', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('./kalender');
  await expect(page.getByRole('navigation', { name: 'Bereiche' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Hauptnavigation' })).toBeHidden();

  await page.setViewportSize({ width: 900, height: 900 });
  await expect(page.getByRole('navigation', { name: 'Hauptnavigation' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Bereiche' })).toBeHidden();
});
