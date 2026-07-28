import { create } from 'zustand';

import { expandAllEvents } from '@/features/calendar/recurrence';
import { ALL_DAY_END, ALL_DAY_START, formatLocalDate } from '@/lib/local-date';
import { enqueue, flushQueue } from '@/lib/mutation-queue';
import { makeLocalId, readLocalJson, writeLocalJson } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import type { CalendarEvent } from '@/types/calendar';
import type { BelongsTo, EventRow, RecurrenceType, RecurringEventException } from '@/types/database';

function cacheKey(calendarId: string) {
  return `ralia:event-cache:${calendarId}`;
}
function queueKey(calendarId: string) {
  return `ralia:event-queue:${calendarId}`;
}

export interface NewEventInput {
  name: string;
  location: string | null;
  notes: string | null;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  isAllDay: boolean;
  belongsTo: BelongsTo;
  recurrenceType: RecurrenceType;
  recurrenceInterval: number;
  recurrenceEndDate: string | null;
  /** Sets `event_type = 'birthday'`, which drives the icon and color role. */
  isBirthday?: boolean;
  createdBy: string;
  calendarId: string;
}

interface CalendarState {
  calendarId: string | null;
  masterEvents: EventRow[];
  exceptions: RecurringEventException[];
  loading: boolean;
  load: (calendarId: string) => Promise<void>;
  eventsInRange: (rangeStart: Date, rangeEnd: Date) => CalendarEvent[];
  addEvent: (input: NewEventInput) => Promise<void>;
  /** Deletes a single occurrence (via exception for recurring instances, or the whole row for a one-off event). */
  deleteOccurrence: (occurrence: CalendarEvent) => Promise<void>;
  /** Deletes the master row and all of its exceptions — the whole series. */
  deleteSeries: (masterEventId: string) => Promise<void>;
}

