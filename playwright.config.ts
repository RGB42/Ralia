import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

/**
 * Vorinstallierten Chromium benutzen, wenn einer daliegt.
 *
 * Manche CI- und Container-Abbilder bringen Chromium mitgeliefert mit, aber
 * unter einer anderen Build-Nummer als die, die dieses @playwright/test
 * erwartet — dann sucht Playwright ins Leere und verlangt einen Download, der
 * in einem abgeschotteten Netz nicht geht. Der Pfad laesst sich ueber
 * PLAYWRIGHT_CHROMIUM_PATH setzen; ohne Fund bleibt es beim mitgelieferten
 * Browser.
 */
const preinstalled = process.env.PLAYWRIGHT_CHROMIUM_PATH ?? '/opt/pw-browsers/chromium';
const executablePath = existsSync(preinstalled) ? preinstalled : undefined;

/**
 * Gegen den Preview-Build statt gegen den Dev-Server: so prueft der Test auch
 * die Build-Ausgabe, nicht nur die Quellen.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}/app/`,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        ...(executablePath ? { launchOptions: { executablePath } } : {}),
      },
    },
  ],
  webServer: {
    command: `npm run build --workspace @ralia/app && npm run preview --workspace @ralia/app -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/app/`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
