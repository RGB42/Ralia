import { AppHeader, Fab, SegmentSwitch } from '@ralia/ui';
import { useState } from 'react';
import { useT } from '../../i18n/useT.js';
import { MOCK_EVENTS, MOCK_PROFILE, MOCK_TODAY, type MockEvent } from '../../mock/fixtures.js';
import { DaySheet } from '../../sheets/DaySheet.js';
import { EventSheet } from '../../sheets/EventSheet.js';
import { NewEventSheet } from '../../sheets/NewEventSheet.js';
import type { EventDraft } from '../../sheets/EventForm.js';
import { Legend } from '../Legend.js';
import { MonthView } from './MonthView.js';
import { WeekView } from './WeekView.js';
import screen from '../screen.module.css';
import {
  addDaysIso,
  isoWeekNumber,
  monthTitle,
  weekRangeLabel,
  weekStartIsoOf,
} from './calendar-labels.js';

type CalMode = 'monat' | 'woche';

const TODAY_YEAR = Number(MOCK_TODAY.slice(0, 4));
const TODAY_MONTH = Number(MOCK_TODAY.slice(5, 7)) - 1;

/** Welches Sheet offen ist. `null` heiszt: keines. */
type SheetState =
  | { kind: 'day'; iso: string }
  | { kind: 'new'; iso: string }
  | { kind: 'event'; iso: string; event: MockEvent }
  | null;

export function CalendarScreen(): React.JSX.Element {
  const { t, lang } = useT();
  // Lokaler Abzug der Fixtures, damit Anlegen und Loeschen sichtbar wirken.
  const [events, setEvents] = useState<readonly MockEvent[]>(MOCK_EVENTS);
  const [sheet, setSheet] = useState<SheetState>(null);
  const [mode, setMode] = useState<CalMode>('monat');
  const [year, setYear] = useState(TODAY_YEAR);
  const [monthIndex, setMonthIndex] = useState(TODAY_MONTH);
  const [weekStartIso, setWeekStartIso] = useState(() => weekStartIsoOf(MOCK_TODAY, 'mo'));
  const [nightExpanded, setNightExpanded] = useState(false);

  const shiftMonth = (delta: number) => {
    const next = new Date(Date.UTC(year, monthIndex + delta, 1));
    setYear(next.getUTCFullYear());
    setMonthIndex(next.getUTCMonth());
  };

  const goToday = () => {
    setYear(TODAY_YEAR);
    setMonthIndex(TODAY_MONTH);
    setWeekStartIso(weekStartIsoOf(MOCK_TODAY, 'mo'));
  };

  const isMonth = mode === 'monat';

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
          onChange={setMode}
          options={[
            { value: 'monat', label: t('month') },
            { value: 'woche', label: t('week') },
          ]}
        />
        <Legend
          entries={[
            { slot: 'u1', label: MOCK_PROFILE.me.name.split(' ')[0] ?? 'u1' },
            { slot: 'u2', label: MOCK_PROFILE.partner.name.split(' ')[0] ?? 'u2' },
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
            today={MOCK_TODAY}
            events={events}
            onSelectDay={(iso) => setSheet({ kind: 'day', iso })}
          />
        ) : (
          <WeekView
            weekStartIso={weekStartIso}
            today={MOCK_TODAY}
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
        onClick={() => setSheet({ kind: 'new', iso: isMonth ? MOCK_TODAY : weekStartIso })}
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
        defaultIso={sheet?.kind === 'new' ? sheet.iso : MOCK_TODAY}
        onClose={() => setSheet(null)}
        onSave={(draft) => {
          setEvents((current) => [...current, toEvent(draft)]);
          setSheet(null);
        }}
      />

      <EventSheet
        open={sheet?.kind === 'event'}
        event={sheet?.kind === 'event' ? sheet.event : null}
        // Zurueck auf das Tages-Sheet, wie in der Vorlage (Z. 1559).
        onClose={() => setSheet(sheet?.kind === 'event' ? { kind: 'day', iso: sheet.iso } : null)}
        onSave={(draft) => {
          if (sheet?.kind !== 'event') return;
          const previous = sheet.event;
          setEvents((current) =>
            current.map((entry) => (entry === previous ? toEvent(draft) : entry)),
          );
          setSheet({ kind: 'day', iso: draft.iso });
        }}
        onDelete={() => {
          if (sheet?.kind !== 'event') return;
          const previous = sheet.event;
          setEvents((current) => current.filter((entry) => entry !== previous));
          setSheet({ kind: 'day', iso: previous.iso });
        }}
      />
    </div>
  );
}

/**
 * Ein Entwurf ohne Endzeit bekommt eine Stunde. Die Vorlage laesst das Feld
 * offen; eine Timeline braucht aber eine Dauer, sonst faellt der Termin auf
 * die Mindesthoehe und sieht wie ein Fehler aus.
 */
function toEvent(draft: EventDraft): MockEvent {
  const end = draft.time === '' ? '' : addHour(draft.time);
  return {
    iso: draft.iso,
    title: draft.title,
    start: draft.time,
    end,
    slot: draft.slot,
    location: draft.location,
  };
}

function addHour(time: string): string {
  const [hours, minutes] = time.split(':');
  const next = (Number(hours) + 1) % 24;
  return `${String(next).padStart(2, '0')}:${minutes ?? '00'}`;
}
