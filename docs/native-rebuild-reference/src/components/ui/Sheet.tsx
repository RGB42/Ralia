import { BlurView } from 'expo-blur';
import type { ReactNode } from 'react';
import { Modal, Platform, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/ui/Icon';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/ThemeProvider';

interface SheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  /** Pinned action row at the bottom, outside the scroll area. */
  footer?: ReactNode;
  /** Fraction of screen height the sheet may occupy. */
  maxHeightRatio?: number;
  /** Disable the internal ScrollView when the content scrolls itself. */
  scrollable?: boolean;
}

const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 900;

/**
 * Bottom sheet with a grabber and drag-to-dismiss.
 *
 * Built on RN's `Modal` rather than a sheet library so it needs no provider
 * wiring and composes with expo-router's own modal stack. The pan gesture is
 * clamped to downward travel only — dragging up does nothing, which is what
 * makes it feel anchored rather than springy.
 */
export function Sheet({
  visible,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxHeightRatio = 0.9,
  scrollable = true,
}: SheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();

  const translateY = useSharedValue(0);

  const close = () => {
    translateY.value = 0;
    onClose();
  };

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      // Downward only; a small rubber-band on upward drag would fight the scroll view.
      translateY.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      const shouldDismiss = e.translationY > DISMISS_DISTANCE || e.velocityY > DISMISS_VELOCITY;
      if (shouldDismiss) {
        translateY.value = withTiming(screenHeight, { duration: 180 }, () => {
          runOnJS(close)();
        });
      } else {
        translateY.value = withSpring(0, { damping: 24, stiffness: 300 });
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const body = (
    <View style={{ paddingHorizontal: theme.space.xl }}>{children}</View>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close} statusBarTranslucent>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable
          onPress={close}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)' }}
        />

        <GestureDetector gesture={pan}>
          <Animated.View
            style={[
              {
                maxHeight: screenHeight * maxHeightRatio,
                backgroundColor: theme.color.grouped,
                borderTopLeftRadius: theme.radius['2xl'],
                borderTopRightRadius: theme.radius['2xl'],
                borderCurve: 'continuous',
                overflow: 'hidden',
              },
              sheetStyle,
            ]}>
            {/* Grabber */}
            <View style={{ alignItems: 'center', paddingTop: theme.space.sm, paddingBottom: theme.space.xs }}>
              <View
                style={{
                  width: 36,
                  height: 5,
                  borderRadius: 3,
                  backgroundColor: theme.color.labelQuaternary,
                }}
              />
            </View>

            {title ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  paddingHorizontal: theme.space.xl,
                  paddingTop: theme.space.xs,
                  paddingBottom: theme.space.md,
                }}>
                <View style={{ flex: 1 }}>
                  <Text variant="title3">{title}</Text>
                  {subtitle ? (
                    <Text variant="footnote" tone="secondary" style={{ marginTop: 2 }}>
                      {subtitle}
                    </Text>
                  ) : null}
                </View>
                <PressableScale
                  onPress={close}
                  activeScale={0.9}
                  hitSlop={8}
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: theme.radius.full,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: theme.color.fillTertiary,
                  }}>
                  <Icon name="close" size={17} color={theme.color.labelSecondary} />
                </PressableScale>
              </View>
            ) : null}

            {scrollable ? (
              <ScrollView
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingBottom: theme.space.xl }}
                showsVerticalScrollIndicator={false}>
                {body}
              </ScrollView>
            ) : (
              body
            )}

            {footer ? (
              <View
                style={{
                  paddingHorizontal: theme.space.xl,
                  paddingTop: theme.space.md,
                  paddingBottom: Math.max(insets.bottom, theme.space.lg),
                  borderTopWidth: 1,
                  borderTopColor: theme.color.separator,
                  backgroundColor: theme.color.groupedElevated,
                }}>
                {footer}
              </View>
            ) : (
              <View style={{ height: Math.max(insets.bottom, theme.space.lg) }} />
            )}
          </Animated.View>
        </GestureDetector>
      </View>
    </Modal>
  );
}
