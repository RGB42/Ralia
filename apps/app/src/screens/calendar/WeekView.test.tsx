import { WEEK_HOUR_HEIGHT_PX } from '@ralia/core';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../i18n/I18nProvider.js';
import { LANG_STORAGE_KEY } from '../../i18n/catalog.js';
import { MOCK_EVENTS, MOCK_TODAY } from '../../mock/fixtures.js';
import type { CalendarEvent } from './calendar-event.js';
import { WeekView } from './WeekView.js';

beforeEach(() => localStorage.setItem(LANG_STORAGE_KEY, 'de'));

function renderWeek(
  nightExpanded = false,
  onToggleNight = vi.fn(),
  onSelectDay = vi.fn(),
  events: readonly CalendarEvent[] = MOCK_EVENTS,
) {
  render(
    <I18nProvider>
      <WeekView
        weekStartIso="2026-07-27"
        today={MOCK_TODAY}
        events={events}
        nightExpanded={nightExpanded}
        onToggleNight={onToggleNight}
        onSelectDay={onSelectDay}
      />
    </I18nProvider>,
  );
  return { onToggleNight, onSelectDay };
}

describe('WeekView', () => {
  it('zeigt sieben Tagesspalten', () => {
    renderWeek();
    expect(screen.getAllByTestId('week-day-head')).toHaveLength(7);
  });

  it('zeigt eingeklappt 18 Stunden ab 06:00', () => {
    renderWeek(false);
    expect(screen.getByText('06:00')).toBeInTheDocument();
    expect(screen.queryByText('00:00')).toBeNull();
    expect(screen.getAllByTestId('hour-label')).toHaveLength(18);
  });

  it('zeigt aufgeklappt 24 Stunden ab 00:00', () => {
    renderWeek(true);
    expect(screen.getByText('00:00')).toBeInTheDocument();
    expect(screen.getAllByTestId('hour-label')).toHaveLength(24);
  });

  it('meldet das Umschalten der Nachtstunden', async () => {
    const { onToggleNight } = renderWeek(false);
    await userEvent.click(screen.getByRole('button', { name: /Nacht/ }));
    expect(onToggleNight).toHaveBeenCalledOnce();
  });

  it('setzt einen 09:00-Termin auf drei Stundenhoehen unter den Tagesanfang', () => {
    renderWeek(false);
    const [zahnarzt] = screen.getAllByRole('button', { name: /Zahnarzt/ });
    expect(zahnarzt?.style.top).toBe(`${3 * WEEK_HOUR_HEIGHT_PX}px`);
  });

  it('gibt einem einstuendigen Termin die Stundenhoehe minus Einzug', () => {
    renderWeek(false);
    const [zahnarzt] = screen.getAllByRole('button', { name: /Zahnarzt/ });
    expect(zahnarzt?.style.height).toBe(`${WEEK_HOUR_HEIGHT_PX - 3}px`);
  });

  it('laesst ganztaegige Termine aus der Timeline weg', () => {
    renderWeek(false);
    // „Lenas Geburtstag" hat keine Zeit und liegt auszerdem in einer anderen Woche.
    expect(screen.queryByRole('button', { name: /Geburtstag/ })).toBeNull();
  });

  it('markiert die heutige Spalte', () => {
    renderWeek();
    const today = screen
      .getAllByTestId('week-day-head')
      .filter((h) => h.getAttribute('aria-current') === 'date');
    expect(today).toHaveLength(1);
  });

  it('nennt Titel und Zeitraum im Namen eines Termins', () => {
    renderWeek(false);
    expect(screen.getAllByRole('button', { name: 'Zahnarzt, 09:00–10:00' }).length).toBeGreaterThan(
      0,
    );
  });

  it('meldet den angetippten Termin mit dem ISO-Datum seines Tages', async () => {
    const { onSelectDay } = renderWeek(false);
    const [zahnarzt] = screen.getAllByRole('button', { name: /Zahnarzt/ });
    expect(zahnarzt).toBeDefined();
    await userEvent.click(zahnarzt as HTMLElement);
    expect(onSelectDay).toHaveBeenCalledWith('2026-07-29');
  });

  it('verschiebt die Termine beim Aufklappen der Nachtstunden nach unten', () => {
    renderWeek(true);
    const [zahnarzt] = screen.getAllByRole('button', { name: /Zahnarzt/ });
    // Tagesanfang 00:00 statt 06:00 → 09:00 liegt bei neun Stundenhoehen.
    expect(zahnarzt?.style.top).toBe(`${9 * WEEK_HOUR_HEIGHT_PX}px`);
  });

  it('zeigt einen mehrtaegigen Termin als durchgehenden Wochenbalken', async () => {
    const onSelectDay = vi.fn();
    const trip: CalendarEvent = {
      id: 'trip',
      iso: '2026-07-25',
      endIso: '2026-07-30',
      title: 'Roadtrip',
      start: '',
      end: '',
      slot: 'both',
      location: '',
    };
    renderWeek(false, vi.fn(), onSelectDay, [trip]);

    const segment = screen.getByTestId('week-multi-day-segment');
    expect(segment).toHaveStyle({ gridColumn: '1 / span 4' });
    await userEvent.click(segment);
    expect(onSelectDay).toHaveBeenCalledWith('2026-07-27');
  });
});
