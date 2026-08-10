/**
 * Framework-free expense ledger. All monetary values are converted to cents
 * before they take part in arithmetic; numbers only reappear at the API edge.
 */

export type ExpenseSplitType = 'single' | 'shared';

export interface LedgerShare {
  userId: string;
  amount: number;
}

/** Fields needed by the optional spending aggregations. */
export interface ExpenseAggregationInput {
  amount: number;
  date?: string;
  category?: string | null;
}

export interface LedgerExpense extends ExpenseAggregationInput {
  id: string;
  paidBy: string;
  splitType: ExpenseSplitType;
  /** Exact obligations. A shared expense without these is split 50/50. */
  shares?: readonly LedgerShare[];
}

export interface LedgerSettlement {
  fromUserId: string;
  toUserId: string;
  amount: number;
}

export interface LedgerInput {
  /** All participants that may pay, owe, or receive a settlement. */
  userIds: readonly string[];
  expenses: readonly LedgerExpense[];
  settlements: readonly LedgerSettlement[];
}

export interface LedgerBalance {
  userId: string;
  /** Direct expense payments, excluding settlement transfers. */
  paid: number;
  /** Expense obligations before settlement transfers. */
  owed: number;
  /** Positive means the user should receive money; negative means they owe money. */
  net: number;
}

export interface RecommendedPayment {
  fromUserId: string;
  toUserId: string;
  amount: number;
}

export interface LedgerResult {
  balances: readonly LedgerBalance[];
  recommendedPayments: readonly RecommendedPayment[];
}

export interface MonthlyExpenseTotal {
  month: string;
  amount: number;
}

export interface CategoryExpenseTotal {
  category: string;
  amount: number;
}

/** Label used when an expense has no category or only whitespace as a category. */
export const UNCATEGORIZED_CATEGORY = 'uncategorized';

interface InternalBalance {
  paid: bigint;
  owed: bigint;
  settlementNet: bigint;
}

interface OutstandingBalance {
  userId: string;
  cents: bigint;
}

const DECIMAL_AMOUNT = /^(\d+)(?:\.(\d{1,2}))?$/;
const CENTS_PER_UNIT = 100n;
const MAX_SAFE_OUTPUT_CENTS = BigInt(Number.MAX_SAFE_INTEGER);

function assertText(value: string, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TypeError(`${field} must be a non-empty string`);
  }
  return value;
}

