import DateTimePicker from '@react-native-community/datetimepicker';
import { useEffect, useState } from 'react';
import { Alert, Modal, Platform, ScrollView, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Field } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { PressableScale } from '@/components/ui/PressableScale';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Text } from '@/components/ui/Text';
import {
  getDisplayBelongsTo,
  isProfileManagedEvent,
  toStorageBelongsTo,
} from '@/features/calendar/ownership';
import {
  addLocalDays,
  formatLocalDate,
  isAllDay as detectAllDay,
  minutesToTime,
  normalizeTime,
  parseLocalDate,
  timeToMinutes,
} from '@/lib/local-date';
import { getFeatureLimit, hasProAccess } from '@/lib/premium';
import { useAuthStore } from '@/store/auth-store';
import { useCalendarStore, type EditScope, type NewEventInput } from '@/store/calendar-store';
import { toast } from '@/store/toast-store';
import { useUpgradeModalStore } from '@/store/upgrade-modal-store';
import { useTheme } from '@/theme/ThemeProvider';
import type { CalendarEvent } from '@/types/calendar';
import type { BelongsTo, RecurrenceType } from '@/types/database';

type ComposerInput = Omit<NewEventInput, 'createdBy' | 'calendarId'>;

interface Props {
  visible: boolean;
  /** Seed date for a new event; ignored when editing. */
  initialDate: Date;
  /** Present = edit mode. */
  event?: CalendarEvent | null;
  onClose: () => void;
  onCreate: (input: ComposerInput) => Promise<void>;
  onUpdate: (event: CalendarEvent, input: ComposerInput, scope: EditScope) => Promise<void>;
  onDelete: (event: CalendarEvent, scope: EditScope) => Promise<void>;
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

const SCOPE_LABEL: Record<EditScope, string> = {
  occurrence: 'Nur dieser',
  future: 'Ab hier',
  series: 'Ganze Serie',
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

function formatDayLabel(date: Date): string {
  return date.toLocaleDateString('de-DE', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function EventComposer({
  visible,
  initialDate,
  event,
  onClose,
  onCreate,
  onUpdate,
  onDelete,
}: Props) {
  const theme = useTheme();
  const profile = useAuthStore((s) => s.profile);
  const partner = useAuthStore((s) => s.partner);
  const getMaster = useCalendarStore((s) => s.getMaster);
  const isPro = hasProAccess(profile);
  const maxInterval = getFeatureLimit('maxRecurrenceInterval', profile);

  const isEdit = !!event;
  const managed = event ? isProfileManagedEvent(event) : false;
  const isSeries = !!event?.isRecurrenceInstance;

  const [scope, setScope] = useState<EditScope>('occurrence');
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

  // Seed the form whenever the sheet opens — from the event when editing,
  // from defaults otherwise.
  useEffect(() => {
    if (!visible) return;
    setPicker(null);
    setSaving(false);

    if (event) {
      // Recurrence settings live on the MASTER row. An overridden occurrence has
      // them nulled out, so reading them off the instance would lose the rule.
      const master = getMaster(event.id);
      const eventAllDay = detectAllDay(event);

      setScope(event.isRecurrenceInstance ? 'occurrence' : 'series');
      setName(event.name);
      setLocation(event.location ?? '');
      setNotes(event.notes ?? '');
      setAllDay(eventAllDay);
      setIsBirthday(event.event_type === 'birthday');
      setStartDate(parseLocalDate(event.start_date));
      setEndDate(parseLocalDate(event.end_date));
      setStartTime(eventAllDay ? '09:00' : normalizeTime(event.start_time));
      setEndTime(eventAllDay ? '10:00' : normalizeTime(event.end_time));
      // Shown in the viewer's frame; re-encoded to creator-relative on save.
      setBelongsTo(getDisplayBelongsTo(event, profile?.id, partner?.id));
      setRecurrenceType(master?.recurrence_type ?? event.recurrence_type ?? null);
      setInterval(String(master?.recurrence_interval ?? event.recurrence_interval ?? 1));
      setRecurrenceEnd(master?.recurrence_end_date ? parseLocalDate(master.recurrence_end_date) : null);
      return;
    }

    setScope('series');
    setName('');
    setLocation('');
    setNotes('');
    setAllDay(false);
    setIsBirthday(false);
    setStartDate(initialDate);
    setEndDate(initialDate);
    setStartTime('09:00');
    setEndTime('10:00');
    setBelongsTo('both');
    setRecurrenceType(null);
    setInterval('1');
    setRecurrenceEnd(null);
  }, [visible, event, initialDate, profile?.id, partner?.id, getMaster]);

  /** Keep end >= start, preserving duration when start moves. */
  const handleStartDateChange = (next: Date) => {
    const shift = Math.round((next.getTime() - startDate.getTime()) / 86_400_000);
    setStartDate(next);
    if (shift !== 0) setEndDate((prev) => addLocalDays(prev, shift));
    else if (endDate < next) setEndDate(next);
  };

  /** Moving the start time drags the end along, keeping the duration. */
  const handleStartTimeChange = (next: string) => {
    const duration = Math.max(15, timeToMinutes(endTime) - timeToMinutes(startTime));
    setStartTime(next);
    setEndTime(minutesToTime(timeToMinutes(next) + duration));
  };

  const buildInput = (): ComposerInput => {
    const parsed = Math.max(1, parseInt(interval, 10) || 1);
    const clamped = Math.min(parsed, maxInterval);
    return {
      name: name.trim(),
      location: location.trim() || null,
      notes: notes.trim() || null,
      startDate: formatLocalDate(startDate),
      endDate: formatLocalDate(endDate < startDate ? startDate : endDate),
      startTime: `${startTime}:00`,
      endTime: `${endTime}:00`,
      isAllDay: allDay,
      // Convert the viewer-frame choice back to creator-relative storage,
      // otherwise editing a partner's event silently reassigns ownership.
      belongsTo: toStorageBelongsTo(
        belongsTo,
        event?.created_by ?? profile?.id,
        profile?.id,
        partner?.id
      ),
      recurrenceType: isBirthday ? 'yearly' : recurrenceType,
      recurrenceInterval: isBirthday ? 1 : recurrenceType ? clamped : 1,
      recurrenceEndDate: recurrenceEnd ? formatLocalDate(recurrenceEnd) : null,
      isBirthday,
    };
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    if (managed) {
      toast.error('Dieser Jahrestag wird über das Profil verwaltet.');
      return;
    }
    setSaving(true);
    try {
      if (event) await onUpdate(event, buildInput(), scope);
      else await onCreate(buildInput());
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Speichern fehlgeschlagen.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!event) return;
    if (managed) {
      toast.error('Dieser Jahrestag wird über das Profil verwaltet.');
      return;
    }

    const runDelete = async (deleteScope: EditScope) => {
      try {
        await onDelete(event, deleteScope);
        onClose();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Löschen fehlgeschlagen.');
      }
    };

    if (!isSeries) {
      Alert.alert(event.name, 'Diesen Termin löschen?', [
        { text: 'Abbrechen', style: 'cancel' },
        { text: 'Löschen', style: 'destructive', onPress: () => void runDelete('series') },
      ]);
      return;
    }

    Alert.alert(event.name, 'Was möchtest du löschen?', [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Nur diesen Termin', onPress: () => void runDelete('occurrence') },
      { text: 'Diesen und alle folgenden', onPress: () => void runDelete('future') },
      { text: 'Ganze Serie', style: 'destructive', onPress: () => void runDelete('series') },
    ]);
  };

  // Editing a single occurrence must not change the rule that generated it.
  const recurrenceLocked = isEdit && isSeries && scope === 'occurrence';
  const canSave = name.trim().length > 0 && !saving && !managed;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: theme.color.grouped }}>
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
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
            <Text variant="headline">{isEdit ? 'Termin bearbeiten' : 'Neuer Termin'}</Text>
            <PressableScale onPress={handleSave} disabled={!canSave} hitSlop={8}>
              <Text
                variant="body"
                weight="600"
                color={canSave ? theme.color.brand : theme.color.labelQuaternary}>
                Fertig
              </Text>
            </PressableScale>
          </View>

          <ScrollView
            contentContainerStyle={{ padding: theme.space.xl, paddingBottom: theme.space['4xl'] }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            {managed ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: theme.space.sm,
                  backgroundColor: theme.event.anniversary.soft,
                  borderRadius: theme.radius.md,
                  padding: theme.space.md,
                  marginBottom: theme.space.lg,
                }}>
                <Icon name="lock" size={16} color={theme.event.anniversary.solid} />
                <Text variant="footnote" style={{ flex: 1 }}>
                  Dieser Jahrestag wird automatisch aus deinem Profil gepflegt.
                </Text>
              </View>
            ) : null}

