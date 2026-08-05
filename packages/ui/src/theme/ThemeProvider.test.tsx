import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { THEME_ATTRIBUTE, THEME_STORAGE_KEY, ThemeProvider } from './ThemeProvider.js';
import { useTheme } from './useTheme.js';

function Probe() {
  const { choice, resolved, setChoice } = useTheme();
  return (
    <>
      <span data-testid="choice">{choice}</span>
      <span data-testid="resolved">{resolved}</span>
      <button onClick={() => setChoice('dark')}>dunkel</button>
      <button onClick={() => setChoice('system')}>system</button>
    </>
  );
}

/** jsdom kennt matchMedia nicht — wir setzen es mit steuerbarem Ergebnis. */
function mockMatchMedia(darkPreferred: boolean) {
  const listeners = new Set<(e: MediaQueryListEvent) => void>();
  const mql = {
    matches: darkPreferred,
    media: '(prefers-color-scheme: dark)',
    addEventListener: (_: string, fn: (e: MediaQueryListEvent) => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: (e: MediaQueryListEvent) => void) => listeners.delete(fn),
    dispatch: (matches: boolean) => {
      mql.matches = matches;
      for (const fn of listeners) fn({ matches } as MediaQueryListEvent);
    },
  };
  vi.stubGlobal('matchMedia', () => mql);
  return mql;
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute(THEME_ATTRIBUTE);
});
afterEach(() => vi.unstubAllGlobals());

describe('ThemeProvider', () => {
  it('folgt ohne gespeicherte Wahl der Systemeinstellung', () => {
    mockMatchMedia(true);
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('choice')).toHaveTextContent('system');
    expect(screen.getByTestId('resolved')).toHaveTextContent('dark');
    expect(document.documentElement.getAttribute(THEME_ATTRIBUTE)).toBe('dark');
  });

  it('setzt bei Hell kein Attribut', () => {
    mockMatchMedia(false);
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('resolved')).toHaveTextContent('light');
    expect(document.documentElement.hasAttribute(THEME_ATTRIBUTE)).toBe(false);
  });

  it('speichert eine manuelle Wahl', async () => {
    mockMatchMedia(false);
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'dunkel' }));
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(document.documentElement.getAttribute(THEME_ATTRIBUTE)).toBe('dark');
  });

  it('stellt eine gespeicherte Wahl wieder her — Reload-Ersatz', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    mockMatchMedia(false);
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('choice')).toHaveTextContent('dark');
    expect(document.documentElement.getAttribute(THEME_ATTRIBUTE)).toBe('dark');
  });

  it('reagiert bei system auf einen Systemwechsel', async () => {
    const mql = mockMatchMedia(false);
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('resolved')).toHaveTextContent('light');
    act(() => mql.dispatch(true));
    expect(await screen.findByText('dark')).toBeInTheDocument();
  });

  it('ignoriert einen unbekannten gespeicherten Wert', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'neon');
    mockMatchMedia(false);
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('choice')).toHaveTextContent('system');
  });
});
