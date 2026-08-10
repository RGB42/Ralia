import type { RecurrenceType } from '@ralia/data';
import {
  Button,
  FieldLabel,
  Input,
  ListRow,
  PersonChip,
  Select,
  Textarea,
  Toggle,
} from '@ralia/ui';
import type { PersonSlot } from '@ralia/ui';
import { useContext, useId, useState } from 'react';
import { AuthContext } from '../auth/AuthProvider.js';
import { useT } from '../i18n/useT.js';
import styles from './sheets.module.css';

export interface EventDraft {
  title: string;
  iso: string;
  time: string;
  endIso: string;
  endTime: string;
  allDay: boolean;
  slot: PersonSlot;
  location: string;
  notes: string;
  recurrenceType: RecurrenceType | '';
  recurrenceInterval: number;
  recurrenceEndDate: string;
  reminderEnabled: boolean;
  reminderOffsetMinutes: number;
  toGoogle: boolean;
}

export interface EventFormProps {
  initial: EventDraft;
  /** Ort-Feld: nur das Bearbeiten-Sheet hat es (Vorlage Z. 766 gegen Z. 1002). */
  withLocation: boolean;
  withGoogleToggle: boolean;
  submitLabel: string;
  onSubmit(draft: EventDraft): void;
  onDelete?: () => void;
  deleteLabel?: string;
}

/**
 * Der Formularteil, den das Neu- und das Bearbeiten-Sheet teilen.
 *
 * Ein leerer Titel verhindert das Speichern und wird an das Feld gemeldet.
 * Die Vorlage schreibt in diesem Fall still den alten Titel zurueck
 * (Z. 1555) — ein Fehler, kein Verhalten zum Uebernehmen.
 */
