import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../i18n/I18nProvider.js';
import { LANG_STORAGE_KEY } from '../../i18n/catalog.js';
import { MOCK_EVENTS, MOCK_TODAY } from '../../mock/fixtures.js';
import { MonthView } from './MonthView.js';

/**
 * jsdom rechnet kein Layout und meldet jede Hoehe als 0 — ohne diesen Stub
 * waere die Dichte immer der Punkte-Modus, und die Chip-Faelle liessen sich
 * nicht pruefen. Der Stub liefert die Hoehe, die der Test setzen will.
 */
function stubResizeObserver(height: number) {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(private cb: ResizeObserverCallback) {}
      observe(target: Element) {
        this.cb(
          [{ target, contentRect: { height } } as unknown as ResizeObserverEntry],
          this as never,
        );
      }
      unobserve() {}
      disconnect() {}
    },
  );
}

beforeEach(() => localStorage.setItem(LANG_STORAGE_KEY, 'de'));
afterEach(() => vi.unstubAllGlobals());

function renderMonth(gridHeight: number, weekStart: 'mo' | 'so' = 'mo', onSelectDay = vi.fn()) {
  stubResizeObserver(gridHeight);
  render(
    <I18nProvider>
      <MonthView
        year={2026}
        monthIndex={6}
        weekStart={weekStart}
        today={MOCK_TODAY}
        events={MOCK_EVENTS}
        onSelectDay={onSelectDay}
      />
    </I18nProvider>,
  );
  return onSelectDay;
}

describe('MonthView', () => {
  it('rendert 42 Tageszellen', () => {
    renderMonth(600);
    expect(screen.getAllByRole('button', { name: /^\d+\./ })).toHaveLength(42);
  });

  it('zeigt sieben Wochentagskoepfe', () => {
    renderMonth(600);
    expect(screen.getAllByTestId('weekday-head')).toHaveLength(7);
  });

  it('markiert heute', () => {
    renderMonth(600);
    expect(screen.getByRole('button', { name: /29\. Juli/ })).toHaveAttribute(
      'aria-current',
      'date',
    );
  });

  it('meldet den angetippten Tag als ISO-Datum', async () => {
    const onSelectDay = renderMonth(600);
    await userEvent.click(screen.getByRole('button', { name: /29\. Juli/ }));
    expect(onSelectDay).toHaveBeenCalledWith('2026-07-29');
  });

  it('zeigt bei viel Platz Ereignis-Chips mit Titel', () => {
    renderMonth(900);
    expect(screen.getAllByText('Zahnarzt').length).toBeGreaterThan(0);
  });

  it('zeigt bei wenig Platz Punkte statt Chips', () => {
    renderMonth(240); // Zeilenhoehe 40 → kein Chip passt
    expect(screen.queryByText('Zahnarzt')).toBeNull();
    expect(screen.getAllByTestId('event-dot').length).toBeGreaterThan(0);
  });

  it('nennt die Zahl der Termine im Namen der Zelle', () => {
    renderMonth(900);
    // Der 29. Juli hat drei Termine.
    expect(screen.getByRole('button', { name: /29\. Juli.*3 Termine/ })).toBeInTheDocument();
  });

  it('kennzeichnet Tage auszerhalb des Monats', () => {
    renderMonth(600);
    // 29. Juni liegt vor dem Monat.
    expect(screen.getByRole('button', { name: /29\. Juni/ })).toHaveAttribute(
      'data-outside',
      'true',
    );
  });

  it('folgt dem Wochenstart Sonntag', () => {
    renderMonth(600, 'so');
    expect(screen.getAllByTestId('weekday-head')[0]).toHaveTextContent('So');
  });

  it('deckelt Chips und zaehlt den Rest als +N', () => {
    // Zeilenhoehe 60 → 25 verfuegbar → genau ein Chip. Der 29. hat drei Termine.
    renderMonth(60 * 6);
    expect(screen.getByRole('button', { name: /29\. Juli/ })).toHaveTextContent('+2');
  });
});
