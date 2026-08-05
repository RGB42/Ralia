import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmDialog } from './ConfirmDialog.js';

const base = {
  open: true,
  title: 'Termin löschen?',
  message: 'Das lässt sich nicht rückgängig machen.',
  confirmLabel: 'Löschen',
  cancelLabel: 'Abbrechen',
} as const;

describe('ConfirmDialog', () => {
  it('meldet die Zustimmung', async () => {
    const onConfirm = vi.fn();
    render(<ConfirmDialog {...base} tone="danger" onConfirm={onConfirm} onCancel={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: 'Löschen' }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('meldet den Abbruch', async () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog {...base} onConfirm={() => {}} onCancel={onCancel} />);
    await userEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('behandelt Escape als Abbruch, nicht als Zustimmung', async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<ConfirmDialog {...base} onConfirm={onConfirm} onCancel={onCancel} />);
    await userEvent.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('legt den Startfokus auf Abbrechen, nicht auf die zerstoerende Handlung', () => {
    render(<ConfirmDialog {...base} tone="danger" onConfirm={() => {}} onCancel={() => {}} />);
    expect(screen.getByRole('button', { name: 'Abbrechen' })).toHaveFocus();
  });

  it('nennt Titel und Meldung', () => {
    render(<ConfirmDialog {...base} onConfirm={() => {}} onCancel={() => {}} />);
    expect(screen.getByRole('dialog', { name: 'Termin löschen?' })).toBeInTheDocument();
    expect(screen.getByText('Das lässt sich nicht rückgängig machen.')).toBeInTheDocument();
  });
});
