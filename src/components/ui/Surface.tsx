import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import type { ElevationLevel } from '@/theme/tokens';

interface SurfaceProps {
  children: ReactNode;
  /** `card` floats on a grouped background; `inset` recedes into it. */
  variant?: 'card' | 'inset' | 'plain';
  elevation?: ElevationLevel;
  padded?: boolean | keyof ReturnType<typeof useTheme>['space'];
  radius?: keyof ReturnType<typeof useTheme>['radius'];
  bordered?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * The neutral container. Everything that needs a background uses this rather
 * than a raw View so corner radius, elevation and appearance stay consistent —
 * and so dark mode never needs per-screen fixes.
 */
export function Surface({
  children,
  variant = 'card',
  elevation = 'none',
  padded = false,
  radius = 'xl',
  bordered = false,
  style,
}: SurfaceProps) {
  const theme = useTheme();

  const background =
    variant === 'card'
      ? theme.color.groupedElevated
      : variant === 'inset'
        ? theme.color.fillQuaternary
        : 'transparent';

  const padding =
    padded === true ? theme.space.lg : padded === false ? undefined : theme.space[padded];

  return (
    <View
      style={[
        {
          backgroundColor: background,
          borderRadius: theme.radius[radius],
          // iOS squircles; a no-op on Android but harmless there.
          borderCurve: 'continuous',
          padding,
        },
        bordered && { borderWidth: 1, borderColor: theme.color.separator },
        theme.elevation[elevation],
        style,
      ]}>
      {children}
    </View>
  );
}
