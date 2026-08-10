import { BottomSheet, Button, FieldLabel, Input } from '@ralia/ui';
import { parseExpenseAmount } from '@ralia/data';
import { useId, useState } from 'react';
import { useT } from '../i18n/useT.js';
import styles from './sheets.module.css';

export interface ExpenseCategoryDraft {
  name: string;
  monthlyLimit: number | null;
}

export interface ExpenseCategorySheetProps {
  open: boolean;
  initialName: string;
  initialLimit: number | null;
  onClose(): void;
  onSave(draft: ExpenseCategoryDraft): void;
}

export function ExpenseCategorySheet({
  open,
  initialName,
  initialLimit,
  onClose,
  onSave,
}: ExpenseCategorySheetProps): React.JSX.Element {
  const { t } = useT();
  const id = useId();
  const [name, setName] = useState(initialName);
  const [limit, setLimit] = useState(initialLimit === null ? '' : String(initialLimit));
  const save = () => {
    if (name.trim() === '') return;
    try {
      onSave({
        name: name.trim(),
        monthlyLimit: limit.trim() === '' ? null : parseExpenseAmount(limit),
      });
    } catch {
      // Preserve the field values until a valid cent-precise limit is entered.
    }
  };
  return (
    <BottomSheet open={open} onClose={onClose} closeLabel={t('sheetClose')} title={t('moneyEditCategory')}>
      <div className={styles.fields}>
        <div>
          <FieldLabel htmlFor={`${id}-name`}>{t('moneyCategoryName')}</FieldLabel>
          <Input id={`${id}-name`} value={name} onChange={setName} />
        </div>
        <div>
          <FieldLabel htmlFor={`${id}-limit`}>{t('moneyCategoryLimit')}</FieldLabel>
          <Input
            id={`${id}-limit`}
            value={limit}
            onChange={setLimit}
            inputMode="decimal"
            placeholder={t('moneyNoLimit')}
          />
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
