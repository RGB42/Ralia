import { BottomSheet, Button, EmptyState, personTokens } from '@ralia/ui';
import { useT } from '../i18n/useT.js';
import type { CalendarEvent } from '../screens/calendar/calendar-event.js';
import { dayLabel, weekdayShort } from '../screens/calendar/calendar-labels.js';
import styles from './sheets.module.css';
import { useLongPress } from './use-long-press.js';

export interface DaySheetProps {
  open: boolean;
  iso: string | null;
  events: readonly CalendarEvent[];
  onClose(): void;
  onEdit(event: CalendarEvent): void;
  onAdd(): void;
}

/** Eine Zeile, damit useLongPress je Termin seinen eigenen Timer bekommt. */
function DayEventRow({
  event,
  dayIso,
  startDateLabel,
  endDateLabel,
  allDayLabel,
  onEdit,
}: {
  event: CalendarEvent;
  dayIso: string;
  startDateLabel: string;
  endDateLabel: string;
  allDayLabel: string;
  onEdit(): void;
}): React.JSX.Element {
  const tokens = personTokens(event.slot);
  const press = useLongPress(onEdit);
  const timed = event.start !== '';
  const endIso = event.endIso ?? event.iso;
  const spansDays = endIso > event.iso;
  const timeLabel = !timed
    ? allDayLabel
    : !spansDays
      ? event.start
      : dayIso === event.iso
        ? `${event.start} →`
        : dayIso === endIso
          ? `→ ${event.end}`
          : allDayLabel;
  const rangeLabel = !timed
    ? allDayLabel
    : !spansDays
      ? `${event.start}–${event.end}`
      : dayIso === event.iso
        ? `${event.start} – ${endDateLabel}`
        : dayIso === endIso
          ? `${startDateLabel} – ${event.end}`
          : `${startDateLabel} – ${endDateLabel}`;
  return (
    <button
      type="button"
      className={styles.dayEvent}
      data-testid="day-event"
      onClick={onEdit}
      style={{ background: tokens.bg, borderLeftColor: tokens.bar, color: tokens.fg }}
      {...press}
    >
      {/*
       * Ganztaegige Termine bekommen eine Kennzeichnung statt eines leeren
       * Feldes. Die Vorlage laesst die Spalte leer, was in einer nach Zeit
       * sortierten Liste wie ein fehlender Wert aussieht.
       */}
      <span className={styles.dayTime}>{timeLabel}</span>
      <span className={styles.dayBody}>
        <span className={styles.dayTitle}>{event.title}</span>
        <span className={styles.daySub}>
          {[rangeLabel, event.location]
            .filter(Boolean)
            .join(' · ')}
        </span>
      </span>
      <span className={styles.dayDot} style={{ background: tokens.bar }} aria-hidden="true" />
    </button>
  );
}

export function DaySheet({
  open,
  iso,
  events,
  onClose,
  onEdit,
  onAdd,
}: DaySheetProps): React.JSX.Element | null {
  const { t, lang } = useT();
  if (!iso) return null;

  // Ganztaegige zuerst, danach nach Startzeit — eine leere Zeit sortiert
  // sonst je nach Vergleich irgendwohin.
  const dayEvents = events
    .filter((event) => event.iso <= iso && (event.endIso ?? event.iso) >= iso)
    .slice()
    .sort((a, b) => (a.start || '00:00').localeCompare(b.start || '00:00'));

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      maxHeight="78%"
      closeLabel={t('sheetClose')}
      kicker={iso === localTodayIso() ? t('today') : weekdayShort(iso, lang)}
      title={dayLabel(iso, lang)}
    >
      <div className={styles.dayList}>
        {dayEvents.map((event, index) => (
          <DayEventRow
            key={`${event.iso}-${index}`}
            event={event}
            dayIso={iso}
            startDateLabel={dayLabel(event.iso, lang)}
            endDateLabel={dayLabel(event.endIso ?? event.iso, lang)}
            allDayLabel={t('sheetAllDay')}
            onEdit={() => onEdit(event)}
          />
        ))}
        {dayEvents.length === 0 ? <EmptyState message={t('sheetDayEmpty')} /> : null}
      </div>
      <div className={styles.actions}>
        <Button fullWidth onClick={onAdd}>
          {t('calAddEvent')}
        </Button>
      </div>
    </BottomSheet>
  );
}

function localTodayIso(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}
