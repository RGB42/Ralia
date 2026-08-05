import { ThemeProvider, ToastProvider } from '@ralia/ui';
import { render } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { vi } from 'vitest';
import { I18nProvider } from './i18n/I18nProvider.js';
import { LANG_STORAGE_KEY } from './i18n/catalog.js';
import { routes } from './routes/router.js';

/**
 * Der Provider-Stapel der echten App fuer Tests, die mehr als eine Route
 * beruehren. Die Screens setzen ihn voraus: Einstellungen brauchen Theme und
 * Toast, jeder Screen den Katalog. Ohne ihn wirft der Baum beim Rendern, und
 * der Test scheitert an einer Meldung, die nichts mit seiner Zusicherung zu
 * tun hat.
 */

/** jsdom kennt matchMedia nicht; der ThemeProvider fragt es beim Rendern ab. */
export function stubMatchMedia(darkPreferred = false): void {
  vi.stubGlobal('matchMedia', () => ({
    matches: darkPreferred,
    media: '(prefers-color-scheme: dark)',
    addEventListener() {},
    removeEventListener() {},
  }));
}

/**
 * Sprache festnageln. jsdom meldet `navigator.language` als `en-US`, sonst
 * haengt jede Beschriftungspruefung am Umgebungslocale.
 */
export function pinLanguage(lang: 'de' | 'en' = 'de'): void {
  localStorage.setItem(LANG_STORAGE_KEY, lang);
}

export function renderAppAt(path: string) {
  stubMatchMedia();
  return render(
    <ThemeProvider>
      <I18nProvider>
        <ToastProvider>
          <RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />
        </ToastProvider>
      </I18nProvider>
    </ThemeProvider>,
  );
}