export function EventForm({
  initial,
  withLocation,
  withGoogleToggle,
  submitLabel,
  onSubmit,
  onDelete,
  deleteLabel,
}: EventFormProps): React.JSX.Element {
  const { t } = useT();
  const auth = useContext(AuthContext);
  const baseId = useId();
  const [draft, setDraft] = useState<EventDraft>(initial);
  const [showError, setShowError] = useState(false);

  const titleId = `${baseId}-title`;
  const errorId = `${baseId}-title-error`;
  const invalidTitle = draft.title.trim() === '';
  const invalidRange =
    draft.iso === '' ||
    draft.endIso === '' ||
    draft.endIso < draft.iso ||
    (!draft.allDay &&
      (draft.time === '' ||
        draft.endTime === '' ||
        (draft.iso === draft.endIso && draft.endTime <= draft.time)));
  const invalidRecurrence =
    draft.recurrenceType !== '' &&
    (!Number.isSafeInteger(draft.recurrenceInterval) || draft.recurrenceInterval < 1);
  const invalid = invalidTitle || invalidRange || invalidRecurrence;

  const set = <K extends keyof EventDraft>(key: K, value: EventDraft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const submit = () => {
    if (invalid) {
      setShowError(true);
      return;
    }
    onSubmit({
      ...draft,
      title: draft.title.trim(),
      location: draft.location.trim(),
      notes: draft.notes.trim(),
    });
  };

  const identity = auth?.session.status === 'signed-in' ? auth.session.identity : null;
  const people: readonly { slot: PersonSlot; label: string }[] = [
    { slot: 'u1', label: identity?.profile.name?.split(' ')[0] || t('me') },
    { slot: 'u2', label: identity?.partner?.name?.split(' ')[0] || t('partner') },
    { slot: 'both', label: t('calLegendBoth') },
  ];

  return (
    <div className={styles.fields}>
      <div>
        <FieldLabel htmlFor={titleId}>{t('sheetTitle')}</FieldLabel>
        <Input
          id={titleId}
          value={draft.title}
          onChange={(next) => {
            set('title', next);
            if (next.trim() !== '') setShowError(false);
          }}
          {...(showError && invalidTitle ? { describedBy: errorId, invalid: true } : {})}
        />
        {showError && invalidTitle ? (
          <div id={errorId} className={styles.error}>
            {t('sheetTitleRequired')}
          </div>
        ) : null}
      </div>

      <div className={styles.row}>
        <div className={styles.rowGrow}>
          <FieldLabel htmlFor={`${baseId}-date`}>{t('sheetDate')}</FieldLabel>
          <Input
            id={`${baseId}-date`}
            type="date"
            value={draft.iso}
            onChange={(next) => set('iso', next)}
          />
        </div>
        <div className={styles.rowNarrow}>
          <FieldLabel htmlFor={`${baseId}-end-date`}>{t('endDate')}</FieldLabel>
          <Input
            id={`${baseId}-end-date`}
            type="date"
            value={draft.endIso}
            onChange={(next) => set('endIso', next)}
          />
        </div>
      </div>

      <ListRow title={t('allDay')} last>
        <Toggle
          checked={draft.allDay}
          label={t('allDay')}
          onChange={(next) => set('allDay', next)}
        />
      </ListRow>

      {!draft.allDay ? (
        <div className={styles.row}>
          <div className={styles.rowGrow}>
            <FieldLabel htmlFor={`${baseId}-time`}>{t('sheetTime')}</FieldLabel>
            <Input
              id={`${baseId}-time`}
              type="time"
              value={draft.time}
              onChange={(next) => set('time', next)}
            />
          </div>
          <div className={styles.rowNarrow}>
            <FieldLabel htmlFor={`${baseId}-end-time`}>{t('endTime')}</FieldLabel>
            <Input
              id={`${baseId}-end-time`}
              type="time"
              value={draft.endTime}
              onChange={(next) => set('endTime', next)}
            />
          </div>
        </div>
      ) : null}

      {withLocation ? (
        <div>
          <FieldLabel htmlFor={`${baseId}-loc`}>{t('sheetLocation')}</FieldLabel>
          <Input
            id={`${baseId}-loc`}
            value={draft.location}
            onChange={(next) => set('location', next)}
            placeholder={t('sheetOptional')}
          />
        </div>
      ) : null}

      <div>
        <FieldLabel htmlFor={`${baseId}-notes`}>{t('notes')}</FieldLabel>
        <Textarea
          id={`${baseId}-notes`}
          value={draft.notes}
          onChange={(next) => set('notes', next)}
          placeholder={t('sheetOptional')}
        />
      </div>

      <div>
        <FieldLabel htmlFor={`${baseId}-repeat`}>{t('repeatPattern')}</FieldLabel>
        <Select<RecurrenceType | ''>
          id={`${baseId}-repeat`}
          value={draft.recurrenceType}
          onChange={(next) => set('recurrenceType', next)}
          options={[
            { value: '', label: t('noRepeat') },
            { value: 'daily', label: t('daily') },
            { value: 'weekly', label: t('weekly') },
            { value: 'monthly', label: t('monthly') },
            { value: 'yearly', label: t('yearly') },
          ]}
        />
      </div>

      {draft.recurrenceType !== '' ? (
        <div className={styles.row}>
          <div className={styles.rowGrow}>
            <FieldLabel htmlFor={`${baseId}-repeat-interval`}>{t('repeatInterval')}</FieldLabel>
            <Input
              id={`${baseId}-repeat-interval`}
              type="number"
              inputMode="numeric"
              value={String(draft.recurrenceInterval)}
              onChange={(next) => set('recurrenceInterval', Number(next))}
            />
          </div>
          <div className={styles.rowGrow}>
            <FieldLabel htmlFor={`${baseId}-repeat-until`}>{t('repeatUntil')}</FieldLabel>
            <Input
              id={`${baseId}-repeat-until`}
              type="date"
              value={draft.recurrenceEndDate}
              onChange={(next) => set('recurrenceEndDate', next)}
            />
          </div>
        </div>
      ) : null}

      <ListRow title={t('enableReminder')} last>
        <Toggle
          checked={draft.reminderEnabled}
          label={t('enableReminder')}
          onChange={(next) => set('reminderEnabled', next)}
        />
      </ListRow>

      {draft.reminderEnabled ? (
        <div>
          <FieldLabel htmlFor={`${baseId}-reminder`}>{t('remindBefore')}</FieldLabel>
          <Select
            id={`${baseId}-reminder`}
            value={String(draft.reminderOffsetMinutes)}
            onChange={(next) => set('reminderOffsetMinutes', Number(next))}
            options={[
              { value: '60', label: t('reminderOneHour') },
              { value: '1440', label: t('reminderOneDay') },
              { value: '2880', label: t('reminderTwoDays') },
              { value: '10080', label: t('reminderOneWeek') },
            ]}
          />
        </div>
      ) : null}

      {showError && (invalidRange || invalidRecurrence) ? (
        <div role="alert" className={styles.error}>
          {invalidRange ? t('calendarInvalidRange') : t('calendarInvalidRecurrence')}
        </div>
      ) : null}

      <div>
        <FieldLabel>{t('sheetAppliesTo')}</FieldLabel>
        <div className={styles.people}>
          {people.map((person) => (
            <PersonChip
              key={person.slot}
              slot={person.slot}
              active={draft.slot === person.slot}
              label={person.label}
              onClick={() => set('slot', person.slot)}
            />
          ))}
        </div>
      </div>

      {withGoogleToggle ? (
        <ListRow title={t('sheetToGoogle')} hint={t('sheetToGoogleHint')} last>
          <Toggle
            checked={draft.toGoogle}
            label={t('sheetToGoogle')}
            onChange={(next) => set('toGoogle', next)}
          />
        </ListRow>
      ) : null}

      <div className={styles.actions}>
        {onDelete ? (
          <Button variant="danger" onClick={onDelete}>
            {deleteLabel ?? t('sheetDelete')}
          </Button>
        ) : null}
        <span className={styles.actionsGrow}>
          <Button fullWidth onClick={submit}>
            {submitLabel}
          </Button>
        </span>
      </div>
    </div>
  );
}
