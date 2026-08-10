import {
  layoutMonthEventRanges,
  monthDensity,
  monthGridCells,
  type WeekStart,
} from '@ralia/core';
import { personTokens } from '@ralia/ui';
import { useT } from '../../i18n/useT.js';
import type { CalendarEvent } from './calendar-event.js';
import styles from './MonthView.module.css';
import { dayLabel, weekdayLabels } from './calendar-labels.js';
import { useElementHeight } from './use-element-height.js';

export interface MonthViewProps {
  year: number;
  monthIndex: number;
  weekStart: WeekStart;
  /** ISO-Datum des heutigen Tages. */
  today: string;
  events: readonly CalendarEvent[];
  onSelectDay(iso: string): void;
}

export function MonthView({
  year,
  monthIndex,
  weekStart,
  today,
  events,
  onSelectDay,
}: MonthViewProps): React.JSX.Element {
  const { t, lang } = useT();
  const [gridRef, gridHeight] = useElementHeight();
  const density = monthDensity(gridHeight);
  const cells = monthGridCells(year, monthIndex, weekStart);
  const multiDayEvents = events.filter((event) => (event.endIso ?? event.iso) > event.iso);
  const rangeLayout = layoutMonthEventRanges(
    cells.map((cell) => cell.iso),
    multiDayEvents.map((event) => ({
      startDate: event.iso,
      endDate: event.endIso ?? event.iso,
    })),
  );

  const byDay = new Map<string, CalendarEvent[]>();
  for (const cell of cells) {
    const dayEvents = events.filter(
      (event) => event.iso <= cell.iso && (event.endIso ?? event.iso) >= cell.iso,
    );
    if (dayEvents.length > 0) byDay.set(cell.iso, dayEvents);
  }

  return (
    <div className={styles.month}>
      <div className={styles.weekdays}>
        {weekdayLabels(weekStart, lang).map((label) => (
          <div key={label} className={styles.weekday} data-testid="weekday-head">
            {label}
          </div>
        ))}
      </div>
      <div className={styles.gridWrap} ref={gridRef}>
        <div className={styles.grid}>
        {cells.map((cell, cellIndex) => {
          const dayEvents = byDay.get(cell.iso) ?? [];
          const singleDayEvents = dayEvents.filter(
            (event) => (event.endIso ?? event.iso) <= event.iso,
          );
          const visibleMultiDayCount = dayEvents.length - singleDayEvents.length;
          const row = Math.floor(cellIndex / 7);
          const rangeLanes = rangeLayout.rowLaneCounts[row] ?? 0;
          const isToday = cell.iso === today;
          const chips =
            density.mode === 'chips' ? singleDayEvents.slice(0, density.maxChips) : [];
          const dots = density.mode === 'dots' ? singleDayEvents.slice(0, density.maxDots) : [];
          const hidden = Math.max(
            0,
            dayEvents.length - visibleMultiDayCount - chips.length - dots.length,
          );

          /*
           * Die Vorlage liest hier nur eine Zahl vor. Ein sprechender Name ist
           * kein Design-Zusatz, sondern der Unterschied zwischen bedienbar und
           * unbedienbar mit Screenreader.
           */
          const count = dayEvents.length;
          const label =
            count > 0
              ? `${dayLabel(cell.iso, lang)}, ${count} ${count === 1 ? t('calEventOne') : t('calEventMany')}`
              : dayLabel(cell.iso, lang);

          return (
            <button
              key={cell.iso}
              type="button"
              className={[
                styles.cell,
                isToday ? styles.today : null,
                cell.inMonth ? null : styles.outside,
              ]
                .filter(Boolean)
                .join(' ')}
              aria-label={label}
              onClick={() => onSelectDay(cell.iso)}
              {...(isToday ? { 'aria-current': 'date' as const } : {})}
              {...(cell.inMonth ? {} : { 'data-outside': 'true' })}
            >
              <span className={styles.head} aria-hidden="true">
                <span className={styles.number}>{cell.dayOfMonth}</span>
                {hidden > 0 ? <span className={styles.more}>+{hidden}</span> : null}
              </span>
              {rangeLanes > 0 ? (
                <span
                  className={styles.rangeSpace}
                  style={{ height: `${rangeLanes * (density.mode === 'chips' ? 19 : 9)}px` }}
                  aria-hidden="true"
                />
              ) : null}
              {chips.map((event, index) => {
                const tokens = personTokens(event.slot);
                return (
                  <span
                    // Titel und Uhrzeit sind in den Demo-Daten nicht eindeutig
                    // (zwei „Physio"), die Position im Tag ist es.
                    key={`${event.iso}-${index}`}
                    className={styles.chip}
                    style={{ background: tokens.bg, borderLeftColor: tokens.bar }}
                    aria-hidden="true"
                  >
                    <span className={styles.chipTitle} style={{ color: tokens.fg }}>
                      {event.title}
                    </span>
                  </span>
                );
              })}
              {dots.length > 0 ? (
                <span className={styles.dots} aria-hidden="true">
                  {dots.map((event, index) => (
                    <span
                      key={`${event.iso}-${index}`}
                      className={styles.dot}
                      data-testid="event-dot"
                      style={{ background: personTokens(event.slot).bar }}
                    />
                  ))}
                </span>
              ) : null}
            </button>
          );
        })}
        </div>
        <div
          className={`${styles.rangeGrid} ${density.mode === 'dots' ? styles.rangeGridDots : ''}`}
        >
          {rangeLayout.segments.map((segment) => {
            const event = multiDayEvents[segment.eventIndex]!;
            const tokens = personTokens(event.slot);
            return (
              <button
                key={`${event.id ?? event.title}-${segment.row}-${segment.columnStart}`}
                type="button"
                className={`${styles.rangeBar} ${segment.continuesBefore ? styles.rangeContinuesBefore : ''} ${segment.continuesAfter ? styles.rangeContinuesAfter : ''}`}
                style={{
                  gridColumn: `${segment.columnStart} / span ${segment.columnSpan}`,
                  gridRow: segment.row + 1,
                  '--range-lane': segment.lane,
                  background: tokens.bg,
                  borderColor: tokens.bar,
                  color: tokens.fg,
                } as React.CSSProperties}
                data-testid="multi-day-segment"
                data-event-title={event.title}
                aria-label={`${event.title}, ${dayLabel(segment.startDate, lang)} – ${dayLabel(segment.endDate, lang)}`}
                onClick={() => onSelectDay(segment.startDate)}
              >
                <span className={styles.rangeTitle}>{event.title}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
