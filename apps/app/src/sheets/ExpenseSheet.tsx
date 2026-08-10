import { BottomSheet, Button, Chip, FieldLabel, Input, PersonChip, Textarea } from '@ralia/ui';
import type { PersonSlot } from '@ralia/ui';
import { parseExpenseAmount } from '@ralia/data';
import { useContext, useId, useState } from 'react';
import { AuthContext } from '../auth/AuthProvider.js';
import { useT } from '../i18n/useT.js';
import styles from './sheets.module.css';

export type SplitMode = 'even' | 'payerOnly' | 'custom';

export interface ExpenseCategoryOption {
  name: string;
}

export interface ExpenseDraft {
  title: string;
  amount: number;
  category: string;
  slot: PersonSlot;
  split: SplitMode;
  paidAt: string;
  notes: string;
  customShares?: { u1: number; u2: number };
}

export interface ExpenseSheetProps {
  open: boolean;
  categories: readonly ExpenseCategoryOption[];
  onClose(): void;
  onSave(draft: ExpenseDraft): void;
}

/**
 * Betrag tolerant lesen: 42,50 und 42.50 meinen dasselbe, und ein deutsches
 * Tastenfeld liefert das Komma. `Number.parseFloat` allein wuerde bei 42,50
 * still 42 ergeben — ein stiller Rechenfehler in einer Haushaltskasse.
 */
export function parseAmount(raw: string): number | null {
  try {
    return parseExpenseAmount(raw);
  } catch {
    return null;
  }
}

/** Vorlage Z. 901–947. */
export function ExpenseSheet({
  open,
  categories,
  onClose,
  onSave,
}: ExpenseSheetProps): React.JSX.Element {
  const { t } = useT();
  const auth = useContext(AuthContext);
  const baseId = useId();
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(categories[0]?.name ?? '');
  const [slot, setSlot] = useState<PersonSlot>('u1');
  const [split, setSplit] = useState<SplitMode>('even');
  const [paidAt, setPaidAt] = useState(localTodayIso);
  const [notes, setNotes] = useState('');
  const [u1Share, setU1Share] = useState('');
  const [u2Share, setU2Share] = useState('');

  const identity = auth?.session.status === 'signed-in' ? auth.session.identity : null;
  const payers: readonly { slot: PersonSlot; label: string }[] = [
    { slot: 'u1', label: identity?.profile.name?.split(' ')[0] || t('me') },
    ...(identity?.partner
      ? [{ slot: 'u2' as const, label: identity.partner.name?.split(' ')[0] || t('partner') }]
      : []),
  ];

  const splits: readonly { value: SplitMode; label: string }[] = [
    { value: 'even', label: t('sheetSplitEven') },
    { value: 'payerOnly', label: t('sheetSplitPayer') },
    ...(identity?.partner ? [{ value: 'custom' as const, label: t('moneyCustomSplit') }] : []),
  ];

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      closeLabel={t('sheetClose')}
      title={t('sheetNewExpense')}
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

        {split === 'custom' ? (
          <div className={styles.row}>
            <div className={styles.rowGrow}>
              <FieldLabel htmlFor={`${baseId}-share-u1`}>{payers[0]?.label ?? t('me')}</FieldLabel>
              <Input
                id={`${baseId}-share-u1`}
                value={u1Share}
                onChange={setU1Share}
                inputMode="decimal"
                placeholder="0,00"
              />
            </div>
            <div className={styles.rowGrow}>
              <FieldLabel htmlFor={`${baseId}-share-u2`}>{payers[1]?.label ?? t('partner')}</FieldLabel>
              <Input
                id={`${baseId}-share-u2`}
                value={u2Share}
                onChange={setU2Share}
                inputMode="decimal"
                placeholder="0,00"
              />
            </div>
          </div>
        ) : null}

        <div className={styles.row}>
          <div className={styles.rowGrow}>
            <FieldLabel htmlFor={`${baseId}-paid-at`}>{t('moneyDate')}</FieldLabel>
            <Input
              id={`${baseId}-paid-at`}
              type="date"
              value={paidAt}
              onChange={setPaidAt}
            />
          </div>
        </div>

        <div>
          <FieldLabel>{t('sheetPaidBy')}</FieldLabel>
          {/*
           * Gruppen mit Namen: „Gem. Konto" gibt es zweimal in diesem Formular
           * — als Zahler und als Aufteilung. Ohne Gruppenname sind die zwei
           * Knoepfe fuer einen Screenreader nicht zu unterscheiden.
           */}
          <div className={styles.people} role="group" aria-label={t('sheetPaidBy')}>
            {payers.map((payer) => (
              <PersonChip
                key={payer.slot}
                slot={payer.slot}
                active={slot === payer.slot}
                label={payer.label}
                onClick={() => setSlot(payer.slot)}
              />
            ))}
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

        <div>
          <FieldLabel>{t('sheetSplit')}</FieldLabel>
          <div className={styles.chips} role="group" aria-label={t('sheetSplit')}>
            {splits.map((entry) => (
              <span key={entry.value} data-testid="split-chip">
                <Chip
                  active={entry.value === split}
                  label={entry.label}
                  onClick={() => setSplit(entry.value)}
                />
              </span>
            ))}
          </div>
        </div>

        <div className={styles.noteBox}>{t('sheetExpenseNote')}</div>

        <div className={styles.actions}>
          <Button
            fullWidth
            onClick={() => {
              const value = parseAmount(amount);
              if (title.trim() === '' || value === null) return;
              const customU1 = split === 'custom' ? parseAmount(u1Share) : null;
              const customU2 = split === 'custom' ? parseAmount(u2Share) : null;
              if (
                split === 'custom' &&
                (customU1 === null || customU2 === null || Math.round((customU1 + customU2) * 100) !== Math.round(value * 100))
              ) {
                return;
              }
              onSave({
                title: title.trim(),
                amount: value,
                category: category.trim(),
                slot,
                split,
                paidAt,
                notes: notes.trim(),
                ...(split === 'custom' && customU1 !== null && customU2 !== null
                  ? { customShares: { u1: customU1, u2: customU2 } }
                  : {}),
              });
            }}
          >
            {t('sheetSaveExpense')}
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
