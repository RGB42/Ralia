import {
  expandRecurringEvents,
  makeLocalId,
  type CoreRecurrenceType,
  type RecurringEventException as CoreRecurringEventException,
  type RecurrenceOccurrence,
} from '@ralia/core';
import {
  displayBelongsTo,
  type BelongsTo,
  type CreateEventInput,
  type EventsRow,
  type EventMutation,
  type RecurringEventExceptionsRow,
  type RecurringEventOverrideData,
  type UpdateEventInput,
} from '@ralia/data';
import { AppHeader, Fab, SegmentSwitch, useToast } from '@ralia/ui';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../auth/useAuth.js';
import { useData } from '../../data/DataProvider.js';
import { useT } from '../../i18n/useT.js';
import { useAppPreferences } from '../../preferences/AppPreferencesProvider.js';
import { DaySheet } from '../../sheets/DaySheet.js';
import { EventSheet } from '../../sheets/EventSheet.js';
import { NewEventSheet } from '../../sheets/NewEventSheet.js';
import type { EventDraft } from '../../sheets/EventForm.js';
import {
  RecurrenceScopeDialog,
  type RecurrenceScope,
} from '../../sheets/RecurrenceScopeDialog.js';
import { Legend } from '../Legend.js';
import { MonthView } from './MonthView.js';
import { WeekView } from './WeekView.js';
import type { CalendarEvent } from './calendar-event.js';
import screen from '../screen.module.css';
import {
  addDaysIso,
  isoWeekNumber,
  monthTitle,
  weekRangeLabel,
  weekStartIsoOf,
} from './calendar-labels.js';

type CalMode = 'monat' | 'woche';

/** Welches Sheet offen ist. `null` heiszt: keines. */
type SheetState =
  | { kind: 'day'; iso: string }
  | { kind: 'new'; iso: string }
  | { kind: 'event'; iso: string; event: CalendarEvent }
  | null;

type PendingSeriesAction =
  | { kind: 'save'; event: CalendarEvent; draft: EventDraft }
  | { kind: 'delete'; event: CalendarEvent }
  | null;

