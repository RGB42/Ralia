import type {
  ExpenseCategoriesRow,
  ProfilesRow,
  SessionState,
  SharedExpensesRow,
} from '@ralia/data';
import { screen, waitFor, within } from '@testing-library/react';
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

const PARTNER_SESSION: SessionState = {
  status: 'signed-in',
  offline: false,
  identity: {
    userId: TEST_PARTNER_ID,
    profile: PARTNER,
    partner: { ...TEST_PROFILE, partner_id: TEST_PARTNER_ID },
    calendarId: [TEST_USER_ID, TEST_PARTNER_ID].sort().join('_'),
  },
};

const CATEGORIES: ExpenseCategoriesRow[] = [
  {
    id: 'food',
    calendar_id: PAIRED_SESSION.identity.calendarId,
    name: 'Lebensmittel',
    color: '#3b82f6',
    monthly_limit: null,
    sort_order: 0,
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
    for_user_id: null,
    category: 'Lebensmittel',
    paid_at: currentDateIso(),
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
    for_user_id: TEST_PARTNER_ID,
    category: 'Freizeit',
    paid_at: currentDateIso(),
    notes: 'Nur Jonas',
    split_type: 'single',
    created_at: '2026-08-09T10:00:00Z',
    updated_at: '2026-08-09T10:00:00Z',
  },
];

beforeEach(() => pinLanguage('de'));

function renderMoney(session: SessionState = PAIRED_SESSION) {
  const listExpenses = vi.fn(async () => EXPENSES);
  const createExpense = vi.fn();
  const updateExpense = vi.fn();
  const createCategory = vi.fn();
  const createSettlement = vi.fn();
  renderAppAt('/geld', {
    auth: { session },
    data: {
      expenses: {
        list: listExpenses,
        create: async (input) => {
          createExpense(input);
          return { ...EXPENSES[0]!, id: 'new-expense', ...input, amount: Number(input.amount) };
        },
        update: async (_calendarId, _id, input) => {
          updateExpense(input);
          return { ...EXPENSES[0]!, ...input, amount: Number(input.amount ?? EXPENSES[0]!.amount) };
        },
        delete: async () => undefined,
      },
      expenseCategories: {
        list: async () => CATEGORIES,
        create: async (input) => {
          createCategory(input);
          return { ...CATEGORIES[0]!, id: 'new-category', name: input.name };
        },
        update: async () => CATEGORIES[0]!,
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
    },
  });
  return { createCategory, createExpense, createSettlement, listExpenses, updateExpense };
}

describe('MoneyScreen', () => {
  it('shows the paid totals and the resulting debt', async () => {
    renderMoney();
    expect(await screen.findByText(/Jonas schuldet Lena/)).toBeInTheDocument();
    expect(screen.getAllByText(/100,00/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/40,00/).length).toBeGreaterThan(0);
  });

  it('filters expenses and settlements by the selected period', async () => {
    const { listExpenses } = renderMoney();
    await screen.findAllByTestId('expense-row');
    await userEvent.click(screen.getByRole('button', { name: 'Alle' }));
    await waitFor(() =>
      expect(listExpenses).toHaveBeenLastCalledWith(PAIRED_SESSION.identity.calendarId, undefined),
    );
  });

  it('books a settlement for the active period', async () => {
    const { createSettlement } = renderMoney();
    await userEvent.click(await screen.findByRole('button', { name: 'Ausgleich buchen' }));
    await userEvent.click(screen.getAllByRole('button', { name: 'Ausgleich buchen' })[1]!);
    await waitFor(() => expect(createSettlement).toHaveBeenCalledOnce());
    expect(createSettlement).toHaveBeenCalledWith(
      expect.objectContaining({
        fromUserId: TEST_PARTNER_ID,
        toUserId: TEST_USER_ID,
        amount: 50,
      }),
    );
  });

  it('creates an expense for the selected person with a category', async () => {
    const { createCategory, createExpense } = renderMoney();
    await userEvent.click(await screen.findByRole('button', { name: 'Ausgabe hinzufügen' }));
    await userEvent.type(screen.getByLabelText('Beschreibung'), 'Gemeinsames Geschenk');
    await userEvent.type(screen.getByLabelText(/Betrag/), '100');
    await userEvent.clear(screen.getByRole('textbox', { name: 'Kategorien' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Kategorien' }), 'Geschenke');
    await userEvent.click(
      within(screen.getByRole('group', { name: 'Für wen?' })).getByRole('button', {
        name: 'Jonas',
      }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Ausgabe speichern' }));

    await waitFor(() => expect(createExpense).toHaveBeenCalledOnce());
    expect(createCategory).toHaveBeenCalledWith(expect.objectContaining({ name: 'Geschenke' }));
    expect(createExpense).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'Geschenke',
        for_user_id: TEST_PARTNER_ID,
        split_type: 'single',
      }),
    );
  });

  it('keeps recipient names and settlement direction stable in the partner view', async () => {
    const { createExpense } = renderMoney(PARTNER_SESSION);

    expect(await screen.findByText(/Jonas schuldet Lena/)).toBeInTheDocument();
    expect(
      screen.getByText(/Freizeit.*Jonas/, { selector: '[class*="expenseMeta"]' }),
    ).toBeInTheDocument();
    await userEvent.click(await screen.findByRole('button', { name: 'Ausgabe hinzufügen' }));
    await userEvent.type(screen.getByLabelText('Beschreibung'), 'Geschenk');
    await userEvent.type(screen.getByLabelText(/Betrag/), '20');
    await userEvent.click(
      within(screen.getByRole('group', { name: 'Für wen?' })).getByRole('button', {
        name: 'Lena',
      }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Ausgabe speichern' }));

    await waitFor(() =>
      expect(createExpense).toHaveBeenCalledWith(
        expect.objectContaining({ for_user_id: TEST_USER_ID }),
      ),
    );
  });

  it('opens a list entry for editing', async () => {
    const { updateExpense } = renderMoney();
    await userEvent.click(
      await screen.findByRole('button', { name: 'Wocheneinkauf: Ausgabe bearbeiten' }),
    );
    const title = screen.getByLabelText('Beschreibung');
    await userEvent.clear(title);
    await userEvent.type(title, 'Wocheneinkauf aktualisiert');
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() =>
      expect(updateExpense).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Wocheneinkauf aktualisiert' }),
      ),
    );
  });
});

function currentDateIso(): string {
  return new Date().toISOString().slice(0, 10);
}
