import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { I18nProvider } from '../../i18n/I18nProvider.js';
import { LANG_STORAGE_KEY } from '../../i18n/catalog.js';
import { PlannerScreen } from './PlannerScreen.js';

beforeEach(() => localStorage.setItem(LANG_STORAGE_KEY, 'de'));

function renderPlanner() {
  render(
    <I18nProvider>
      <PlannerScreen />
    </I18nProvider>,
  );
}

describe('PlannerScreen', () => {
  it('zeigt sieben Tageskarten', () => {
    renderPlanner();
    expect(screen.getAllByTestId('planner-day')).toHaveLength(7);
  });

  it('klappt vergangene Tage zu und kuenftige auf', () => {
    renderPlanner();
    // Fiktives Heute ist der 29. (Index 2) — davor zwei zugeklappte Tage.
    const collapsed = screen
      .getAllByTestId('planner-day')
      .filter((d) => d.querySelector('[aria-expanded="false"]'));
    expect(collapsed).toHaveLength(2);
  });

  it('laesst einen Tag auf- und zuklappen', async () => {
    renderPlanner();
    const [firstDay] = screen.getAllByTestId('planner-day');
    const toggle = firstDay?.querySelector('button');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(toggle as HTMLElement);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });

  it('zeigt Mahlzeit und Aufgaben eines aufgeklappten Tages', () => {
    renderPlanner();
    expect(screen.getByText('Auswärts: Trattoria Sole')).toBeInTheDocument();
    expect(screen.getByText('Bad putzen')).toBeInTheDocument();
  });

  it('hakt eine Aufgabe ab', async () => {
    renderPlanner();
    const task = screen.getByRole('checkbox', { name: 'Bad putzen' });
    expect(task).not.toBeChecked();
    await userEvent.click(task);
    expect(screen.getByRole('checkbox', { name: 'Bad putzen' })).toBeChecked();
  });

  it('zeigt bei einem Tag ohne Aufgaben einen Hinweis', () => {
    renderPlanner();
    expect(screen.getByText('Keine Aufgaben')).toBeInTheDocument();
  });

  it('zeigt bei zugeklapptem Tag eine Vorschau', () => {
    renderPlanner();
    expect(screen.getByText(/Ofengemüse mit Feta/)).toBeInTheDocument();
  });

  it('markiert den heutigen Tag', () => {
    renderPlanner();
    // Der 29. ist heute; seine Plakette traegt die gefuellte Markenfarbe.
    expect(screen.getByText('29')).toBeInTheDocument();
  });
});
