import { describe, expect, it } from 'vitest';
import {
  MAX_EXPENSE_AMOUNT_CENTS,
  expenseAmountToCents,
  normalizeExpenseAmount,
} from './expense-money.js';

describe('expense money', () => {
  it.each([
    ['0', 0n],
    ['1', 100n],
    ['0001,05', 105n],
    [' 42.50 ', 4250n],
    [19.99, 1999n],
    ['9999999999.99', MAX_EXPENSE_AMOUNT_CENTS],
  ])('parses %j exactly as integer cents', (input, expected) => {
    expect(expenseAmountToCents(input, true)).toBe(expected);
  });

  it('supports exact balance arithmetic in cents', () => {
    const balance = expenseAmountToCents('0.10', false) + expenseAmountToCents('0.20', false);

    expect(balance).toBe(30n);
  });

  it.each(['-1', '1.001', '1e2', '12 EUR', '10000000000', NaN, Infinity])(
    'rejects invalid or out-of-range amount %j',
    (input) => {
      expect(() => expenseAmountToCents(input, true)).toThrow();
    },
  );

  it('rejects calculated number inputs that have lost cent precision', () => {
    expect(() => normalizeExpenseAmount(0.1 + 0.2, false)).toThrow(/decimal/);
  });

  it('allows zero only when requested and emits the canonical database number', () => {
    expect(() => normalizeExpenseAmount('0.00', false)).toThrow(/greater than zero/);
    expect(normalizeExpenseAmount('00042,50', false)).toBe(42.5);
  });
});