export const useCalendarStore = create<CalendarState>((set, get) => ({
  calendarId: null,
  masterEvents: [],
  exceptions: [],
  loading: false,

  load: async (calendarId) => {
    set({ loading: true, calendarId });

    const cached = await readLocalJson<{ events: EventRow[]; exceptions: RecurringEventException[] }>(cacheKey(calendarId), {
      events: [],
      exceptions: [],
    });
    set({ masterEvents: cached.events, exceptions: cached.exceptions });

    await flushQueue(queueKey(calendarId), {
      onRebase: (tempId, realId) => {
        set((s) => ({ masterEvents: s.masterEvents.map((e) => (e.id === tempId ? { ...e, id: realId } : e)) }));
      },
    });

    const [eventsRes, exceptionsRes] = await Promise.all([
      supabase.from('events').select('*').eq('calendar_id', calendarId),
      supabase.from('recurring_event_exceptions').select('*').eq('calendar_id', calendarId),
    ]);

    const events = eventsRes.data ?? cached.events;
    const exceptions = exceptionsRes.data ?? cached.exceptions;
    set({ masterEvents: events, exceptions, loading: false });
    await writeLocalJson(cacheKey(calendarId), { events, exceptions });
  },

  eventsInRange: (rangeStart, rangeEnd) => {
    const { masterEvents, exceptions } = get();
    return expandAllEvents(masterEvents, exceptions, rangeStart, rangeEnd);
  },

  addEvent: async (input) => {
    const now = new Date().toISOString();
    const tempId = makeLocalId('event');
    const row: EventRow = {
      id: tempId,
      calendar_id: input.calendarId,
      name: input.name,
      location: input.location,
      start_date: input.startDate,
      // Both ends at midnight — the legacy web app is still live on this same
      // database and detects all-day that way, so an end of 23:59 would make
      // our rows read as timed events over there.
      start_time: input.isAllDay ? ALL_DAY_START : input.startTime,
      end_date: input.endDate,
      end_time: input.isAllDay ? ALL_DAY_END : input.endTime,
      notes: input.notes,
      belongs_to: input.belongsTo,
      created_by: input.createdBy,
      created_at: now,
      updated_at: now,
      recurrence_type: input.recurrenceType,
      recurrence_end_date: input.recurrenceEndDate,
      parent_event_id: null,
      google_event_id: null,
      recurrence_interval: input.recurrenceType ? input.recurrenceInterval : 1,
      reminder_enabled: false,
      reminder_offset_minutes: 1440,
      reminder_offsets: null,
      event_type: input.isBirthday ? 'birthday' : 'default',
      // 'anniversary' is reserved for the profile-managed row that
      // syncAutomaticSpecialEvents owns, so it's never set from a user form —
      // matching the legacy app, which also forces these two on every save.
      is_special_auto: false,
      special_key: null,
      subtitle: null,
      short_description: null,
      extended_data: null,
      category: null,
    };
    set((s) => ({ masterEvents: [...s.masterEvents, row] }));
    await writeLocalJson(cacheKey(input.calendarId), { events: get().masterEvents, exceptions: get().exceptions });
    await enqueue(queueKey(input.calendarId), { op: 'insert', table: 'events', tempId, values: row });
    await flushQueue(queueKey(input.calendarId), {
      onRebase: (t, r) => set((s) => ({ masterEvents: s.masterEvents.map((e) => (e.id === t ? { ...e, id: r } : e)) })),
    });
  },

  deleteOccurrence: async (occurrence) => {
    const { calendarId, masterEvents, exceptions } = get();
    if (!calendarId) return;

    if (!occurrence.isRecurrenceInstance) {
      set({ masterEvents: masterEvents.filter((e) => e.id !== occurrence.id) });
      await writeLocalJson(cacheKey(calendarId), { events: get().masterEvents, exceptions });
      if (!occurrence.id.startsWith('local-')) {
        await enqueue(queueKey(calendarId), { op: 'delete', table: 'events', targetId: occurrence.id });
        await flushQueue(queueKey(calendarId));
      }
      return;
    }

    // Recurring occurrence: record a "deleted" exception rather than touching the master row.
    const exceptionRow: RecurringEventException = {
      id: makeLocalId('exception'),
      calendar_id: calendarId,
      master_event_id: occurrence.id,
      // Keyed on the date the RULE produced, not where an override may have moved
      // the occurrence to — that's the unique key the exceptions table enforces.
      original_occurrence_date: occurrence.originalOccurrenceDate,
      created_by: occurrence.created_by ?? '',
      is_deleted: true,
      override_event_data: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    set({ exceptions: [...exceptions, exceptionRow] });
    await writeLocalJson(cacheKey(calendarId), { events: masterEvents, exceptions: get().exceptions });
    await enqueue(queueKey(calendarId), {
      op: 'insert',
      table: 'recurring_event_exceptions',
      tempId: exceptionRow.id,
      values: exceptionRow,
    });
    await flushQueue(queueKey(calendarId));
  },

  deleteSeries: async (masterEventId) => {
    const { calendarId, masterEvents, exceptions } = get();
    if (!calendarId) return;
    const relatedExceptions = exceptions.filter((e) => e.master_event_id === masterEventId);
    set({
      masterEvents: masterEvents.filter((e) => e.id !== masterEventId),
      exceptions: exceptions.filter((e) => e.master_event_id !== masterEventId),
    });
    await writeLocalJson(cacheKey(calendarId), { events: get().masterEvents, exceptions: get().exceptions });
    // Delete exceptions first — defensive against the FK not cascading.
    for (const ex of relatedExceptions) {
      if (!ex.id.startsWith('local-')) {
        await enqueue(queueKey(calendarId), { op: 'delete', table: 'recurring_event_exceptions', targetId: ex.id });
      }
    }
    if (!masterEventId.startsWith('local-')) {
      await enqueue(queueKey(calendarId), { op: 'delete', table: 'events', targetId: masterEventId });
    }
    await flushQueue(queueKey(calendarId));
  },
}));

export { formatLocalDate };
