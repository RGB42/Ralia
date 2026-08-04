import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pinLanguage, renderAppAt } from '../../test-harness.js';

beforeEach(() => {
  localStorage.clear();
  pinLanguage('de');
});
afterEach(() => vi.unstubAllGlobals());

const renderSync = () => renderAppAt('/profil/sync');

describe('SyncScreen', () => {
  it('zeigt zwei verbundene Konten', async () => {
    renderSync();
    expect(await screen.findAllByTestId('sync-account')).toHaveLength(2);
  });

  it('zeigt fuenf Kalender mit Schaltern', async () => {
    renderSync();
    // Nur die fuenf Kalender: der Auto-Sync-Schalter sitzt in den
    // Einstellungen, nicht hier (Vorlage Z. 542 gegen Z. 605–615).
    expect(await screen.findAllByRole('switch')).toHaveLength(5);
  });

  it('schaltet einen Kalender aus', async () => {
    renderSync();
    const [first] = await screen.findAllByRole('switch');
    expect(first).toBeChecked();
    await userEvent.click(first as HTMLElement);
    expect(screen.getAllByRole('switch')[0]).not.toBeChecked();
  });

  it('bietet die drei Sync-Richtungen als Radiogruppe an', async () => {
    renderSync();
    const group = await screen.findByRole('radiogroup', { name: 'Richtung' });
    expect(within(group).getAllByRole('radio')).toHaveLength(3);
  });

  it('wechselt die Sync-Richtung mit den Pfeiltasten', async () => {
    renderSync();
    const group = await screen.findByRole('radiogroup', { name: 'Richtung' });
    const checked = within(group)
      .getAllByRole('radio')
      .find((r) => r.getAttribute('aria-checked') === 'true');
    expect(checked).toBeDefined();
    (checked as HTMLElement).focus();
    await userEvent.keyboard('{ArrowDown}');
    const nowChecked = within(group)
      .getAllByRole('radio')
      .filter((r) => r.getAttribute('aria-checked') === 'true');
    expect(nowChecked).toHaveLength(1);
    expect(nowChecked[0]).not.toBe(checked);
  });

  it('zeigt den offenen Konflikt mit beiden Fassungen', async () => {
    renderSync();
    expect(await screen.findByText(/auf beiden Seiten geändert/)).toBeInTheDocument();
    expect(screen.getByText('09:00 – 10:00')).toBeInTheDocument();
    expect(screen.getByText('09:30 – 10:30')).toBeInTheDocument();
  });

  it('loest den Konflikt und zeigt die Bestaetigung mit Rueckgaengig', async () => {
    renderSync();
    await userEvent.click(await screen.findByRole('button', { name: 'Ralia behalten' }));
    expect(await screen.findByRole('button', { name: 'Rückgängig' })).toBeInTheDocument();
    expect(screen.queryByText(/auf beiden Seiten geändert/)).toBeNull();
  });

  it('nimmt die Konfliktloesung zurueck', async () => {
    renderSync();
    await userEvent.click(await screen.findByRole('button', { name: 'Google übernehmen' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Rückgängig' }));
    expect(await screen.findByText(/auf beiden Seiten geändert/)).toBeInTheDocument();
  });

  it('zeigt das Protokoll', async () => {
    renderSync();
    expect(await screen.findAllByTestId('sync-log-row')).toHaveLength(4);
  });

  it('kehrt ueber Zurueck zu den Einstellungen', async () => {
    renderSync();
    await userEvent.click(await screen.findByRole('button', { name: 'Zurück' }));
    expect(await screen.findByText('Jonas Berger')).toBeInTheDocument();
  });
});
