import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { pinLanguage, renderAppAt } from '../../test-harness.js';

beforeEach(() => pinLanguage('de'));

function renderPlanner() {
  return renderAppAt('/planer');
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
    renderPlanner();
    expect(await screen.findByText('Auswärts: Trattoria Sole')).toBeInTheDocument();
    expect(await screen.findByText('Bad putzen')).toBeInTheDocument();
  });

  it('hakt eine Aufgabe ab', async () => {
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
