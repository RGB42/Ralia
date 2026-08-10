import { describe, expect, it } from 'vitest';
import {
  UNCATEGORIZED_CATEGORY,
  aggregateExpensesByCategory,
  aggregateExpensesByMonth,
  calculateLedger,
  type LedgerInput,
} from './ledger.js';

function ledger(overrides: Partial<LedgerInput> = {}): LedgerInput {
  return {
    userIds: ['alice', 'bob'],
    expenses: [],
    settlements: [],
    ...overrides,
  };
}

describe('calculateLedger', () => {
  it('splits an odd shared amount deterministically, regardless of participant input order', () => {
    const result = calculateLedger(
      ledger({
        userIds: ['bob', 'alice'],
        expenses: [{ id: 'groceries', amount: 10.01, paidBy: 'alice', splitType: 'shared' }],
      }),
    );

    expect(result.balances).toEqual([
      { userId: 'alice', paid: 10.01, owed: 5.01, net: 5 },
      { userId: 'bob', paid: 0, owed: 5, net: -5 },
    ]);
    expect(result.recommendedPayments).toEqual([{ fromUserId: 'bob', toUserId: 'alice', amount: 5 }]);
  });

  it('assigns a single expense entirely to its payer', () => {
    const result = calculateLedger(
      ledger({
        expenses: [{ id: 'coffee', amount: 3.5, paidBy: 'bob', splitType: 'single' }],
      }),
    );

    expect(result.balances).toEqual([
      { userId: 'alice', paid: 0, owed: 0, net: 0 },
      { userId: 'bob', paid: 3.5, owed: 3.5, net: 0 },
    ]);
    expect(result.recommendedPayments).toEqual([]);
  });

  it('uses exact explicit shares for more than two participants', () => {
    const result = calculateLedger(
      ledger({
        userIds: ['carol', 'alice', 'bob'],
        expenses: [
          {
            id: 'trip',
            amount: 30,
            paidBy: 'alice',
            splitType: 'shared',
            shares: [
              { userId: 'alice', amount: 10 },
              { userId: 'bob', amount: 5 },
              { userId: 'carol', amount: 15 },
            ],
          },
        ],
      }),
    );

    expect(result.balances).toEqual([
      { userId: 'alice', paid: 30, owed: 10, net: 20 },
      { userId: 'bob', paid: 0, owed: 5, net: -5 },
      { userId: 'carol', paid: 0, owed: 15, net: -15 },
    ]);
    expect(result.recommendedPayments).toEqual([
      { fromUserId: 'bob', toUserId: 'alice', amount: 5 },
      { fromUserId: 'carol', toUserId: 'alice', amount: 15 },
    ]);
  });

  it('keeps cents exact across several decimal inputs', () => {
    const result = calculateLedger(
      ledger({
        expenses: [
          { id: 'one', amount: 0.1, paidBy: 'alice', splitType: 'shared' },
          { id: 'two', amount: 0.2, paidBy: 'alice', splitType: 'single' },
          { id: 'three', amount: 0.3, paidBy: 'bob', splitType: 'single' },
        ],
      }),
    );

    expect(result.balances).toEqual([
      { userId: 'alice', paid: 0.3, owed: 0.25, net: 0.05 },
      { userId: 'bob', paid: 0.3, owed: 0.35, net: -0.05 },
    ]);
    expect(result.recommendedPayments).toEqual([{ fromUserId: 'bob', toUserId: 'alice', amount: 0.05 }]);
  });

  it('reduces the outstanding debt by completed settlements without changing expense totals', () => {
    const result = calculateLedger(
      ledger({
        expenses: [{ id: 'rent', amount: 100, paidBy: 'alice', splitType: 'shared' }],
        settlements: [{ fromUserId: 'bob', toUserId: 'alice', amount: 30 }],
      }),
    );

    expect(result.balances).toEqual([
      { userId: 'alice', paid: 100, owed: 50, net: 20 },
      { userId: 'bob', paid: 0, owed: 50, net: -20 },
    ]);
    expect(result.recommendedPayments).toEqual([{ fromUserId: 'bob', toUserId: 'alice', amount: 20 }]);
  });

  it('reverses the recommended direction when a settlement overpays a debt', () => {
    const result = calculateLedger(
      ledger({
        expenses: [{ id: 'rent', amount: 100, paidBy: 'alice', splitType: 'shared' }],
        settlements: [{ fromUserId: 'bob', toUserId: 'alice', amount: 80 }],
      }),
    );

    expect(result.recommendedPayments).toEqual([{ fromUserId: 'alice', toUserId: 'bob', amount: 30 }]);
  });

  it.each([
    {
      name: 'has a share total that differs by one cent',
      input: ledger({
        expenses: [
          {
            id: 'bad-total',
            amount: 10,
            paidBy: 'alice',
            splitType: 'shared',
            shares: [
              { userId: 'alice', amount: 5 },
              { userId: 'bob', amount: 4.99 },
            ],
          },
        ],
      }),
      message: /must add up/,
    },
    {
      name: 'repeats a share user',
      input: ledger({
        expenses: [
          {
            id: 'duplicate-share',
            amount: 10,
            paidBy: 'alice',
            splitType: 'shared',
            shares: [
              { userId: 'alice', amount: 5 },
              { userId: 'alice', amount: 5 },
            ],
          },
        ],
      }),
      message: /duplicate shares/,
    },
    {
      name: 'uses an unknown share user',
      input: ledger({
        expenses: [
          {
            id: 'unknown-share',
            amount: 10,
            paidBy: 'alice',
            splitType: 'shared',
            shares: [
              { userId: 'alice', amount: 5 },
              { userId: 'carol', amount: 5 },
            ],
          },
        ],
      }),
      message: /unknown userId/,
    },
    {
      name: 'has more than two participants for an implicit shared split',
      input: ledger({
        userIds: ['alice', 'bob', 'carol'],
        expenses: [{ id: 'needs-shares', amount: 10, paidBy: 'alice', splitType: 'shared' }],
      }),
      message: /exactly two userIds/,
    },
    {
      name: 'attaches shares to a single expense',
      input: ledger({
        expenses: [
          {
            id: 'single-with-shares',
            amount: 10,
            paidBy: 'alice',
            splitType: 'single',
            shares: [{ userId: 'alice', amount: 10 }],
          },
        ],
      }),
      message: /cannot have explicit shares/,
    },
  ])('rejects an invalid explicit split when it $name', ({ input, message }) => {
    expect(() => calculateLedger(input)).toThrow(message);
  });

  it.each([
    { amount: 0, message: /greater than zero/ },
    { amount: -1, message: /at most two decimal places/ },
    { amount: 1.001, message: /at most two decimal places/ },
    { amount: Number.NaN, message: /finite number/ },
    { amount: Number.POSITIVE_INFINITY, message: /finite number/ },
    { amount: 0.1 + 0.2, message: /at most two decimal places/ },
  ])('rejects non-cent-safe expense amount $amount', ({ amount, message }) => {
    expect(() =>
      calculateLedger(
        ledger({ expenses: [{ id: 'invalid', amount, paidBy: 'alice', splitType: 'single' }] }),
      ),
    ).toThrow(message);
  });

  it.each([
    {
      settlement: { fromUserId: 'alice', toUserId: 'alice', amount: 1 },
      message: /different fromUserId/,
    },
    {
      settlement: { fromUserId: 'carol', toUserId: 'alice', amount: 1 },
      message: /unknown userId/,
    },
    {
      settlement: { fromUserId: 'alice', toUserId: 'bob', amount: 0 },
      message: /greater than zero/,
    },
  ])('validates settlement $settlement.fromUserId to $settlement.toUserId', ({ settlement, message }) => {
    expect(() => calculateLedger(ledger({ settlements: [settlement] }))).toThrow(message);
  });

  it('rejects duplicate expense identifiers and duplicate participants', () => {
    expect(() =>
      calculateLedger(
        ledger({
          expenses: [
            { id: 'same', amount: 1, paidBy: 'alice', splitType: 'single' },
            { id: 'same', amount: 1, paidBy: 'bob', splitType: 'single' },
          ],
        }),
      ),
    ).toThrow(/duplicate expense id/);
    expect(() => calculateLedger(ledger({ userIds: ['alice', 'alice'] }))).toThrow(/twice/);
  });
});

