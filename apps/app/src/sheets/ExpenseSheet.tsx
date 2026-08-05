import { BottomSheet, Button, Chip, FieldLabel, Input, PersonChip } from '@ralia/ui';
import type { PersonSlot } from '@ralia/ui';
import { useId, useState } from 'react';
import { useT } from '../i18n/useT.js';
import { MOCK_PROFILE, type MockCategory } from '../mock/fixtures.js';
import styles from './sheets.module.css';

export type SplitMode = 'even' | 'payerOnly' | 'shared';

export interface ExpenseDraft {
  title: string;
  amount: number;
  category: string;
  slot: PersonSlot;
  split: SplitMode;
}

export interface ExpenseSheetProps {
  open: boolean;
  categories: readonly MockCategory[];
  onClose(): void;
  onSave(draft: ExpenseDraft): void;
}

/**
 * Betrag tolerant lesen: 42,50 und 42.50 meinen dasselbe, und ein deutsches
 * Tastenfeld liefert das Komma. `Number.parseFloat` allein wuerde bei 42,50
 * still 42 ergeben — ein stiller Rechenfehler in einer Haushaltskasse.
 */
export function parseAmount(raw: string): number | null {
  const normalized = raw.trim().replace(',', '.');
  if (normalized === '') return null;
  const value = Number.parseFloat(normalized);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 100) / 100;
}

/** Vorlage Z. 901–947. */
export function ExpenseSheet({
  open,
  categories,
  onClose,
  onSave,
}: ExpenseSheetProps): React.JSX.Element {
  const { t } = useT();
  const baseId = useId();
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(categories[0]?.name ?? '');
  const [slot, setSlot] = useState<PersonSlot>('u1');
  const [split, setSplit] = useState<SplitMode>('even');

  const payers: readonly { slot: PersonSlot; label: string }[] = [
    { slot: 'u1', label: MOCK_PROFILE.me.name.split(' ')[0] ?? 'u1' },
    { slot: 'u2', label: MOCK_PROFILE.partner.name.split(' ')[0] ?? 'u2' },
    { slot: 'both', label: t('sheetJointAccount') },
  ];

  const splits: readonly { value: SplitMode; label: string }[] = [
    { value: 'even', label: t('sheetSplitEven') },
    { value: 'payerOnly', label: t('sheetSplitPayer') },
    { value: 'shared', label: t('sheetSplitShared') },
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
              onSave({ title: title.trim(), amount: value, category, slot, split });
            }}
          >
            {t('sheetSaveExpense')}
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
}