export function CalendarScreen(): React.JSX.Element {
  const { t, lang } = useT();
  const { preferences } = useAppPreferences();
  const { show } = useToast();
  const { session } = useAuth();
  const {
    events: eventRepo,
    eventQueue,
    recurringEventExceptions,
    subscribeToEvents,
  } = useData();
  const today = localTodayIso();
  const todayYear = Number(today.slice(0, 4));
  const todayMonth = Number(today.slice(5, 7)) - 1;
  const [events, setEvents] = useState<readonly CalendarEvent[]>([]);
  const [sheet, setSheet] = useState<SheetState>(null);
  const [mode, setMode] = useState<CalMode>('monat');
  const [year, setYear] = useState(todayYear);
  const [monthIndex, setMonthIndex] = useState(todayMonth);
  const weekStart = preferences?.week_start ?? 'mo';
  const [weekStartIso, setWeekStartIso] = useState(() => weekStartIsoOf(today, weekStart));
  const [nightExpanded, setNightExpanded] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [pendingSeriesAction, setPendingSeriesAction] = useState<PendingSeriesAction>(null);
  const request = useRef(0);

  const shiftMonth = (delta: number) => {
    const next = new Date(Date.UTC(year, monthIndex + delta, 1));
    setYear(next.getUTCFullYear());
    setMonthIndex(next.getUTCMonth());
  };

  const goToday = () => {
    setYear(todayYear);
    setMonthIndex(todayMonth);
    setWeekStartIso(weekStartIsoOf(today, weekStart));
  };

  const isMonth = mode === 'monat';
  const activeWeekStartIso = weekStartIsoOf(weekStartIso, weekStart);
  const rangeStart = isMonth ? monthIso(year, monthIndex, 1) : activeWeekStartIso;
  const rangeEnd = isMonth ? monthEndIso(year, monthIndex) : addDaysIso(activeWeekStartIso, 6);
  const identity = session.status === 'signed-in' ? session.identity : null;

  useEffect(() => {
    if (!identity) return;
    const requestId = ++request.current;
    void Promise.all([
      eventRepo.list(identity.calendarId, { startDate: rangeStart, endDate: rangeEnd }),
      recurringEventExceptions.list(identity.calendarId),
      eventQueue.pending(identity.calendarId),
    ])
      .then(([rows, exceptions, pending]) => {
        if (request.current !== requestId) return;
        const projected = projectPendingMutations(
          rows,
          exceptions,
          pending,
          identity.calendarId,
        );
        setEvents(
          eventsForRange(
            projected.events,
            projected.exceptions,
            rangeStart,
            rangeEnd,
            identity.userId,
          ),
        );
      })
      .catch(() => {
        if (request.current !== requestId) return;
        show(t('calendarLoadError'), 'danger');
      });
    return () => {
      request.current += 1;
    };
  }, [eventQueue, eventRepo, identity, rangeEnd, rangeStart, recurringEventExceptions, reloadToken, show, t]);

  useEffect(() => {
    if (!identity) return;
    const subscription = subscribeToEvents(identity.calendarId, () => {
      setReloadToken((current) => current + 1);
    });
    return () => {
      void subscription.unsubscribe();
    };
  }, [identity, subscribeToEvents]);

  const switchMode = (next: CalMode) => {
    if (next === mode) return;
    if (next === 'woche') {
      setWeekStartIso(weekStartIsoOf(monthIso(year, monthIndex, 1), weekStart));
    } else {
      setYear(Number(activeWeekStartIso.slice(0, 4)));
      setMonthIndex(Number(activeWeekStartIso.slice(5, 7)) - 1);
    }
    setMode(next);
  };

  const queueEventMutation = async (mutation: EventMutation) => {
    if (!identity) throw new Error('No active calendar identity');
    await eventQueue.enqueue(identity.calendarId, mutation);
    void eventQueue
      .flush()
      .then((summary) => {
        if (summary.rebases.length > 0) {
          const rebases = new Map(summary.rebases.map((rebase) => [rebase.tempId, rebase.realId]));
          setEvents((current) =>
            current.map((event) => {
              const realId = event.id ? rebases.get(event.id) : undefined;
              return realId ? { ...event, id: realId } : event;
            }),
          );
        }
        if (summary.dropped > 0) {
          show(summary.dropReasons[0] ?? t('calendarSaveError'), 'danger');
        }
        if (summary.retried > 0 || summary.deferred > 0) {
          show(t('offlineCalendarReady'), 'info');
        }
        if (summary.done > 0 || summary.dropped > 0) {
          setReloadToken((current) => current + 1);
        }
      })
      .catch(() => show(t('offlineCalendarReady'), 'info'));
  };

  const saveNew = async (draft: EventDraft) => {
    if (!identity) return;
    const tempId = makeLocalId('event');
    const input = createEventInput(draft, identity.userId);
    try {
      await queueEventMutation({ kind: 'event.create', tempId, input });
      setEvents((current) =>
        upsertVisible(current, eventFromDraft(tempId, draft), rangeStart, rangeEnd),
      );
      setSheet(null);
    } catch {
      show(t('calendarSaveError'), 'danger');
    }
  };

  const saveExisting = async (draft: EventDraft) => {
    if (!identity || sheet?.kind !== 'event' || !sheet.event.id) return;
    if (sheet.event.recurrence) {
      setPendingSeriesAction({ kind: 'save', event: sheet.event, draft });
      return;
    }
    const event = sheet.event;
    try {
      await queueEventMutation({
        kind: 'event.update',
        eventId: event.id!,
        changes: updateEventInput(draft),
      });
      setEvents((current) =>
        upsertVisible(current, eventFromDraft(event.id!, draft), rangeStart, rangeEnd),
      );
      setSheet({ kind: 'day', iso: draft.iso });
    } catch {
      show(t('calendarSaveError'), 'danger');
    }
  };

  const deleteExisting = async () => {
    if (!identity || sheet?.kind !== 'event' || !sheet.event.id) return;
    const event = sheet.event;
    if (event.recurrence) {
      setPendingSeriesAction({ kind: 'delete', event });
      return;
    }
    const eventId = event.id;
    if (!eventId) return;
    try {
      await queueEventMutation({ kind: 'event.delete', eventId });
      setEvents((current) => current.filter((entry) => entry.id !== eventId));
      setSheet({ kind: 'day', iso: event.iso });
    } catch {
      show(t('calendarDeleteError'), 'danger');
    }
  };

  const applySeriesScope = async (scope: RecurrenceScope) => {
    if (!identity || !pendingSeriesAction?.event.recurrence) return;
    const action = pendingSeriesAction;
    const event = action.event;
    const recurrence = event.recurrence;
    if (!recurrence) return;
    try {
      if (scope === 'occurrence') {
        if (action.kind === 'delete') {
          if (recurrence.exceptionId) {
            await queueEventMutation({
              kind: 'exception.update',
              input: {
                masterEventId: recurrence.masterId,
                id: recurrence.exceptionId,
                isDeleted: true,
                overrideEventData: null,
              },
            });
          } else {
            await queueEventMutation({
              kind: 'exception.create',
              tempId: makeLocalId('exception'),
              input: {
                masterEventId: recurrence.masterId,
                createdBy: identity.userId,
                originalOccurrenceDate: recurrence.originalOccurrenceDate,
                isDeleted: true,
              },
            });
          }
        } else {
          const overrideEventData = occurrenceOverride(action.draft);
          if (recurrence.exceptionId) {
            await queueEventMutation({
              kind: 'exception.update',
              input: {
                masterEventId: recurrence.masterId,
                id: recurrence.exceptionId,
                originalOccurrenceDate: recurrence.originalOccurrenceDate,
                isDeleted: false,
                overrideEventData,
              },
            });
          } else {
            await queueEventMutation({
              kind: 'exception.create',
              tempId: makeLocalId('exception'),
              input: {
                masterEventId: recurrence.masterId,
                createdBy: identity.userId,
                originalOccurrenceDate: recurrence.originalOccurrenceDate,
                isDeleted: false,
                overrideEventData,
              },
            });
          }
        }
      } else if (scope === 'future') {
        await queueEventMutation({
          kind: 'series.splitFuture',
          input: {
            masterEventId: recurrence.masterId,
            originalOccurrenceDate: recurrence.originalOccurrenceDate,
            changes: action.kind === 'save' ? updateEventInput(action.draft) : {},
            deleteFuture: action.kind === 'delete',
          },
        });
      } else if (action.kind === 'delete') {
        await queueEventMutation({ kind: 'event.delete', eventId: recurrence.masterId });
      } else {
        await queueEventMutation({
          kind: 'event.update',
          eventId: recurrence.masterId,
          changes: {
            ...updateEventInput(action.draft),
            start_date: recurrence.masterStartDate,
            end_date: recurrence.masterEndDate,
          },
        });
      }

      setPendingSeriesAction(null);
      setSheet({ kind: 'day', iso: event.iso });
    } catch {
      show(
        action.kind === 'delete' ? t('calendarDeleteError') : t('calendarSaveError'),
        'danger',
      );
    }
  };

  const myName = identity?.profile.name?.split(' ')[0] || t('me');
  const partnerName = identity?.partner?.name?.split(' ')[0] || t('partner');
  const createIso = isMonth
    ? year === todayYear && monthIndex === todayMonth
      ? today
      : monthIso(year, monthIndex, 1)
    : activeWeekStartIso;

  return (
    <div className={screen.screen}>
      <AppHeader
        kicker={isMonth ? t('calKicker') : `${t('calWeekKicker')} ${isoWeekNumber(activeWeekStartIso)}`}
        title={isMonth ? monthTitle(year, monthIndex, lang) : weekRangeLabel(activeWeekStartIso, lang)}
        range={{
          onPrev: () => (isMonth ? shiftMonth(-1) : setWeekStartIso(addDaysIso(activeWeekStartIso, -7))),
          onNext: () => (isMonth ? shiftMonth(1) : setWeekStartIso(addDaysIso(activeWeekStartIso, 7))),
          onToday: goToday,
          prevLabel: isMonth ? t('calPrevMonth') : t('calPrevWeek'),
          nextLabel: isMonth ? t('calNextMonth') : t('calNextWeek'),
          todayLabel: t('today'),
        }}
      >
        <SegmentSwitch<CalMode>
          label={t('calViewLabel')}
          value={mode}
          onChange={switchMode}
          options={[
            { value: 'monat', label: t('month') },
            { value: 'woche', label: t('week') },
          ]}
        />
        <Legend
          entries={[
            { slot: 'u1', label: myName },
            { slot: 'u2', label: partnerName },
            { slot: 'both', label: t('calLegendBoth') },
          ]}
        />
      </AppHeader>

      <div className={screen.body}>
        {isMonth ? (
          <MonthView
            year={year}
            monthIndex={monthIndex}
            weekStart={weekStart}
            today={today}
            events={events}
            onSelectDay={(iso) => setSheet({ kind: 'day', iso })}
          />
        ) : (
          <WeekView
            weekStartIso={activeWeekStartIso}
            today={today}
            events={events}
            nightExpanded={nightExpanded}
            onToggleNight={() => setNightExpanded((value) => !value)}
            onSelectDay={(iso) => setSheet({ kind: 'day', iso })}
          />
        )}
      </div>

      {/* Der FAB steht im Screen, nicht im Layout: die Vorlage blendet ihn
          auf Profil und Sync aus (Z. 1526). */}
      <Fab
        label={t('calAddEvent')}
        onClick={() => setSheet({ kind: 'new', iso: createIso })}
      />

      <DaySheet
        open={sheet?.kind === 'day'}
        iso={sheet?.kind === 'day' ? sheet.iso : null}
        events={events}
        onClose={() => setSheet(null)}
        onEdit={(event) => setSheet({ kind: 'event', iso: event.iso, event })}
        onAdd={() => setSheet(sheet?.kind === 'day' ? { kind: 'new', iso: sheet.iso } : null)}
      />

      <NewEventSheet
        open={sheet?.kind === 'new'}
        defaultIso={sheet?.kind === 'new' ? sheet.iso : today}
        onClose={() => setSheet(null)}
        onSave={(draft) => void saveNew(draft)}
      />

      <EventSheet
        open={sheet?.kind === 'event' && pendingSeriesAction === null}
        event={sheet?.kind === 'event' ? sheet.event : null}
        // Zurueck auf das Tages-Sheet, wie in der Vorlage (Z. 1559).
        onClose={() => setSheet(sheet?.kind === 'event' ? { kind: 'day', iso: sheet.iso } : null)}
        onSave={(draft) => void saveExisting(draft)}
        onDelete={() => void deleteExisting()}
      />

      <RecurrenceScopeDialog
        open={pendingSeriesAction !== null}
        canChooseFuture={
          pendingSeriesAction?.event.recurrence !== undefined &&
          pendingSeriesAction.event.recurrence.originalOccurrenceDate >
            pendingSeriesAction.event.recurrence.masterStartDate
        }
        onClose={() => setPendingSeriesAction(null)}
        onSelect={(scope) => void applySeriesScope(scope)}
      />
    </div>
  );
}

