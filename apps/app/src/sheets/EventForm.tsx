import { Button, FieldLabel, Input, ListRow, PersonChip, Toggle } from '@ralia/ui';
import type { PersonSlot } from '@ralia/ui';
import { useContext, useId, useState } from 'react';
import { AuthContext } from '../auth/AuthProvider.js';
import { useT } from '../i18n/useT.js';
import styles from './sheets.module.css';

export interface EventDraft {
  title: string;
  iso: string;
  time: string;
  slot: PersonSlot;
  location: string;
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
  const invalid = draft.title.trim() === '';

  const set = <K extends keyof EventDraft>(key: K, value: EventDraft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const submit = () => {
    if (invalid) {
      setShowError(true);
      return;
    }
    onSubmit({ ...draft, title: draft.title.trim() });
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
          {...(showError && invalid ? { describedBy: errorId, invalid: true } : {})}
        />
        {showError && invalid ? (
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
          <FieldLabel htmlFor={`${baseId}-time`}>{t('sheetTime')}</FieldLabel>
          <Input
            id={`${baseId}-time`}
            type="time"
            value={draft.time}
            onChange={(next) => set('time', next)}
          />
        </div>
      </div>

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
