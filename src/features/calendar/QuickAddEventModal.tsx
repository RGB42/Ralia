import DateTimePicker from '@react-native-community/datetimepicker';
import { useEffect, useState } from 'react';
import { Modal, Platform, ScrollView, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Field } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { PressableScale } from '@/components/ui/PressableScale';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Text } from '@/components/ui/Text';
import { addLocalDays, formatLocalDate, minutesToTime, timeToMinutes } from '@/lib/local-date';
import { getFeatureLimit, hasProAccess } from '@/lib/premium';
import { useAuthStore } from '@/store/auth-store';
import type { NewEventInput } from '@/store/calendar-store';
import { useUpgradeModalStore } from '@/store/upgrade-modal-store';
import { useTheme } from '@/theme/ThemeProvider';
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

const INTERVAL_UNIT: Record<Exclude<RecurrenceType, null>, string> = {
  daily: 'Tage',
  weekly: 'Wochen',
  monthly: 'Monate',
  yearly: 'Jahre',
};

function timeFromDate(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function dateWithTime(base: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(base);
  d.setHours(h ?? 0, m ?? 0, 0, 0);
  return d;
}

export function QuickAddEventModal({ visible, initialDate, onClose, onSubmit }: Props) {
  const theme = useTheme();
  const profile = useAuthStore((s) => s.profile);
  const partner = useAuthStore((s) => s.partner);
  const isPro = hasProAccess(profile);
  const maxInterval = getFeatureLimit('maxRecurrenceInterval', profile);

  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [allDay, setAllDay] = useState(false);
  const [isBirthday, setIsBirthday] = useState(false);
  const [startDate, setStartDate] = useState(initialDate);
  const [endDate, setEndDate] = useState(initialDate);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [belongsTo, setBelongsTo] = useState<BelongsTo>('both');
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>(null);
  const [interval, setInterval] = useState('1');
  const [recurrenceEnd, setRecurrenceEnd] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const [picker, setPicker] = useState<'start' | 'end' | 'startTime' | 'endTime' | 'until' | null>(null);

  // Re-seed the dates whenever the sheet is opened on a different day.
  useEffect(() => {
    if (!visible) return;
    setStartDate(initialDate);
    setEndDate(initialDate);
  }, [visible, initialDate]);

  const reset = () => {
    setName('');
    setLocation('');
    setNotes('');
    setAllDay(false);
    setIsBirthday(false);
    setStartTime('09:00');
    setEndTime('10:00');
    setBelongsTo('both');
    setRecurrenceType(null);
    setInterval('1');
    setRecurrenceEnd(null);
    setPicker(null);
  };

  /** Keep end >= start, and preserve the event's duration when start moves. */
  const handleStartDateChange = (next: Date) => {
    const shift = Math.round((next.getTime() - startDate.getTime()) / 86_400_000);
    setStartDate(next);
    if (shift !== 0) setEndDate((prev) => addLocalDays(prev, shift));
    else if (endDate < next) setEndDate(next);
  };

  /** Moving the start time drags the end time along, keeping the duration. */
  const handleStartTimeChange = (next: string) => {
    const duration = Math.max(15, timeToMinutes(endTime) - timeToMinutes(startTime));
    setStartTime(next);
    setEndTime(minutesToTime(timeToMinutes(next) + duration));
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const parsed = Math.max(1, parseInt(interval, 10) || 1);
      const clamped = Math.min(parsed, maxInterval);
      await onSubmit({
        name: name.trim(),
        location: location.trim() || null,
        notes: notes.trim() || null,
        startDate: formatLocalDate(startDate),
        endDate: formatLocalDate(endDate < startDate ? startDate : endDate),
        startTime: `${startTime}:00`,
        endTime: `${endTime}:00`,
        isAllDay: allDay,
        belongsTo,
        // A birthday is inherently a yearly series, so force the recurrence
        // rather than making the user set both.
        recurrenceType: isBirthday ? 'yearly' : recurrenceType,
        recurrenceInterval: isBirthday ? 1 : recurrenceType ? clamped : 1,
        recurrenceEndDate: recurrenceEnd ? formatLocalDate(recurrenceEnd) : null,
        isBirthday,
      });
      reset();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const canSave = name.trim().length > 0 && !saving;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: theme.color.grouped }}>
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
          {/* Header */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: theme.space.xl,
              paddingVertical: theme.space.md,
              borderBottomWidth: 1,
              borderBottomColor: theme.color.separator,
            }}>
            <PressableScale onPress={onClose} hitSlop={8} haptic="none">
              <Text variant="body" tone="secondary">
                Abbrechen
              </Text>
            </PressableScale>
            <Text variant="headline">Neuer Termin</Text>
            <PressableScale onPress={handleSave} disabled={!canSave} hitSlop={8}>
              <Text variant="body" weight="600" color={canSave ? theme.color.brand : theme.color.labelQuaternary}>
                Fertig
              </Text>
            </PressableScale>
          </View>

          <ScrollView
            contentContainerStyle={{ padding: theme.space.xl, paddingBottom: theme.space['4xl'] }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <Field
              autoFocus
              value={name}
              onChangeText={setName}
              placeholder="Titel — z. B. Abendessen bei Mama"
              returnKeyType="next"
            />
            <Field
              icon="location"
              value={location}
              onChangeText={setLocation}
              placeholder="Ort (optional)"
              returnKeyType="next"
            />

            <Section title="Wer?">
              <SegmentedControl
                value={belongsTo}
                onChange={setBelongsTo}
                options={[
                  { value: 'both', label: 'Beide', icon: 'people' },
                  { value: 'user1', label: profile?.name || 'Ich', icon: 'person' },
                  { value: 'user2', label: partner?.name || 'Partner', icon: 'person' },
                ]}
              />
            </Section>

            <Section title="Zeit">
              <ToggleRow
                label="Ganztägig"
                icon="allDay"
                value={allDay}
                onValueChange={setAllDay}
                first
              />
              <PickerRow
                label="Beginn"
                icon="calendar"
                value={startDate.toLocaleDateString('de-DE', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
                onPress={() => setPicker(picker === 'start' ? null : 'start')}
                active={picker === 'start'}
              />
              {picker === 'start' ? (
                <InlinePicker
                  value={startDate}
                  mode="date"
                  onChange={(d) => {
                    handleStartDateChange(d);
                    if (Platform.OS !== 'ios') setPicker(null);
                  }}
                />
              ) : null}

              <PickerRow
                label="Ende"
                icon="calendar"
                value={endDate.toLocaleDateString('de-DE', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
                onPress={() => setPicker(picker === 'end' ? null : 'end')}
                active={picker === 'end'}
              />
              {picker === 'end' ? (
                <InlinePicker
                  value={endDate}
                  mode="date"
                  minimumDate={startDate}
                  onChange={(d) => {
                    setEndDate(d);
                    if (Platform.OS !== 'ios') setPicker(null);
                  }}
                />
              ) : null}

              {!allDay ? (
                <>
                  <PickerRow
                    label="Von"
                    icon="clock"
                    value={startTime}
                    onPress={() => setPicker(picker === 'startTime' ? null : 'startTime')}
                    active={picker === 'startTime'}
                  />
                  {picker === 'startTime' ? (
                    <InlinePicker
                      value={dateWithTime(startDate, startTime)}
                      mode="time"
                      onChange={(d) => {
                        handleStartTimeChange(timeFromDate(d));
                        if (Platform.OS !== 'ios') setPicker(null);
                      }}
                    />
                  ) : null}

                  <PickerRow
                    label="Bis"
                    icon="clock"
                    value={endTime}
                    onPress={() => setPicker(picker === 'endTime' ? null : 'endTime')}
                    active={picker === 'endTime'}
                    last
                  />
                  {picker === 'endTime' ? (
                    <InlinePicker
                      value={dateWithTime(endDate, endTime)}
                      mode="time"
                      onChange={(d) => {
                        setEndTime(timeFromDate(d));
                        if (Platform.OS !== 'ios') setPicker(null);
                      }}
                    />
                  ) : null}
                </>
              ) : null}
            </Section>

            <Section title="Wiederholung">
              <ToggleRow
                label="Geburtstag"
                icon="birthday"
                detail="Wiederholt sich automatisch jedes Jahr"
                value={isBirthday}
                onValueChange={(v) => {
                  setIsBirthday(v);
                  if (v) setRecurrenceType(null);
                }}
                first
                last
              />

              {!isBirthday ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: theme.space.md }}>
                  {RECURRENCE_OPTIONS.map((opt) => (
                    <Chip
                      key={opt.label}
                      label={opt.label}
                      selected={recurrenceType === opt.value}
                      onPress={() => setRecurrenceType(opt.value)}
                    />
                  ))}
                </View>
              ) : null}

              {!isBirthday && recurrenceType ? (
                <View style={{ marginTop: theme.space.lg }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm }}>
                    <Text variant="subheadline" tone="secondary">
                      Alle
                    </Text>
                    <Field
                      value={interval}
                      onChangeText={setInterval}
                      keyboardType="number-pad"
                      containerStyle={{ marginBottom: 0, width: 72 }}
                      textAlign="center"
                    />
                    <Text variant="subheadline" tone="secondary">
                      {INTERVAL_UNIT[recurrenceType]}
                    </Text>
                  </View>

                  {!isPro ? (
                    <PressableScale
                      onPress={() => useUpgradeModalStore.getState().open('maxRecurrenceInterval')}
                      activeScale={0.97}
                      style={{ marginTop: theme.space.sm }}>
                      <Chip label="Pro: Intervalle bis 24" icon="pro" color={theme.color.orange} />
                    </PressableScale>
                  ) : null}

                  <PickerRow
                    label="Endet am"
                    icon="repeat"
                    value={
                      recurrenceEnd
                        ? recurrenceEnd.toLocaleDateString('de-DE', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })
                        : 'Nie'
                    }
                    onPress={() => setPicker(picker === 'until' ? null : 'until')}
                    active={picker === 'until'}
                    first
                    last
                    style={{ marginTop: theme.space.md }}
                  />
                  {picker === 'until' ? (
                    <>
                      <InlinePicker
                        value={recurrenceEnd ?? addLocalDays(startDate, 30)}
                        mode="date"
                        minimumDate={startDate}
                        onChange={(d) => {
                          setRecurrenceEnd(d);
                          if (Platform.OS !== 'ios') setPicker(null);
                        }}
                      />
                      {recurrenceEnd ? (
                        <Button
                          label="Kein Enddatum"
                          variant="plain"
                          size="sm"
                          onPress={() => {
                            setRecurrenceEnd(null);
                            setPicker(null);
                          }}
                          style={{ alignSelf: 'center' }}
                        />
                      ) : null}
                    </>
                  ) : null}
                </View>
              ) : null}
            </Section>

            <Section title="Notiz">
              <Field
                value={notes}
                onChangeText={setNotes}
                placeholder="Details, Links, Einkaufsliste …"
                multiline
                numberOfLines={4}
                containerStyle={{ marginBottom: 0 }}
                inputStyle={{ minHeight: 88, textAlignVertical: 'top' }}
              />
            </Section>

            <Button
              label="Termin speichern"
              onPress={handleSave}
              loading={saving}
              disabled={!name.trim()}
              fullWidth
              style={{ marginTop: theme.space.lg }}
            />
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={{ marginTop: theme.space.lg, marginBottom: theme.space.lg }}>
      <Text
        variant="footnote"
        tone="secondary"
        weight="500"
        style={{
          marginBottom: theme.space.sm,
          marginLeft: theme.space.xs,
          textTransform: 'uppercase',
          letterSpacing: 0.6,
        }}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function rowStyle(theme: ReturnType<typeof useTheme>, first?: boolean, last?: boolean) {
  return {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.space.md,
    backgroundColor: theme.color.groupedElevated,
    paddingHorizontal: theme.space.lg,
    paddingVertical: theme.space.md,
    minHeight: 48,
    borderTopLeftRadius: first ? theme.radius.md : 0,
    borderTopRightRadius: first ? theme.radius.md : 0,
    borderBottomLeftRadius: last ? theme.radius.md : 0,
    borderBottomRightRadius: last ? theme.radius.md : 0,
    borderTopWidth: first ? 0 : 1,
    borderTopColor: theme.color.separator,
  };
}

