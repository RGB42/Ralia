import type {
  ExpenseBudgetsRow,
  ExpenseCategoriesRow,
  ProfilesRow,
  SessionState,
  SharedExpensesRow,
} from '@ralia/data';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  TEST_PARTNER_ID,
  TEST_PROFILE,
  TEST_USER_ID,
  pinLanguage,
  renderAppAt,
} from '../../test-harness.js';

const PARTNER: ProfilesRow = {
  ...TEST_PROFILE,
  id: TEST_PARTNER_ID,
  name: 'Jonas Berger',
  partner_id: TEST_USER_ID,
};

const PAIRED_SESSION: SessionState = {
  status: 'signed-in',
  offline: false,
  identity: {
    userId: TEST_USER_ID,
    profile: { ...TEST_PROFILE, partner_id: TEST_PARTNER_ID },
    partner: PARTNER,
    calendarId: [TEST_USER_ID, TEST_PARTNER_ID].sort().join('_'),
  },
};

const CATEGORIES: ExpenseCategoriesRow[] = [
  {
    id: 'food',
    calendar_id: PAIRED_SESSION.identity.calendarId,
    name: 'Lebensmittel',
    color: '#3b82f6',
    monthly_limit: 120,
    sort_order: 0,
    created_by: TEST_USER_ID,
    created_at: '2026-08-01T10:00:00Z',
    updated_at: '2026-08-01T10:00:00Z',
  },
  {
    id: 'free',
    calendar_id: PAIRED_SESSION.identity.calendarId,
    name: 'Freizeit',
    color: '#ec4899',
    monthly_limit: 80,
    sort_order: 1,
    created_by: TEST_USER_ID,
    created_at: '2026-08-01T10:00:00Z',
    updated_at: '2026-08-01T10:00:00Z',
  },
];

const EXPENSES: SharedExpensesRow[] = [
  {
    id: 'food-expense',
    calendar_id: PAIRED_SESSION.identity.calendarId,
    title: 'Wocheneinkauf',
    amount: 100,
    paid_by: TEST_USER_ID,
    category: 'Lebensmittel',
    paid_at: '2026-08-10',
    notes: null,
    split_type: 'shared',
    created_at: '2026-08-10T10:00:00Z',
    updated_at: '2026-08-10T10:00:00Z',
  },
  {
    id: 'free-expense',
    calendar_id: PAIRED_SESSION.identity.calendarId,
    title: 'Kinokarte',
    amount: 40,
    paid_by: TEST_PARTNER_ID,
    category: 'Freizeit',
    paid_at: '2026-08-09',
    notes: 'Nur Jonas',
    split_type: 'single',
    created_at: '2026-08-09T10:00:00Z',
    updated_at: '2026-08-09T10:00:00Z',
  },
];

const BUDGET: ExpenseBudgetsRow = {
  id: 'budget',
  calendar_id: PAIRED_SESSION.identity.calendarId,
  month_start: currentMonthStart(),
  amount: 200,
  created_by: TEST_USER_ID,
  created_at: '2026-08-01T10:00:00Z',
  updated_at: '2026-08-01T10:00:00Z',
};

beforeEach(() => pinLanguage('de'));

function renderMoney() {
  const createSettlement = vi.fn();
  const createExpense = vi.fn();
  const createCategory = vi.fn();
  const updateCategory = vi.fn();
  const createSplit = vi.fn();
  const app = renderAppAt('/geld', {
    auth: { session: PAIRED_SESSION },
    data: {
      expenses: {
        list: async () => EXPENSES,
        create: async (input) => {
          createExpense(input);
          return { ...EXPENSES[0]!, id: 'new-expense', ...input, amount: Number(input.amount) };
        },
        update: async () => EXPENSES[0]!,
        delete: async () => undefined,
      },
      expenseCategories: {
        list: async () => CATEGORIES,
        create: async (input) => {
          createCategory(input);
          return { ...CATEGORIES[0]!, id: 'new-category', name: input.name };
        },
        update: async (input) => {
          updateCategory(input);
          return { ...CATEGORIES[0]!, monthly_limit: Number(input.monthlyLimit) };
        },
        delete: async () => undefined,
      },
      expenseBudgets: {
        list: async () => [BUDGET],
        create: async () => BUDGET,
        update: async () => BUDGET,
        delete: async () => undefined,
      },
      expenseSettlements: {
        list: async () => [],
        create: async (input) => {
          createSettlement(input);
          return {
            id: 'settlement',
            calendar_id: input.calendarId,
            from_user_id: input.fromUserId,
            to_user_id: input.toUserId,
            amount: Number(input.amount),
            settled_at: input.settledAt,
            notes: input.notes ?? null,
            created_by: input.createdBy,
            created_at: '2026-08-10T10:00:00Z',
          };
        },
        delete: async () => undefined,
      },
      expenseSplits: {
        list: async () => [],
        create: async (input) => {
          createSplit(input);
          return {
            id: `split-${createSplit.mock.calls.length}`,
            expense_id: input.expenseId,
            user_id: input.userId,
            amount: Number(input.amount),
            created_at: '2026-08-10T10:00:00Z',
          };
        },
        update: async () => {
          throw new Error('not needed in this test');
        },
        delete: async () => undefined,
      },
    },
  });
  return { ...app, createSettlement, createExpense, createCategory, updateCategory, createSplit };
}

