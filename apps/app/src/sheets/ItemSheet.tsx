import { BottomSheet, Button, FieldLabel, Input, PersonChip } from '@ralia/ui';
import type { PersonSlot } from '@ralia/ui';
import { useId, useState } from 'react';
import { useAuth } from '../auth/useAuth.js';
import { useT } from '../i18n/useT.js';
import type { MockTodoItem } from '../mock/fixtures.js';
import styles from './sheets.module.css';

export interface ItemSheetProps {
  open: boolean;
  item: MockTodoItem | null;
  onClose(): void;
  onSave(next: MockTodoItem): void;
  onDelete(): void;
}

/** Vorlage Z. 785–816. Die Vorlage begrenzt dieses Sheet nicht in der Hoehe. */
export function ItemSheet({
  open,
  item,
  onClose,
  onSave,
  onDelete,
}: ItemSheetProps): React.JSX.Element | null {
  const { t } = useT();
  const { session } = useAuth();
  const baseId = useId();
  const [text, setText] = useState(item?.text ?? '');
  const [note, setNote] = useState(item?.note ?? '');
  const [slot, setSlot] = useState<PersonSlot>(item?.slot ?? 'u1');

  if (!item) return null;

  const identity = session.status === 'signed-in' ? session.identity : null;
  const people: readonly { slot: PersonSlot; label: string }[] = [
    { slot: 'u1', label: firstName(identity?.profile.name ?? t('me')) },
    ...(identity?.partner
      ? [{ slot: 'u2' as const, label: firstName(identity.partner.name ?? t('partner')) }]
      : []),
  ];

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      maxHeight="none"
      closeLabel={t('sheetClose')}
      title={t('sheetEditEntry')}
    >
      <div className={styles.fields}>
        <div className={styles.row}>
          <div className={styles.rowGrow}>
            <FieldLabel htmlFor={`${baseId}-text`}>{t('sheetEntry')}</FieldLabel>
            <Input id={`${baseId}-text`} value={text} onChange={setText} />
          </div>
          <div className={styles.rowNarrow}>
            <FieldLabel htmlFor={`${baseId}-note`}>{t('sheetNote')}</FieldLabel>
            <Input id={`${baseId}-note`} value={note} onChange={setNote} />
          </div>
        </div>

        <div>
          <FieldLabel>{t('sheetAssignedTo')}</FieldLabel>
          <div className={styles.people}>
            {people.map((person) => (
              <PersonChip
                key={person.slot}
                slot={person.slot}
                active={slot === person.slot}
                label={person.label}
                onClick={() => setSlot(person.slot)}
              />
            ))}
          </div>
        </div>

        <div className={styles.actions}>
          <Button variant="danger" onClick={onDelete}>
            {t('sheetDelete')}
          </Button>
          <span className={styles.actionsGrow}>
            <Button
              fullWidth
              onClick={() => {
                if (text.trim() === '') return;
                onSave({ ...item, text: text.trim(), note: note.trim(), slot });
              }}
            >
              {t('sheetSave')}
            </Button>
          </span>
        </div>
      </div>
    </BottomSheet>
  );
}

function firstName(value: string): string {
  return value.split(' ')[0] || value;
}
