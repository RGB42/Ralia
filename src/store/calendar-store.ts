import { create } from 'zustand';

import { expandAllEvents, getPreviousOccurrenceDate } from '@/features/calendar/recurrence';
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

/**
 * Which part of a recurring series an edit or delete applies to. One-off events
 * always use `series` (there's nothing else to scope).
 */
export type EditScope = 'occurrence' | 'future' | 'series';

interface CalendarState {
  calendarId: string | null;
  masterEvents: EventRow[];
  exceptions: RecurringEventException[];
  loading: boolean;
  load: (calendarId: string) => Promise<void>;
  eventsInRange: (rangeStart: Date, rangeEnd: Date) => CalendarEvent[];
  /** The raw master row behind an occurrence — recurrence settings live there, not on the instance. */
  getMaster: (masterEventId: string) => EventRow | undefined;
  addEvent: (input: NewEventInput) => Promise<void>;
  updateEvent: (occurrence: CalendarEvent, input: NewEventInput, scope: EditScope) => Promise<void>;
  /** Deletes a single occurrence (via exception for recurring instances, or the whole row for a one-off event). */
  deleteOccurrence: (occurrence: CalendarEvent) => Promise<void>;
  /** Ends the series just before this occurrence — "this and all following". */
  deleteFutureOccurrences: (occurrence: CalendarEvent) => Promise<void>;
  /** Deletes the master row and all of its exceptions — the whole series. */
  deleteSeries: (masterEventId: string) => Promise<void>;
}

/** Shared shape for both insert and update payloads. */
function buildEventFields(input: NewEventInput) {
  return {
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
    recurrence_type: input.recurrenceType,
    recurrence_end_date: input.recurrenceEndDate,
    recurrence_interval: input.recurrenceType ? input.recurrenceInterval : 1,
    event_type: input.isBirthday ? ('birthday' as const) : ('default' as const),
  };
}

/**
 * The exact projection the exceptions table stores as `override_event_data`.
 * Deliberately excludes recurrence fields and `special_key` — an override
 * describes one occurrence, never the rule that generated it.
 */