            {isEdit && isSeries ? (
              <Section title="Änderung gilt für">
                <SegmentedControl<EditScope>
                  value={scope}
                  onChange={setScope}
                  options={[
                    { value: 'occurrence', label: SCOPE_LABEL.occurrence },
                    { value: 'future', label: SCOPE_LABEL.future },
                    { value: 'series', label: SCOPE_LABEL.series },
                  ]}
                />
                <Text variant="footnote" tone="secondary" style={{ marginTop: theme.space.sm }}>
                  {scope === 'occurrence'
                    ? 'Nur dieser Termin wird geändert, die Serie bleibt unverändert.'
                    : scope === 'future'
                      ? 'Die Serie endet vor diesem Termin, ab hier beginnt eine neue.'
                      : 'Alle Termine dieser Serie werden geändert.'}
                </Text>
              </Section>
            ) : null}

            <Field
              autoFocus={!isEdit}
              value={name}
              onChangeText={setName}
              placeholder="Titel — z. B. Abendessen bei Mama"
              editable={!managed}
              returnKeyType="next"
            />
            <Field
              icon="location"
              value={location}
              onChangeText={setLocation}
              placeholder="Ort (optional)"
              editable={!managed}
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
              <ToggleRow label="Ganztägig" icon="allDay" value={allDay} onValueChange={setAllDay} first />
              <PickerRow
                label="Beginn"
                icon="calendar"
                value={formatDayLabel(startDate)}
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
                value={formatDayLabel(endDate)}
                onPress={() => setPicker(picker === 'end' ? null : 'end')}
                active={picker === 'end'}
                last={allDay}
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

