import { Link } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Field } from '@/components/ui/Field';
import { Logo } from '@/components/ui/Logo';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { signUpWithPassword } from '@/lib/auth';
import { toast } from '@/store/toast-store';
import { useTheme } from '@/theme/ThemeProvider';

export default function SignupScreen() {
  const theme = useTheme();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState<string | null>(null);

  const handleSignup = async () => {
    if (!name.trim() || !email.trim() || !password) {
      toast.error('Bitte alle Felder ausfüllen.');
      return;
    }
    if (password.length < 6) {
      toast.error('Das Passwort muss mindestens 6 Zeichen haben.');
      return;
    }
    setLoading(true);
    try {
      const { needsEmailConfirmation } = await signUpWithPassword(name.trim(), email.trim(), password);
      if (needsEmailConfirmation) {
        setVerificationEmail(email.trim());
      }
      // Otherwise a session was created directly and the store/router take over.
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Registrierung fehlgeschlagen.';
      toast.error(message.includes('already registered') ? 'Diese E-Mail ist bereits registriert.' : message);
    } finally {
      setLoading(false);
    }
  };

  if (verificationEmail) {
    return (
      <Screen centered edges={['top', 'bottom']}>
        <EmptyState
          icon="mail"
          title="Bestätige deine E-Mail"
          message={`Wir haben einen Bestätigungslink an ${verificationEmail} gesendet. Bitte öffne ihn, dann kannst du dich anmelden.`}
        />
        <Link href="/(auth)/login" asChild>
          <Text variant="subheadline" tone="brand" weight="600" align="center">
            Zurück zum Login
          </Text>
        </Link>
      </Screen>
    );
  }

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
            label="Dein Name"
            icon="person"
            value={name}
            onChangeText={setName}
            placeholder="Alex"
            autoComplete="name"
            returnKeyType="next"
          />
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
            autoComplete="new-password"
            placeholder="mind. 6 Zeichen"
            hint="Mindestens 6 Zeichen"
            returnKeyType="go"
            onSubmitEditing={handleSignup}
          />

          <Button label="Konto erstellen" onPress={handleSignup} loading={loading} fullWidth />

          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 5,
              marginTop: theme.space['2xl'],
            }}>
            <Text variant="subheadline" tone="secondary">
              Schon ein Konto?
            </Text>
            <Link href="/(auth)/login" asChild>
              <Text variant="subheadline" tone="brand" weight="600">
                Anmelden
              </Text>
            </Link>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}
