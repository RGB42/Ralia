import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { BottomSheet } from './BottomSheet.js';

function open(onClose = vi.fn()) {
  render(
    <BottomSheet open onClose={onClose} title="Neuer Termin" kicker="Heute">
      <input aria-label="Titel" />
      <button>Speichern</button>
    </BottomSheet>,
  );
  return onClose;
}

describe('BottomSheet', () => {
  it('rendert geschlossen nichts', () => {
    render(
      <BottomSheet open={false} onClose={() => {}} title="X">
        <p>Inhalt</p>
      </BottomSheet>,
    );
    expect(screen.queryByText('Inhalt')).toBeNull();
  });

  it('ist ein modaler Dialog mit Titel', () => {
    open();
    const dialog = screen.getByRole('dialog', { name: 'Neuer Termin' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('zeigt den Kicker', () => {
    open();
    expect(screen.getByText('Heute')).toBeInTheDocument();
  });

  it('schlieszt bei Escape', async () => {
    const onClose = open();
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('schlieszt bei Klick auf den Backdrop', async () => {
    const onClose = open();
    await userEvent.click(screen.getByTestId('sheet-backdrop'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('schlieszt nicht bei Klick in den Inhalt', async () => {
    const onClose = open();
    await userEvent.click(screen.getByLabelText('Titel'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('schlieszt ueber den Schlieszen-Knopf', async () => {
    const onClose = open();
    await userEvent.click(screen.getByRole('button', { name: 'Schließen' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('setzt den Fokus beim Oeffnen in das Sheet', () => {
    open();
    const dialog = screen.getByRole('dialog');
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('haelt Tab im Sheet gefangen', async () => {
    open();
    const dialog = screen.getByRole('dialog');
    // Viermal Tab bei drei fokussierbaren Elementen: der Fokus muss im Sheet bleiben.
    for (let i = 0; i < 4; i += 1) await userEvent.tab();
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('haelt Shift+Tab ebenfalls im Sheet', async () => {
    open();
    const dialog = screen.getByRole('dialog');
    for (let i = 0; i < 4; i += 1) await userEvent.tab({ shift: true });
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('laesst den Fokus nicht auf einen Knopf hinter dem Backdrop', async () => {
    render(
      <>
        <button>dahinter</button>
        <BottomSheet open onClose={() => {}} title="X">
          <button>drin</button>
        </BottomSheet>
      </>,
    );
    const outside = screen.getByRole('button', { name: 'dahinter' });
    for (let i = 0; i < 5; i += 1) await userEvent.tab();
    expect(outside).not.toHaveFocus();
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);
  });

  it('sperrt und entsperrt das Scrollen des Hintergrunds', () => {
    const { unmount } = render(
      <BottomSheet open onClose={() => {}} title="X">
        <p>Inhalt</p>
      </BottomSheet>,
    );
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).toBe('');
  });

  it('gibt den Fokus beim Schlieszen an das ausloesende Element zurueck', async () => {
    function Host() {
      const [isOpen, setIsOpen] = useState(false);
      return (
        <>
          <button onClick={() => setIsOpen(true)}>oeffnen</button>
          <BottomSheet open={isOpen} onClose={() => setIsOpen(false)} title="X">
            <button>drin</button>
          </BottomSheet>
        </>
      );
    }
    render(<Host />);
    const opener = screen.getByRole('button', { name: 'oeffnen' });
    await userEvent.click(opener);
    await userEvent.keyboard('{Escape}');
    expect(opener).toHaveFocus();
  });
});
