import { useEffect, useRef } from 'react';
import { Animated, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useToastStore } from '@/store/toast-store';

export function ToastHost() {
  const { message, kind } = useToastStore();
  const insets = useSafeAreaInsets();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    if (message) {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 20, duration: 180, useNativeDriver: true }),
      ]).start();
    }
  }, [message, opacity, translateY]);

  if (!message) return null;

  const bg = kind === 'error' ? 'bg-red-500' : kind === 'success' ? 'bg-emerald-500' : 'bg-gray-900';

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: 16,
        right: 16,
        bottom: insets.bottom + 16,
        opacity,
        transform: [{ translateY }],
      }}
      className={`rounded-2xl px-4 py-3.5 shadow-lg ${bg}`}>
      <Text className="text-center text-sm font-medium text-white">{message}</Text>
    </Animated.View>
  );
}
