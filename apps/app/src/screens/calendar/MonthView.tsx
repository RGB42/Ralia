import { monthDensity, monthGridCells, type WeekStart } from '@ralia/core';
import { personTokens } from '@ralia/ui';
import { useT } from '../../i18n/useT.js';
import type { MockEvent } from '../../mock/fixtures.js';
import styles from './MonthView.module.css';
import { dayLabel, weekdayLabels } from './calendar-labels.js';
import { useElementHeight } from './use-element-height.js';

export interface MonthViewProps {
  year: number;
  monthIndex: number;
  weekStart: WeekStart;
  /** ISO-Datum des heutigen Tages. */
  today: string;
  events: readonly MockEvent[];
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

  const byDay = new Map<string, MockEvent[]>();
  for (const event of events) {
    const bucket = byDay.get(event.iso);
    if (bucket) bucket.push(event);
    else byDay.set(event.iso, [event]);
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
      <div className={styles.grid} ref={gridRef}>
        {cells.map((cell) => {
          const dayEvents = byDay.get(cell.iso) ?? [];
          const isToday = cell.iso === today;
          const chips = density.mode === 'chips' ? dayEvents.slice(0, density.maxChips) : [];
          const dots = density.mode === 'dots' ? dayEvents.slice(0, density.maxDots) : [];
          const hidden = dayEvents.length - chips.length - dots.length;

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
    </div>
  );
}
