import { Link } from 'expo-router';
import { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { signInWithGoogle, signInWithPassword } from '@/lib/auth';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Logo } from '@/components/ui/Logo';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { toast } from '@/store/toast-store';

export default function LoginScreen() {
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
    <Screen centered className="px-6">
      <Logo subtitle="Teile Deine Tage gemeinsam" />
      <Card>
        <TextField
          label="E-Mail"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          placeholder="du@beispiel.de"
        />
        <TextField
          label="Passwort"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          placeholder="••••••••"
        />
        <Button label="Anmelden" onPress={handleLogin} loading={loading} fullWidth className="mt-2" />

        <Link href="/(auth)/forgot-password" asChild>
          <TouchableOpacity className="mt-4">
            <Text className="text-center text-sm text-purple-600">Passwort vergessen?</Text>
          </TouchableOpacity>
        </Link>

        <View className="my-5 flex-row items-center gap-3">
          <View className="h-px flex-1 bg-gray-200" />
          <Text className="text-xs text-gray-400">oder weiter mit</Text>
          <View className="h-px flex-1 bg-gray-200" />
        </View>

        <Button
          label="Mit Google anmelden"
          onPress={handleGoogle}
          variant="secondary"
          loading={googleLoading}
          fullWidth
        />

        <View className="mt-6 flex-row justify-center gap-1">
          <Text className="text-sm text-gray-500">Noch kein Konto?</Text>
          <Link href="/(auth)/signup" asChild>
            <TouchableOpacity>
              <Text className="text-sm font-semibold text-purple-600">Registrieren</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </Card>
    </Screen>
  );
}
