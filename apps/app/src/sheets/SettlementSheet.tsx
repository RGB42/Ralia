import { BottomSheet, Button, FieldLabel, Input, Textarea } from '@ralia/ui';
import { parseExpenseAmount } from '@ralia/data';
import { useId, useState } from 'react';
import { useT } from '../i18n/useT.js';
import styles from './sheets.module.css';

export interface SettlementDraft {
  amount: number;
  settledAt: string;
  notes: string;
}

export interface SettlementSheetProps {
  open: boolean;
  fromName: string;
  toName: string;
  suggestedAmount: number;
  onClose(): void;
  onSave(draft: SettlementDraft): void;
}

export function SettlementSheet({
  open,
  fromName,
  toName,
  suggestedAmount,
  onClose,
  onSave,
}: SettlementSheetProps): React.JSX.Element {
  const { t } = useT();
  const id = useId();
  const [amount, setAmount] = useState(String(suggestedAmount));
  const [date, setDate] = useState(localTodayIso);
  const [notes, setNotes] = useState('');
  const save = () => {
    try {
      onSave({ amount: parseExpenseAmount(amount), settledAt: date, notes: notes.trim() });
    } catch {
      // Keep invalid input in place rather than creating a rounded transaction.
    }
  };
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      closeLabel={t('sheetClose')}
      title={t('moneySettleUp')}
    >
      <div className={styles.fields}>
        <div className={styles.noteBox}>
          {fromName} → {toName}
        </div>
        <div>
          <FieldLabel htmlFor={`${id}-amount`}>{t('sheetAmount')}</FieldLabel>
          <Input
            id={`${id}-amount`}
            value={amount}
            onChange={setAmount}
            inputMode="decimal"
            placeholder="0,00"
          />
        </div>
        <div>
          <FieldLabel htmlFor={`${id}-date`}>{t('moneyDate')}</FieldLabel>
          <Input id={`${id}-date`} type="date" value={date} onChange={setDate} />
        </div>
        <div>
          <FieldLabel htmlFor={`${id}-notes`}>{t('notes')}</FieldLabel>
          <Textarea
            id={`${id}-notes`}
            value={notes}
            onChange={setNotes}
            rows={2}
            placeholder={t('sheetOptional')}
          />
        </div>
        <div className={styles.actions}>
          <Button fullWidth onClick={save}>
            {t('moneySettleUp')}
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
