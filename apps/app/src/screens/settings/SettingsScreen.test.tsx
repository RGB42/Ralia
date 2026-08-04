import { THEME_ATTRIBUTE, THEME_STORAGE_KEY, ThemeProvider, ToastProvider } from '@ralia/ui';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../i18n/I18nProvider.js';
import { LANG_STORAGE_KEY } from '../../i18n/catalog.js';
import { SettingsScreen } from './SettingsScreen.js';

function renderScreen() {
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    media: '',
    addEventListener() {},
    removeEventListener() {},
  }));
  return render(
    <MemoryRouter>
      <ThemeProvider>
        <I18nProvider>
          <ToastProvider>
            <SettingsScreen />
          </ToastProvider>
        </I18nProvider>
      </ThemeProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(LANG_STORAGE_KEY, 'de');
  document.documentElement.removeAttribute(THEME_ATTRIBUTE);
});
afterEach(() => vi.unstubAllGlobals());

describe('SettingsScreen', () => {
  it('zeigt Profilkarte und drei Kennzahlen', () => {
    renderScreen();
    expect(screen.getByText('Jonas Berger')).toBeInTheDocument();
    expect(screen.getAllByTestId('profile-stat')).toHaveLength(3);
  });

  it('schaltet das Theme auf dunkel und speichert es', async () => {
    renderScreen();
    await userEvent.click(screen.getByRole('switch', { name: /Dark Mode/ }));
    expect(document.documentElement.getAttribute(THEME_ATTRIBUTE)).toBe('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });

  it('schaltet das Theme wieder zurueck', async () => {
    renderScreen();
    await userEvent.click(screen.getByRole('switch', { name: /Dark Mode/ }));
    await userEvent.click(screen.getByRole('switch', { name: /Dark Mode/ }));
    expect(document.documentElement.hasAttribute(THEME_ATTRIBUTE)).toBe(false);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });

  it('wechselt die Sprache auf Englisch', async () => {
    renderScreen();
    // Vorher steht die Abschnittsueberschrift auf Deutsch da.
    expect(screen.getByText('Persönlich')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: 'EN' }));
    expect(localStorage.getItem(LANG_STORAGE_KEY)).toBe('en');
    // Der Screen-Titel lebt im AppHeader; geprueft wird eine Beschriftung,
    // die dieser Screen selbst rendert.
    expect(screen.queryByText('Persönlich')).toBeNull();
    expect(screen.getByText('Personal')).toBeInTheDocument();
  });

  it('zeigt den Einladungscode', () => {
    renderScreen();
    expect(screen.getByText('R7K2QM')).toBeInTheDocument();
  });

  it('meldet das Kopieren des Codes per Toast', async () => {
    const writeText = vi.fn(async () => {});
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    renderScreen();
    await userEvent.click(screen.getByRole('button', { name: /Kopieren/ }));
    expect(writeText).toHaveBeenCalledWith('R7K2QM');
    expect(await screen.findByRole('status')).toBeInTheDocument();
  });

  /** Kein Clipboard: der Nutzer bekommt trotzdem eine Rueckmeldung. */
  it('meldet auch einen fehlgeschlagenen Kopierversuch', async () => {
    vi.stubGlobal('navigator', {
      ...navigator,
      clipboard: {
        writeText: async () => {
          throw new Error('verweigert');
        },
      },
    });
    renderScreen();
    await userEvent.click(screen.getByRole('button', { name: /Kopieren/ }));
    expect(await screen.findByRole('status')).toHaveTextContent(/abschreiben/);
  });

  it('schaltet den Wochenstart um', async () => {
    renderScreen();
    await userEvent.click(screen.getByRole('radio', { name: 'So' }));
    expect(screen.getByRole('radio', { name: 'So' })).toBeChecked();
  });

  it('fuehrt zur Sync-Unterseite', () => {
    renderScreen();
    expect(
      screen.getByRole('button', { name: /Kalender & Konflikte verwalten/ }),
    ).toBeInTheDocument();
  });
});
