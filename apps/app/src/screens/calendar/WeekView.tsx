import {
  WEEK_DEFAULT_START_HOUR,
  WEEK_EXPANDED_START_HOUR,
  parseTimeToMinutes,
  weekEventGeometry,
} from '@ralia/core';
import { personTokens } from '@ralia/ui';
import { useT } from '../../i18n/useT.js';
import type { CalendarEvent } from './calendar-event.js';
import styles from './WeekView.module.css';
import { addDaysIso, dayOfMonth, weekdayShort } from './calendar-labels.js';

export interface WeekViewProps {
  /** ISO-Datum des ersten Tages der Woche. */
  weekStartIso: string;
  today: string;
  events: readonly CalendarEvent[];
  nightExpanded: boolean;
  onToggleNight(): void;
  onSelectDay(iso: string): void;
}

function pad(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}

export function WeekView({
  weekStartIso,
  today,
  events,
  nightExpanded,
  onToggleNight,
  onSelectDay,
}: WeekViewProps): React.JSX.Element {
  const { t, lang } = useT();
  const startHour = nightExpanded ? WEEK_EXPANDED_START_HOUR : WEEK_DEFAULT_START_HOUR;
  const hours = Array.from({ length: 24 - startHour }, (_, index) => startHour + index);
  const days = Array.from({ length: 7 }, (_, index) => addDaysIso(weekStartIso, index));

  return (
    <div className={styles.week}>
      <div className={styles.inner}>
        <div className={styles.headRow}>
          <div className={styles.timeGutter} />
          {days.map((iso) => {
            const isToday = iso === today;
            return (
              <div
                key={iso}
                className={`${styles.dayHead} ${isToday ? styles.dayHeadToday : ''}`}
                data-testid="week-day-head"
                {...(isToday ? { 'aria-current': 'date' as const } : {})}
              >
                <div className={styles.dayHeadWeekday}>{weekdayShort(iso, lang)}</div>
                <div className={styles.dayHeadNumber}>{dayOfMonth(iso)}</div>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          className={styles.nightToggle}
          onClick={onToggleNight}
          aria-expanded={nightExpanded}
        >
          <span aria-hidden="true">{nightExpanded ? '▴' : '▾'}</span>
          {nightExpanded ? t('calNightCollapse') : t('calNightExpand')}
        </button>

        <div className={styles.body}>
          <div className={styles.hours}>
            {hours.map((hour) => (
              <div key={hour} className={styles.hour}>
                <span className={styles.hourLabel} data-testid="hour-label">
                  {pad(hour)}
                </span>
              </div>
            ))}
            {/* Vorlage Z. 198–200: ohne diese Marke endet die Achse unbeschriftet. */}
            <div className={styles.hourEnd}>
              <span className={styles.hourLabel}>24:00</span>
            </div>
          </div>

          {days.map((iso) => {
            const isToday = iso === today;
            const timed = events
              .filter((event) => event.iso === iso)
              .map((event) => {
                const start = parseTimeToMinutes(event.start);
                const end = parseTimeToMinutes(event.end);
                // Ganztaegige Termine haben keine Zeit und keinen Platz auf
                // einer Timeline — sie gehoeren in das Tages-Sheet.
                if (start === null || end === null) return null;
                return { event, geometry: weekEventGeometry(start, end, startHour) };
              })
              .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

            return (
              <div key={iso} className={`${styles.column} ${isToday ? styles.columnToday : ''}`}>
                {hours.map((hour) => (
                  <div key={hour} className={styles.slot} />
                ))}
                {timed.map(({ event, geometry }, index) => {
                  const tokens = personTokens(event.slot);
                  const range = `${event.start}–${event.end}`;
                  return (
                    <button
                      key={`${iso}-${index}`}
                      type="button"
                      className={styles.event}
                      style={{
                        top: `${geometry.topPx}px`,
                        height: `${geometry.heightPx}px`,
                        background: tokens.bg,
                        borderLeftColor: tokens.bar,
                        color: tokens.fg,
                      }}
                      aria-label={`${event.title}, ${range}`}
                      onClick={() => onSelectDay(iso)}
                    >
                      <span className={styles.eventTitle} aria-hidden="true">
                        {event.title}
                      </span>
                      <span className={styles.eventRange} aria-hidden="true">
                        {range}
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