function ToggleRow({
  label,
  detail,
  icon,
  value,
  onValueChange,
  first,
  last,
}: {
  label: string;
  detail?: string;
  icon: 'allDay' | 'birthday';
  value: boolean;
  onValueChange: (v: boolean) => void;
  first?: boolean;
  last?: boolean;
}) {
  const theme = useTheme();
  return (
    <View style={rowStyle(theme, first, last)}>
      <Icon name={icon} size={18} color={theme.color.labelSecondary} />
      <View style={{ flex: 1 }}>
        <Text variant="body">{label}</Text>
        {detail ? (
          <Text variant="caption" tone="tertiary">
            {detail}
          </Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ true: theme.color.brand, false: theme.color.fill }}
        thumbColor="#FFFFFF"
      />
    </View>
  );
}

function PickerRow({
  label,
  value,
  icon,
  onPress,
  active,
  first,
  last,
  style,
}: {
  label: string;
  value: string;
  icon: 'calendar' | 'clock' | 'repeat';
  onPress: () => void;
  active?: boolean;
  first?: boolean;
  last?: boolean;
  style?: object;
}) {
  const theme = useTheme();
  return (
    <PressableScale onPress={onPress} activeScale={0.995} haptic="none" style={[rowStyle(theme, first, last), style]}>
      <Icon name={icon} size={18} color={theme.color.labelSecondary} />
      <Text variant="body" style={{ flex: 1 }}>
        {label}
      </Text>
      <Text variant="body" color={active ? theme.color.brand : theme.color.labelSecondary}>
        {value}
      </Text>
    </PressableScale>
  );
}

/**
 * On iOS the spinner stays open until dismissed, so it's rendered inline under
 * the row it belongs to. On Android the platform dialog closes itself, which is
 * why callers clear `picker` there.
 */
function InlinePicker({
  value,
  mode,
  minimumDate,
  onChange,
}: {
  value: Date;
  mode: 'date' | 'time';
  minimumDate?: Date;
  onChange: (d: Date) => void;
}) {
  const theme = useTheme();
  return (
    <View
      style={{
        backgroundColor: theme.color.groupedElevated,
        borderTopWidth: 1,
        borderTopColor: theme.color.separator,
        alignItems: 'center',
      }}>
      <DateTimePicker
        value={value}
        mode={mode}
        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
        minimumDate={minimumDate}
        is24Hour
        onChange={(_, d) => d && onChange(d)}
      />
    </View>
  );
}