function amountToCents(value: number, field: string, allowZero = false): bigint {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${field} must be a finite number`);
  }

  // String(number) exposes binary-floating-point artifacts instead of rounding
  // them away, so inputs such as 0.1 + 0.2 cannot silently change a cent value.
  const match = DECIMAL_AMOUNT.exec(String(value));
  const whole = match?.[1];
  if (whole === undefined) {
    throw new TypeError(`${field} must have at most two decimal places`);
  }

  const fraction = (match?.[2] ?? '').padEnd(2, '0');
  const cents = BigInt(`${whole}${fraction}`);
  if (!allowZero && cents === 0n) {
    throw new RangeError(`${field} must be greater than zero`);
  }
  return cents;
}

function centsToAmount(cents: bigint): number {
  if (cents > MAX_SAFE_OUTPUT_CENTS || cents < -MAX_SAFE_OUTPUT_CENTS) {
    throw new RangeError('ledger result exceeds the cent-precise number range');
  }
  return Number(cents) / Number(CENTS_PER_UNIT);
}

function compareText(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function participantIds(rawUserIds: readonly string[]): string[] {
  const userIds = rawUserIds.map((userId) => assertText(userId, 'userId')).sort(compareText);
  for (let index = 1; index < userIds.length; index += 1) {
    if (userIds[index] === userIds[index - 1]) {
      throw new RangeError(`userIds contains the participant ${JSON.stringify(userIds[index])} twice`);
    }
  }
  return userIds;
}

function balanceFor(balances: Map<string, InternalBalance>, userId: string): InternalBalance {
  const balance = balances.get(userId);
  if (balance === undefined) throw new RangeError(`unknown userId ${JSON.stringify(userId)}`);
  return balance;
}

function assertParticipant(
  balances: Map<string, InternalBalance>,
  userId: string,
  field: string,
): string {
  const value = assertText(userId, field);
  balanceFor(balances, value);
  return value;
}

function addOwed(balances: Map<string, InternalBalance>, userId: string, cents: bigint): void {
  balanceFor(balances, userId).owed += cents;
}

function addExplicitShares(
  balances: Map<string, InternalBalance>,
  expense: LedgerExpense,
  expenseId: string,
  amount: bigint,
): void {
  const shares = expense.shares;
  if (shares === undefined || shares.length === 0) {
    throw new RangeError(`expense ${JSON.stringify(expenseId)} must have at least one explicit share`);
  }

  let splitTotal = 0n;
  const shareUsers = new Set<string>();
  for (const share of shares) {
    const userId = assertParticipant(balances, share.userId, 'share.userId');
    if (shareUsers.has(userId)) {
      throw new RangeError(`expense ${JSON.stringify(expenseId)} has duplicate shares for ${userId}`);
    }
    shareUsers.add(userId);

    const shareAmount = amountToCents(share.amount, 'share.amount', true);
    splitTotal += shareAmount;
    addOwed(balances, userId, shareAmount);
  }

  if (splitTotal !== amount) {
    throw new RangeError(
      `explicit shares for expense ${JSON.stringify(expenseId)} must add up to its amount`,
    );
  }
}

function addDefaultSharedSplit(
  balances: Map<string, InternalBalance>,
  userIds: readonly string[],
  amount: bigint,
): void {
  if (userIds.length !== 2) {
    throw new RangeError('a shared expense without explicit shares requires exactly two userIds');
  }

  const firstUser = userIds[0];
  const secondUser = userIds[1];
  if (firstUser === undefined || secondUser === undefined) {
    throw new Error('two validated participants were expected');
  }

  const half = amount / 2n;
  // userIds are lexically sorted, making the odd cent independent of input order.
  addOwed(balances, firstUser, half + (amount % 2n));
  addOwed(balances, secondUser, half);
}

function recommendedPayments(
  userIds: readonly string[],
  balances: Map<string, InternalBalance>,
): RecommendedPayment[] {
  const debtors: OutstandingBalance[] = [];
  const creditors: OutstandingBalance[] = [];

  for (const userId of userIds) {
    const balance = balanceFor(balances, userId);
    const net = balance.paid - balance.owed + balance.settlementNet;
    if (net < 0n) debtors.push({ userId, cents: -net });
    if (net > 0n) creditors.push({ userId, cents: net });
  }

  const payments: RecommendedPayment[] = [];
  let debtorIndex = 0;
  let creditorIndex = 0;
  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];
    if (debtor === undefined || creditor === undefined) break;

    const cents = debtor.cents < creditor.cents ? debtor.cents : creditor.cents;
    payments.push({
      fromUserId: debtor.userId,
      toUserId: creditor.userId,
      amount: centsToAmount(cents),
    });
    debtor.cents -= cents;
    creditor.cents -= cents;
    if (debtor.cents === 0n) debtorIndex += 1;
    if (creditor.cents === 0n) creditorIndex += 1;
  }

  if (debtorIndex !== debtors.length || creditorIndex !== creditors.length) {
    throw new Error('ledger balances are not conserved');
  }
  return payments;
}

/**
 * Calculates a complete ledger. `paid` and `owed` describe expenses only;
 * settlements only affect `net`, which is the outstanding balance.
 */
export function calculateLedger(input: LedgerInput): LedgerResult {
  const userIds = participantIds(input.userIds);
  const balances = new Map<string, InternalBalance>(
    userIds.map((userId) => [userId, { paid: 0n, owed: 0n, settlementNet: 0n }]),
  );
  const expenseIds = new Set<string>();

  for (const expense of input.expenses) {
    const expenseId = assertText(expense.id, 'expense.id');
    if (expenseIds.has(expenseId)) {
      throw new RangeError(`duplicate expense id ${JSON.stringify(expenseId)}`);
    }
    expenseIds.add(expenseId);

    const payer = assertParticipant(balances, expense.paidBy, 'expense.paidBy');
    const amount = amountToCents(expense.amount, 'expense.amount');
    balanceFor(balances, payer).paid += amount;

    if (expense.splitType === 'single') {
      if (expense.shares !== undefined) {
        throw new RangeError(`single expense ${JSON.stringify(expenseId)} cannot have explicit shares`);
      }
      addOwed(balances, payer, amount);
      continue;
    }

    if (expense.splitType !== 'shared') {
      throw new TypeError(`expense ${JSON.stringify(expenseId)} has an invalid splitType`);
    }
    if (expense.shares === undefined) {
      addDefaultSharedSplit(balances, userIds, amount);
    } else {
      addExplicitShares(balances, expense, expenseId, amount);
    }
  }

  for (const settlement of input.settlements) {
    const fromUserId = assertParticipant(balances, settlement.fromUserId, 'settlement.fromUserId');
    const toUserId = assertParticipant(balances, settlement.toUserId, 'settlement.toUserId');
    if (fromUserId === toUserId) {
      throw new RangeError('a settlement must have different fromUserId and toUserId values');
    }

    const amount = amountToCents(settlement.amount, 'settlement.amount');
    // Paying a settlement reduces a debtor's negative net and a creditor's positive net.
    balanceFor(balances, fromUserId).settlementNet += amount;
    balanceFor(balances, toUserId).settlementNet -= amount;
  }

  return {
    balances: userIds.map((userId) => {
      const balance = balanceFor(balances, userId);
      return {
        userId,
        paid: centsToAmount(balance.paid),
        owed: centsToAmount(balance.owed),
        net: centsToAmount(balance.paid - balance.owed + balance.settlementNet),
      };
    }),
    recommendedPayments: recommendedPayments(userIds, balances),
  };
}

function totalsBy(
  expenses: readonly ExpenseAggregationInput[],
  keyFor: (expense: ExpenseAggregationInput) => string,
): Array<readonly [string, bigint]> {
  const totals = new Map<string, bigint>();
  for (const expense of expenses) {
    const key = keyFor(expense);
    totals.set(key, (totals.get(key) ?? 0n) + amountToCents(expense.amount, 'expense.amount'));
  }
  return [...totals.entries()].sort(([left], [right]) => compareText(left, right));
}

function monthFromDate(date: string | undefined): string {
  if (typeof date !== 'string') {
    throw new TypeError('expense.date must be a valid YYYY-MM-DD string for monthly aggregation');
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (match === null) {
    throw new TypeError('expense.date must be a valid YYYY-MM-DD string for monthly aggregation');
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > (daysInMonth[month - 1] ?? 0)) {
    throw new TypeError('expense.date must be a valid YYYY-MM-DD string for monthly aggregation');
  }
  return `${match[1]}-${match[2]}`;
}

function categoryFromExpense(category: string | null | undefined): string {
  if (category === null || category === undefined) return UNCATEGORIZED_CATEGORY;
  if (typeof category !== 'string') throw new TypeError('expense.category must be a string or null');
  const normalized = category.trim();
  return normalized.length === 0 ? UNCATEGORIZED_CATEGORY : normalized;
}

/** Full expense amounts grouped by their valid calendar month, sorted ascending. */
export function aggregateExpensesByMonth(
  expenses: readonly ExpenseAggregationInput[],
): MonthlyExpenseTotal[] {
  return totalsBy(expenses, (expense) => monthFromDate(expense.date)).map(([month, cents]) => ({
    month,
    amount: centsToAmount(cents),
  }));
}

/** Full expense amounts grouped by category, sorted by category identifier. */
export function aggregateExpensesByCategory(
  expenses: readonly ExpenseAggregationInput[],
): CategoryExpenseTotal[] {
  return totalsBy(expenses, (expense) => categoryFromExpense(expense.category)).map(
    ([category, cents]) => ({
      category,
      amount: centsToAmount(cents),
    }),
  );
}
