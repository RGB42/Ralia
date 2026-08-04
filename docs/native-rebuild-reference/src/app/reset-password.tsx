import { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { updatePassword } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth-store';
import { toast } from '@/store/toast-store';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Reached only via the password-recovery deep link (Supabase sets a session
 * and fires PASSWORD_RECOVERY, which auth-store surfaces as
 * passwordRecoveryPending — see (auth)/_layout.tsx). Matches the legacy web
 * app's behavior of signing the user back out after a successful reset, so
 * they land on a fresh, deliberate login rather than being silently dropped
 * into the app on a recovery session.
 */
export default function ResetPasswordScreen() {
  const theme = useTheme();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const clearPasswordRecovery = useAuthStore((s) => s.clearPasswordRecovery);

  const mismatch = confirm.length > 0 && password !== confirm;

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
    <Screen centered edges={['top', 'bottom']}>
      <View style={{ paddingHorizontal: theme.space['2xl'] }}>
        <Text variant="title2">Neues Passwort</Text>
        <Text variant="subheadline" tone="secondary" style={{ marginTop: 6, marginBottom: theme.space['2xl'] }}>
          Lege ein neues Passwort für dein Konto fest.
        </Text>

        <Field
          label="Neues Passwort"
          icon="lock"
          value={password}
          onChangeText={setPassword}
          secureToggle
          autoCapitalize="none"
          autoComplete="new-password"
          placeholder="mind. 6 Zeichen"
          returnKeyType="next"
        />
        <Field
          label="Passwort bestätigen"
          icon="lock"
          value={confirm}
          onChangeText={setConfirm}
          secureToggle
          autoCapitalize="none"
          autoComplete="new-password"
          placeholder="••••••••"
          error={mismatch ? 'Die Passwörter stimmen nicht überein.' : null}
          returnKeyType="go"
          onSubmitEditing={handleSubmit}
        />

        <Button
          label="Passwort aktualisieren"
          onPress={handleSubmit}
          loading={loading}
          disabled={password.length < 6 || mismatch}
          fullWidth
        />
      </View>
    </Screen>
  );
}
