import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from './ErrorBoundary.js';
import { I18nProvider } from './i18n/I18nProvider.js';
import { LANG_STORAGE_KEY } from './i18n/catalog.js';

/** Sprache festnageln: jsdom meldet navigator.language als en-US. */
beforeEach(() => localStorage.setItem(LANG_STORAGE_KEY, 'de'));

/**
 * React meldet jeden abgefangenen Fehler zusaetzlich ueber `console.error`. Das
 * ist hier erwartetes Verhalten und darf die Testausgabe nicht zumuellen.
 */
let consoleError: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => consoleError.mockRestore());

function Boom(): React.JSX.Element {
  throw new Error('Renderfehler im Screen');
}

function mount(children: React.ReactNode, onReload: () => void = () => undefined) {
  return render(
    <I18nProvider>
      <ErrorBoundary onReload={onReload}>{children}</ErrorBoundary>
    </I18nProvider>,
  );
}

describe('ErrorBoundary', () => {
  it('zeigt die Kinder, solange nichts wirft', () => {
    mount(<p>Inhalt</p>);
    expect(screen.getByText('Inhalt')).toBeInTheDocument();
  });

  it('faengt einen Renderfehler ab, statt eine leere Seite stehen zu lassen', () => {
    mount(<Boom />);
    expect(screen.getByRole('alert')).toHaveTextContent('Etwas ist schiefgelaufen');
  });

  /**
   * Ohne die Meldung ist ein Fehlerbericht wertlos: der Nutzer sieht nur, dass
   * etwas kaputt ist, und kann nicht sagen, was.
   */
  it('nennt die Fehlermeldung, damit sie berichtbar bleibt', () => {
    mount(<Boom />);
    expect(screen.getByText(/Renderfehler im Screen/)).toBeInTheDocument();
  });

  /**
   * Der Neustart laedt die Seite, statt nur den Fehlerzustand zu verwerfen: der
   * Baum hat schon einmal geworfen, und derselbe Zustand wirft gleich wieder.
   */
  it('bietet einen Neustart an', async () => {
    const onReload = vi.fn();
    mount(<Boom />, onReload);
    await userEvent.click(screen.getByRole('button', { name: 'App neu laden' }));
    expect(onReload).toHaveBeenCalledTimes(1);
  });
});
