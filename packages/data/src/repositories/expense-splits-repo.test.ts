import { describe, expect, it, vi } from 'vitest';
import type { ExpenseSplitsRow } from '../database.types.js';
import { createExpenseSplitsRepo, type ExpenseSplitsGateway } from './expense-splits-repo.js';

const EXPENSE_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '22222222-2222-4222-8222-222222222222';
const SPLIT_ID = '33333333-3333-4333-8333-333333333333';

const SPLIT: ExpenseSplitsRow = {
  amount: 21.25,
  created_at: '2026-08-10T08:00:00.000Z',
  expense_id: EXPENSE_ID,
  id: SPLIT_ID,
  user_id: USER_ID,
};

function gateway(overrides: Partial<ExpenseSplitsGateway> = {}): ExpenseSplitsGateway {
  return {
    listByExpense: vi.fn().mockResolvedValue({ data: [SPLIT], error: null }),
    insert: vi.fn().mockResolvedValue({ data: SPLIT, error: null }),
    update: vi.fn().mockResolvedValue({ data: SPLIT, error: null }),
    delete: vi.fn().mockResolvedValue({ data: { id: SPLIT_ID }, error: null }),
    ...overrides,
  };
}

describe('expense splits', () => {
  it('lists only through the expense-scoped gateway', async () => {
    const gw = gateway();

    await expect(createExpenseSplitsRepo(gw).list(` ${EXPENSE_ID} `)).resolves.toEqual([SPLIT]);
    expect(gw.listByExpense).toHaveBeenCalledWith(EXPENSE_ID);
  });

  it('rejects a split leaking from another expense', async () => {
    const gw = gateway({
      listByExpense: vi.fn().mockResolvedValue({
        data: [{ ...SPLIT, expense_id: 'other-expense' }],
        error: null,
      }),
    });

    await expect(createExpenseSplitsRepo(gw).list(EXPENSE_ID)).rejects.toMatchObject({
      code: 'invalid_response',
      operation: 'expense_splits.list',
    });
  });

  it('creates a positive split after cent-precise normalization', async () => {
    const gw = gateway();

    await createExpenseSplitsRepo(gw).create({
      amount: '21,25',
      expenseId: EXPENSE_ID,
      userId: USER_ID,
    });

    expect(gw.insert).toHaveBeenCalledWith({
      amount: 21.25,
      expense_id: EXPENSE_ID,
      user_id: USER_ID,
    });
  });

  it.each(['0', '-1', '1.001', 0.1 + 0.2])(
    'rejects invalid split amount %j before writing',
    async (amount) => {
      const gw = gateway();

      await expect(
        createExpenseSplitsRepo(gw).create({ amount, expenseId: EXPENSE_ID, userId: USER_ID }),
      ).rejects.toMatchObject({ code: 'invalid_input' });
      expect(gw.insert).not.toHaveBeenCalled();
    },
  );

  it('updates and deletes only within the parent expense', async () => {
    const gw = gateway();
    const repo = createExpenseSplitsRepo(gw);

    await repo.update({ amount: '30.00', expenseId: EXPENSE_ID, id: SPLIT_ID });
    await repo.delete({ expenseId: EXPENSE_ID, id: SPLIT_ID });

    expect(gw.update).toHaveBeenCalledWith(EXPENSE_ID, SPLIT_ID, { amount: 30 });
    expect(gw.delete).toHaveBeenCalledWith(EXPENSE_ID, SPLIT_ID);
  });

  it('maps a missing scoped update to not_found', async () => {
    const gw = gateway({ update: vi.fn().mockResolvedValue({ data: null, error: null }) });

    await expect(
      createExpenseSplitsRepo(gw).update({ amount: '1', expenseId: EXPENSE_ID, id: SPLIT_ID }),
    ).rejects.toMatchObject({ code: 'not_found' });
  });
});