describe('expense aggregations', () => {
  const expenses = [
    { amount: 10.01, date: '2026-02-01', category: 'Food' },
    { amount: 5, date: '2026-01-31', category: null },
    { amount: 4.99, date: '2026-02-28', category: 'Food' },
    { amount: 0.1, date: '2026-02-10', category: '  ' },
  ] as const;

  it('groups full expense amounts by ascending calendar month', () => {
    expect(aggregateExpensesByMonth(expenses)).toEqual([
      { month: '2026-01', amount: 5 },
      { month: '2026-02', amount: 15.1 },
    ]);
  });

  it('groups full expense amounts by category and handles empty categories', () => {
    expect(aggregateExpensesByCategory(expenses)).toEqual([
      { category: 'Food', amount: 15 },
      { category: UNCATEGORIZED_CATEGORY, amount: 5.1 },
    ]);
  });

  it.each([undefined, '2026-02-30', '2026-2-01', 'not-a-date'])(
    'rejects invalid monthly aggregation date %j',
    (date) => {
      const expenses = date === undefined ? [{ amount: 1 }] : [{ amount: 1, date }];
      expect(() => aggregateExpensesByMonth(expenses)).toThrow(/valid YYYY-MM-DD/);
    },
  );

  it('rejects invalid aggregation amounts with the same cent validation as the ledger', () => {
    expect(() => aggregateExpensesByCategory([{ amount: 1.001, category: 'Food' }])).toThrow(
      /at most two decimal places/,
    );
  });
});
