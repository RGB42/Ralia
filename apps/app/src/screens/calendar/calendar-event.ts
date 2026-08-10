import type { PersonSlot } from '@ralia/ui';

/** UI projection of a persisted event occurrence or master row. */
export interface CalendarEvent {
  id?: string;
  iso: string;
  endIso?: string;
  title: string;
  /** `HH:MM` or empty for an all-day event. */
  start: string;
  end: string;
  slot: PersonSlot;
  location: string;
  notes?: string;
}