/**
 * Converts the explicit form range to the database representation.
 */
function eventTimes(draft: EventDraft): {
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
} {
  if (draft.allDay) {
    return {
      startDate: draft.iso,
      startTime: '00:00',
      endDate: draft.endIso,
      endTime: '23:59',
    };
  }
  return {
    startDate: draft.iso,
    startTime: draft.time,
    endDate: draft.endIso,
    endTime: draft.endTime,
  };
}

function createEventInput(draft: EventDraft, userId: string): CreateEventInput {
  const times = eventTimes(draft);
  return {
    name: draft.title,
    location: draft.location || null,
    start_date: times.startDate,
    start_time: times.startTime,
    end_date: times.endDate,
    end_time: times.endTime,
    belongs_to: draft.slot === 'bday' ? 'both' : draft.slot,
    created_by: userId,
    notes: draft.notes || null,
    recurrence_type: draft.recurrenceType || null,
    recurrence_interval: draft.recurrenceType ? draft.recurrenceInterval : null,
    recurrence_end_date:
      draft.recurrenceType && draft.recurrenceEndDate ? draft.recurrenceEndDate : null,
    reminder_enabled: draft.reminderEnabled,
    reminder_offset_minutes: draft.reminderEnabled ? draft.reminderOffsetMinutes : null,
    reminder_offsets: draft.reminderEnabled ? [draft.reminderOffsetMinutes] : null,
  };
}