function buildOverrideData(input: NewEventInput): Partial<EventRow> {
  return {
    name: input.name,
    location: input.location,
    start_date: input.startDate,
    start_time: input.isAllDay ? ALL_DAY_START : input.startTime,
    end_date: input.endDate,
    end_time: input.isAllDay ? ALL_DAY_END : input.endTime,
    notes: input.notes,
    belongs_to: input.belongsTo,
    event_type: input.isBirthday ? 'birthday' : 'default',
  };
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

  getMaster: (masterEventId) => get().masterEvents.find((e) => e.id === masterEventId),

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

  updateEvent: async (occurrence, input, scope) => {
    const { calendarId, masterEvents, exceptions } = get();
    if (!calendarId) return;

    const now = new Date().toISOString();
    const persist = () =>
      writeLocalJson(cacheKey(calendarId), { events: get().masterEvents, exceptions: get().exceptions });

    // ── Scope: this occurrence only ───────────────────────────────────────
    // Recorded as an exception override so the rule itself stays intact.
    if (scope === 'occurrence' && occurrence.isRecurrenceInstance) {
      const key = occurrence.originalOccurrenceDate;
      const existing = exceptions.find(
        (e) => e.master_event_id === occurrence.id && e.original_occurrence_date === key
      );

      const row: RecurringEventException = {
        id: existing?.id ?? makeLocalId('exception'),
        calendar_id: calendarId,
        master_event_id: occurrence.id,
        original_occurrence_date: key,
        created_by: existing?.created_by ?? occurrence.created_by ?? '',
        is_deleted: false,
        override_event_data: buildOverrideData(input),
        created_at: existing?.created_at ?? now,
        updated_at: now,
      };

      set({
        exceptions: existing
          ? exceptions.map((e) => (e.id === existing.id ? row : e))
          : [...exceptions, row],
      });
      await persist();

      if (existing && !existing.id.startsWith('local-')) {
        await enqueue(queueKey(calendarId), {
          op: 'update',
          table: 'recurring_event_exceptions',
          targetId: existing.id,
          values: {
            is_deleted: false,
            override_event_data: row.override_event_data,
            updated_at: now,
          },
        });
      } else if (!existing) {
        await enqueue(queueKey(calendarId), {
          op: 'insert',
          table: 'recurring_event_exceptions',
          tempId: row.id,
          values: row,
        });
      }
      await flushQueue(queueKey(calendarId));
      return;
    }

    // ── Scope: this and all following ─────────────────────────────────────
    // Truncate the old series just before this occurrence and start a new one.
    if (scope === 'future' && occurrence.isRecurrenceInstance) {
      const master = masterEvents.find((e) => e.id === occurrence.id);
      if (!master) return;

      const splitDate = occurrence.originalOccurrenceDate;

      // Splitting at the very first occurrence has no "before" — it degenerates
      // into editing the whole series.
      if (splitDate === master.start_date) {
        await get().updateEvent(occurrence, input, 'series');
        return;
      }

      const previous = getPreviousOccurrenceDate(master, splitDate);
      if (!previous) {
        await get().updateEvent(occurrence, input, 'series');
        return;
      }

      const truncated: EventRow = { ...master, recurrence_end_date: previous, updated_at: now };
      const newSeries: EventRow = {
        ...master,
        ...buildEventFields(input),
        id: makeLocalId('event'),
        // The new series inherits the original author, not whoever split it —
        // belongs_to is stored relative to created_by.
        created_by: master.created_by,
        created_at: now,
        updated_at: now,
        parent_event_id: null,
        special_key: null,
        is_special_auto: false,
      };

      // Overrides at or after the split point belonged to the old tail.
      const orphaned = exceptions.filter(
        (e) => e.master_event_id === master.id && e.original_occurrence_date >= splitDate
      );

      set({
        masterEvents: [...masterEvents.map((e) => (e.id === master.id ? truncated : e)), newSeries],
        exceptions: exceptions.filter(
          (e) => !(e.master_event_id === master.id && e.original_occurrence_date >= splitDate)
        ),
      });
      await persist();

      if (!master.id.startsWith('local-')) {
        await enqueue(queueKey(calendarId), {
          op: 'update',
          table: 'events',
          targetId: master.id,
          values: { recurrence_end_date: previous, updated_at: now },
        });
      }
      for (const ex of orphaned) {
        if (!ex.id.startsWith('local-')) {
          await enqueue(queueKey(calendarId), {
            op: 'delete',
            table: 'recurring_event_exceptions',
            targetId: ex.id,
          });
        }
      }
      await enqueue(queueKey(calendarId), {
        op: 'insert',
        table: 'events',
        tempId: newSeries.id,
        values: newSeries,
      });
      await flushQueue(queueKey(calendarId), {
        onRebase: (t, r) =>
          set((s) => ({ masterEvents: s.masterEvents.map((e) => (e.id === t ? { ...e, id: r } : e)) })),
      });
      return;
    }

    // ── Scope: whole series (also the path for one-off events) ────────────
    const fields = buildEventFields(input);
    set({
      masterEvents: masterEvents.map((e) =>
        e.id === occurrence.id ? { ...e, ...fields, updated_at: now } : e
      ),
    });
    await persist();

    if (!occurrence.id.startsWith('local-')) {
      await enqueue(queueKey(calendarId), {
        op: 'update',
        table: 'events',
        targetId: occurrence.id,
        values: { ...fields, updated_at: now },
      });
      await flushQueue(queueKey(calendarId));
    } else {
      // Still queued as an insert — fold the edit into it rather than issuing an
      // update against a row the server has never seen.
      await enqueue(queueKey(calendarId), {
        op: 'update',
        table: 'events',
        targetId: occurrence.id,
        values: { ...fields, updated_at: now },
      });
      await flushQueue(queueKey(calendarId), {
        onRebase: (t, r) =>
          set((s) => ({ masterEvents: s.masterEvents.map((e) => (e.id === t ? { ...e, id: r } : e)) })),
      });
    }
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

  deleteFutureOccurrences: async (occurrence) => {
    const { calendarId, masterEvents, exceptions } = get();
    if (!calendarId) return;

    const master = masterEvents.find((e) => e.id === occurrence.id);
    if (!master) return;

    const splitDate = occurrence.originalOccurrenceDate;

    // Deleting from the first occurrence onwards removes the entire series.
    if (splitDate === master.start_date) {
      await get().deleteSeries(master.id);
      return;
    }

    const previous = getPreviousOccurrenceDate(master, splitDate);
    if (!previous) {
      await get().deleteSeries(master.id);
      return;
    }

    const now = new Date().toISOString();
    const orphaned = exceptions.filter(
      (e) => e.master_event_id === master.id && e.original_occurrence_date >= splitDate
    );

    set({
      masterEvents: masterEvents.map((e) =>
        e.id === master.id ? { ...e, recurrence_end_date: previous, updated_at: now } : e
      ),
      exceptions: exceptions.filter(
        (e) => !(e.master_event_id === master.id && e.original_occurrence_date >= splitDate)
      ),
    });
    await writeLocalJson(cacheKey(calendarId), {
      events: get().masterEvents,
      exceptions: get().exceptions,
    });

    if (!master.id.startsWith('local-')) {
      await enqueue(queueKey(calendarId), {
        op: 'update',
        table: 'events',
        targetId: master.id,
        values: { recurrence_end_date: previous, updated_at: now },
      });
    }
    for (const ex of orphaned) {
      if (!ex.id.startsWith('local-')) {
        await enqueue(queueKey(calendarId), {
          op: 'delete',
          table: 'recurring_event_exceptions',
          targetId: ex.id,
        });
      }
    }
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
