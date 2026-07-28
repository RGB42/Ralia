import { View, type StyleProp, type ViewStyle } from 'react-native';

import { Icon, type IconName } from '@/components/ui/Icon';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/ThemeProvider';

interface ChipProps {
  label: string;
  icon?: IconName;
  /** Drives both the fill and the text — pass an event-role solid color. */
  color?: string;
  /** Solid fill with white text instead of a soft tint. */
  solid?: boolean;
  selected?: boolean;
  onPress?: () => void;
  size?: 'sm' | 'md';
  style?: StyleProp<ViewStyle>;
}

/**
 * Compact status/metadata pill, also usable as a selectable filter.
 *
 * Default rendering is a *soft tint* of the given color rather than a solid
 * fill — several of these often sit in one row (owner, category, status) and
 * solid fills at that density fight each other for attention.
 */
export function Chip({
  label,
  icon,
  color,
  solid,
  selected,
  onPress,
  size = 'md',
  style,
}: ChipProps) {
  const theme = useTheme();
  const accent = color ?? theme.color.brand;

  const active = solid || selected;
  const background = active ? accent : theme.color.fillTertiary;
  const foreground = active ? '#FFFFFF' : color ? accent : theme.color.labelSecondary;

  const paddingVertical = size === 'sm' ? 3 : 5;
  const paddingHorizontal = size === 'sm' ? 7 : 10;
  const iconSize = size === 'sm' ? 11 : 13;

  const content = (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          backgroundColor: background,
          borderRadius: theme.radius.full,
          paddingVertical,
          paddingHorizontal,
          alignSelf: 'flex-start',
        },
        style,
      ]}>
      {icon ? <Icon name={icon} size={iconSize} color={foreground} /> : null}
      <Text variant={size === 'sm' ? 'caption2' : 'caption'} weight="600" color={foreground} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );

  if (!onPress) return content;

  return (
    <PressableScale onPress={onPress} activeScale={0.93}>
      {content}
    </PressableScale>
  );
}
