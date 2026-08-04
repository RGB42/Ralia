import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Field } from '@/components/ui/Field';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { requestPasswordReset } from '@/lib/auth';
import { toast } from '@/store/toast-store';
import { useTheme } from '@/theme/ThemeProvider';

export default function ForgotPasswordScreen() {
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSend = async () => {
    if (!email.trim()) {
      toast.error('Bitte deine E-Mail eingeben.');
      return;
    }
    setLoading(true);
    try {
      await requestPasswordReset(email.trim());
      setSent(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Senden fehlgeschlagen.');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <Screen centered edges={['top', 'bottom']}>
        <EmptyState
          icon="mail"
          title="Link ist unterwegs"
          message="Falls diese E-Mail bei uns registriert ist, findest du gleich einen Link zum Zurücksetzen im Postfach."
          actionLabel="Zurück zum Login"
          onAction={() => router.replace('/(auth)/login')}
        />
      </Screen>
    );
  }

  return (
    <Screen centered edges={['top', 'bottom']}>
      <View style={{ paddingHorizontal: theme.space['2xl'] }}>
        <Text variant="title2">Passwort zurücksetzen</Text>
        <Text variant="subheadline" tone="secondary" style={{ marginTop: 6, marginBottom: theme.space['2xl'] }}>
          Gib deine E-Mail ein — wir senden dir einen Link zum Zurücksetzen.
        </Text>

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
          returnKeyType="go"
          onSubmitEditing={handleSend}
        />

        <Button label="Link senden" onPress={handleSend} loading={loading} fullWidth />
        <Button
          label="Zurück zum Login"
          icon="chevronLeft"
          onPress={() => router.back()}
          variant="plain"
          size="md"
          style={{ alignSelf: 'center', marginTop: theme.space.md }}
        />
      </View>
    </Screen>
  );
}
