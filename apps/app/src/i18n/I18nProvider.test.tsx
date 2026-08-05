import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from './I18nProvider.js';
import { LANG_STORAGE_KEY, detectLang } from './catalog.js';
import { useT } from './useT.js';

function Probe() {
  const { t, lang, setLang } = useT();
  return (
    <>
      <span data-testid="lang">{lang}</span>
      <span data-testid="text">{t('loginButton')}</span>
      <span data-testid="fallback">{t('gibtsNichtInDe')}</span>
      <button onClick={() => setLang('en')}>en</button>
    </>
  );
}

/**
 * jsdom meldet `navigator.language` als `en-US`. Ohne diesen Stub startet die
 * App in Tests auf Englisch — richtig nach der Erkennungsregel, aber nicht das,
 * was die folgenden Faelle pruefen wollen. Die Browsersprache wird deshalb
 * ausdruecklich gesetzt statt der Umgebung ueberlassen.
 */
function stubNavigatorLanguage(value: string) {
  vi.spyOn(globalThis.navigator, 'language', 'get').mockReturnValue(value);
}

beforeEach(() => {
  localStorage.clear();
  stubNavigatorLanguage('de-DE');
});
afterEach(() => vi.restoreAllMocks());

describe('detectLang', () => {
  it('folgt der gespeicherten Wahl vor allem anderen', () => {
    expect(detectLang('en', 'de-DE')).toBe('en');
    expect(detectLang('de', 'en-US')).toBe('de');
  });

  it('nimmt ohne gespeicherte Wahl die Browsersprache', () => {
    expect(detectLang(null, 'en-GB')).toBe('en');
    expect(detectLang(null, 'de-AT')).toBe('de');
  });

  it('faellt bei unbekannter Sprache auf Deutsch', () => {
    expect(detectLang(null, 'fr-FR')).toBe('de');
    expect(detectLang('klingon', undefined)).toBe('de');
  });
});

describe('I18nProvider', () => {
  it('startet auf Deutsch, wenn nichts gespeichert ist', () => {
    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>,
    );
    expect(screen.getByTestId('lang')).toHaveTextContent('de');
    expect(screen.getByTestId('text')).toHaveTextContent('Anmelden');
  });

  it('wechselt die Sprache und speichert sie', async () => {
    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'en' }));
    expect(screen.getByTestId('lang')).toHaveTextContent('en');
    expect(localStorage.getItem(LANG_STORAGE_KEY)).toBe('en');
  });

  it('stellt eine gespeicherte Sprache wieder her', () => {
    localStorage.setItem(LANG_STORAGE_KEY, 'en');
    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>,
    );
    expect(screen.getByTestId('lang')).toHaveTextContent('en');
  });

  it('gibt bei unbekanntem Schluessel den Schluessel zurueck', () => {
    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>,
    );
    expect(screen.getByTestId('fallback')).toHaveTextContent('gibtsNichtInDe');
  });

  it('setzt das lang-Attribut am Dokument', () => {
    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>,
    );
    expect(document.documentElement.lang).toBe('de');
  });
});
