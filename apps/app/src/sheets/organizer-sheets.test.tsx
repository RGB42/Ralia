import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../i18n/I18nProvider.js';
import { MOCK_CATEGORIES, MOCK_TODOS, MOCK_TODO_LISTS } from '../mock/fixtures.js';
import { pinLanguage } from '../test-harness.js';
import { ExpenseSheet, parseAmount } from './ExpenseSheet.js';
import { PlanSheet } from './PlanSheet.js';
import { TodoSheet } from './TodoSheet.js';
import { findDuplicate } from './todo-duplicate.js';

beforeEach(() => pinLanguage('de'));

function wrap(node: React.ReactNode) {
  return render(<I18nProvider>{node}</I18nProvider>);
}

function renderTodoSheet(onSave = vi.fn(), onReveal = vi.fn()) {
  wrap(
    <TodoSheet
      open
      lists={MOCK_TODO_LISTS}
      defaultListId="einkauf"
      existing={MOCK_TODOS}
      onClose={() => {}}
      onSave={onSave}
      onReveal={onReveal}
    />,
  );
  return { onSave, onReveal };
}

describe('findDuplicate', () => {
  it('findet nichts bei leerem Text', () => {
    expect(findDuplicate('   ', 'einkauf', MOCK_TODOS).kind).toBe('none');
  });

  it('unterscheidet offen und erledigt', () => {
    expect(findDuplicate('Haferflocken', 'einkauf', MOCK_TODOS).kind).toBe('open');
    expect(findDuplicate('Spülmaschinentabs', 'einkauf', MOCK_TODOS).kind).toBe('done');
  });

  it('ignoriert Gross-/Kleinschreibung und Randleerzeichen', () => {
    expect(findDuplicate('  HAFERFLOCKEN ', 'einkauf', MOCK_TODOS).kind).toBe('open');
  });

  it('sucht nur in der gewaehlten Liste', () => {
    expect(findDuplicate('Haferflocken', 'urlaub', MOCK_TODOS).kind).toBe('none');
  });
});

describe('TodoSheet', () => {
  it('bietet jede Liste als Chip an', () => {
    renderTodoSheet();
    expect(screen.getAllByTestId('list-chip')).toHaveLength(3);
  });

  it('warnt bei einem offenen Duplikat und aendert die Knopfbeschriftung', async () => {
    renderTodoSheet();
    await userEvent.type(screen.getByLabelText('Eintrag'), 'Haferflocken');
    expect(screen.getByRole('alert')).toHaveTextContent(/steht schon offen/);
    expect(
      screen.getByRole('button', { name: 'Vorhandenen Eintrag anzeigen' }),
    ).toBeInTheDocument();
  });

  it('warnt bei einem erledigten Duplikat mit anderem Text', async () => {
    renderTodoSheet();
    await userEvent.type(screen.getByLabelText('Eintrag'), 'Spülmaschinentabs');
    expect(screen.getByRole('alert')).toHaveTextContent(/bereits erledigt/);
    expect(screen.getByRole('button', { name: 'Eintrag wieder öffnen' })).toBeInTheDocument();
  });

  it('erkennt Duplikate unabhaengig von Gross- und Kleinschreibung', async () => {
    renderTodoSheet();
    await userEvent.type(screen.getByLabelText('Eintrag'), '  HAFERFLOCKEN ');
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('speichert einen neuen Eintrag', async () => {
    const { onSave } = renderTodoSheet();
    await userEvent.type(screen.getByLabelText('Eintrag'), 'Olivenöl');
    await userEvent.type(screen.getByLabelText('Notiz'), '1 l');
    await userEvent.click(screen.getByRole('button', { name: 'Zur Liste hinzufügen' }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'Olivenöl', note: '1 l', listId: 'einkauf' }),
    );
  });

  it('speichert ein Duplikat nicht, sondern zeigt es', async () => {
    const { onSave, onReveal } = renderTodoSheet();
    await userEvent.type(screen.getByLabelText('Eintrag'), 'Haferflocken');
    await userEvent.click(screen.getByRole('button', { name: 'Vorhandenen Eintrag anzeigen' }));
    expect(onSave).not.toHaveBeenCalled();
    expect(onReveal).toHaveBeenCalledOnce();
  });
});

describe('PlanSheet', () => {
  const days = Array.from({ length: 7 }, (_, index) => ({
    iso: `2026-08-${String(10 + index).padStart(2, '0')}`,
    label: `Tag ${index + 1}`,
  }));

  it('wechselt zwischen Mahlzeit und Aufgabe und zeigt die Personenwahl nur bei Aufgabe', async () => {
    wrap(<PlanSheet open days={days} onClose={() => {}} onSave={() => {}} />);
    expect(screen.queryByText('Wer macht es?')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Aufgabe', pressed: false }));
    expect(screen.getByText('Wer macht es?')).toBeInTheDocument();
  });

  it('bietet sieben Tage zur Wahl', () => {
    wrap(<PlanSheet open days={days} onClose={() => {}} onSave={() => {}} />);
    expect(screen.getAllByTestId('plan-day-chip')).toHaveLength(7);
  });
});

describe('parseAmount', () => {
  it('liest Punkt und Komma gleich', () => {
    expect(parseAmount('42.50')).toBe(42.5);
    expect(parseAmount('42,50')).toBe(42.5);
  });

  it('lehnt leer, null und negativ ab', () => {
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('0')).toBeNull();
    expect(parseAmount('-5')).toBeNull();
    expect(parseAmount('abc')).toBeNull();
  });
});

describe('ExpenseSheet', () => {
  function renderExpense(onSave = vi.fn()) {
    wrap(<ExpenseSheet open categories={MOCK_CATEGORIES} onClose={() => {}} onSave={onSave} />);
    return onSave;
  }

  it('bietet Kategorien, Zahler und Empfaenger an', () => {
    renderExpense();
    expect(screen.getAllByTestId('category-chip')).toHaveLength(5);
    expect(screen.getAllByTestId('recipient-chip')).toHaveLength(1);
    const payers = screen.getByRole('group', { name: 'Bezahlt von' });
    expect(within(payers).getByRole('button', { name: 'Mich' })).toBeInTheDocument();
    const recipients = screen.getByRole('group', { name: 'Für wen?' });
    expect(within(recipients).getByRole('button', { name: 'Mich' })).toBeInTheDocument();
  });

  it('speichert nicht ohne Betrag', async () => {
    const onSave = renderExpense();
    await userEvent.type(screen.getByLabelText('Beschreibung'), 'Rewe');
    await userEvent.click(screen.getByRole('button', { name: 'Ausgabe speichern' }));
    expect(onSave).not.toHaveBeenCalled();
  });

  it('speichert mit Beschreibung und Betrag', async () => {
    const onSave = renderExpense();
    await userEvent.type(screen.getByLabelText('Beschreibung'), 'Rewe');
    await userEvent.type(screen.getByLabelText(/Betrag/), '42.50');
    await userEvent.click(screen.getByRole('button', { name: 'Ausgabe speichern' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ amount: 42.5 }));
  });
});
