import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { I18nProvider } from '../../i18n/I18nProvider.js';
import { LANG_STORAGE_KEY } from '../../i18n/catalog.js';
import { MOCK_BALANCE } from '../../mock/fixtures.js';
import { MoneyScreen } from './MoneyScreen.js';

beforeEach(() => localStorage.setItem(LANG_STORAGE_KEY, 'de'));

function renderMoney() {
  render(
    <I18nProvider>
      <MoneyScreen />
    </I18nProvider>,
  );
}

describe('MoneyScreen', () => {
  it('zeigt das Budget mit Fortschritt', () => {
    renderMoney();
    expect(screen.getByRole('progressbar', { name: /Budget/ })).toBeInTheDocument();
  });

  it('zeigt fuenf Kategorien mit segmentiertem Balken', () => {
    renderMoney();
    expect(screen.getAllByTestId('category-row')).toHaveLength(5);
  });

  it('zeigt die Bilanz beider Personen', () => {
    renderMoney();
    // Beide Namen stehen zweimal: in der Kategorienlegende und in der Bilanz.
    expect(screen.getAllByText('Jonas').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Lena').length).toBeGreaterThan(0);
    expect(screen.getByText(MOCK_BALANCE.owedLabel)).toBeInTheDocument();
  });

  it('bucht den Ausgleich und wechselt die Beschriftung', async () => {
    renderMoney();
    await userEvent.click(screen.getByRole('button', { name: 'Ausgleich buchen' }));
    expect(screen.getByRole('button', { name: /Ausgleich notiert/ })).toBeInTheDocument();
  });

  it('listet die letzten Ausgaben', () => {
    renderMoney();
    expect(screen.getAllByTestId('expense-row')).toHaveLength(7);
    expect(screen.getByText('Rewe Großeinkauf')).toBeInTheDocument();
  });

  it('zeigt Betraege in Euro', () => {
    renderMoney();
    // Intl trennt Zahl und Zeichen mit einem geschuetzten Leerzeichen; welches
    // genau, haengt an der ICU-Version. Deshalb alle Leerzeichen entfernen.
    const amounts = screen
      .getAllByTestId('expense-row')
      .map((row) => (row.textContent ?? '').replace(/\s/gu, ''));
    expect(amounts.some((text) => text.includes('780,00€'))).toBe(true);
  });
});
