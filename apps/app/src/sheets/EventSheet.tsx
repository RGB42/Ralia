import { BottomSheet } from '@ralia/ui';
import { useT } from '../i18n/useT.js';
import type { MockEvent } from '../mock/fixtures.js';
import { EventForm, type EventDraft } from './EventForm.js';

export interface EventSheetProps {
  open: boolean;
  event: MockEvent | null;
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
          slot: event.slot,
          location: event.location,
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
