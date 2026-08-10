import {
  aggregateExpensesByCategory,
  calculateLedger,
  type LedgerExpense,
  type LedgerSettlement,
} from '@ralia/core';
import type {
  ExpenseBudgetsRow,
  ExpenseCategoriesRow,
  ExpenseSettlementsRow,
  SharedExpensesRow,
} from '@ralia/data';
import { AppHeader, Card, Fab, ProgressBar, SectionLabel, personTokens, useToast } from '@ralia/ui';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../auth/useAuth.js';
import { useData } from '../../data/DataProvider.js';
import { useT } from '../../i18n/useT.js';
import { BudgetSheet } from '../../sheets/BudgetSheet.js';
import { ExpenseSheet, type ExpenseDraft } from '../../sheets/ExpenseSheet.js';
import { ExpenseCategorySheet } from '../../sheets/ExpenseCategorySheet.js';
import { SettlementSheet } from '../../sheets/SettlementSheet.js';
import screen from '../screen.module.css';
import { addDaysIso, monthTitle } from '../calendar/calendar-labels.js';
import styles from './MoneyScreen.module.css';
import { formatEur } from './money-math.js';

export function MoneyScreen(): React.JSX.Element {
  const { t, lang } = useT();
  const { show } = useToast();
  const { session } = useAuth();
  const {
    expenses: expenseRepo,
    expenseBudgets,
    expenseCategories,
    expenseSettlements,
    expenseSplits,
  } = useData();
  const identity = session.status === 'signed-in' ? session.identity : null;
  const [monthStart, setMonthStart] = useState(currentMonthStart);
  const [expenses, setExpenses] = useState<readonly SharedExpensesRow[]>([]);
  const [categories, setCategories] = useState<readonly ExpenseCategoriesRow[]>([]);
  const [budget, setBudget] = useState<ExpenseBudgetsRow | null>(null);
  const [settlements, setSettlements] = useState<readonly ExpenseSettlementsRow[]>([]);
  const [splitsByExpense, setSplitsByExpense] = useState<
    ReadonlyMap<string, readonly { user_id: string; amount: number }[]>
  >(new Map());
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [settlementOpen, setSettlementOpen] = useState(false);
  const [categoryEditing, setCategoryEditing] = useState<string | null>(null);
  const monthEnd = addDaysIso(nextMonthStart(monthStart), -1);

  useEffect(() => {
    if (!identity) return;
    let active = true;
    void Promise.all([
      expenseRepo.list(identity.calendarId, monthStart, monthEnd),
      expenseCategories.list(identity.calendarId),
      expenseBudgets.list(identity.calendarId),
      expenseSettlements.list(identity.calendarId, { startDate: monthStart, endDate: monthEnd }),
    ])
      .then(async ([nextExpenses, nextCategories, budgets, nextSettlements]) => {
        const splitRows = await Promise.all(
          nextExpenses.map(async (expense) => [expense.id, await expenseSplits.list(expense.id)] as const),
        );
        if (!active) return;
        setExpenses(nextExpenses);
        setCategories(nextCategories);
        setBudget(budgets.find((entry) => entry.month_start === monthStart) ?? null);
        setSettlements(nextSettlements);
        setSplitsByExpense(new Map(splitRows));
      })
      .catch(() => {
        if (active) show(t('moneyLoadError'), 'danger');
      });
    return () => {
      active = false;
    };
  }, [expenseBudgets, expenseCategories, expenseRepo, expenseSettlements, expenseSplits, identity, monthEnd, monthStart, show, t]);

  const ledgerExpenses: LedgerExpense[] = expenses.map((expense) => ({
    id: expense.id,
    amount: expense.amount,
    paidBy: expense.paid_by,
    splitType: identity?.partner && expense.split_type === 'shared' ? 'shared' : 'single',
    category: expense.category,
    date: expense.paid_at,
    ...(splitsByExpense.get(expense.id)?.length
      ? {
          shares: splitsByExpense.get(expense.id)!.map((split) => ({
            userId: split.user_id,
            amount: split.amount,
          })),
        }
      : {}),
  }));
  const ledgerSettlements: LedgerSettlement[] = settlements.map((settlement) => ({
    fromUserId: settlement.from_user_id,
    toUserId: settlement.to_user_id,
    amount: settlement.amount,
  }));
  const ledger = useMemo(() => {
    if (!identity) return null;
    const participantIds = identity.partner ? [identity.userId, identity.partner.id] : [identity.userId];
    try {
      return calculateLedger({ userIds: participantIds, expenses: ledgerExpenses, settlements: ledgerSettlements });
    } catch {
      return null;
    }
  }, [identity, ledgerExpenses, ledgerSettlements]);

  const spent = aggregateExpensesByCategory(
    expenses.map((expense) => ({ amount: expense.amount, category: expense.category })),
  ).reduce((total, entry) => total + entry.amount, 0);
  const budgetAmount = budget?.amount ?? 0;
  const budgetPct = budgetAmount > 0 ? Math.min(100, (spent / budgetAmount) * 100) : spent > 0 ? 100 : 0;
  const remaining = Math.max(0, budgetAmount - spent);
  const categoryAmounts = new Map(
    aggregateExpensesByCategory(
      expenses.map((expense) => ({ amount: expense.amount, category: expense.category })),
    ).map((entry) => [entry.category, entry.amount]),
  );
  const categoryNames = uniqueCategoryNames(categories, expenses);
  const recommendation = ledger?.recommendedPayments[0] ?? null;
  const balanceById = new Map(ledger?.balances.map((balance) => [balance.userId, balance]) ?? []);
  const me = identity?.profile ?? null;
  const partner = identity?.partner ?? null;
  const categoryOptions = categoryNames.map((name) => ({ name }));

  const saveExpense = async (draft: ExpenseDraft) => {
    if (!identity) return;
    const paidBy = draft.slot === 'u2' && identity.partner ? identity.partner.id : identity.userId;
    try {
      if (
        draft.category !== '' &&
        !categories.some((category) => category.name.localeCompare(draft.category, undefined, { sensitivity: 'accent' }) === 0)
      ) {
        const createdCategory = await expenseCategories.create({
          calendarId: identity.calendarId,
          createdBy: identity.userId,
          name: draft.category,
          sortOrder: categories.length,
        });
        setCategories((current) => [...current, createdCategory]);
      }
      const created = await expenseRepo.create({
        calendar_id: identity.calendarId,
        title: draft.title,
        amount: draft.amount,
        paid_by: paidBy,
        category: draft.category || null,
        paid_at: draft.paidAt,
        notes: draft.notes || null,
        split_type: draft.split === 'payerOnly' || !identity.partner ? 'single' : 'shared',
      });
      if (draft.customShares && identity.partner) {
        try {
          const splits = await Promise.all([
            ...(draft.customShares.u1 > 0
              ? [expenseSplits.create({ expenseId: created.id, userId: identity.userId, amount: draft.customShares.u1 })]
              : []),
            ...(draft.customShares.u2 > 0
              ? [expenseSplits.create({ expenseId: created.id, userId: identity.partner.id, amount: draft.customShares.u2 })]
              : []),
          ]);
          setSplitsByExpense((current) => new Map(current).set(created.id, splits));
        } catch (error) {
          await expenseRepo.delete(identity.calendarId, created.id).catch(() => undefined);
          throw error;
        }
      }
      setExpenses((current) => [created, ...current]);
      setExpenseOpen(false);
    } catch {
      show(t('moneySaveError'), 'danger');
    }
  };

  const saveBudget = async (amount: number) => {
    if (!identity) return;
    try {
      const next = budget
        ? await expenseBudgets.update({ calendarId: identity.calendarId, id: budget.id, amount })
        : await expenseBudgets.create({
            calendarId: identity.calendarId,
            createdBy: identity.userId,
            monthStart,
            amount,
          });
      setBudget(next);
      setBudgetOpen(false);
    } catch {
      show(t('moneyBudgetSaveError'), 'danger');
    }
  };

  const saveCategory = async ({ name, monthlyLimit }: { name: string; monthlyLimit: number | null }) => {
    if (!identity || categoryEditing === null) return;
    const existing = categories.find((entry) => entry.name === categoryEditing);
    try {
      const next = existing
        ? await expenseCategories.update({
            calendarId: identity.calendarId,
            id: existing.id,
            name,
            monthlyLimit,
          })
        : await expenseCategories.create({
            calendarId: identity.calendarId,
            createdBy: identity.userId,
            name,
            monthlyLimit,
            sortOrder: categories.length,
          });
      setCategories((current) =>
        existing
          ? current.map((entry) => (entry.id === next.id ? next : entry))
          : [...current, next],
      );
      setCategoryEditing(null);
    } catch {
      show(t('moneyCategorySaveError'), 'danger');
    }
  };

  const saveSettlement = async ({ amount, settledAt, notes }: { amount: number; settledAt: string; notes: string }) => {
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
      <AppHeader
        kicker={t('navMoney')}
        title={monthTitle(Number(monthStart.slice(0, 4)), Number(monthStart.slice(5, 7)) - 1, lang)}
        range={{
          onPrev: () => setMonthStart(addDaysIso(monthStart, -1).slice(0, 8) + '01'),
          onNext: () => setMonthStart(nextMonthStart(monthStart)),
          onToday: () => setMonthStart(currentMonthStart()),
          prevLabel: t('calPrevMonth'),
          nextLabel: t('calNextMonth'),
          todayLabel: t('today'),
        }}
      />
      <div className={screen.body}>
        <div className={screen.stack}>
          <Card>
            <div className={styles.budgetHead}>
              <span className={styles.budgetLabel}>
                <SectionLabel>{t('moneyBudget')}</SectionLabel>
              </span>
              <button type="button" className={styles.budgetAction} onClick={() => setBudgetOpen(true)}>
                {budget ? t('moneyEditBudget') : t('moneySetBudget')}
              </button>
            </div>
            <div className={styles.budgetAmounts}>
              <span className={styles.budgetSpent}>{formatEur(spent, lang)}</span>
              <span className={styles.budgetOf}>
                {budgetAmount > 0 ? `${t('moneyOf')} ${formatEur(budgetAmount, lang)}` : t('moneyNoBudget')}
              </span>
            </div>
            <div className={styles.budgetBar}>
              <ProgressBar
                height={9}
                label={t('moneyBudget')}
                segments={[{ widthPct: budgetPct, color: 'var(--brand)' }]}
              />
            </div>
            <div className={styles.budgetRemain}>
              {budgetAmount > 0 ? `${formatEur(remaining, lang)} ${t('moneyRemaining')}` : t('moneyNoBudgetHint')}
            </div>
          </Card>

          <div className={styles.categories}>
            <div className={styles.categoriesHead}>
              <span className={styles.categoriesLabel}>
                <SectionLabel>{t('moneyCategories')}</SectionLabel>
              </span>
              <span className={styles.miniLegend}>
                {(partner
                  ? [
                      { slot: 'u1' as const, label: firstName(me?.name ?? t('me')) },
                      { slot: 'u2' as const, label: firstName(partner.name ?? t('partner')) },
                    ]
                  : [{ slot: 'u1' as const, label: firstName(me?.name ?? t('me')) }]
                ).map(({ slot, label }) => (
                  <span key={slot} className={styles.miniLegendItem}>
                    <span className={styles.miniSwatch} style={{ background: personTokens(slot).bar }} aria-hidden="true" />
                    {label}
                  </span>
                ))}
              </span>
            </div>

            {categoryNames.length === 0 ? (
              <Card padding="12px 14px">{t('moneyNoCategories')}</Card>
            ) : (
              categoryNames.map((name) => {
                const category = categories.find((entry) => entry.name === name);
                const amount = categoryAmounts.get(name) ?? 0;
                const limit = category?.monthly_limit ?? 0;
                const pct = limit > 0 ? Math.min(100, (amount / limit) * 100) : amount > 0 ? 100 : 0;
                const contributors = new Set(
                  expenses.filter((expense) => normalizedCategory(expense.category) === name).map((expense) => expense.paid_by),
                ).size;
                return (
                  <button
                    key={name}
                    type="button"
                    className={styles.category}
                    data-testid="category-row"
                    onClick={() => setCategoryEditing(name)}
                    aria-label={`${displayCategory(name, t('moneyUncategorized'))}: ${t('moneyEditCategory')}`}
                  >
                    <div className={styles.categoryHead}>
                      <span className={styles.categoryName}>{displayCategory(name, t('moneyUncategorized'))}</span>
                      <span className={`${styles.categoryAmount} ${limit > 0 && amount > limit ? styles.categoryOver : ''}`}>
                        {formatEur(amount, lang)}
                      </span>
                      <span className={styles.categoryLimit}>
                        {limit > 0 ? `/ ${formatEur(limit, lang)}` : t('moneyNoLimit')}
                      </span>
                    </div>
                    <div className={styles.categoryBar}>
                      <ProgressBar height={7} label={name} segments={[{ widthPct: pct, color: category?.color ?? 'var(--brand)' }]} />
                    </div>
                    <div className={styles.categoryNote}>
                      {contributors} {t('moneyContributors')}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <Card tone="brand">
            <SectionLabel>{t('moneyBalance')}</SectionLabel>
            <div className={styles.balancePair}>
              {[me, partner].filter((profile): profile is NonNullable<typeof profile> => profile !== null).map((profile, index) => {
                const slot = index === 0 ? 'u1' : 'u2';
                const balance = balanceById.get(profile.id);
                return (
                  <div key={profile.id} className={styles.balanceCard}>
                    <div className={styles.balanceWho}>
                      <span className={styles.balanceDot} style={{ background: personTokens(slot).bar }} aria-hidden="true" />
                      <span className={styles.balanceName}>{firstName(profile.name ?? t('partner'))}</span>
                    </div>
                    <div className={styles.balanceAmount}>{formatEur(balance?.paid ?? 0, lang)}</div>
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
                  {t('moneyAsOf')} {monthTitle(Number(monthStart.slice(0, 4)), Number(monthStart.slice(5, 7)) - 1, lang)} · {expenses.length} {t('moneyExpenses')}
                </div>
              </div>
              <div className={styles.owedAmount}>{formatEur(recommendation?.amount ?? 0, lang)}</div>
            </div>
            <button
              type="button"
              className={styles.settle}
              disabled={!recommendation}
              onClick={() => setSettlementOpen(true)}
            >
              {recommendation ? t('moneySettleUp') : t('moneySettled')}
            </button>
          </Card>

          <Card flush>
            <div className={styles.expensesHead}>
              <SectionLabel>{t('moneyRecentExpenses')}</SectionLabel>
            </div>
            {expenses.length === 0 ? (
              <div className={styles.emptyExpenses}>{t('moneyNoExpenses')}</div>
            ) : (
              expenses.map((expense) => {
                const slot = expense.paid_by === identity?.userId ? 'u1' : 'u2';
                const initial = slot === 'u1' ? firstInitial(me?.name) : firstInitial(partner?.name);
                return (
                  <div key={expense.id} className={styles.expense} data-testid="expense-row">
                    <span className={styles.expenseAvatar} style={{ background: personTokens(slot).bar }} aria-hidden="true">
                      {initial}
                    </span>
                    <div className={styles.expenseBody}>
                      <div className={styles.expenseTitle}>{expense.title}</div>
                      <div className={styles.expenseMeta}>
                        {displayCategory(normalizedCategory(expense.category), t('moneyUncategorized'))} · {formatDate(expense.paid_at, lang)} · {splitsByExpense.get(expense.id)?.length ? t('moneyCustomSplit') : expense.split_type === 'shared' ? '50/50' : t('sheetSplitPayer')}
                      </div>
                    </div>
                    <div className={styles.expenseAmount}>{formatEur(expense.amount, lang)}</div>
                  </div>
                );
              })
            )}
          </Card>
        </div>
      </div>
      <Fab label={t('moneyAddExpense')} onClick={() => setExpenseOpen(true)} />

      <ExpenseSheet
        key={`expense-${expenseOpen}-${categoryNames.join('|')}`}
        open={expenseOpen}
        categories={categoryOptions}
        onClose={() => setExpenseOpen(false)}
        onSave={(draft) => void saveExpense(draft)}
      />
      <BudgetSheet
        key={`budget-${budgetOpen}-${budget?.id ?? 'new'}`}
        open={budgetOpen}
        currentAmount={budget?.amount ?? null}
        onClose={() => setBudgetOpen(false)}
        onSave={(amount) => void saveBudget(amount)}
      />
      {categoryEditing !== null ? (
        <ExpenseCategorySheet
          key={`category-${categoryEditing}`}
          open
          initialName={categoryEditing === 'uncategorized' ? '' : categoryEditing}
          initialLimit={categories.find((entry) => entry.name === categoryEditing)?.monthly_limit ?? null}
          onClose={() => setCategoryEditing(null)}
          onSave={(draft) => void saveCategory(draft)}
        />
      ) : null}
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

function currentMonthStart(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
}

function nextMonthStart(monthStart: string): string {
  const year = Number(monthStart.slice(0, 4));
  const month = Number(monthStart.slice(5, 7));
  const next = new Date(Date.UTC(year, month, 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

function uniqueCategoryNames(categories: readonly ExpenseCategoriesRow[], expenses: readonly SharedExpensesRow[]): string[] {
  return [...new Set([
    ...categories.map((category) => category.name),
    ...expenses.map((expense) => normalizedCategory(expense.category)),
  ])].sort((left, right) => left.localeCompare(right));
}

function normalizedCategory(category: string | null): string {
  const value = category?.trim() ?? '';
  return value === '' ? 'uncategorized' : value;
}

function displayCategory(category: string, uncategorizedLabel: string): string {
  return category === 'uncategorized' ? uncategorizedLabel : category;
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
