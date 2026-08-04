import { LinearGradient } from 'expo-linear-gradient';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/ui/Icon';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { TAB_BAR_HEIGHT } from '@/theme/layout';
import { useTheme } from '@/theme/ThemeProvider';

interface FABProps {
  onPress: () => void;
  icon?: IconName;
  /** Turns the circle into a pill with a label — for primary empty-state CTAs. */
  label?: string;
  /** Set false on screens without a tab bar (modals, stack screens). */
  aboveTabBar?: boolean;
  /** Extra offset on top of the computed inset. */
  offsetBottom?: number;
}

const SIZE = 58;

/**
 * Floating action button.
 *
 * Clears the tab bar by combining the shared tab-bar constant with the bottom
 * safe-area inset, rather than a single magic number — that's what keeps it off
 * the home indicator on iOS and the gesture bar on Android.
 */
export function FAB({ onPress, icon = 'add', label, aboveTabBar = true, offsetBottom = 16 }: FABProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const bottom = (aboveTabBar ? TAB_BAR_HEIGHT + insets.bottom : insets.bottom) + offsetBottom;

  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', right: theme.space.xl, bottom }}>
      <PressableScale
        onPress={onPress}
        activeScale={0.92}
        haptic="medium"
        style={[{ borderRadius: theme.radius.full, overflow: 'hidden' }, theme.elevation.lg]}>
        <LinearGradient
          colors={[theme.color.brand, theme.color.brandPink]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            height: SIZE,
            minWidth: SIZE,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 7,
            paddingHorizontal: label ? theme.space.xl : 0,
          }}>
          <Icon name={icon} size={label ? 20 : 28} color="#FFFFFF" />
          {label ? (
            <Text variant="headline" weight="600" color="#FFFFFF">
              {label}
            </Text>
          ) : null}
        </LinearGradient>
      </PressableScale>
    </View>
  );
}