function updateEventInput(draft: EventDraft): UpdateEventInput {
  const { created_by: _createdBy, ...changes } = createEventInput(draft, 'unused');
  return changes;
}

function eventFromDraft(id: string, draft: EventDraft): CalendarEvent {
  const times = eventTimes(draft);
  return {
    id,
    iso: times.startDate,
    endIso: times.endDate,
    title: draft.title,
    start: draft.allDay ? '' : times.startTime,
    end: draft.allDay ? '' : times.endTime,
    slot: draft.slot,
    location: draft.location,
    ...(draft.notes ? { notes: draft.notes } : {}),
    recurrenceType: draft.recurrenceType || null,
    recurrenceInterval: draft.recurrenceInterval,
    recurrenceEndDate: draft.recurrenceEndDate,
    reminderEnabled: draft.reminderEnabled,
    reminderOffsetMinutes: draft.reminderOffsetMinutes,
  };
}

function eventFromRow(
  row: EventsRow,
  viewerId: string,
  recurrence?: CalendarEvent['recurrence'],
): CalendarEvent {
  const belongsTo: BelongsTo =
    row.belongs_to === 'user1' || row.belongs_to === 'user2' || row.belongs_to === 'both'
      ? row.belongs_to
      : 'both';
  const allDay = row.start_time.startsWith('00:00') && row.end_time.startsWith('23:59');
  return {
    id: row.id,
    iso: row.start_date,
    endIso: row.end_date,
    title: row.name,
    start: allDay ? '' : row.start_time.slice(0, 5),
    end: allDay ? '' : row.end_time.slice(0, 5),
    slot: row.event_type === 'birthday' ? 'bday' : displaySlot(belongsTo, row.created_by, viewerId),
    location: row.location ?? '',
    ...(row.notes ? { notes: row.notes } : {}),
    recurrenceType: isRecurrenceType(row.recurrence_type) ? row.recurrence_type : null,
    recurrenceInterval: row.recurrence_interval ?? 1,
    recurrenceEndDate: row.recurrence_end_date ?? '',
    reminderEnabled: row.reminder_enabled === true,
    reminderOffsetMinutes: row.reminder_offset_minutes ?? 1440,
    ...(recurrence ? { recurrence } : {}),
  };
}

