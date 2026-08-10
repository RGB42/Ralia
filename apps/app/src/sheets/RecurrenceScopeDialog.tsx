import { Button, Modal } from '@ralia/ui';
import { useT } from '../i18n/useT.js';
import styles from './sheets.module.css';

export type RecurrenceScope = 'occurrence' | 'future' | 'series';

export interface RecurrenceScopeDialogProps {
  open: boolean;
  canChooseFuture: boolean;
  onClose(): void;
  onSelect(scope: RecurrenceScope): void;
}

export function RecurrenceScopeDialog({
  open,
  canChooseFuture,
  onClose,
  onSelect,
}: RecurrenceScopeDialogProps): React.JSX.Element {
  const { t } = useT();
  return (
    <Modal
      open={open}
      onClose={onClose}
      closeLabel={t('sheetClose')}
      title={t('seriesScopeTitle')}
    >
      <div className={styles.fields}>
        <Button fullWidth onClick={() => onSelect('occurrence')}>
          {t('seriesScopeOccurrence')}
        </Button>
        <Button fullWidth disabled={!canChooseFuture} onClick={() => onSelect('future')}>
          {t('seriesScopeFuture')}
        </Button>
        <Button fullWidth variant="secondary" onClick={() => onSelect('series')}>
          {t('seriesScopeAll')}
        </Button>
      </div>
    </Modal>
  );
}
