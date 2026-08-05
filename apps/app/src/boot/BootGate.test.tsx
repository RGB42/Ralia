import { ToastProvider } from '@ralia/ui';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../i18n/I18nProvider.js';
import { LANG_STORAGE_KEY } from '../i18n/catalog.js';
import { BootGate } from './BootGate.js';
import type { BootState } from './bootstrap.js';

/** Sprache festnageln: jsdom meldet navigator.language als en-US. */
beforeEach(() => localStorage.setItem(LANG_STORAGE_KEY, 'de'));

/**
 * Das Gate liest nur `phase` und `warnings`. Der Rest des Ergebnisses wird
 * hier nicht nachgebaut — die Zusicherung dieses Tests haengt nicht daran.
 */
function ready(warnings: string[] = []): BootState {
  return { phase: 'ready', warnings } as BootState;
}

function mount(boot: () => Promise<BootState>, strict = true) {
  const tree = (
    <I18nProvider>
      <ToastProvider>
        <BootGate boot={boot}>
          <p>Inhalt</p>
        </BootGate>
      </ToastProvider>
    </I18nProvider>
  );
  return render(strict ? <StrictMode>{tree}</StrictMode> : tree);
}

describe('BootGate', () => {
  it('zeigt den Inhalt, sobald der Boot fertig ist', async () => {
    mount(async () => ready());
    expect(await screen.findByText('Inhalt')).toBeInTheDocument();
  });

  /**
   * Der Fall, der eine echte Blockade war: StrictMode fuehrt den Effekt doppelt
   * aus. Ein reiner „schon gestartet"-Merker wurde vom Probelauf gesetzt,
   * dessen Aufraeumen verwarf das Ergebnis, und die App blieb fuer immer im
   * Ladezustand — sichtbar nur im Browser, nicht in einem Nicht-StrictMode-Test.
   */
  it('startet den Boot unter StrictMode genau einmal und kommt an', async () => {
    const boot = vi.fn(async () => ready());
    mount(boot);
    expect(await screen.findByText('Inhalt')).toBeInTheDocument();
    expect(boot).toHaveBeenCalledTimes(1);
  });

  it('meldet jede Warnung genau einmal als Toast', async () => {
    mount(async () => ready(['/config nicht erreichbar']));
    expect(await screen.findByRole('status')).toHaveTextContent('/config nicht erreichbar');
  });

  it('zeigt bei Fehlschlag eine Meldung und laesst es erneut versuchen', async () => {
    let attempt = 0;
    const boot = vi.fn(async (): Promise<BootState> => {
      attempt += 1;
      return attempt === 1 ? { phase: 'failed', error: new Error('kaputt') } : ready();
    });
    mount(boot);
    expect(await screen.findByText(/kaputt/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }));
    expect(await screen.findByText('Inhalt')).toBeInTheDocument();
    expect(boot).toHaveBeenCalledTimes(2);
  });
});
