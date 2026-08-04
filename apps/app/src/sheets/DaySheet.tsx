import { BottomSheet, Button, EmptyState, personTokens } from '@ralia/ui';
import { useT } from '../i18n/useT.js';
import type { MockEvent } from '../mock/fixtures.js';
import { MOCK_TODAY } from '../mock/fixtures.js';
import { dayLabel, weekdayShort } from '../screens/calendar/calendar-labels.js';
import styles from './sheets.module.css';
import { useLongPress } from './use-long-press.js';

export interface DaySheetProps {
  open: boolean;
  iso: string | null;
  events: readonly MockEvent[];
  onClose(): void;
  onEdit(event: MockEvent): void;
  onAdd(): void;
}

/** Eine Zeile, damit useLongPress je Termin seinen eigenen Timer bekommt. */
function DayEventRow({
  event,
  allDayLabel,
  onEdit,
}: {
  event: MockEvent;
  allDayLabel: string;
  onEdit(): void;
}): React.JSX.Element {
  const tokens = personTokens(event.slot);
  const press = useLongPress(onEdit);
  const timed = event.start !== '';
  return (
    <button
      type="button"
      className={styles.dayEvent}
      data-testid="day-event"
      style={{ background: tokens.bg, borderLeftColor: tokens.bar, color: tokens.fg }}
      {...press}
    >
      {/*
       * Ganztaegige Termine bekommen eine Kennzeichnung statt eines leeren
       * Feldes. Die Vorlage laesst die Spalte leer, was in einer nach Zeit
       * sortierten Liste wie ein fehlender Wert aussieht.
       */}
      <span className={styles.dayTime}>{timed ? event.start : allDayLabel}</span>
      <span className={styles.dayBody}>
        <span className={styles.dayTitle}>{event.title}</span>
        <span className={styles.daySub}>
          {[timed ? `${event.start}–${event.end}` : allDayLabel, event.location]
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
    .filter((event) => event.iso === iso)
    .slice()
    .sort((a, b) => (a.start || '00:00').localeCompare(b.start || '00:00'));

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      maxHeight="78%"
      closeLabel={t('sheetClose')}
      kicker={iso === MOCK_TODAY ? t('today') : weekdayShort(iso, lang)}
      title={dayLabel(iso, lang)}
    >
      <div className={styles.dayList}>
        {dayEvents.map((event, index) => (
          <DayEventRow
            key={`${event.iso}-${index}`}
            event={event}
            allDayLabel={t('sheetAllDay')}
            onEdit={() => onEdit(event)}
          />
        ))}
        {dayEvents.length === 0 ? <EmptyState message={t('sheetDayEmpty')} /> : null}
      </div>
      <div className={styles.hint}>{t('sheetLongPressHint')}</div>
      <div className={styles.actions}>
        <Button fullWidth onClick={onAdd}>
          {t('calAddEvent')}
        </Button>
      </div>
    </BottomSheet>
  );
}
