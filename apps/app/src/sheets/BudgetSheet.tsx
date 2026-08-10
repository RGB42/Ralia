import { BottomSheet, Button, FieldLabel, Input } from '@ralia/ui';
import { parseExpenseAmount } from '@ralia/data';
import { useId, useState } from 'react';
import { useT } from '../i18n/useT.js';
import styles from './sheets.module.css';

export interface BudgetSheetProps {
  open: boolean;
  currentAmount: number | null;
  onClose(): void;
  onSave(amount: number): void;
}

export function BudgetSheet({
  open,
  currentAmount,
  onClose,
  onSave,
}: BudgetSheetProps): React.JSX.Element {
  const { t } = useT();
  const id = useId();
  const [amount, setAmount] = useState(currentAmount === null ? '' : String(currentAmount));
  const save = () => {
    try {
      onSave(parseExpenseAmount(amount));
    } catch {
      // Keep the draft visible until a valid cent-precise amount is entered.
    }
  };
  return (
    <BottomSheet open={open} onClose={onClose} closeLabel={t('sheetClose')} title={t('moneySetBudget')}>
      <div className={styles.fields}>
        <div>
          <FieldLabel htmlFor={id}>{t('moneyBudget')}</FieldLabel>
          <Input id={id} value={amount} onChange={setAmount} inputMode="decimal" placeholder="0,00" />
        </div>
        <div className={styles.actions}>
          <Button fullWidth onClick={save}>
            {t('sheetSave')}
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
}