            {recurrenceLocked ? (
              <Section title="Wiederholung">
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: theme.space.sm,
                    backgroundColor: theme.color.fillQuaternary,
                    borderRadius: theme.radius.md,
                    padding: theme.space.md,
                  }}>
                  <Icon name="repeat" size={16} color={theme.color.labelSecondary} />
                  <Text variant="footnote" tone="secondary" style={{ flex: 1 }}>
                    Wähle „{SCOPE_LABEL.series}“, um die Wiederholung zu ändern.
                  </Text>
                </View>
              </Section>
            ) : (
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
                      value={recurrenceEnd ? formatDayLabel(recurrenceEnd) : 'Nie'}
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
            )}

            <Section title="Notiz">
              <Field
                value={notes}
                onChangeText={setNotes}
                placeholder="Details, Links, Einkaufsliste …"
                multiline
                editable={!managed}
                containerStyle={{ marginBottom: 0 }}
                inputStyle={{ minHeight: 88, textAlignVertical: 'top' }}
              />
            </Section>

            <Button
              label={isEdit ? 'Änderungen speichern' : 'Termin speichern'}
              onPress={handleSave}
              loading={saving}
              disabled={!canSave}
              fullWidth
              style={{ marginTop: theme.space.lg }}
            />

            {isEdit && !managed ? (
              <Button
                label="Termin löschen"
                icon="trash"
                onPress={handleDelete}
                variant="plain"
                size="md"
                style={{ alignSelf: 'center', marginTop: theme.space.md }}
              />
            ) : null}
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
    <PressableScale
      onPress={onPress}
      activeScale={0.995}
      haptic="none"
      style={[rowStyle(theme, first, last), style]}>
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
 * On iOS the spinner stays open until dismissed, so it renders inline under the
 * row it belongs to. On Android the platform dialog closes itself, which is why
 * callers clear `picker` there.
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
