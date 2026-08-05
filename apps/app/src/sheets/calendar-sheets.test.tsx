import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../i18n/I18nProvider.js';
import { MOCK_EVENTS, MOCK_TODAY } from '../mock/fixtures.js';
import { pinLanguage } from '../test-harness.js';
import { DaySheet } from './DaySheet.js';
import { NewEventSheet } from './NewEventSheet.js';

beforeEach(() => pinLanguage('de'));
afterEach(() => vi.useRealTimers());

function wrap(node: React.ReactNode) {
  return render(<I18nProvider>{node}</I18nProvider>);
}

function renderDay(iso: string, onEdit = vi.fn(), onAdd = vi.fn()) {
  wrap(
    <DaySheet
      open
      iso={iso}
      events={MOCK_EVENTS}
      onClose={() => {}}
      onEdit={onEdit}
      onAdd={onAdd}
    />,
  );
  return { onEdit, onAdd };
}

describe('DaySheet', () => {
  it('listet die Termine des Tages nach Zeit', () => {
    renderDay(MOCK_TODAY);
    const titles = screen.getAllByTestId('day-event').map((el) => el.textContent ?? '');
    expect(titles[0]).toContain('Zahnarzt');
    expect(titles[2]).toContain('Abendessen Marco');
  });

  it('nennt heute im Kicker', () => {
    renderDay(MOCK_TODAY);
    expect(screen.getByText('Heute')).toBeInTheDocument();
  });

  it('zeigt an einem leeren Tag den Hinweis der Vorlage', () => {
    renderDay('2026-07-02');
    expect(screen.getByText('Keine Termine an diesem Tag')).toBeInTheDocument();
  });

  it('oeffnet nach langem Druecken das Bearbeiten', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { onEdit } = renderDay(MOCK_TODAY);
    const [first] = screen.getAllByTestId('day-event');
    await user.pointer({ target: first as HTMLElement, keys: '[MouseLeft>]' });
    act(() => void vi.advanceTimersByTime(500));
    expect(onEdit).toHaveBeenCalledOnce();
  });

  it('meldet einen kurzen Tipp nicht als lange gedrueckt', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { onEdit } = renderDay(MOCK_TODAY);
    await user.click(screen.getAllByTestId('day-event')[0] as HTMLElement);
    expect(onEdit).not.toHaveBeenCalled();
  });

  it('meldet Termin hinzufuegen', async () => {
    const { onAdd } = renderDay(MOCK_TODAY);
    await userEvent.click(screen.getByRole('button', { name: 'Termin hinzufügen' }));
    expect(onAdd).toHaveBeenCalledOnce();
  });

  it('kennzeichnet ganztaegige Termine statt die Zeitspalte leer zu lassen', () => {
    renderDay('2026-07-15');
    const rows = screen.getAllByTestId('day-event').map((el) => el.textContent ?? '');
    expect(rows.some((row) => row.includes('ganztägig'))).toBe(true);
  });
});

describe('NewEventSheet', () => {
  function renderNew(onSave = vi.fn()) {
    wrap(<NewEventSheet open defaultIso="2026-07-31" onClose={() => {}} onSave={onSave} />);
    return onSave;
  }

  it('uebernimmt den gewaehlten Tag als Vorgabe', () => {
    renderNew();
    expect(screen.getByLabelText('Datum')).toHaveValue('2026-07-31');
  });

  it('sammelt Titel, Zeit, Zuordnung und Google-Schalter', async () => {
    const onSave = renderNew();
    await userEvent.type(screen.getByLabelText('Titel'), 'Kino');
    await userEvent.click(screen.getByRole('button', { name: 'Beide' }));
    await userEvent.click(screen.getByRole('switch', { name: /Google/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Kino', slot: 'both', toGoogle: false }),
    );
  });

  it('speichert nicht ohne Titel', async () => {
    const onSave = renderNew();
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Titel')).toHaveAccessibleDescription(/Titel/i);
  });

  it('hat genau eine Zuordnung gleichzeitig gedrueckt', async () => {
    renderNew();
    await userEvent.click(screen.getByRole('button', { name: 'Jonas' }));
    const pressed = ['Jonas', 'Lena', 'Beide']
      .map((n) => screen.getByRole('button', { name: n }))
      .filter((b) => b.getAttribute('aria-pressed') === 'true');
    expect(pressed).toHaveLength(1);
  });
});
