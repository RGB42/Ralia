import { useMemo } from 'react';
import { View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { getEventIconName, getEventRole } from '@/features/calendar/ownership';
import { buildMonthGrid, layoutMonthEvents, VISIBLE_LANES } from '@/features/calendar/month-grid';
import type { Holiday } from '@/features/calendar/holidays';
import { useTheme } from '@/theme/ThemeProvider';
import type { CalendarEvent } from '@/types/calendar';

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

const LANE_HEIGHT = 15;
const LANE_GAP = 2;

interface MonthViewProps {
  monthAnchor: Date;
  events: CalendarEvent[];
  selectedKey: string;
  onSelectDay: (date: Date) => void;
  viewerId: string | undefined;
  partnerId: string | undefined;
  holidays: Map<string, Holiday>;
}

/**
 * Month grid where multi-day events render as continuous bars.
 *
 * Bars are drawn with a 1px negative horizontal margin so they visually bridge
 * the gap between adjacent cells; corner radius is applied only at the true
 * start/end of the span, which is what makes a 5-day event read as one object
 * instead of five separate chips.
 */
export function MonthView({
  monthAnchor,
  events,
  selectedKey,
  onSelectDay,
  viewerId,
  partnerId,
  holidays,
}: MonthViewProps) {
  const theme = useTheme();

  const cells = useMemo(() => buildMonthGrid(monthAnchor), [monthAnchor]);
  const layout = useMemo(() => layoutMonthEvents(cells, events), [cells, events]);

  const rows = useMemo(() => {
    const out: typeof cells[] = [];
    for (let i = 0; i < cells.length; i += 7) out.push(cells.slice(i, i + 7));
    return out;
  }, [cells]);

  return (
    <View>
      <View style={{ flexDirection: 'row', paddingHorizontal: theme.space.sm }}>
        {WEEKDAYS.map((label, i) => (
          <Text
            key={label}
            variant="caption2"
            weight="600"
            align="center"
            // Weekend columns dimmed one step so the work week reads first.
            tone={i >= 5 ? 'tertiary' : 'secondary'}
            style={{ flex: 1, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {label}
          </Text>
        ))}
      </View>

      <View style={{ marginTop: theme.space.xs }}>
        {rows.map((row, rowIndex) => (
          <View key={rowIndex} style={{ flexDirection: 'row', paddingHorizontal: theme.space.sm }}>
            {row.map((cell) => {
              const lanes = layout.byDate.get(cell.key);
              const overflow = layout.overflowByDate.get(cell.key) ?? 0;
              const holiday = holidays.get(cell.key);
              const isSelected = cell.key === selectedKey;

              return (
                <PressableScale
                  key={cell.key}
                  onPress={() => onSelectDay(cell.date)}
                  activeScale={0.95}
                  haptic="none"
                  style={{
                    flex: 1,
                    minHeight: 78,
                    paddingBottom: 3,
                    paddingHorizontal: 1,
                  }}>
                  {/* Day number */}
                  <View style={{ alignItems: 'center', paddingVertical: 3 }}>
                    <View
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 12,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: isSelected
                          ? theme.color.brand
                          : cell.isToday
                            ? theme.color.brandSoft
                            : 'transparent',
                      }}>
                      <Text
                        variant="caption"
                        weight={cell.isToday || isSelected ? '700' : '400'}
                        color={
                          isSelected
                            ? '#FFFFFF'
                            : !cell.inMonth
                              ? theme.color.labelQuaternary
                              : holiday
                                ? theme.event.holiday.solid
                                : cell.isToday
                                  ? theme.color.brand
                                  : theme.color.label
                        }>
                        {cell.date.getDate()}
                      </Text>
                    </View>
                  </View>

                  {/* Event lanes */}
                  <View style={{ gap: LANE_GAP }}>
                    {Array.from({ length: VISIBLE_LANES }, (_, lane) => {
                      const segment = lanes?.[lane];
                      if (!segment) {
                        // Placeholder keeps lanes vertically aligned across cells.
                        return <View key={lane} style={{ height: LANE_HEIGHT }} />;
                      }

                      const role = getEventRole(segment.event, viewerId, partnerId);
                      const colors = theme.event[role];
                      const iconName = getEventIconName(segment.event);

                      return (
                        <View
                          key={lane}
                          style={{
                            height: LANE_HEIGHT,
                            backgroundColor: colors.solid,
                            opacity: cell.inMonth ? 1 : 0.4,
                            justifyContent: 'center',
                            paddingHorizontal: 3,
                            // Bridge the inter-cell gap so spans look continuous.
                            marginLeft: segment.isStart ? 0 : -3,
                            marginRight: segment.isEnd ? 0 : -3,
                            borderTopLeftRadius: segment.isStart ? 4 : 0,
                            borderBottomLeftRadius: segment.isStart ? 4 : 0,
                            borderTopRightRadius: segment.isEnd ? 4 : 0,
                            borderBottomRightRadius: segment.isEnd ? 4 : 0,
                          }}>
                          {segment.isStart ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                              {iconName ? <Icon name={iconName} size={8} color={colors.on} /> : null}
                              <Text
                                variant="caption2"
                                weight="600"
                                color={colors.on}
                                numberOfLines={1}
                                style={{ flex: 1, fontSize: 9, lineHeight: 11 }}>
                                {segment.event.name}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                      );
                    })}

                    {overflow > 0 ? (
                      <Text
                        variant="caption2"
                        tone="tertiary"
                        weight="600"
                        align="center"
                        style={{ fontSize: 9, lineHeight: 11 }}>
                        +{overflow}
                      </Text>
                    ) : null}
                  </View>
                </PressableScale>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}
