import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pinLanguage, renderAppAt } from '../test-harness.js';

beforeEach(() => pinLanguage('de'));
afterEach(() => vi.unstubAllGlobals());

const renderAt = renderAppAt;

function currentMonthTitle(): string {
  return new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' }).format(new Date());
}

describe('Routing', () => {
  it('leitet / auf /kalender', async () => {
    renderAt('/');
    // Der Kalender-Screen bringt seinen eigenen AppHeader mit; sein <h1>
    // traegt den aktuellen lokalen Monat.
    expect(await screen.findByRole('heading', { name: currentMonthTitle() })).toBeInTheDocument();
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
    // traegt den aktuellen lokalen Monat.
    expect(await screen.findByRole('heading', { name: currentMonthTitle() })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Kalender' })[0]).toHaveAttribute(
      'aria-current',
      'page',
    );
  });
});
