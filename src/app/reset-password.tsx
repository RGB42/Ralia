import { useState } from 'react';
import { Text } from 'react-native';

import { updatePassword } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { useAuthStore } from '@/store/auth-store';
import { toast } from '@/store/toast-store';

/**
 * Reached only via the password-recovery deep link (Supabase sets a session
 * and fires PASSWORD_RECOVERY, which auth-store surfaces as
 * passwordRecoveryPending — see (auth)/_layout.tsx). Matches the legacy web
 * app's behavior of signing the user back out after a successful reset, so
 * they land on a fresh, deliberate login rather than being silently dropped
 * into the app on a recovery session.
 */
export default function ResetPasswordScreen() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const clearPasswordRecovery = useAuthStore((s) => s.clearPasswordRecovery);

  const handleSubmit = async () => {
    if (password.length < 6) {
      toast.error('Das Passwort muss mindestens 6 Zeichen haben.');
      return;
    }
    if (password !== confirm) {
      toast.error('Die Passwörter stimmen nicht überein.');
      return;
    }
    setLoading(true);
    try {
      await updatePassword(password);
      toast.success('Passwort aktualisiert. Bitte melde dich erneut an.');
      await supabase.auth.signOut({ scope: 'local' });
      clearPasswordRecovery();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Aktualisierung fehlgeschlagen.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen centered className="px-6">
      <Card>
        <Text className="mb-1 text-xl font-semibold text-gray-800">Neues Passwort</Text>
        <Text className="mb-5 text-sm text-gray-500">Lege ein neues Passwort für dein Konto fest.</Text>
        <TextField
          label="Neues Passwort"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          placeholder="mind. 6 Zeichen"
        />
        <TextField
          label="Passwort bestätigen"
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry
          autoCapitalize="none"
          placeholder="••••••••"
        />
        <Button label="Passwort aktualisieren" onPress={handleSubmit} loading={loading} fullWidth />
      </Card>
    </Screen>
  );
}
