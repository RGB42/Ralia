import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { gradients } from '@/theme/colors';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'md' | 'sm';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  fullWidth?: boolean;
  className?: string;
}

const SIZE_PADDING = { md: { paddingVertical: 14, paddingHorizontal: 24 }, sm: { paddingVertical: 9, paddingHorizontal: 16 } };

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  loading,
  disabled,
  icon,
  fullWidth,
  className,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  const handlePress = () => {
    if (isDisabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onPress();
  };

  const textClass =
    variant === 'primary' || variant === 'danger'
      ? `text-white font-semibold ${size === 'sm' ? 'text-sm' : 'text-base'}`
      : `text-purple-600 font-semibold ${size === 'sm' ? 'text-sm' : 'text-base'}`;

  const content = loading ? (
    <ActivityIndicator color={variant === 'secondary' || variant === 'ghost' ? '#8b5cf6' : '#fff'} />
  ) : (
    <View className="flex-row items-center justify-center gap-2">
      {icon}
      <Text className={textClass}>{label}</Text>
    </View>
  );

  if (variant === 'primary') {
    return (
      <Pressable
        onPress={handlePress}
        disabled={isDisabled}
        className={`overflow-hidden rounded-2xl ${isDisabled ? 'opacity-50' : ''} ${fullWidth ? 'w-full' : ''} ${className ?? ''}`}>
        <LinearGradient
          colors={gradients.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={SIZE_PADDING[size]}>
          {content}
        </LinearGradient>
      </Pressable>
    );
  }

  const base =
    variant === 'secondary' ? 'border-2 border-gray-200 bg-white' : variant === 'danger' ? 'bg-red-500' : 'bg-transparent';

  return (
    <Pressable
      onPress={handlePress}
      disabled={isDisabled}
      className={`rounded-2xl ${base} ${isDisabled ? 'opacity-50' : ''} ${fullWidth ? 'w-full' : ''} ${className ?? ''}`}
      style={SIZE_PADDING[size]}>
      {content}
    </Pressable>
  );
}
