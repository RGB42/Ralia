import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { formatLocalDate } from '@/lib/local-date';
import { getFeatureLimit, hasProAccess } from '@/lib/premium';
import { useAuthStore } from '@/store/auth-store';
import { useUpgradeModalStore } from '@/store/upgrade-modal-store';
import type { NewEventInput } from '@/store/calendar-store';
import type { BelongsTo, RecurrenceType } from '@/types/database';

interface Props {
  visible: boolean;
  initialDate: Date;
  onClose: () => void;
  onSubmit: (input: Omit<NewEventInput, 'createdBy' | 'calendarId'>) => Promise<void>;
}

const RECURRENCE_OPTIONS: { value: RecurrenceType; label: string }[] = [
  { value: null, label: 'Einmalig' },
  { value: 'daily', label: 'Täglich' },
  { value: 'weekly', label: 'Wöchentlich' },
  { value: 'monthly', label: 'Monatlich' },
  { value: 'yearly', label: 'Jährlich' },
];

function combineDateAndTime(date: Date, time: Date): Date {
  const d = new Date(date);
  d.setHours(time.getHours(), time.getMinutes(), 0, 0);
  return d;
}

function formatTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:00`;
}

export function QuickAddEventModal({ visible, initialDate, onClose, onSubmit }: Props) {
  const profile = useAuthStore((s) => s.profile);
  const partner = useAuthStore((s) => s.partner);
  const isPro = hasProAccess(profile);

  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [isAllDay, setIsAllDay] = useState(false);
  const [startDate, setStartDate] = useState(initialDate);
  const [startTime, setStartTime] = useState(() => {
    const d = new Date(initialDate);
    d.setHours(9, 0, 0, 0);
    return d;
  });
  const [belongsTo, setBelongsTo] = useState<BelongsTo>('both');
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>(null);
  const [recurrenceInterval, setRecurrenceInterval] = useState('1');
  const [saving, setSaving] = useState(false);

  const maxInterval = getFeatureLimit('maxRecurrenceInterval', profile);

  const reset = () => {
    setName('');
    setLocation('');
    setIsAllDay(false);
    setBelongsTo('both');
    setRecurrenceType(null);
    setRecurrenceInterval('1');
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const interval = Math.min(Math.max(1, parseInt(recurrenceInterval, 10) || 1), maxInterval);
      await onSubmit({
        name: name.trim(),
        location: location.trim() || null,
        notes: null,
        startDate: formatLocalDate(startDate),
        endDate: formatLocalDate(startDate),
        startTime: formatTime(startTime),
        endTime: formatTime(combineDateAndTime(startDate, new Date(startTime.getTime() + 60 * 60 * 1000))),
        isAllDay,
        belongsTo,
        recurrenceType,
        recurrenceInterval: recurrenceType ? interval : 1,
        recurrenceEndDate: null,
      });
      reset();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView className="flex-1 bg-white">
        <View className="flex-row items-center justify-between border-b border-gray-100 px-5 py-4">
          <Pressable onPress={onClose}>
            <Text className="text-base text-gray-500">Abbrechen</Text>
          </Pressable>
          <Text className="text-base font-semibold text-gray-800">Neuer Termin</Text>
          <Pressable onPress={handleSave} disabled={!name.trim() || saving}>
            <Text className={`text-base font-semibold ${name.trim() ? 'text-purple-600' : 'text-gray-300'}`}>Fertig</Text>
          </Pressable>
        </View>

        <ScrollView className="flex-1 px-5 pt-5" keyboardShouldPersistTaps="handled">
          <TextInput
            autoFocus
            value={name}
            onChangeText={setName}
            placeholder="Titel — z.B. Abendessen bei Mama"
            placeholderTextColor="#9ca3af"
            className="mb-4 rounded-xl border border-gray-200 px-4 py-3.5 text-base"
          />
          <TextInput
            value={location}
            onChangeText={setLocation}
            placeholder="Ort (optional)"
            placeholderTextColor="#9ca3af"
            className="mb-5 rounded-xl border border-gray-200 px-4 py-3.5 text-base"
          />

          <View className="mb-5 flex-row items-center justify-between rounded-xl bg-gray-50 px-4 py-3.5">
            <Text className="text-base text-gray-700">Ganztägig</Text>
            <Switch value={isAllDay} onValueChange={setIsAllDay} trackColor={{ true: '#a855f7' }} />
          </View>

          <Text className="mb-2 text-sm font-medium text-gray-600">Datum</Text>
          <DateTimePicker
            value={startDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'compact' : 'default'}
            onChange={(_, date) => date && setStartDate(date)}
            style={{ alignSelf: 'flex-start', marginBottom: 16 }}
          />

          {!isAllDay && (
            <>
              <Text className="mb-2 text-sm font-medium text-gray-600">Uhrzeit</Text>
              <DateTimePicker
                value={startTime}
                mode="time"
                display={Platform.OS === 'ios' ? 'compact' : 'default'}
                onChange={(_, time) => time && setStartTime(time)}
                style={{ alignSelf: 'flex-start', marginBottom: 16 }}
              />
            </>
          )}

          <Text className="mb-2 text-sm font-medium text-gray-600">Wer?</Text>
          <View className="mb-5 flex-row rounded-xl bg-gray-100 p-1">
            {(
              [
                { value: 'both', label: 'Beide 💕' },
                { value: 'user1', label: 'Ich' },
                { value: 'user2', label: partner?.name ?? 'Partner' },
              ] as { value: BelongsTo; label: string }[]
            ).map((opt) => (
              <Pressable
                key={opt.value}
                onPress={() => setBelongsTo(opt.value)}
                className={`flex-1 items-center rounded-lg py-2 ${belongsTo === opt.value ? 'bg-white shadow-sm' : ''}`}>
                <Text className={`text-sm font-medium ${belongsTo === opt.value ? 'text-purple-600' : 'text-gray-500'}`}>{opt.label}</Text>
              </Pressable>
            ))}
          </View>

          <Text className="mb-2 text-sm font-medium text-gray-600">Wiederholung</Text>
          <View className="mb-2 flex-row flex-wrap gap-2">
            {RECURRENCE_OPTIONS.map((opt) => (
              <Pressable
                key={opt.label}
                onPress={() => setRecurrenceType(opt.value)}
                className={`rounded-full border px-3.5 py-2 ${recurrenceType === opt.value ? 'border-purple-400 bg-purple-50' : 'border-gray-200'}`}>
                <Text className={`text-sm ${recurrenceType === opt.value ? 'text-purple-600' : 'text-gray-500'}`}>{opt.label}</Text>
              </Pressable>
            ))}
          </View>

          {recurrenceType && (
            <View className="mb-4 flex-row items-center gap-2">
              <Text className="text-sm text-gray-500">Alle</Text>
              <TextInput
                value={recurrenceInterval}
                onChangeText={setRecurrenceInterval}
                keyboardType="number-pad"
                className="w-16 rounded-lg border border-gray-200 px-3 py-2 text-center text-sm"
              />
              <Text className="text-sm text-gray-500">
                {recurrenceType === 'daily' ? 'Tag(e)' : recurrenceType === 'weekly' ? 'Woche(n)' : recurrenceType === 'monthly' ? 'Monat(e)' : 'Jahr(e)'}
              </Text>
              {!isPro && (
                <Pressable onPress={() => useUpgradeModalStore.getState().open('maxRecurrenceInterval')} className="ml-1">
                  <Text className="text-xs text-purple-600">Pro: bis 24 ✨</Text>
                </Pressable>
              )}
            </View>
          )}
        </ScrollView>

        <View className="px-5 pb-4">
          <Button label="Termin speichern" onPress={handleSave} loading={saving} disabled={!name.trim()} fullWidth />
        </View>
      </SafeAreaView>
    </Modal>
  );
}
