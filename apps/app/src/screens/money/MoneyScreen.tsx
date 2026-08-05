import { AppHeader, Card, Fab, ProgressBar, SectionLabel, personTokens } from '@ralia/ui';
import { useState } from 'react';
import { useT } from '../../i18n/useT.js';
import { MOCK_BALANCE, MOCK_CATEGORIES, MOCK_EXPENSES, MOCK_PROFILE } from '../../mock/fixtures.js';
import { ExpenseSheet } from '../../sheets/ExpenseSheet.js';
import screen from '../screen.module.css';
import styles from './MoneyScreen.module.css';
import { budgetSummary, categoryTotals, formatEur } from './money-math.js';

const INITIAL_BY_SLOT: Record<string, string> = {
  u1: MOCK_PROFILE.me.initial,
  u2: MOCK_PROFILE.partner.initial,
  both: '∞',
  bday: '·',
};

export function MoneyScreen(): React.JSX.Element {
  const { t, lang } = useT();
  const [settled, setSettled] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);

  const summary = budgetSummary(MOCK_CATEGORIES, MOCK_BALANCE.monthlyBudget);
  const totals = categoryTotals(MOCK_CATEGORIES);
  const firstName = (full: string) => full.split(' ')[0] ?? full;

  return (
    <div className={screen.screen}>
      <AppHeader kicker={t('navMoney')} title={t('moneyTitle')} />
      <div className={screen.body}>
        <div className={screen.stack}>
          <Card>
            <div className={styles.budgetHead}>
              <span className={styles.budgetLabel}>
                <SectionLabel>{t('moneyBudget')}</SectionLabel>
              </span>
              <span className={styles.budgetPct}>{Math.round(summary.pct)} %</span>
            </div>
            <div className={styles.budgetAmounts}>
              <span className={styles.budgetSpent}>{formatEur(summary.spent, lang)}</span>
              <span className={styles.budgetOf}>
                {t('moneyOf')} {formatEur(MOCK_BALANCE.monthlyBudget, lang)}
              </span>
            </div>
            <div className={styles.budgetBar}>
              <ProgressBar
                height={9}
                label={t('moneyBudget')}
                segments={[{ widthPct: summary.pct, color: 'var(--brand)' }]}
              />
            </div>
            <div className={styles.budgetRemain}>
              {formatEur(summary.remaining, lang)} {t('moneyRemaining')}
            </div>
          </Card>

          <div className={styles.categories}>
            <div className={styles.categoriesHead}>
              <span className={styles.categoriesLabel}>
                <SectionLabel>{t('moneyCategories')}</SectionLabel>
              </span>
              <span className={styles.miniLegend}>
                {(
                  [
                    ['u1', firstName(MOCK_PROFILE.me.name)],
                    ['u2', firstName(MOCK_PROFILE.partner.name)],
                    ['both', t('moneyShared')],
                  ] as const
                ).map(([slot, label]) => (
                  <span key={slot} className={styles.miniLegendItem}>
                    <span
                      className={styles.miniSwatch}
                      style={{ background: personTokens(slot).bar }}
                      aria-hidden="true"
                    />
                    {label}
                  </span>
                ))}
              </span>
            </div>

            {totals.map((category) => (
              <div key={category.name} className={styles.category} data-testid="category-row">
                <div className={styles.categoryHead}>
                  <span className={styles.categoryName}>{category.name}</span>
                  <span
                    className={`${styles.categoryAmount} ${
                      category.spent > category.limit ? styles.categoryOver : ''
                    }`}
                  >
                    {formatEur(category.spent, lang)}
                  </span>
                  <span className={styles.categoryLimit}>/ {formatEur(category.limit, lang)}</span>
                </div>
                <div className={styles.categoryBar}>
                  <ProgressBar height={7} label={category.name} segments={category.segments} />
                </div>
                <div className={styles.categoryNote}>
                  {category.segments.length} {t('moneyContributors')}
                </div>
              </div>
            ))}
          </div>

          <Card tone="brand">
            <SectionLabel>{t('moneyBalance')}</SectionLabel>
            <div className={styles.balancePair}>
              {(
                [
                  ['u1', firstName(MOCK_PROFILE.me.name), MOCK_BALANCE.u1Total],
                  ['u2', firstName(MOCK_PROFILE.partner.name), MOCK_BALANCE.u2Total],
                ] as const
              ).map(([slot, name, total]) => (
                <div key={slot} className={styles.balanceCard}>
                  <div className={styles.balanceWho}>
                    <span
                      className={styles.balanceDot}
                      style={{ background: personTokens(slot).bar }}
                      aria-hidden="true"
                    />
                    <span className={styles.balanceName}>{name}</span>
                  </div>
                  <div className={styles.balanceAmount}>{formatEur(total, lang)}</div>
                </div>
              ))}
            </div>
            <div className={styles.owed}>
              <div className={styles.owedText}>
                <div className={styles.owedTitle}>{MOCK_BALANCE.owedLabel}</div>
                <div className={styles.owedHint}>
                  {t('moneyAsOf')} 29. Juli · {MOCK_BALANCE.expenseCount} {t('moneyExpenses')}
                </div>
              </div>
              <div className={styles.owedAmount}>{formatEur(MOCK_BALANCE.owedAmount, lang)}</div>
            </div>
            <button type="button" className={styles.settle} onClick={() => setSettled(true)}>
              {settled ? t('moneySettled') : t('moneySettleUp')}
            </button>
          </Card>

          <Card flush>
            <div className={styles.expensesHead}>
              <SectionLabel>{t('moneyRecentExpenses')}</SectionLabel>
            </div>
            {MOCK_EXPENSES.map((expense) => (
              <div key={expense.title} className={styles.expense} data-testid="expense-row">
                <span
                  className={styles.expenseAvatar}
                  style={{ background: personTokens(expense.slot).bar }}
                  aria-hidden="true"
                >
                  {INITIAL_BY_SLOT[expense.slot] ?? '?'}
                </span>
                <div className={styles.expenseBody}>
                  <div className={styles.expenseTitle}>{expense.title}</div>
                  <div className={styles.expenseMeta}>
                    {expense.category} · {expense.date} · {expense.split}
                  </div>
                </div>
                <div className={styles.expenseAmount}>{formatEur(expense.amount, lang)}</div>
              </div>
            ))}
          </Card>
        </div>
      </div>
      <Fab label={t('moneyAddExpense')} onClick={() => setExpenseOpen(true)} />

      <ExpenseSheet
        key={`expense-${expenseOpen}`}
        open={expenseOpen}
        categories={MOCK_CATEGORIES}
        onClose={() => setExpenseOpen(false)}
        onSave={() => setExpenseOpen(false)}
      />
    </div>
  );
}
