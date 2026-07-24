import type { ReactNode } from 'react';
import { View } from 'react-native';

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <View
      className={`rounded-3xl bg-white/90 p-6 shadow-lg shadow-purple-900/10 ${className ?? ''}`}>
      {children}
    </View>
  );
}