describe('MoneyScreen', () => {
  it('zeigt das Monatsbudget mit Fortschritt', async () => {
    renderMoney();
    expect(await screen.findByRole('progressbar', { name: /Budget/ })).toBeInTheDocument();
    expect(screen.getByText(/200,00/)).toBeInTheDocument();
  });

  it('aggregiert echte Kategorien aus den Ausgaben', async () => {
    renderMoney();
    expect(await screen.findAllByTestId('category-row')).toHaveLength(2);
    expect(screen.getByText('Lebensmittel')).toBeInTheDocument();
    expect(screen.getByText('Freizeit')).toBeInTheDocument();
  });

  it('berechnet die Bilanz des Paares', async () => {
    renderMoney();
    expect(await screen.findByText(/Jonas schuldet Lena/)).toBeInTheDocument();
    expect(screen.getAllByText(/50,00/).length).toBeGreaterThan(0);
  });

  it('bucht eine echte Ausgleichstransaktion', async () => {
    const { createSettlement } = renderMoney();
    await userEvent.click(await screen.findByRole('button', { name: 'Ausgleich buchen' }));
    await userEvent.click(screen.getAllByRole('button', { name: 'Ausgleich buchen' })[1]!);
    await waitFor(() => expect(createSettlement).toHaveBeenCalledOnce());
    expect(createSettlement.mock.calls[0]?.[0]).toMatchObject({
      fromUserId: TEST_PARTNER_ID,
      toUserId: TEST_USER_ID,
      amount: 50,
    });
  });

  it('listet die echten Ausgaben', async () => {
    renderMoney();
    expect(await screen.findAllByTestId('expense-row')).toHaveLength(2);
    expect(screen.getByText('Wocheneinkauf')).toBeInTheDocument();
    expect(screen.getByText('Kinokarte')).toBeInTheDocument();
  });

  it('legt eine Kategorie, Ausgabe und exakte individuelle Anteile an', async () => {
    const { createCategory, createExpense, createSplit } = renderMoney();
    await userEvent.click(await screen.findByRole('button', { name: 'Ausgabe hinzufügen' }));
    await userEvent.type(screen.getByLabelText('Beschreibung'), 'Gemeinsames Geschenk');
    await userEvent.type(screen.getByLabelText(/Betrag/), '100');
    await userEvent.clear(screen.getByRole('textbox', { name: 'Kategorien' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Kategorien' }), 'Geschenke');
    await userEvent.click(screen.getByRole('button', { name: 'Eigene Anteile' }));
    await userEvent.type(screen.getByLabelText('Lena'), '30');
    await userEvent.type(screen.getByLabelText('Jonas'), '70');
    await userEvent.click(screen.getByRole('button', { name: 'Ausgabe speichern' }));

    await waitFor(() => expect(createExpense).toHaveBeenCalledOnce());
    expect(createCategory).toHaveBeenCalledWith(expect.objectContaining({ name: 'Geschenke' }));
    expect(createExpense).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'Geschenke', split_type: 'shared' }),
    );
    await waitFor(() => expect(createSplit).toHaveBeenCalledTimes(2));
    expect(createSplit.mock.calls.map(([input]) => input.amount)).toEqual([30, 70]);
  });

  it('speichert ein monatliches Kategorienlimit', async () => {
    const { updateCategory } = renderMoney();
    await userEvent.click(await screen.findByRole('button', { name: /Lebensmittel: Kategorie bearbeiten/ }));
    const limit = screen.getByLabelText('Monatliches Limit');
    await userEvent.clear(limit);
    await userEvent.type(limit, '150');
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(updateCategory).toHaveBeenCalledWith(expect.objectContaining({ monthlyLimit: 150 })));
  });
});

function currentMonthStart(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
}
