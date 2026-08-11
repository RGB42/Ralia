import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pinLanguage, renderAppAt as renderAt } from '../../test-harness.js';

beforeEach(() => pinLanguage('de'));
afterEach(() => vi.unstubAllGlobals());

describe('TodoOverview', () => {
  it('zeigt eine Kachel je Liste plus die Anlegen-Kachel', async () => {
    renderAt('/todos');
    expect(await screen.findAllByTestId('todo-list-card')).toHaveLength(3);
    expect(screen.getByRole('button', { name: /Neue Liste/ })).toBeInTheDocument();
  });

  it('nennt die Zahl der offenen Eintraege', async () => {
    renderAt('/todos');
    // einkauf: 5 Eintraege, 1 erledigt → 4 offen
    expect(await screen.findByRole('button', { name: /Einkauf.*4 offen/ })).toBeInTheDocument();
  });

  it('oeffnet eine Liste', async () => {
    renderAt('/todos');
    await userEvent.click(await screen.findByRole('button', { name: /Einkauf/ }));
    expect(await screen.findByRole('button', { name: 'Zurück' })).toBeInTheDocument();
  });

  it('zeigt den Fortschritt als Messwert', async () => {
    renderAt('/todos');
    expect(await screen.findAllByRole('progressbar')).toHaveLength(3);
  });
});

describe('TodoDetail', () => {
  it('zeigt die offenen Eintraege der Liste', async () => {
    renderAt('/todos/einkauf');
    expect(await screen.findByRole('checkbox', { name: /Haferflocken/ })).toBeInTheDocument();
  });

  it('haelt Erledigtes hinter einem Aufklapper', async () => {
    renderAt('/todos/einkauf');
    await screen.findByRole('checkbox', { name: /Haferflocken/ });
    expect(screen.queryByRole('checkbox', { name: /Spülmaschinentabs/ })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /Erledigt/ }));
    expect(await screen.findByRole('checkbox', { name: /Spülmaschinentabs/ })).toBeInTheDocument();
  });

  it('hakt einen Eintrag ab und verschiebt ihn nach Erledigt', async () => {
    renderAt('/todos/einkauf');
    const item = await screen.findByRole('checkbox', { name: /Haferflocken/ });
    await userEvent.click(item);
    expect(screen.queryByRole('checkbox', { name: /Haferflocken/ })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /Erledigt · 2/ }));
    expect(await screen.findByRole('checkbox', { name: /Haferflocken/ })).toBeChecked();
  });

  it('filtert nach Person', async () => {
    renderAt('/todos/einkauf');
    await userEvent.click(await screen.findByRole('button', { name: 'Lena' }));
    expect(screen.queryByRole('checkbox', { name: /Haferflocken/ })).toBeNull();
    expect(screen.getByRole('checkbox', { name: /Tomaten & Basilikum/ })).toBeInTheDocument();
  });

  it('zeigt bei leerer Auswahl den Hinweis der Vorlage', async () => {
    renderAt('/todos/einkauf');
    for (const name of ['Haferflocken', 'Tomaten & Basilikum', 'Kaffeebohnen', 'Hafermilch']) {
      await userEvent.click(await screen.findByRole('checkbox', { name: new RegExp(name) }));
    }
    expect(await screen.findByText('Nichts offen – alles abgehakt')).toBeInTheDocument();
  });

  it('kehrt ueber Zurueck zur Uebersicht', async () => {
    renderAt('/todos/einkauf');
    await userEvent.click(await screen.findByRole('button', { name: 'Zurück' }));
    expect(await screen.findByRole('button', { name: /Neue Liste/ })).toBeInTheDocument();
  });

  it('zeigt die Notiz eines Eintrags', async () => {
    renderAt('/todos/einkauf');
    expect(await screen.findByText('2 Pack')).toBeInTheDocument();
  });

  /**
   * Der Grund, warum der Zustand in der Elternroute liegt: haengt er am
   * Screen, ist das Abhaken beim Zurueckgehen wieder da.
   */
  it('behaelt ein Abhaken beim Wechsel zurueck zur Uebersicht', async () => {
    renderAt('/todos/einkauf');
    await userEvent.click(await screen.findByRole('checkbox', { name: /Haferflocken/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Zurück' }));
    // einkauf hat jetzt 3 statt 4 offene Eintraege.
    expect(await screen.findByRole('button', { name: /Einkauf.*3 offen/ })).toBeInTheDocument();
  });
});
