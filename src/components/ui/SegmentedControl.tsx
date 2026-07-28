import { useState } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';

import { Icon, type IconName } from '@/components/ui/Icon';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/ThemeProvider';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  icon?: IconName;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Hide labels and show icons only — for tight toolbars. */
  iconOnly?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * iOS segmented control: a single sliding thumb inside a translucent track.
 * The thumb is animated by translating one absolutely-positioned view rather
 * than cross-fading per-segment backgrounds, which is what makes the motion
 * read as one continuous object.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  iconOnly,
  style,
}: SegmentedControlProps<T>) {
  const theme = useTheme();
  const [trackWidth, setTrackWidth] = useState(0);

  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const segmentWidth = trackWidth > 0 ? trackWidth / options.length : 0;

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: withSpring(index * segmentWidth, { damping: 22, stiffness: 260, mass: 0.6 }) }],
  }));

  return (
    <View
      onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width - 4)}
      style={[
        {
          flexDirection: 'row',
          backgroundColor: theme.color.fillTertiary,
          borderRadius: theme.radius.sm + 2,
          borderCurve: 'continuous',
          padding: 2,
        },
        style,
      ]}>
      {segmentWidth > 0 ? (
        <Animated.View
          style={[
            {
              position: 'absolute',
              top: 2,
              bottom: 2,
              left: 2,
              width: segmentWidth,
              backgroundColor: theme.color.groupedElevated,
              borderRadius: theme.radius.sm,
              borderCurve: 'continuous',
            },
            theme.elevation.sm,
            thumbStyle,
          ]}
        />
      ) : null}

      {options.map((option) => {
        const selected = option.value === value;
        return (
          <PressableScale
            key={option.value}
            onPress={() => {
              if (!selected) onChange(option.value);
            }}
            activeScale={0.94}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 5,
              paddingVertical: 7,
            }}>
            {option.icon ? (
              <Icon
                name={option.icon}
                size={16}
                color={selected ? theme.color.label : theme.color.labelSecondary}
              />
            ) : null}
            {!iconOnly ? (
              <Text
                variant="subheadline"
                weight={selected ? '600' : '400'}
                tone={selected ? 'primary' : 'secondary'}
                numberOfLines={1}>
                {option.label}
              </Text>
            ) : null}
          </PressableScale>
        );
      })}
    </View>
  );
}
