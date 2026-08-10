import { describe, expect, it, vi } from 'vitest';
import type { SharedExpensesRow } from '../database.types.js';
import {
  createSharedExpenseRepo,
  parseExpenseAmount,
  type SharedExpenseGateway,
} from './shared-expense-repo.js';

const CALENDAR_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '22222222-2222-4222-8222-222222222222';
const EXPENSE_ID = '33333333-3333-4333-8333-333333333333';

const EXPENSE: SharedExpensesRow = {
  amount: 42.5,
  calendar_id: CALENDAR_ID,
  category: 'Lebensmittel',
  created_at: '2026-08-10T08:00:00Z',
  id: EXPENSE_ID,
  notes: null,
  paid_at: '2026-08-10',
  paid_by: USER_ID,
  split_type: 'shared',
  title: 'Einkauf',
  updated_at: '2026-08-10T08:00:00Z',
};

function gateway(overrides: Partial<SharedExpenseGateway> = {}): SharedExpenseGateway {
  return {
    selectByDateRange: vi.fn().mockResolvedValue({ data: [EXPENSE], error: null }),
    insert: vi.fn().mockResolvedValue({ data: EXPENSE, error: null }),
    updateById: vi.fn().mockResolvedValue({ data: EXPENSE, error: null }),
    deleteById: vi.fn().mockResolvedValue({ error: null }),
    ...overrides,
  };
}

describe('parseExpenseAmount', () => {
  it.each([
    ['42', 42],
    ['42.5', 42.5],
    [' 42,50 ', 42.5],
    ['0001,05', 1.05],
    [12.34, 12.34],
  ])('accepts %j as a complete decimal input', (input, expected) => {
    expect(parseExpenseAmount(input)).toBe(expected);
  });

  it.each(['', '0', '-1', '1.234', '1,234.56', '12 EUR', 'NaN', Infinity])(
    'rejects invalid amount %j',
    (input) => {
      expect(() => parseExpenseAmount(input)).toThrow();
    },
  );

  it('rejects a number whose binary calculation exposes more than two decimal places', () => {
    expect(() => parseExpenseAmount(0.1 + 0.2)).toThrow(/decimal/);
  });

  it('rejects values too large to preserve cent precision', () => {
    expect(() => parseExpenseAmount('90071992547409.92')).toThrow(/cent precision/);
    expect(() => parseExpenseAmount('90071992547409.91')).toThrow(/cent precision/);
  });
});

describe('shared expense list', () => {
  it('lists through the inclusive calendar and date-range gateway operation', async () => {
    const gw = gateway();

    expect(await createSharedExpenseRepo(gw).list(CALENDAR_ID, '2026-08-01', '2026-08-31')).toEqual(
      [EXPENSE],
    );
    expect(gw.selectByDateRange).toHaveBeenCalledWith(CALENDAR_ID, '2026-08-01', '2026-08-31');
  });

  it('rejects a reversed range without querying', async () => {
    const gw = gateway();

    await expect(
      createSharedExpenseRepo(gw).list(CALENDAR_ID, '2026-09-01', '2026-08-31'),
    ).rejects.toThrow(/from_date/);
    expect(gw.selectByDateRange).not.toHaveBeenCalled();
  });

  it('forwards gateway errors', async () => {
    const gw = gateway({
      selectByDateRange: vi
        .fn()
        .mockResolvedValue({ data: null, error: { code: '42501', message: 'denied' } }),
    });

    await expect(
      createSharedExpenseRepo(gw).list(CALENDAR_ID, '2026-08-01', '2026-08-31'),
    ).rejects.toThrow('denied');
  });
});

describe('shared expense mutations', () => {
  it('validates and normalizes the amount before creating', async () => {
    const gw = gateway();
    const result = await createSharedExpenseRepo(gw).create({
      amount: '42,50',
      calendar_id: CALENDAR_ID,
      category: 'Lebensmittel',
      notes: null,
      paid_at: '2026-08-10',
      paid_by: USER_ID,
      split_type: 'shared',
      title: 'Einkauf',
    });

    expect(result).toEqual(EXPENSE);
    expect(gw.insert).toHaveBeenCalledWith({
      amount: 42.5,
      calendar_id: CALENDAR_ID,
      category: 'Lebensmittel',
      notes: null,
      paid_at: '2026-08-10',
      paid_by: USER_ID,
      split_type: 'shared',
      title: 'Einkauf',
    });
  });

  it('normalizes update amounts and scopes the mutation to the calendar', async () => {
    const gw = gateway();

    await createSharedExpenseRepo(gw).update(CALENDAR_ID, EXPENSE_ID, {
      amount: '19.95',
      category: null,
      notes: null,
    });

    expect(gw.updateById).toHaveBeenCalledWith(CALENDAR_ID, EXPENSE_ID, {
      amount: 19.95,
      category: null,
      notes: null,
    });
  });

  it('rejects an invalid amount before writing', async () => {
    const gw = gateway();

    await expect(
      createSharedExpenseRepo(gw).update(CALENDAR_ID, EXPENSE_ID, { amount: '12.345' }),
    ).rejects.toThrow(/decimal/);
    expect(gw.updateById).not.toHaveBeenCalled();
  });

  it('deletes through a calendar-scoped gateway operation', async () => {
    const gw = gateway();

    await createSharedExpenseRepo(gw).delete(CALENDAR_ID, EXPENSE_ID);

    expect(gw.deleteById).toHaveBeenCalledWith(CALENDAR_ID, EXPENSE_ID);
  });

  it('forwards delete errors', async () => {
    const gw = gateway({
      deleteById: vi.fn().mockResolvedValue({ error: { message: 'denied' } }),
    });

    await expect(createSharedExpenseRepo(gw).delete(CALENDAR_ID, EXPENSE_ID)).rejects.toThrow(
      'denied',
    );
  });

  it('does not report a mutation as successful when no row is returned', async () => {
    const gw = gateway({ insert: vi.fn().mockResolvedValue({ data: null, error: null }) });

    await expect(
      createSharedExpenseRepo(gw).create({
        amount: '42.50',
        calendar_id: CALENDAR_ID,
        paid_by: USER_ID,
        title: 'Einkauf',
      }),
    ).rejects.toThrow(/not returned/);
  });
});
