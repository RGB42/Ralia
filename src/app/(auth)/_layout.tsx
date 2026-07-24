import { Redirect, Stack } from 'expo-router';

import { useAuthStore } from '@/store/auth-store';

/**
 * Simple guard: if a session exists at all, bounce to `/` and let the root
 * index route decide exactly where (tabs, connect-partner, or reset-password)
 * — keeps that decision tree in one place instead of duplicated per group.
 */
export default function AuthLayout() {
  const session = useAuthStore((s) => s.session);

  if (session) {
    return <Redirect href="/" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
