import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MOCK_TODAY } from '../../mock/fixtures.js';
import { pinLanguage, renderAppAt } from '../../test-harness.js';

beforeEach(() => pinLanguage('de'));
// Nur relevant fuer die zwei Tests, die pinFixtureToday() aufrufen; fuer alle
// anderen ist das ein No-op, da dann nie faked wurde.
afterEach(() => vi.useRealTimers());

function renderPlanner() {
  return renderAppAt('/planer');
}

/**
 * PlannerScreen klappt vom aktuellen Wochentag an alle Tage der Woche auf und
 * die davor liegenden zu (`defaultOpen` in PlannerScreen.tsx: `index >=
 * currentDayIndex`). Die Fixture-Eintraege 'Auswärts: Trattoria Sole' und
 * 'Bad putzen' haengen an `day_of_week: 2`, also Mittwoch (siehe
 * MOCK_PLANNER in mock/fixtures.ts) — sichtbar sind sie deshalb nur, wenn
 * "heute" auf Montag, Dienstag oder Mittwoch faellt. An jedem anderen
 * Wochentag ist der Mittwoch eingeklappt und sein Inhalt wird gar nicht erst
 * gerendert; genau daran sind die beiden Tests unten je nach Wochentag
 * gescheitert.
 *
 * MOCK_TODAY ist das Mittwochs-Datum, um das herum die gesamte Fixture-Welt
 * gebaut ist (siehe Kommentar dort) — deshalb wird exakt darauf festgenagelt,
 * statt auf einen der anderen zwei gueltigen Wochentage.
 *
 * `vi.setSystemTime` OHNE vorheriges `vi.useFakeTimers()`: Vitest mockt dann
 * nur `Date`, laesst `setTimeout` & Co. aber real. Mit echten Fake-Timern legt
 * Vitest auch die Timer still, auf die `userEvent.click` intern angewiesen
 * ist — die Klicks unten wuerden sonst bis zum Test-Timeout haengen.
 *
 * Lokale Konstruktion (kein "Z"/UTC-Suffix): `getFullYear/getMonth/getDate`
 * (die `localTodayIso()` in PlannerScreen.tsx liest) lesen dieselben lokalen
 * Felder zurueck, das Ergebnis ist damit unabhaengig von der Zeitzone der
 * Testumgebung.
 */
function pinFixtureToday(): void {
  const [year, month, day] = MOCK_TODAY.split('-').map(Number);
  vi.setSystemTime(new Date(year!, month! - 1, day!, 12, 0, 0));
}

describe('PlannerScreen', () => {
  it('zeigt sieben Tageskarten', async () => {
    renderPlanner();
    expect(await screen.findAllByTestId('planner-day')).toHaveLength(7);
  });

  it('oeffnet die aktuelle Woche ab heute', async () => {
    renderPlanner();
    const days = await screen.findAllByTestId('planner-day');
    expect(days.some((day) => day.querySelector('[aria-expanded="true"]') !== null)).toBe(true);
  });

  it('laesst einen Tag auf- und zuklappen', async () => {
    renderPlanner();
    const days = await screen.findAllByTestId('planner-day');
    const toggle = days.find((day) => day.querySelector('[aria-expanded="true"]'))?.querySelector('button');
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await userEvent.click(toggle as HTMLElement);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('zeigt Mahlzeit und Aufgaben eines aufgeklappten Tages', async () => {
    pinFixtureToday();
    renderPlanner();
    expect(await screen.findByText('Auswärts: Trattoria Sole')).toBeInTheDocument();
    expect(await screen.findByText('Bad putzen')).toBeInTheDocument();
  });

  it('hakt eine Aufgabe ab', async () => {
    pinFixtureToday();
    renderPlanner();
    const task = await screen.findByRole('checkbox', { name: 'Bad putzen' });
    expect(task).not.toBeChecked();
    await userEvent.click(task);
    expect(screen.getByRole('checkbox', { name: 'Bad putzen' })).toBeChecked();
  });

  it('zeigt bei einem Tag ohne Aufgaben einen Hinweis', async () => {
    renderPlanner();
    expect((await screen.findAllByText('Keine Aufgaben')).length).toBeGreaterThan(0);
  });

  it('zeigt bei zugeklapptem Tag eine Vorschau', async () => {
    renderPlanner();
    const [firstDay] = await screen.findAllByTestId('planner-day');
    const toggle = firstDay!.querySelector('button')!;
    if (toggle.getAttribute('aria-expanded') === 'false') await userEvent.click(toggle);
    await screen.findByText('Ofengemüse mit Feta');
    await userEvent.click(toggle);
    expect(screen.getByText(/Ofengemüse mit Feta/)).toBeInTheDocument();
  });

  it('markiert den heutigen Tag', async () => {
    renderPlanner();
    expect(await screen.findByText(String(new Date().getDate()))).toBeInTheDocument();
  });

  it('oeffnet die gemeinsame Einkaufsliste', async () => {
    const { router } = renderPlanner();
    await userEvent.click(await screen.findByRole('button', { name: 'Einkaufsliste' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/todos/einkauf'));
  });
});
