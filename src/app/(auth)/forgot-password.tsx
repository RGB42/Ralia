import { router } from 'expo-router';
import { useState } from 'react';
import { Text, TouchableOpacity } from 'react-native';

import { requestPasswordReset } from '@/lib/auth';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { toast } from '@/store/toast-store';

export default function ForgotPasswordScreen() {
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

  return (
    <Screen centered className="px-6">
      <Card>
        <Text className="mb-1 text-xl font-semibold text-gray-800">Passwort zurücksetzen</Text>
        <Text className="mb-5 text-sm text-gray-500">
          {sent
            ? 'Falls diese E-Mail bei uns registriert ist, ist ein Link zum Zurücksetzen unterwegs.'
            : 'Gib deine E-Mail ein — wir senden dir einen Link zum Zurücksetzen.'}
        </Text>
        {!sent && (
          <TextField
            label="E-Mail"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            placeholder="du@beispiel.de"
          />
        )}
        {sent ? (
          <Button label="Zurück zum Login" onPress={() => router.replace('/(auth)/login')} fullWidth />
        ) : (
          <Button label="Link senden" onPress={handleSend} loading={loading} fullWidth />
        )}
        {!sent && (
          <TouchableOpacity className="mt-4" onPress={() => router.back()}>
            <Text className="text-center text-sm text-gray-500">← Zurück zum Login</Text>
          </TouchableOpacity>
        )}
      </Card>
    </Screen>
  );
}
