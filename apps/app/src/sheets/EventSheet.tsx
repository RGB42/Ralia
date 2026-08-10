import { BottomSheet } from '@ralia/ui';
import { useT } from '../i18n/useT.js';
import type { CalendarEvent } from '../screens/calendar/calendar-event.js';
import { EventForm, type EventDraft } from './EventForm.js';

export interface EventSheetProps {
  open: boolean;
  event: CalendarEvent | null;
  onClose(): void;
  onSave(next: EventDraft): void;
  onDelete(): void;
}

/** Vorlage Z. 742–782. */
export function EventSheet({
  open,
  event,
  onClose,
  onSave,
  onDelete,
}: EventSheetProps): React.JSX.Element | null {
  const { t } = useT();
  if (!event) return null;
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      maxHeight="90%"
      closeLabel={t('sheetClose')}
      title={t('sheetEditEvent')}
    >
      <EventForm
        key={`${event.iso}-${event.title}`}
        initial={{
          title: event.title,
          iso: event.iso,
          time: event.start,
          endIso: event.endIso ?? event.iso,
          endTime: event.end,
          allDay: event.start === '',
          slot: event.slot,
          location: event.location,
          notes: event.notes ?? '',
          recurrenceType: event.recurrenceType ?? '',
          recurrenceInterval: event.recurrenceInterval ?? 1,
          recurrenceEndDate: event.recurrenceEndDate ?? '',
          reminderEnabled: event.reminderEnabled ?? false,
          reminderOffsetMinutes: event.reminderOffsetMinutes ?? 1440,
          toGoogle: true,
        }}
        withLocation
        withGoogleToggle={false}
        submitLabel={t('sheetSave')}
        onSubmit={onSave}
        onDelete={onDelete}
        deleteLabel={t('sheetDelete')}
      />
    </BottomSheet>
  );
}
