import { calculateLedger, type LedgerExpense, type LedgerSettlement } from '@ralia/core';
import type { ExpenseCategoriesRow, ExpenseSettlementsRow, SharedExpensesRow } from '@ralia/data';
import { AppHeader, Card, Chip, Fab, SectionLabel, personTokens, useToast } from '@ralia/ui';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../auth/useAuth.js';
import { useData } from '../../data/DataProvider.js';
import { useT } from '../../i18n/useT.js';
import {
  ExpenseSheet,
  type ExpenseDraft,
  type ExpenseRecipient,
} from '../../sheets/ExpenseSheet.js';
import { SettlementSheet } from '../../sheets/SettlementSheet.js';
import screen from '../screen.module.css';
import styles from './MoneyScreen.module.css';
import { formatEur } from './money-math.js';

type ExpensePeriod = 'thisMonth' | 'lastMonth' | 'twoMonthsAgo' | 'thisYear' | 'all';

const ALL_TIME_RANGE = { startDate: '0001-01-01', endDate: '9999-12-31' };

export function MoneyScreen(): React.JSX.Element {
  const { t, lang } = useT();
  const { show } = useToast();
  const { session } = useAuth();
  const { expenses: expenseRepo, expenseCategories, expenseSettlements } = useData();
  const identity = session.status === 'signed-in' ? session.identity : null;
  const [period, setPeriod] = useState<ExpensePeriod>('thisMonth');
  const [expenses, setExpenses] = useState<readonly SharedExpensesRow[]>([]);
  const [categories, setCategories] = useState<readonly ExpenseCategoriesRow[]>([]);
  const [settlements, setSettlements] = useState<readonly ExpenseSettlementsRow[]>([]);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [expenseEditing, setExpenseEditing] = useState<SharedExpensesRow | null>(null);
  const [settlementOpen, setSettlementOpen] = useState(false);

  useEffect(() => {
    if (!identity) return;
    let active = true;
    const range = dateRangeFor(period);
    void Promise.all([
      expenseRepo.list(identity.calendarId, range ?? undefined),
      expenseCategories.list(identity.calendarId),
      expenseSettlements.list(identity.calendarId, range ?? ALL_TIME_RANGE),
    ])
      .then(([nextExpenses, nextCategories, nextSettlements]) => {
        if (!active) return;
        setExpenses(nextExpenses);
        setCategories(nextCategories);
        setSettlements(nextSettlements);
      })
      .catch(() => {
        if (active) show(t('moneyLoadError'), 'danger');
      });
    return () => {
      active = false;
    };
  }, [expenseCategories, expenseRepo, expenseSettlements, identity, period, show, t]);

  const ledger = useMemo(() => {
    if (!identity) return null;
    const userIds = identity.partner ? [identity.userId, identity.partner.id] : [identity.userId];
    const ledgerExpenses: LedgerExpense[] = expenses.map((expense) => ({
      id: expense.id,
      amount: expense.amount,
      paidBy: expense.paid_by,
      splitType: identity.partner && expense.for_user_id === null ? 'shared' : 'single',
      forUserId: expense.for_user_id ?? expense.paid_by,
    }));
    const ledgerSettlements: LedgerSettlement[] = settlements.map((settlement) => ({
      fromUserId: settlement.from_user_id,
      toUserId: settlement.to_user_id,
      amount: settlement.amount,
    }));
    try {
      return calculateLedger({ userIds, expenses: ledgerExpenses, settlements: ledgerSettlements });
    } catch {
      return null;
    }
  }, [expenses, identity, settlements]);

  const recommendation = ledger?.recommendedPayments[0] ?? null;
  const balanceById = new Map(ledger?.balances.map((balance) => [balance.userId, balance]) ?? []);
  const me = identity?.profile ?? null;
  const partner = identity?.partner ?? null;
  const categoryOptions = uniqueCategoryNames(categories, expenses).map((name) => ({ name }));
  const periodOptions: readonly { value: ExpensePeriod; label: string }[] = [
    { value: 'thisMonth', label: t('moneyThisMonth') },
    { value: 'lastMonth', label: t('moneyLastMonth') },
    { value: 'twoMonthsAgo', label: t('moneyTwoMonthsAgo') },
    { value: 'thisYear', label: t('moneyThisYear') },
    { value: 'all', label: t('moneyAll') },
  ];

  const saveExpense = async (draft: ExpenseDraft) => {
    if (!identity) return;
    const paidBy =
      draft.paidBy === 'u2' && identity.partner ? identity.partner.id : identity.userId;
    const forUserId = recipientId(draft.recipient, identity.userId, identity.partner?.id);
    const splitType = forUserId === null && identity.partner ? 'shared' : 'single';
    const values = {
      amount: draft.amount,
      category: draft.category,
      for_user_id: splitType === 'shared' ? null : (forUserId ?? identity.userId),
      notes: draft.notes || null,
      paid_at: draft.paidAt,
      paid_by: paidBy,
      split_type: splitType,
      title: draft.title,
    } as const;

    try {
      if (
        !categories.some(
          (category) =>
            category.name.localeCompare(draft.category, undefined, { sensitivity: 'accent' }) === 0,
        )
      ) {
        const createdCategory = await expenseCategories.create({
          calendarId: identity.calendarId,
          createdBy: identity.userId,
          name: draft.category,
          sortOrder: categories.length,
        });
        setCategories((current) => [...current, createdCategory]);
      }
      if (expenseEditing) {
        const updated = await expenseRepo.update(identity.calendarId, expenseEditing.id, values);
        setExpenses((current) =>
          current.map((expense) => (expense.id === updated.id ? updated : expense)),
        );
        setExpenseEditing(null);
      } else {
        const created = await expenseRepo.create({ calendar_id: identity.calendarId, ...values });
        setExpenses((current) => [created, ...current]);
        setExpenseOpen(false);
      }
    } catch {
      show(t('moneySaveError'), 'danger');
    }
  };

  const saveSettlement = async ({
    amount,
    settledAt,
    notes,
  }: {
    amount: number;
    settledAt: string;
    notes: string;
  }) => {
    if (!identity || !recommendation) return;
    try {
      const created = await expenseSettlements.create({
        calendarId: identity.calendarId,
        createdBy: identity.userId,
        fromUserId: recommendation.fromUserId,
        toUserId: recommendation.toUserId,
        amount,
        settledAt,
        notes: notes || null,
      });
      setSettlements((current) => [created, ...current]);
      setSettlementOpen(false);
    } catch {
      show(t('moneySettlementSaveError'), 'danger');
    }
  };

  return (
    <div className={screen.screen}>
      <AppHeader kicker={t('navMoney')} title={t('moneyTitle')} />
      <div className={screen.body}>
        <div className={screen.stack}>
          <div className={styles.filters} role="group" aria-label={t('moneyPeriod')}>
            {periodOptions.map((option) => (
              <Chip
                key={option.value}
                active={period === option.value}
                label={option.label}
                onClick={() => setPeriod(option.value)}
              />
            ))}
          </div>

          <Card tone="brand">
            <SectionLabel>{t('moneyBalance')}</SectionLabel>
            <div className={styles.balancePair}>
              {[me, partner]
                .filter((profile): profile is NonNullable<typeof profile> => profile !== null)
                .map((profile, index) => {
                  const slot = index === 0 ? 'u1' : 'u2';
                  const balance = balanceById.get(profile.id);
                  return (
                    <div key={profile.id} className={styles.balanceCard}>
                      <div className={styles.balanceWho}>
                        <span
                          className={styles.balanceDot}
                          style={{ background: personTokens(slot).bar }}
                          aria-hidden="true"
                        />
                        <span className={styles.balanceName}>
                          {firstName(profile.name ?? t('partner'))}
                        </span>
                      </div>
                      <div className={styles.balanceAmount}>
                        {formatEur(balance?.paid ?? 0, lang)}
                      </div>
                      <div className={styles.balancePaid}>{t('moneyPaid')}</div>
                    </div>
                  );
                })}
            </div>
            <div className={styles.owed}>
              <div className={styles.owedText}>
                <div className={styles.owedTitle}>
                  {recommendation
                    ? `${nameFor(recommendation.fromUserId, me, partner, t('partner'))} ${t('moneyOwes')} ${nameFor(recommendation.toUserId, me, partner, t('partner'))}`
                    : t('moneyBalanced')}
                </div>
                <div className={styles.owedHint}>
                  {periodOptions.find((option) => option.value === period)?.label} ·{' '}
                  {expenses.length} {t('moneyExpenses')}
                </div>
              </div>
              <div className={styles.owedAmount}>
                {formatEur(recommendation?.amount ?? 0, lang)}
              </div>
            </div>
            {partner ? (
              <button
                type="button"
                className={styles.settle}
                disabled={!recommendation}
                onClick={() => setSettlementOpen(true)}
              >
                {recommendation ? t('moneySettleUp') : t('moneySettled')}
              </button>
            ) : null}
          </Card>

          <Card flush>
            <div className={styles.expensesHead}>
              <SectionLabel>{t('moneyExpenses')}</SectionLabel>
            </div>
            {expenses.length === 0 ? (
              <div className={styles.emptyExpenses}>{t('moneyNoExpenses')}</div>
            ) : (
              expenses.map((expense) => {
                const slot = expense.paid_by === identity?.userId ? 'u1' : 'u2';
                const initial =
                  slot === 'u1' ? firstInitial(me?.name) : firstInitial(partner?.name);
                return (
                  <button
                    key={expense.id}
                    type="button"
                    className={styles.expense}
                    data-testid="expense-row"
                    onClick={() => setExpenseEditing(expense)}
                    aria-label={`${expense.title}: ${t('sheetEditExpense')}`}
                  >
                    <span
                      className={styles.expenseAvatar}
                      style={{ background: personTokens(slot).bar }}
                      aria-hidden="true"
                    >
                      {initial}
                    </span>
                    <span className={styles.expenseBody}>
                      <span className={styles.expenseTitle}>{expense.title}</span>
                      <span className={styles.expenseMeta}>
                        {expense.category} · {formatDate(expense.paid_at, lang)} ·{' '}
                        {recipientLabel(expense.for_user_id, identity?.userId, partner?.id, t)}
                      </span>
                    </span>
                    <span className={styles.expenseAmount}>{formatEur(expense.amount, lang)}</span>
                  </button>
                );
              })
            )}
          </Card>
        </div>
      </div>
      <Fab label={t('moneyAddExpense')} onClick={() => setExpenseOpen(true)} />

      <ExpenseSheet
        key={expenseEditing ? `edit-${expenseEditing.id}` : `new-${expenseOpen}`}
        open={expenseOpen || expenseEditing !== null}
        categories={categoryOptions}
        initial={expenseEditing ? draftFromExpense(expenseEditing, partner?.id) : undefined}
        onClose={() => {
          setExpenseOpen(false);
          setExpenseEditing(null);
        }}
        onSave={(draft) => void saveExpense(draft)}
      />
      {recommendation ? (
        <SettlementSheet
          key={`settlement-${settlementOpen}-${recommendation.amount}`}
          open={settlementOpen}
          fromName={nameFor(recommendation.fromUserId, me, partner, t('partner'))}
          toName={nameFor(recommendation.toUserId, me, partner, t('partner'))}
          suggestedAmount={recommendation.amount}
          onClose={() => setSettlementOpen(false)}
          onSave={(draft) => void saveSettlement(draft)}
        />
      ) : null}
    </div>
  );
}

