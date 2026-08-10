import { BottomSheet } from '@ralia/ui';
import { useT } from '../i18n/useT.js';
import { EventForm, type EventDraft } from './EventForm.js';

export type { EventDraft } from './EventForm.js';

export interface NewEventSheetProps {
  open: boolean;
  defaultIso: string;
  onClose(): void;
  onSave(draft: EventDraft): void;
}

/** Vorlage Z. 984–1025. */
export function NewEventSheet({
  open,
  defaultIso,
  onClose,
  onSave,
}: NewEventSheetProps): React.JSX.Element {
  const { t } = useT();
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      maxHeight="88%"
      closeLabel={t('sheetClose')}
      title={t('sheetNewEvent')}
    >
      <EventForm
        // key: ein erneutes Oeffnen soll ein leeres Formular zeigen, nicht
        // den Entwurf von vorletzter Woche.
        key={`${open}-${defaultIso}`}
        initial={{
          title: '',
          iso: defaultIso,
          time: '',
          endIso: defaultIso,
          endTime: '',
          allDay: true,
          slot: 'both',
          location: '',
          notes: '',
          recurrenceType: '',
          recurrenceInterval: 1,
          recurrenceEndDate: '',
          reminderEnabled: false,
          reminderOffsetMinutes: 1440,
          toGoogle: false,
        }}
        withLocation
        withGoogleToggle={false}
        submitLabel={t('sheetSave')}
        onSubmit={onSave}
      />
    </BottomSheet>
  );
}
