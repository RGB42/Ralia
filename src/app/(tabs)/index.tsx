import { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { FAB } from '@/components/ui/FAB';
import { Icon } from '@/components/ui/Icon';
import { PressableScale } from '@/components/ui/PressableScale';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { MonthView } from '@/features/calendar/MonthView';
import { QuickAddEventModal } from '@/features/calendar/QuickAddEventModal';
import { indexHolidays, loadHolidays, type Holiday } from '@/features/calendar/holidays';
import {
  getEventIconName,
  getEventRole,
  getOwnerLabel,
  isProfileManagedEvent,
} from '@/features/calendar/ownership';
import {
  addLocalDays,
  formatLocalDate,
  isAllDay,
  isSameLocalDay,
  normalizeTime,
  startOfLocalMonth,
} from '@/lib/local-date';
import { useAuthStore } from '@/store/auth-store';
import { useCalendarStore } from '@/store/calendar-store';
import { SCROLL_BOTTOM_PADDING } from '@/theme/layout';
import { useTheme } from '@/theme/ThemeProvider';
import type { CalendarEvent } from '@/types/calendar';

const MONTHS = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

export default function CalendarScreen() {
  const theme = useTheme();
  const profile = useAuthStore((s) => s.profile);
  const partner = useAuthStore((s) => s.partner);
  const calendarId = useAuthStore((s) => s.calendarId);
  const { load, eventsInRange, addEvent } = useCalendarStore();

  const [monthAnchor, setMonthAnchor] = useState(() => startOfLocalMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [composerOpen, setComposerOpen] = useState(false);
  const [holidays, setHolidays] = useState<Map<string, Holiday>>(new Map());

  useEffect(() => {
    if (calendarId) load(calendarId);
  }, [calendarId, load]);

  useEffect(() => {
    // Non-blocking: the grid renders without holidays and fills them in.
    loadHolidays('DE')
      .then((list) => setHolidays(indexHolidays(list)))
      .catch(() => {});
  }, []);

  // Expand a generous window so multi-day and recurring events that start
  // outside the visible month still produce segments inside it.
  const events = useMemo(() => {
    const from = addLocalDays(startOfLocalMonth(monthAnchor), -45);
    const to = addLocalDays(startOfLocalMonth(monthAnchor), 90);
    return eventsInRange(from, to);
  }, [monthAnchor, eventsInRange]);

  const selectedKey = formatLocalDate(selectedDate);

  const dayEvents = useMemo(
    () =>
      events
        .filter((e) => e.start_date <= selectedKey && e.end_date >= selectedKey)
        .sort((a, b) => {
          // All-day first, then by start time.
          const aAll = isAllDay(a);
          const bAll = isAllDay(b);
          if (aAll !== bAll) return aAll ? -1 : 1;
          return normalizeTime(a.start_time).localeCompare(normalizeTime(b.start_time));
        }),
    [events, selectedKey]
  );

  const selectedHoliday = holidays.get(selectedKey);
  const isToday = isSameLocalDay(selectedDate, new Date());

  const shiftMonth = (delta: number) => {
    setMonthAnchor((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  };

  const goToToday = () => {
    const today = new Date();
    setMonthAnchor(startOfLocalMonth(today));
    setSelectedDate(today);
  };

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ paddingBottom: SCROLL_BOTTOM_PADDING }}
        showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: theme.space.xl,
            paddingTop: theme.space.sm,
            paddingBottom: theme.space.lg,
          }}>
          <View style={{ flex: 1 }}>
            <Text variant="title1">{MONTHS[monthAnchor.getMonth()]}</Text>
            <Text variant="subheadline" tone="secondary">
              {monthAnchor.getFullYear()}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.xs }}>
            <RoundButton icon="today" onPress={goToToday} />
            <RoundButton icon="chevronLeft" onPress={() => shiftMonth(-1)} />
            <RoundButton icon="chevronRight" onPress={() => shiftMonth(1)} />
          </View>
        </View>

        <MonthView
          monthAnchor={monthAnchor}
          events={events}
          selectedKey={selectedKey}
          onSelectDay={setSelectedDate}
          viewerId={profile?.id}
          partnerId={partner?.id}
          holidays={holidays}
        />

        {/* Selected day */}
        <View style={{ paddingHorizontal: theme.space.xl, paddingTop: theme.space['2xl'] }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm }}>
            <Text variant="headline">
              {isToday
                ? 'Heute'
                : selectedDate.toLocaleDateString('de-DE', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                  })}
            </Text>
            {dayEvents.length > 0 ? (
              <Text variant="footnote" tone="tertiary">
                {dayEvents.length}
              </Text>
            ) : null}
          </View>

          {selectedHoliday ? (
            <View style={{ marginTop: theme.space.md }}>
              <Chip
                label={selectedHoliday.localName || selectedHoliday.name}
                icon="holiday"
                color={theme.event.holiday.solid}
              />
            </View>
          ) : null}

          {dayEvents.length === 0 ? (
            <EmptyState
              icon="calendar"
              title="Keine Termine"
              message="An diesem Tag ist noch nichts geplant."
              compact
            />
          ) : (
            <View style={{ marginTop: theme.space.md, gap: theme.space.sm }}>
              {dayEvents.map((event) => (
                <EventRow
                  key={event.renderKey}
                  event={event}
                  viewerId={profile?.id}
                  partnerId={partner?.id}
                  myName={profile?.name}
                  partnerName={partner?.name}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      <FAB onPress={() => setComposerOpen(true)} />

      <QuickAddEventModal
        visible={composerOpen}
        initialDate={selectedDate}
        onClose={() => setComposerOpen(false)}
        onSubmit={async (input) => {
          if (!profile?.id || !calendarId) return;
          await addEvent({ ...input, createdBy: profile.id, calendarId });
        }}
      />
    </Screen>
  );
}

function RoundButton({ icon, onPress }: { icon: 'today' | 'chevronLeft' | 'chevronRight'; onPress: () => void }) {
  const theme = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      activeScale={0.88}
      hitSlop={6}
      style={{
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.color.fillTertiary,
      }}>
      <Icon name={icon} size={18} color={theme.color.label} />
    </PressableScale>
  );
}

interface EventRowProps {
  event: CalendarEvent;
  viewerId: string | undefined;
  partnerId: string | undefined;
  myName: string | null | undefined;
  partnerName: string | null | undefined;
}

function EventRow({ event, viewerId, partnerId, myName, partnerName }: EventRowProps) {
  const theme = useTheme();
  const role = getEventRole(event, viewerId, partnerId);
  const colors = theme.event[role];
  const iconName = getEventIconName(event);
  const allDay = isAllDay(event);
  const multiDay = event.start_date !== event.end_date;
  const managed = isProfileManagedEvent(event);

  const timeLabel = allDay
    ? 'Ganztägig'
    : `${normalizeTime(event.start_time)} – ${normalizeTime(event.end_time)}`;

  return (
    <PressableScale
      activeScale={0.985}
      dim
      style={{
        flexDirection: 'row',
        backgroundColor: theme.color.groupedElevated,
        borderRadius: theme.radius.lg,
        borderCurve: 'continuous',
        overflow: 'hidden',
      }}>
      {/* Role color spine */}
      <View style={{ width: 4, backgroundColor: colors.solid }} />

      <View style={{ flex: 1, padding: theme.space.md, gap: 5 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          {iconName ? <Icon name={iconName} size={14} color={colors.solid} /> : null}
          <Text variant="callout" weight="600" numberOfLines={1} style={{ flex: 1 }}>
            {event.name}
          </Text>
          {managed ? <Icon name="lock" size={12} color={theme.color.labelTertiary} /> : null}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
          <Icon name={allDay ? 'allDay' : 'clock'} size={12} color={theme.color.labelTertiary} />
          <Text variant="footnote" tone="secondary">
            {timeLabel}
          </Text>
          {event.isRecurrenceInstance ? (
            <Icon name="repeat" size={12} color={theme.color.labelTertiary} />
          ) : null}
          {event.reminder_enabled ? (
            <Icon name="bell" size={12} color={theme.color.labelTertiary} />
          ) : null}
        </View>

        {event.location ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Icon name="location" size={12} color={theme.color.labelTertiary} />
            <Text variant="footnote" tone="secondary" numberOfLines={1} style={{ flex: 1 }}>
              {event.location}
            </Text>
          </View>
        ) : null}

        <View style={{ flexDirection: 'row', gap: 5, marginTop: 1 }}>
          <Chip
            label={getOwnerLabel(event, viewerId, partnerId, myName, partnerName)}
            icon={role === 'both' ? 'people' : 'person'}
            color={colors.solid}
            size="sm"
          />
          {multiDay ? <Chip label="Mehrtägig" icon="calendar" size="sm" /> : null}
        </View>
      </View>
    </PressableScale>
  );
}