type RecurringEventsRow = EventsRow & { recurrence_type: CoreRecurrenceType };

function isRecurringRow(row: EventsRow): row is RecurringEventsRow {
  return isRecurrenceType(row.recurrence_type);
}

function isRecurrenceType(value: string | null): value is CoreRecurrenceType {
  return value === 'daily' || value === 'weekly' || value === 'monthly' || value === 'yearly';
}

function eventsForRange(
  rows: readonly EventsRow[],
  exceptionRows: readonly RecurringEventExceptionsRow[],
  rangeStart: string,
  rangeEnd: string,
  viewerId: string,
): CalendarEvent[] {
  const recurring = rows.filter(isRecurringRow);
  const oneTime = rows.filter((row) => !isRecurringRow(row));
  const masterIds = new Set(recurring.map((row) => row.id));
  const exceptions: CoreRecurringEventException<RecurringEventsRow>[] = exceptionRows
    .filter((row) => masterIds.has(row.master_event_id))
    .map((row) => ({
      id: row.id,
      master_event_id: row.master_event_id,
      original_occurrence_date: row.original_occurrence_date,
      is_deleted: row.is_deleted,
      override_event_data: isJsonObject(row.override_event_data)
        ? (row.override_event_data as Partial<RecurringEventsRow>)
        : null,
    }));
  const occurrences = expandRecurringEvents(
    recurring,
    { startDate: rangeStart, endDate: rangeEnd },
    exceptions,
  );
  const masters = new Map(recurring.map((master) => [master.id, master]));

  return [
    ...oneTime.map((row) => eventFromRow(row, viewerId)),
    ...occurrences.map((occurrence) =>
      occurrenceEvent(occurrence, masters.get(occurrence.id)!, viewerId),
    ),
  ].sort(
    (left, right) =>
      left.iso.localeCompare(right.iso) ||
      left.start.localeCompare(right.start) ||
      left.title.localeCompare(right.title),
  );
}

function occurrenceEvent(
  occurrence: RecurrenceOccurrence<RecurringEventsRow>,
  master: RecurringEventsRow,
  viewerId: string,
): CalendarEvent {
  return eventFromRow(occurrence, viewerId, {
    masterId: occurrence.id,
    masterStartDate: master.start_date,
    masterEndDate: master.end_date,
    originalOccurrenceDate: occurrence.originalOccurrenceDate,
    exceptionId: occurrence.exceptionId,
    isOverride: occurrence.isExceptionOverride,
  });
}

