export type ExpenseAmountInput = string | number;

/** Maximum absolute value accepted by PostgreSQL numeric(12, 2), expressed in cents. */
export const MAX_EXPENSE_AMOUNT_CENTS = 999_999_999_999n;

const DECIMAL_AMOUNT = /^(\d+)(?:[.,](\d{1,2}))?$/;

/**
 * Parses an amount without binary floating-point arithmetic. The bigint result is
 * safe to use for totals and balance comparisons.
 */
export function expenseAmountToCents(value: ExpenseAmountInput, allowZero: boolean): bigint {
  if (typeof value === 'number' && !Number.isFinite(value)) {
    throw new TypeError('amount must be finite');
  }

  const raw = (typeof value === 'number' ? String(value) : value).trim();
  const match = DECIMAL_AMOUNT.exec(raw);
  const whole = match?.[1];
  if (whole === undefined) {
    throw new TypeError('amount must be a non-negative decimal with at most two decimal places');
  }

  const fraction = match?.[2] ?? '';
  const cents = BigInt(`${whole}${fraction.padEnd(2, '0')}`);
  if (!allowZero && cents === 0n) throw new RangeError('amount must be greater than zero');
  if (cents > MAX_EXPENSE_AMOUNT_CENTS) {
    throw new RangeError('amount exceeds numeric(12, 2)');
  }
  return cents;
}

/** Produces the number expected by generated Supabase insert/update types. */
export function normalizeExpenseAmount(value: ExpenseAmountInput, allowZero: boolean): number {
  const cents = expenseAmountToCents(value, allowZero);
  const whole = cents / 100n;
  const fraction = String(cents % 100n).padStart(2, '0');
  return Number(`${whole}.${fraction}`);
}
