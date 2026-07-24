import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';

import { Screen } from '@/components/ui/Screen';
import { QuickAddEventModal } from '@/features/calendar/QuickAddEventModal';
import { getEventColor, getEventIcon } from '@/features/calendar/ownership';
import { formatLocalDate, isSameLocalDay, parseLocalDate, startOfLocalMonth } from '@/lib/local-date';
import { useAuthStore } from '@/store/auth-store';
import { useCalendarStore } from '@/store/calendar-store';
import type { CalendarEvent } from '@/types/calendar';

const WEEKDAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const MONTH_LABELS = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

function buildMonthGrid(monthStart: Date): Date[] {
  // Monday-first grid, always 42 cells (6 weeks) so the layout never jumps.
  const firstWeekday = (monthStart.getDay() + 6) % 7; // 0=Mon
  const gridStart = new Date(monthStart);
  gridStart.setDate(gridStart.getDate() - firstWeekday);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(d.getDate() + i);
    return d;
  });
}

export default function CalendarScreen() {
  const profile = useAuthStore((s) => s.profile);
  const partner = useAuthStore((s) => s.partner);
  const calendarId = useAuthStore((s) => s.calendarId);
  const { load, eventsInRange, deleteOccurrence, deleteSeries, addEvent } = useCalendarStore();

  const [monthAnchor, setMonthAnchor] = useState(() => startOfLocalMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    if (calendarId) load(calendarId);
  }, [calendarId, load]);

  const grid = useMemo(() => buildMonthGrid(monthAnchor), [monthAnchor]);
  const rangeStart = grid[0];
  const rangeEnd = grid[grid.length - 1];
  const events = eventsInRange(rangeStart, rangeEnd);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of events) {
      const key = ev.occurrenceDate;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(ev);
    }
    return map;
  }, [events]);

  const selectedDayEvents = (eventsByDay.get(formatLocalDate(selectedDate)) ?? []).sort((a, b) => a.start_time.localeCompare(b.start_time));

  const handleDeleteEvent = (event: CalendarEvent) => {
    const options: Parameters<typeof Alert.alert>[2] = [
      { text: event.isRecurrenceInstance ? 'Diesen Termin löschen' : 'Löschen', style: 'destructive', onPress: () => deleteOccurrence(event) },
    ];
    if (event.isRecurrenceInstance) {
      options.push({ text: 'Ganze Serie löschen', style: 'destructive', onPress: () => deleteSeries(event.id) });
    }
    options.push({ text: 'Abbrechen', style: 'cancel' });
    Alert.alert(event.name, undefined, options);
  };

  return (
    <Screen>
      <View className="flex-1">
        <View className="flex-row items-center justify-between px-5 pt-4">
          <Text className="text-2xl font-semibold text-gray-800">
            {MONTH_LABELS[monthAnchor.getMonth()]} {monthAnchor.getFullYear()}
          </Text>
          <View className="flex-row gap-4">
            <Pressable onPress={() => setMonthAnchor(new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() - 1, 1))}>
              <Text className="text-xl text-purple-500">‹</Text>
            </Pressable>
            <Pressable onPress={() => setMonthAnchor(new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() + 1, 1))}>
              <Text className="text-xl text-purple-500">›</Text>
            </Pressable>
          </View>
        </View>

        <View className="flex-row px-5 pt-4">
          {WEEKDAY_LABELS.map((label) => (
            <Text key={label} className="flex-1 text-center text-xs font-medium text-gray-400">{label}</Text>
          ))}
        </View>

        <View className="flex-row flex-wrap px-3 pt-1">
          {grid.map((day) => {
            const inMonth = day.getMonth() === monthAnchor.getMonth();
            const isToday = isSameLocalDay(day, new Date());
            const isSelected = isSameLocalDay(day, selectedDate);
            const dayEvents = eventsByDay.get(formatLocalDate(day)) ?? [];
            return (
              <Pressable key={day.toISOString()} onPress={() => setSelectedDate(day)} className="w-[14.28%] items-center py-1.5">
                <View
                  className={`h-9 w-9 items-center justify-center rounded-full ${
                    isSelected ? 'bg-purple-500' : isToday ? 'border-2 border-purple-400' : ''
                  }`}>
                  <Text className={`text-sm ${isSelected ? 'text-white' : inMonth ? 'text-gray-700' : 'text-gray-300'}`}>{day.getDate()}</Text>
                </View>
                <View className="mt-1 flex-row gap-0.5">
                  {dayEvents.slice(0, 3).map((ev) => (
                    <View key={ev.renderKey} className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: getEventColor(ev, profile?.id, partner?.id) }} />
                  ))}
                </View>
              </Pressable>
            );
          })}
        </View>

        <View className="mt-3 h-px bg-gray-100" />

        <ScrollView className="flex-1 px-5 pt-4">
          <Text className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">
            {isSameLocalDay(selectedDate, new Date()) ? 'Heute' : selectedDate.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}
          </Text>
          {selectedDayEvents.length === 0 ? (
            <Text className="text-sm text-gray-400">Keine Termine an diesem Tag.</Text>
          ) : (
            selectedDayEvents.map((ev) => (
              <Pressable
                key={ev.renderKey}
                onLongPress={() => handleDeleteEvent(ev)}
                delayLongPress={420}
                className="mb-2.5 flex-row items-center rounded-2xl border border-gray-100 bg-white p-3.5">
                <View className="mr-3 h-2.5 w-2.5 rounded-full" style={{ backgroundColor: getEventColor(ev, profile?.id, partner?.id) }} />
                <View className="flex-1">
                  <Text className="text-base font-medium text-gray-800">
                    {getEventIcon(ev)} {ev.name}
                  </Text>
                  <Text className="text-xs text-gray-500">
                    {ev.start_time === '00:00:00' && ev.end_time === '23:59:00' ? 'Ganztägig' : ev.start_time.slice(0, 5)}
                    {ev.location ? ` · ${ev.location}` : ''}
                  </Text>
                </View>
              </Pressable>
            ))
          )}
        </ScrollView>
      </View>

      <Pressable
        onPress={() => setModalVisible(true)}
        className="absolute bottom-6 right-6 h-16 w-16 items-center justify-center rounded-full bg-purple-500 shadow-lg shadow-purple-900/30">
        <Text className="text-3xl text-white">＋</Text>
      </Pressable>

      <QuickAddEventModal
        visible={modalVisible}
        initialDate={selectedDate}
        onClose={() => setModalVisible(false)}
        onSubmit={async (input) => {
          if (!profile?.id || !calendarId) return;
          await addEvent({ ...input, createdBy: profile.id, calendarId });
        }}
      />
    </Screen>
  );
}
