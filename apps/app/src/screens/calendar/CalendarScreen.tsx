import {
  displayBelongsTo,
  type BelongsTo,
  type CreateEventInput,
  type EventsRow,
  type UpdateEventInput,
} from '@ralia/data';
import { AppHeader, Fab, SegmentSwitch, useToast } from '@ralia/ui';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../auth/useAuth.js';
import { useData } from '../../data/DataProvider.js';
import { useT } from '../../i18n/useT.js';
import { DaySheet } from '../../sheets/DaySheet.js';
import { EventSheet } from '../../sheets/EventSheet.js';
import { NewEventSheet } from '../../sheets/NewEventSheet.js';
import type { EventDraft } from '../../sheets/EventForm.js';
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

export function CalendarScreen(): React.JSX.Element {
  const { t, lang } = useT();
  const { show } = useToast();
  const { session } = useAuth();
  const { events: eventRepo } = useData();
  const today = localTodayIso();
  const todayYear = Number(today.slice(0, 4));
  const todayMonth = Number(today.slice(5, 7)) - 1;
  const [events, setEvents] = useState<readonly CalendarEvent[]>([]);
  const [sheet, setSheet] = useState<SheetState>(null);
  const [mode, setMode] = useState<CalMode>('monat');
  const [year, setYear] = useState(todayYear);
  const [monthIndex, setMonthIndex] = useState(todayMonth);
  const [weekStartIso, setWeekStartIso] = useState(() => weekStartIsoOf(today, 'mo'));
  const [nightExpanded, setNightExpanded] = useState(false);
  const request = useRef(0);

  const shiftMonth = (delta: number) => {
    const next = new Date(Date.UTC(year, monthIndex + delta, 1));
    setYear(next.getUTCFullYear());
    setMonthIndex(next.getUTCMonth());
  };

  const goToday = () => {
    setYear(todayYear);
    setMonthIndex(todayMonth);
    setWeekStartIso(weekStartIsoOf(today, 'mo'));
  };

  const isMonth = mode === 'monat';
  const rangeStart = isMonth ? monthIso(year, monthIndex, 1) : weekStartIso;
  const rangeEnd = isMonth ? monthEndIso(year, monthIndex) : addDaysIso(weekStartIso, 6);
  const identity = session.status === 'signed-in' ? session.identity : null;

  useEffect(() => {
    if (!identity) return;
    const requestId = ++request.current;
    void eventRepo
      .list(identity.calendarId, { startDate: rangeStart, endDate: rangeEnd })
      .then((rows) => {
        if (request.current !== requestId) return;
        setEvents(rows.map((row) => eventFromRow(row, identity.userId)));
      })
      .catch(() => {
        if (request.current !== requestId) return;
        show(t('calendarLoadError'), 'danger');
      });
    return () => {
      request.current += 1;
    };
  }, [eventRepo, identity, rangeEnd, rangeStart, show, t]);

  const switchMode = (next: CalMode) => {
    if (next === mode) return;
    if (next === 'woche') {
      setWeekStartIso(weekStartIsoOf(monthIso(year, monthIndex, 1), 'mo'));
    } else {
      setYear(Number(weekStartIso.slice(0, 4)));
      setMonthIndex(Number(weekStartIso.slice(5, 7)) - 1);
    }
    setMode(next);
  };

  const saveNew = async (draft: EventDraft) => {
    if (!identity) return;
    try {
      const row = await eventRepo.create(
        identity.calendarId,
        createEventInput(draft, identity.userId),
      );
      setEvents((current) =>
        upsertVisible(current, eventFromRow(row, identity.userId), rangeStart, rangeEnd),
      );
      setSheet(null);
    } catch {
      show(t('calendarSaveError'), 'danger');
    }
  };

  const saveExisting = async (draft: EventDraft) => {
    if (!identity || sheet?.kind !== 'event' || !sheet.event.id) return;
    try {
      const row = await eventRepo.update(
        identity.calendarId,
        sheet.event.id,
        updateEventInput(draft),
      );
      setEvents((current) =>
        upsertVisible(current, eventFromRow(row, identity.userId), rangeStart, rangeEnd),
      );
      setSheet({ kind: 'day', iso: draft.iso });
    } catch {
      show(t('calendarSaveError'), 'danger');
    }
  };

  const deleteExisting = async () => {
    if (!identity || sheet?.kind !== 'event' || !sheet.event.id) return;
    const event = sheet.event;
    const eventId = event.id;
    if (!eventId) return;
    try {
      await eventRepo.delete(identity.calendarId, eventId);
      setEvents((current) => current.filter((entry) => entry.id !== eventId));
      setSheet({ kind: 'day', iso: event.iso });
    } catch {
      show(t('calendarDeleteError'), 'danger');
    }
  };

  const myName = identity?.profile.name?.split(' ')[0] || t('me');
  const partnerName = identity?.partner?.name?.split(' ')[0] || t('partner');
  const createIso = isMonth
    ? year === todayYear && monthIndex === todayMonth
      ? today
      : monthIso(year, monthIndex, 1)
    : weekStartIso;

  return (
    <div className={screen.screen}>
      <AppHeader
        kicker={isMonth ? t('calKicker') : `${t('calWeekKicker')} ${isoWeekNumber(weekStartIso)}`}
        title={isMonth ? monthTitle(year, monthIndex, lang) : weekRangeLabel(weekStartIso, lang)}
        range={{
          onPrev: () => (isMonth ? shiftMonth(-1) : setWeekStartIso(addDaysIso(weekStartIso, -7))),
          onNext: () => (isMonth ? shiftMonth(1) : setWeekStartIso(addDaysIso(weekStartIso, 7))),
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
            weekStart="mo"
            today={today}
            events={events}
            onSelectDay={(iso) => setSheet({ kind: 'day', iso })}
          />
        ) : (
          <WeekView
            weekStartIso={weekStartIso}
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
        open={sheet?.kind === 'event'}
        event={sheet?.kind === 'event' ? sheet.event : null}
        // Zurueck auf das Tages-Sheet, wie in der Vorlage (Z. 1559).
        onClose={() => setSheet(sheet?.kind === 'event' ? { kind: 'day', iso: sheet.iso } : null)}
        onSave={(draft) => void saveExisting(draft)}
        onDelete={() => void deleteExisting()}
      />
    </div>
  );
}

/**
 * The current compact form has one time. Timed events receive one hour while
 * all-day events use the full local day. Midnight rollover advances end_date.
 */
function eventTimes(draft: EventDraft): {
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
} {
  if (draft.time === '') {
    return { startDate: draft.iso, startTime: '00:00', endDate: draft.iso, endTime: '23:59' };
  }
  const [hours = '0', minutes = '0'] = draft.time.split(':');
  const total = Number(hours) * 60 + Number(minutes) + 60;
  const nextDay = total >= 24 * 60;
  return {
    startDate: draft.iso,
    startTime: draft.time,
    endDate: nextDay ? addDaysIso(draft.iso, 1) : draft.iso,
    endTime: `${String(Math.floor((total % (24 * 60)) / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`,
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
  };
}

function updateEventInput(draft: EventDraft): UpdateEventInput {
  const { created_by: _createdBy, ...changes } = createEventInput(draft, 'unused');
  return changes;
}

function eventFromRow(row: EventsRow, viewerId: string): CalendarEvent {
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
