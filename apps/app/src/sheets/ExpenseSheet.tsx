import { BottomSheet, Button, Chip, FieldLabel, Input, PersonChip, Textarea } from '@ralia/ui';
import type { PersonSlot } from '@ralia/ui';
import { parseExpenseAmount } from '@ralia/data';
import { useContext, useId, useState } from 'react';
import { AuthContext } from '../auth/AuthProvider.js';
import { useT } from '../i18n/useT.js';
import styles from './sheets.module.css';

export type ExpenseRecipient = 'self' | 'partner' | 'both';

export interface ExpenseCategoryOption {
  name: string;
}

export interface ExpenseDraft {
  title: string;
  amount: number;
  category: string;
  paidBy: PersonSlot;
  recipient: ExpenseRecipient;
  paidAt: string;
  notes: string;
}

export interface ExpenseSheetProps {
  open: boolean;
  categories: readonly ExpenseCategoryOption[];
  initial?: ExpenseDraft | undefined;
  onClose(): void;
  onSave(draft: ExpenseDraft): void;
}

/** Betrag tolerant lesen: 42,50 und 42.50 meinen dasselbe. */
export function parseAmount(raw: string): number | null {
  try {
    return parseExpenseAmount(raw);
  } catch {
    return null;
  }
}

export function ExpenseSheet({
  open,
  categories,
  initial,
  onClose,
  onSave,
}: ExpenseSheetProps): React.JSX.Element {
  const { t } = useT();
  const auth = useContext(AuthContext);
  const baseId = useId();
  const identity = auth?.session.status === 'signed-in' ? auth.session.identity : null;
  const [title, setTitle] = useState(initial?.title ?? '');
  const [amount, setAmount] = useState(initial ? String(initial.amount).replace('.', ',') : '');
  const [category, setCategory] = useState(initial?.category ?? categories[0]?.name ?? '');
  const [paidBy, setPaidBy] = useState<PersonSlot>(initial?.paidBy ?? 'u1');
  const [recipient, setRecipient] = useState<ExpenseRecipient>(initial?.recipient ?? 'both');
  const [paidAt, setPaidAt] = useState(initial?.paidAt ?? localTodayIso);
  const [notes, setNotes] = useState(initial?.notes ?? '');

  const people: readonly { slot: PersonSlot; label: string }[] = [
    { slot: 'u1', label: identity?.profile.name?.split(' ')[0] || t('me') },
    ...(identity?.partner
      ? [{ slot: 'u2' as const, label: identity.partner.name?.split(' ')[0] || t('partner') }]
      : []),
  ];
  const recipients: readonly { value: ExpenseRecipient; label: string }[] = [
    { value: 'self', label: t('sheetForSelf') },
    ...(identity?.partner
      ? [
          { value: 'partner' as const, label: t('sheetForPartner') },
          { value: 'both' as const, label: t('sheetForBoth') },
        ]
      : []),
  ];
  const validRecipient = recipients.some((entry) => entry.value === recipient) ? recipient : 'self';

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      closeLabel={t('sheetClose')}
      title={initial ? t('sheetEditExpense') : t('sheetNewExpense')}
    >
      <div className={styles.fields}>
        <div className={styles.row}>
          <div className={styles.rowGrow}>
            <FieldLabel htmlFor={`${baseId}-title`}>{t('sheetDescription')}</FieldLabel>
            <Input id={`${baseId}-title`} value={title} onChange={setTitle} />
          </div>
          <div className={styles.rowNarrow}>
            <FieldLabel htmlFor={`${baseId}-amount`}>{t('sheetAmount')}</FieldLabel>
            <Input
              id={`${baseId}-amount`}
              value={amount}
              onChange={setAmount}
              inputMode="decimal"
              placeholder="0,00"
            />
          </div>
        </div>

        <div>
          <FieldLabel>{t('moneyCategories')}</FieldLabel>
          <div className={styles.chips} role="group" aria-label={t('moneyCategories')}>
            {categories.map((entry) => (
              <span key={entry.name} data-testid="category-chip">
                <Chip
                  active={entry.name === category}
                  label={entry.name}
                  onClick={() => setCategory(entry.name)}
                />
              </span>
            ))}
          </div>
          <Input
            ariaLabel={t('moneyCategories')}
            value={category}
            onChange={setCategory}
            placeholder={t('moneyCategoryPlaceholder')}
          />
        </div>

        <div>
          <FieldLabel>{t('sheetPaidBy')}</FieldLabel>
          <div className={styles.people} role="group" aria-label={t('sheetPaidBy')}>
            {people.map((person) => (
              <PersonChip
                key={person.slot}
                slot={person.slot}
                active={paidBy === person.slot}
                label={person.label}
                onClick={() => setPaidBy(person.slot)}
              />
            ))}
          </div>
        </div>

        <div>
          <FieldLabel>{t('sheetForWhom')}</FieldLabel>
          <div className={styles.chips} role="group" aria-label={t('sheetForWhom')}>
            {recipients.map((entry) => (
              <span key={entry.value} data-testid="recipient-chip">
                <Chip
                  active={entry.value === validRecipient}
                  label={entry.label}
                  onClick={() => setRecipient(entry.value)}
                />
              </span>
            ))}
          </div>
        </div>

        <div className={styles.row}>
          <div className={styles.rowGrow}>
            <FieldLabel htmlFor={`${baseId}-paid-at`}>{t('moneyDate')}</FieldLabel>
            <Input id={`${baseId}-paid-at`} type="date" value={paidAt} onChange={setPaidAt} />
          </div>
        </div>

        <div>
          <FieldLabel htmlFor={`${baseId}-notes`}>{t('notes')}</FieldLabel>
          <Textarea
            id={`${baseId}-notes`}
            value={notes}
            onChange={setNotes}
            rows={2}
            placeholder={t('sheetOptional')}
          />
        </div>

        <div className={styles.noteBox}>{t('sheetExpenseNote')}</div>

        <div className={styles.actions}>
          <Button
            fullWidth
            onClick={() => {
              const value = parseAmount(amount);
              if (title.trim() === '' || category.trim() === '' || value === null) return;
              onSave({
                title: title.trim(),
                amount: value,
                category: category.trim(),
                paidBy,
                recipient: validRecipient,
                paidAt,
                notes: notes.trim(),
              });
            }}
          >
            {initial ? t('sheetSave') : t('sheetSaveExpense')}
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
}

function localTodayIso(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}
