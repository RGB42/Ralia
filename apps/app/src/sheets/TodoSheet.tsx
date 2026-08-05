import { BottomSheet, Button, Card, Chip, FieldLabel, Input, PersonChip } from '@ralia/ui';
import type { PersonSlot } from '@ralia/ui';
import { useId, useState } from 'react';
import { useT } from '../i18n/useT.js';
import { MOCK_PROFILE, type MockTodoItem, type MockTodoList } from '../mock/fixtures.js';
import styles from './sheets.module.css';
import { findDuplicate } from './todo-duplicate.js';

export interface TodoDraft {
  text: string;
  note: string;
  listId: string;
  slot: PersonSlot;
}

export interface TodoSheetProps {
  open: boolean;
  lists: readonly MockTodoList[];
  defaultListId: string;
  existing: readonly MockTodoItem[];
  onClose(): void;
  onSave(draft: TodoDraft): void;
  /** Vorhandenen Treffer anzeigen bzw. wieder oeffnen. */
  onReveal?(item: MockTodoItem): void;
}

/** Vorlage Z. 859–898. */
export function TodoSheet({
  open,
  lists,
  defaultListId,
  existing,
  onClose,
  onSave,
  onReveal,
}: TodoSheetProps): React.JSX.Element {
  const { t } = useT();
  const baseId = useId();
  const [text, setText] = useState('');
  const [note, setNote] = useState('');
  const [listId, setListId] = useState(defaultListId);
  const [slot, setSlot] = useState<PersonSlot>('u1');

  const duplicate = findDuplicate(text, listId, existing);

  const submitLabel =
    duplicate.kind === 'open'
      ? t('sheetShowExisting')
      : duplicate.kind === 'done'
        ? t('sheetReopenEntry')
        : t('sheetAddToList');

  const submit = () => {
    if (text.trim() === '') return;
    if (duplicate.match) {
      onReveal?.(duplicate.match);
      return;
    }
    onSave({ text: text.trim(), note: note.trim(), listId, slot });
  };

  const people: readonly { slot: PersonSlot; label: string }[] = [
    { slot: 'u1', label: MOCK_PROFILE.me.name.split(' ')[0] ?? 'u1' },
    { slot: 'u2', label: MOCK_PROFILE.partner.name.split(' ')[0] ?? 'u2' },
  ];

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      closeLabel={t('sheetClose')}
      title={t('sheetNewTodo')}
    >
      <div className={styles.fields}>
        <div>
          <FieldLabel>{t('sheetList')}</FieldLabel>
          <div className={styles.chips}>
            {lists.map((list) => (
              <span key={list.id} data-testid="list-chip">
                <Chip
                  active={list.id === listId}
                  label={list.title}
                  onClick={() => setListId(list.id)}
                />
              </span>
            ))}
          </div>
        </div>

        <div>
          <FieldLabel htmlFor={`${baseId}-text`}>{t('sheetEntry')}</FieldLabel>
          <Input id={`${baseId}-text`} value={text} onChange={setText} />
        </div>

        {duplicate.kind !== 'none' ? (
          // role=alert: die Vorlage nutzt nur eine gefaerbte Box, die
          // Screenreader nicht ankuendigen.
          <div role="alert">
            <Card tone="warn" padding="10px 12px">
              {duplicate.kind === 'open' ? t('sheetDupOpen') : t('sheetDupDone')}
            </Card>
          </div>
        ) : null}

        <div>
          <FieldLabel htmlFor={`${baseId}-note`}>{t('sheetNote')}</FieldLabel>
          <Input
            id={`${baseId}-note`}
            value={note}
            onChange={setNote}
            placeholder={t('sheetOptional')}
          />
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
          <Button fullWidth onClick={submit}>
            {submitLabel}
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
}
