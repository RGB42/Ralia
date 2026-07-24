import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface ScreenProps {
  children: ReactNode;
  className?: string;
  /** Center content vertically — used for auth screens, empty states. */
  centered?: boolean;
}

/** Base screen wrapper: safe-area + soft brand-tinted background, matching the web app's `gradient-bg`. */
export function Screen({ children, className, centered }: ScreenProps) {
  return (
    <View className="flex-1 bg-purple-50">
      <SafeAreaView className={`flex-1 ${className ?? ''}`}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className={`flex-1 ${centered ? 'justify-center' : ''}`}>
          {children}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