function occurrenceOverride(draft: EventDraft): RecurringEventOverrideData {
  const times = eventTimes(draft);
  return {
    name: draft.title,
    location: draft.location || null,
    start_date: times.startDate,
    start_time: times.startTime,
    end_date: times.endDate,
    end_time: times.endTime,
    notes: draft.notes || null,
    belongs_to: draft.slot === 'bday' ? 'both' : draft.slot,
    reminder_enabled: draft.reminderEnabled,
    reminder_offset_minutes: draft.reminderEnabled ? draft.reminderOffsetMinutes : null,
    reminder_offsets: draft.reminderEnabled ? [draft.reminderOffsetMinutes] : null,
  };
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function projectPendingMutations(
  serverEvents: readonly EventsRow[],
  serverExceptions: readonly RecurringEventExceptionsRow[],
  mutations: readonly EventMutation[],
  calendarId: string,
): { events: EventsRow[]; exceptions: RecurringEventExceptionsRow[] } {
  let events = serverEvents.map((event) => ({ ...event }));
  let exceptions = serverExceptions.map((exception) => ({ ...exception }));

  for (const mutation of mutations) {
    switch (mutation.kind) {
      case 'event.create':
        events = [...events, rowFromPendingCreate(mutation.tempId, calendarId, mutation.input)];
        break;
      case 'event.update':
        events = events.map((event) =>
          event.id === mutation.eventId ? { ...event, ...mutation.changes } : event,
        );
        break;
      case 'event.delete':
        events = events.filter((event) => event.id !== mutation.eventId);
        break;
      case 'exception.create':
        exceptions = [
          ...exceptions,
          {
            id: mutation.tempId,
            calendar_id: calendarId,
            created_by: mutation.input.createdBy,
            master_event_id: mutation.input.masterEventId,
            original_occurrence_date: mutation.input.originalOccurrenceDate,
            is_deleted: mutation.input.isDeleted,
            override_event_data:
              'overrideEventData' in mutation.input
                ? (mutation.input.overrideEventData ?? null)
                : null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ];
        break;
      case 'exception.update':
        exceptions = exceptions.map((exception) =>
          exception.id === mutation.input.id
            ? {
                ...exception,
                ...(mutation.input.originalOccurrenceDate
                  ? { original_occurrence_date: mutation.input.originalOccurrenceDate }
                  : {}),
                ...(mutation.input.isDeleted === undefined
                  ? {}
                  : { is_deleted: mutation.input.isDeleted }),
                ...('overrideEventData' in mutation.input
                  ? { override_event_data: mutation.input.overrideEventData ?? null }
                  : {}),
              }
            : exception,
        );
        break;
      case 'exception.delete':
        exceptions = exceptions.filter((exception) => exception.id !== mutation.input.id);
        break;
      case 'series.splitFuture':
        // The server performs this transaction atomically. Until it can flush,
        // keep the last complete local series snapshot instead of inventing IDs.
        break;
    }
  }

  return { events, exceptions };
}

function rowFromPendingCreate(
  id: string,
  calendarId: string,
  input: Omit<CreateEventInput, 'id'>,
): EventsRow {
  return {
    id,
    calendar_id: calendarId,
    name: input.name,
    location: input.location ?? null,
    start_date: input.start_date,
    start_time: input.start_time,
    end_date: input.end_date,
    end_time: input.end_time,
    notes: input.notes ?? null,
    belongs_to: input.belongs_to,
    created_by: input.created_by ?? null,
    created_at: input.created_at ?? new Date().toISOString(),
    updated_at: input.updated_at ?? new Date().toISOString(),
    recurrence_type: input.recurrence_type ?? null,
    recurrence_end_date: input.recurrence_end_date ?? null,
    parent_event_id: input.parent_event_id ?? null,
    google_event_id: input.google_event_id ?? null,
    recurrence_interval: input.recurrence_interval ?? null,
    reminder_enabled: input.reminder_enabled ?? false,
    reminder_offset_minutes: input.reminder_offset_minutes ?? null,
    reminder_offsets: input.reminder_offsets ?? null,
    event_type: input.event_type ?? 'default',
    is_special_auto: input.is_special_auto ?? false,
    special_key: input.special_key ?? null,
    subtitle: input.subtitle ?? null,
    short_description: input.short_description ?? null,
    extended_data: input.extended_data ?? null,
    category: input.category ?? null,
  };
}

function displaySlot(
  belongsTo: BelongsTo,
  createdBy: string | null,
  viewerId: string,
): 'u1' | 'u2' | 'both' {
  const display = displayBelongsTo(belongsTo, createdBy, viewerId);
  if (display === 'user1') return 'u1';
  if (display === 'user2') return 'u2';
  return 'both';
}

function upsertVisible(
  current: readonly CalendarEvent[],
  event: CalendarEvent,
  rangeStart: string,
  rangeEnd: string,
): readonly CalendarEvent[] {
  const withoutEvent = current.filter((entry) => entry.id !== event.id);
  if (event.iso > rangeEnd || (event.endIso ?? event.iso) < rangeStart) return withoutEvent;
  return [...withoutEvent, event];
}

function monthIso(year: number, monthIndex: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function monthEndIso(year: number, monthIndex: number): string {
  const end = new Date(Date.UTC(year, monthIndex + 1, 0));
  return monthIso(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
}

function localTodayIso(): string {
  const today = new Date();
  return monthIso(today.getFullYear(), today.getMonth(), today.getDate());
}
