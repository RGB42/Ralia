import { AppHeader, Fab, SegmentSwitch } from '@ralia/ui';
import { useState } from 'react';
import { useT } from '../../i18n/useT.js';
import { MOCK_EVENTS, MOCK_PROFILE, MOCK_TODAY } from '../../mock/fixtures.js';
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

export interface CalendarScreenProps {
  /** Tippen auf einen Tag oder Termin — Task 23 haengt hier das Tages-Sheet an. */
  onSelectDay?(iso: string): void;
}

export function CalendarScreen({ onSelectDay }: CalendarScreenProps): React.JSX.Element {
  const { t, lang } = useT();
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
            events={MOCK_EVENTS}
            onSelectDay={(iso) => onSelectDay?.(iso)}
          />
        ) : (
          <WeekView
            weekStartIso={weekStartIso}
            today={MOCK_TODAY}
            events={MOCK_EVENTS}
            nightExpanded={nightExpanded}
            onToggleNight={() => setNightExpanded((value) => !value)}
            onSelectDay={(iso) => onSelectDay?.(iso)}
          />
        )}
      </div>

      {/* Der FAB steht im Screen, nicht im Layout: die Vorlage blendet ihn
          auf Profil und Sync aus (Z. 1526). */}
      <Fab label={t('calAddEvent')} onClick={() => onSelectDay?.(MOCK_TODAY)} />
    </div>
  );
}
