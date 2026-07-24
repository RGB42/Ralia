import '@/global.css';

import { useFonts } from '@expo-google-fonts/poppins/useFonts';
import { Poppins_400Regular } from '@expo-google-fonts/poppins/400Regular';
import { Poppins_500Medium } from '@expo-google-fonts/poppins/500Medium';
import { Poppins_600SemiBold } from '@expo-google-fonts/poppins/600SemiBold';
import { Poppins_700Bold } from '@expo-google-fonts/poppins/700Bold';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import * as Linking from 'expo-linking';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ToastHost } from '@/components/ui/ToastHost';
import { createSessionFromUrl } from '@/lib/auth';
import { useAuthStore } from '@/store/auth-store';

/**
 * Password-recovery links opened from outside the app (the user's email
 * client) arrive here as `ralia://reset-password#access_token=...&type=recovery`.
 * The Google OAuth callback is already handled synchronously via
 * WebBrowser.openAuthSessionAsync's return value in lib/auth.ts — this
 * listener only needs to cover links opened externally (cold start or the
 * app already running in the background).
 */
function useAuthDeepLinks() {
  useEffect(() => {
    Linking.getInitialURL().then((url) => {
      if (url) createSessionFromUrl(url).catch(() => {});
    });
    const subscription = Linking.addEventListener('url', ({ url }) => {
      createSessionFromUrl(url).catch(() => {});
    });
    return () => subscription.remove();
  }, []);
}

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const init = useAuthStore((s) => s.init);
  const initializing = useAuthStore((s) => s.initializing);
  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  useEffect(() => {
    init();
  }, [init]);

  useAuthDeepLinks();

  useEffect(() => {
    if (!initializing && fontsLoaded) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [initializing, fontsLoaded]);

  if (initializing || !fontsLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <Stack screenOptions={{ headerShown: false }} />
        <ToastHost />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
