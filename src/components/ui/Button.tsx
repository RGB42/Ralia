import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, View, type StyleProp, type ViewStyle } from 'react-native';

import { Icon, type IconName } from '@/components/ui/Icon';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/ThemeProvider';

type Variant = 'primary' | 'secondary' | 'tinted' | 'plain' | 'danger';
type Size = 'lg' | 'md' | 'sm';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  icon?: IconName;
  iconPosition?: 'leading' | 'trailing';
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
}

const SIZES: Record<Size, { paddingVertical: number; paddingHorizontal: number; gap: number; icon: number }> = {
  lg: { paddingVertical: 15, paddingHorizontal: 24, gap: 8, icon: 19 },
  md: { paddingVertical: 11, paddingHorizontal: 18, gap: 6, icon: 17 },
  sm: { paddingVertical: 7, paddingHorizontal: 13, gap: 5, icon: 15 },
};

const TEXT_VARIANT: Record<Size, 'headline' | 'callout' | 'subheadline'> = {
  lg: 'headline',
  md: 'callout',
  sm: 'subheadline',
};

/**
 * `primary` keeps Ralia's violet→pink gradient (the app's signature CTA);
 * everything else follows Apple's flatter button hierarchy — `secondary` is a
 * neutral filled button, `tinted` a translucent brand wash, `plain` text-only.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'lg',
  icon,
  iconPosition = 'leading',
  loading,
  disabled,
  fullWidth,
  style,
}: ButtonProps) {
  const theme = useTheme();
  const isDisabled = disabled || loading;
  const dims = SIZES[size];

  const foreground =
    variant === 'primary' || variant === 'danger'
      ? '#FFFFFF'
      : variant === 'secondary'
        ? theme.color.label
        : theme.color.brand;

  const inner = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: dims.gap,
        opacity: loading ? 0 : 1,
      }}>
      {icon && iconPosition === 'leading' ? <Icon name={icon} size={dims.icon} color={foreground} /> : null}
      <Text variant={TEXT_VARIANT[size]} weight="600" color={foreground} numberOfLines={1}>
        {label}
      </Text>
      {icon && iconPosition === 'trailing' ? <Icon name={icon} size={dims.icon} color={foreground} /> : null}
    </View>
  );

  // Absolutely-positioned spinner so the button keeps its width while loading.
  const body = (
    <View style={{ justifyContent: 'center' }}>
      {inner}
      {loading ? (
        <View style={{ position: 'absolute', left: 0, right: 0, alignItems: 'center' }}>
          <ActivityIndicator size="small" color={foreground} />
        </View>
      ) : null}
    </View>
  );

  const shell: ViewStyle = {
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
    overflow: 'hidden',
    alignSelf: fullWidth ? 'stretch' : 'flex-start',
    opacity: isDisabled ? 0.45 : 1,
  };

  if (variant === 'primary') {
    return (
      <PressableScale onPress={onPress} disabled={isDisabled} style={[shell, style]}>
        <LinearGradient
          colors={[theme.color.brand, theme.color.brandPink]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingVertical: dims.paddingVertical, paddingHorizontal: dims.paddingHorizontal }}>
          {body}
        </LinearGradient>
      </PressableScale>
    );
  }

  const background =
    variant === 'secondary'
      ? theme.color.fillTertiary
      : variant === 'tinted'
        ? theme.color.brandSoft
        : variant === 'danger'
          ? theme.color.red
          : 'transparent';

  return (
    <PressableScale
      onPress={onPress}
      disabled={isDisabled}
      style={[
        shell,
        {
          backgroundColor: background,
          paddingVertical: dims.paddingVertical,
          paddingHorizontal: variant === 'plain' ? 4 : dims.paddingHorizontal,
        },
        style,
      ]}>
      {body}
    </PressableScale>
  );
}
