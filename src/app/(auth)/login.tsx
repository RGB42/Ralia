import { Link } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Logo } from '@/components/ui/Logo';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { signInWithGoogle, signInWithPassword } from '@/lib/auth';
import { toast } from '@/store/toast-store';
import { useTheme } from '@/theme/ThemeProvider';

export default function LoginScreen() {
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      toast.error('Bitte E-Mail und Passwort eingeben.');
      return;
    }
    setLoading(true);
    try {
      await signInWithPassword(email.trim(), password);
      // Session updates the auth store via onAuthStateChange; routing reacts automatically.
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Anmeldung fehlgeschlagen.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Google-Anmeldung fehlgeschlagen.');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          paddingHorizontal: theme.space['2xl'],
          paddingVertical: theme.space['3xl'],
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <Logo subtitle="Teile Deine Tage gemeinsam" />

        <View style={{ marginTop: theme.space['3xl'] }}>
          <Field
            label="E-Mail"
            icon="mail"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            autoComplete="email"
            placeholder="du@beispiel.de"
            returnKeyType="next"
          />
          <Field
            label="Passwort"
            icon="lock"
            value={password}
            onChangeText={setPassword}
            secureToggle
            autoCapitalize="none"
            autoComplete="current-password"
            placeholder="••••••••"
            returnKeyType="go"
            onSubmitEditing={handleLogin}
          />

          <Button label="Anmelden" onPress={handleLogin} loading={loading} fullWidth />

          <Link href="/(auth)/forgot-password" asChild>
            <Text
              variant="subheadline"
              tone="brand"
              weight="500"
              align="center"
              style={{ marginTop: theme.space.lg }}>
              Passwort vergessen?
            </Text>
          </Link>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.space.md,
              marginVertical: theme.space['2xl'],
            }}>
            <View style={{ height: 1, flex: 1, backgroundColor: theme.color.separator }} />
            <Text variant="caption" tone="tertiary">
              oder weiter mit
            </Text>
            <View style={{ height: 1, flex: 1, backgroundColor: theme.color.separator }} />
          </View>

          <Button
            label="Mit Google anmelden"
            icon="google"
            onPress={handleGoogle}
            variant="secondary"
            loading={googleLoading}
            fullWidth
          />

          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 5,
              marginTop: theme.space['2xl'],
            }}>
            <Text variant="subheadline" tone="secondary">
              Noch kein Konto?
            </Text>
            <Link href="/(auth)/signup" asChild>
              <Text variant="subheadline" tone="brand" weight="600">
                Registrieren
              </Text>
            </Link>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}
