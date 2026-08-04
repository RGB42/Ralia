import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { I18nProvider } from '../i18n/I18nProvider.js';
import { LANG_STORAGE_KEY } from '../i18n/catalog.js';
import { routes } from './router.js';

/**
 * Sprache festnageln. jsdom meldet `navigator.language` als `en-US`, sonst
 * wuerden diese Faelle die englischen Beschriftungen sehen und je nach
 * Umgebungslocale unterschiedlich ausgehen.
 */
beforeEach(() => localStorage.setItem(LANG_STORAGE_KEY, 'de'));

/** AppFrame holt die Tab-Beschriftungen aus dem Katalog — der Provider muss stehen. */
function renderAt(path: string) {
  return render(
    <I18nProvider>
      <RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />
    </I18nProvider>,
  );
}

describe('Routing', () => {
  it('leitet / auf /kalender', async () => {
    renderAt('/');
    // Die Platzhalter dieser Task rendern nur ihren Namen; einen <h1> gibt es
    // erst ab Task 16, wenn die Screens den AppHeader mitbringen.
    // Der Kalender-Screen bringt seinen eigenen AppHeader mit; sein <h1>
    // traegt den Monatstitel des fiktiven Heute.
    expect(await screen.findByRole('heading', { name: 'Juli 2026' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Kalender' })[0]).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it.each([
    ['/planer', 'Planer'],
    ['/todos', 'Todos'],
    ['/geld', 'Geld'],
    ['/profil', 'Profil'],
  ])('markiert bei %s den Tab %s', async (path, label) => {
    renderAt(path);
    const active = (await screen.findAllByRole('button', { name: label })).filter(
      (b) => b.getAttribute('aria-current') === 'page',
    );
    expect(active.length).toBeGreaterThan(0);
  });

  it('navigiert per Klick auf einen Tab', async () => {
    renderAt('/kalender');
    const [geld] = await screen.findAllByRole('button', { name: 'Geld' });
    expect(geld).toBeDefined();
    await userEvent.click(geld as HTMLElement);
    const active = screen
      .getAllByRole('button', { name: 'Geld' })
      .filter((b) => b.getAttribute('aria-current') === 'page');
    expect(active.length).toBeGreaterThan(0);
  });

  it('haelt /profil/sync auf dem Profil-Tab', async () => {
    renderAt('/profil/sync');
    const active = (await screen.findAllByRole('button', { name: 'Profil' })).filter(
      (b) => b.getAttribute('aria-current') === 'page',
    );
    expect(active.length).toBeGreaterThan(0);
  });

  it('zeigt bei unbekanntem Pfad den Kalender', async () => {
    renderAt('/gibtsnicht');
    // Der Kalender-Screen bringt seinen eigenen AppHeader mit; sein <h1>
    // traegt den Monatstitel des fiktiven Heute.
    expect(await screen.findByRole('heading', { name: 'Juli 2026' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Kalender' })[0]).toHaveAttribute(
      'aria-current',
      'page',
    );
  });
});
