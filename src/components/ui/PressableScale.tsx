import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface PressableScaleProps extends Omit<PressableProps, 'style'> {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** How far it shrinks on press. Smaller targets want a subtler dip. */
  activeScale?: number;
  /** Also dim slightly — right for text-only rows, wrong for colored fills. */
  dim?: boolean;
  haptic?: 'light' | 'medium' | 'none';
}

/**
 * Standard tap affordance: a quick spring-scale on press-in.
 *
 * The spring config is tuned to settle in roughly one frame-batch (no visible
 * bounce) — the goal is the "solid, physical" feel of iOS controls rather than
 * a playful overshoot.
 */
export function PressableScale({
  children,
  style,
  activeScale = 0.97,
  dim = false,
  haptic = 'light',
  onPressIn,
  onPressOut,
  onPress,
  ...rest
}: PressableScaleProps) {
  const pressed = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.value * (1 - activeScale) }],
    opacity: dim ? 1 - pressed.value * 0.35 : 1,
  }));

  return (
    <AnimatedPressable
      style={[style, animatedStyle]}
      onPressIn={(e) => {
        pressed.value = withSpring(1, { damping: 26, stiffness: 420, mass: 0.5 });
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        pressed.value = withSpring(0, { damping: 26, stiffness: 420, mass: 0.5 });
        onPressOut?.(e);
      }}
      onPress={(e) => {
        if (haptic !== 'none') {
          const style_ =
            haptic === 'medium' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light;
          Haptics.impactAsync(style_).catch(() => {});
        }
        onPress?.(e);
      }}
      {...rest}>
      {children}
    </AnimatedPressable>
  );
}
