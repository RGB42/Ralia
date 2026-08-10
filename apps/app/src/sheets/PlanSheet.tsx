import { BottomSheet, Button, Chip, FieldLabel, Input, PersonChip } from '@ralia/ui';
import type { PersonSlot } from '@ralia/ui';
import { useContext, useId, useState } from 'react';
import { AuthContext } from '../auth/AuthProvider.js';
import { useT } from '../i18n/useT.js';
import styles from './sheets.module.css';

export type PlanEntryKind = 'meal' | 'task';

export interface PlanDraft {
  kind: PlanEntryKind;
  dayIndex: number;
  text: string;
  slot: PersonSlot;
}

export interface PlanSheetProps {
  open: boolean;
  days: readonly { iso: string; label: string }[];
  defaultDayIndex?: number;
  defaultKind?: PlanEntryKind;
  initialText?: string;
  onClose(): void;
  onSave(draft: PlanDraft): void;
}

/** Vorlage Z. 819–856. */
export function PlanSheet({
  open,
  days,
  defaultDayIndex = 0,
  defaultKind = 'meal',
  initialText = '',
  onClose,
  onSave,
}: PlanSheetProps): React.JSX.Element {
  const { t } = useT();
  const auth = useContext(AuthContext);
  const baseId = useId();
  const [kind, setKind] = useState<PlanEntryKind>(defaultKind);
  const [dayIndex, setDayIndex] = useState(defaultDayIndex);
  const [text, setText] = useState(initialText);
  const [slot, setSlot] = useState<PersonSlot>('u1');

  const identity = auth?.session.status === 'signed-in' ? auth.session.identity : null;
  const people: readonly { slot: PersonSlot; label: string }[] = [
    { slot: 'u1', label: identity?.profile.name?.split(' ')[0] || t('me') },
    { slot: 'u2', label: identity?.partner?.name?.split(' ')[0] || t('partner') },
    { slot: 'both', label: t('calLegendBoth') },
  ];

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      closeLabel={t('sheetClose')}
      title={t('sheetPlanEntry')}
    >
      <div className={styles.fields}>
        {/* Grosze Chips, kein SegmentSwitch: die Vorlage zeigt sie so (Z. 823). */}
        <div className={styles.modeChips}>
          {(
            [
              ['meal', t('plannerMeal')],
              ['task', t('plannerAddTask')],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={kind === value}
              className={`${styles.modeChip} ${kind === value ? styles.modeChipActive : ''}`}
              onClick={() => setKind(value)}
            >
              {label}
            </button>
          ))}
        </div>

        <div>
          <FieldLabel>{t('sheetDay')}</FieldLabel>
          <div className={styles.chips}>
            {days.map((day, index) => (
              <span key={day.iso} data-testid="plan-day-chip">
                <Chip
                  active={index === dayIndex}
                  label={day.label}
                  onClick={() => setDayIndex(index)}
                />
              </span>
            ))}
          </div>
        </div>

        <div>
          <FieldLabel htmlFor={`${baseId}-text`}>
            {kind === 'meal' ? t('sheetMealText') : t('sheetTaskText')}
          </FieldLabel>
          <Input
            id={`${baseId}-text`}
            value={text}
            onChange={setText}
            placeholder={kind === 'meal' ? t('sheetMealPlaceholder') : t('sheetTaskPlaceholder')}
          />
        </div>

        {kind === 'task' ? (
          <div>
            <FieldLabel>{t('sheetWhoDoesIt')}</FieldLabel>
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
        ) : null}

        <div className={styles.actions}>
          <Button
            fullWidth
            onClick={() => {
              if (text.trim() === '') return;
              onSave({ kind, dayIndex, text: text.trim(), slot });
            }}
          >
            {t('sheetSave')}
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
}
