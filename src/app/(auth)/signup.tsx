import { Link } from 'expo-router';
import { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { signUpWithPassword } from '@/lib/auth';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Logo } from '@/components/ui/Logo';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { toast } from '@/store/toast-store';

export default function SignupScreen() {
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
      <Screen centered className="px-6">
        <Card className="items-center">
          <Text className="text-5xl">💌</Text>
          <Text className="mt-4 text-center text-lg font-semibold text-gray-800">
            Bestätige deine E-Mail
          </Text>
          <Text className="mt-2 text-center text-gray-500">
            Wir haben einen Bestätigungslink an {verificationEmail} gesendet. Bitte öffne ihn, dann kannst du
            dich anmelden.
          </Text>
          <Link href="/(auth)/login" asChild>
            <TouchableOpacity className="mt-6">
              <Text className="text-sm font-semibold text-purple-600">Zurück zum Login</Text>
            </TouchableOpacity>
          </Link>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen centered className="px-6">
      <Logo subtitle="Teile Deine Tage gemeinsam" />
      <Card>
        <TextField label="Dein Name" value={name} onChangeText={setName} placeholder="Alex" />
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
          placeholder="mind. 6 Zeichen"
        />
        <Button label="Konto erstellen" onPress={handleSignup} loading={loading} fullWidth className="mt-2" />

        <View className="mt-6 flex-row justify-center gap-1">
          <Text className="text-sm text-gray-500">Schon ein Konto?</Text>
          <Link href="/(auth)/login" asChild>
            <TouchableOpacity>
              <Text className="text-sm font-semibold text-purple-600">Anmelden</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </Card>
    </Screen>
  );
}