function dateRangeFor(period: ExpensePeriod): { startDate: string; endDate: string } | null {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  if (period === 'all') return null;
  if (period === 'thisYear') return { startDate: `${year}-01-01`, endDate: `${year}-12-31` };
  const offset = period === 'thisMonth' ? 0 : period === 'lastMonth' ? -1 : -2;
  const start = new Date(Date.UTC(year, month + offset, 1));
  const end = new Date(Date.UTC(year, month + offset + 1, 0));
  return { startDate: isoDate(start), endDate: isoDate(end) };
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function recipientId(
  recipient: ExpenseRecipient,
  userId: string,
  partnerId?: string,
): string | null {
  if (recipient === 'both' && partnerId) return null;
  if (recipient === 'partner' && partnerId) return partnerId;
  return userId;
}

function draftFromExpense(expense: SharedExpensesRow, partnerId?: string): ExpenseDraft {
  return {
    title: expense.title,
    amount: expense.amount,
    category: expense.category ?? '',
    paidBy: expense.paid_by === partnerId ? 'u2' : 'u1',
    recipient:
      expense.for_user_id === null
        ? 'both'
        : expense.for_user_id === partnerId
          ? 'partner'
          : 'self',
    paidAt: expense.paid_at,
    notes: expense.notes ?? '',
  };
}

function uniqueCategoryNames(
  categories: readonly ExpenseCategoriesRow[],
  expenses: readonly SharedExpensesRow[],
): string[] {
  return [
    ...new Set([
      ...categories.map((category) => category.name),
      ...expenses
        .map((expense) => expense.category)
        .filter((category): category is string => Boolean(category?.trim())),
    ]),
  ].sort((left, right) => left.localeCompare(right));
}

function recipientLabel(
  forUserId: string | null,
  userId: string | undefined,
  partnerId: string | undefined,
  t: (key: string) => string,
): string {
  if (forUserId === null) return t('sheetForBoth');
  if (forUserId === userId) return t('sheetForSelf');
  if (forUserId === partnerId) return t('sheetForPartner');
  return t('sheetForSelf');
}

function firstName(value: string): string {
  return value.split(' ')[0] || value;
}

function firstInitial(value: string | null | undefined): string {
  return value?.trim().charAt(0).toUpperCase() || '?';
}

function nameFor(
  userId: string,
  me: { id: string; name: string | null } | null,
  partner: { id: string; name: string | null } | null,
  fallback: string,
): string {
  if (userId === me?.id) return firstName(me.name ?? fallback);
  if (userId === partner?.id) return firstName(partner.name ?? fallback);
  return fallback;
}

function formatDate(iso: string, lang: 'de' | 'en'): string {
  return new Intl.DateTimeFormat(lang === 'de' ? 'de-DE' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${iso}T00:00:00Z`));
}
