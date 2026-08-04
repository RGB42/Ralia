import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/ThemeProvider';

interface ScreenProps {
  children: ReactNode;
  /** Center content vertically — auth screens, empty states. */
  centered?: boolean;
  /** Which safe-area edges to inset. Tab screens skip `bottom` (the tab bar handles it). */
  edges?: readonly Edge[];
  /** `plain` uses the flat background — for screens whose content supplies its own cards. */
  variant?: 'grouped' | 'plain';
  style?: StyleProp<ViewStyle>;
}

/** Base screen wrapper: themed background, safe area, keyboard avoidance. */
export function Screen({
  children,
  centered,
  edges = ['top'],
  variant = 'grouped',
  style,
}: ScreenProps) {
  const theme = useTheme();
  const background = variant === 'grouped' ? theme.color.grouped : theme.color.background;

  return (
    <View style={{ flex: 1, backgroundColor: background }}>
      <SafeAreaView style={{ flex: 1 }} edges={edges}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[{ flex: 1 }, centered && { justifyContent: 'center' }, style]}>
          {children}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
