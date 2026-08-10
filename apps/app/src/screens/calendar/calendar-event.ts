import type { PersonSlot } from '@ralia/ui';
import type { RecurrenceType } from '@ralia/data';

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
  recurrenceType?: RecurrenceType | null;
  recurrenceInterval?: number;
  recurrenceEndDate?: string;
  reminderEnabled?: boolean;
  reminderOffsetMinutes?: number;
  recurrence?: {
    masterId: string;
    masterStartDate: string;
    masterEndDate: string;
    originalOccurrenceDate: string;
    exceptionId: string | null;
    isOverride: boolean;
  };
}
