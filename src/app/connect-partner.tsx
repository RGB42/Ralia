import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { connectPartner } from '@/lib/partner';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { useAuthStore } from '@/store/auth-store';
import { toast } from '@/store/toast-store';

export default function ConnectPartnerScreen() {
  const profile = useAuthStore((s) => s.profile);
  const refreshProfile = useAuthStore((s) => s.refreshProfile);
  const skipPartnerConnect = useAuthStore((s) => s.skipPartnerConnect);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const copyCode = async () => {
    if (!profile?.invite_code) return;
    await Clipboard.setStringAsync(profile.invite_code);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    toast.success('Code kopiert!');
  };

  const handleConnect = async () => {
    if (!code.trim()) {
      toast.error('Bitte einen Einladungscode eingeben.');
      return;
    }
    setLoading(true);
    try {
      const partner = await connectPartner(code.trim().toUpperCase());
      await refreshProfile();
      toast.success(`Verbunden mit ${partner.name}! 💕`);
      router.replace('/(tabs)');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Verbindung fehlgeschlagen.');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    await skipPartnerConnect();
    router.replace('/(tabs)');
  };

  return (
    <Screen centered className="px-6">
      <Card>
        <Text className="mb-1 text-center text-2xl">💕</Text>
        <Text className="mb-1 text-center text-xl font-semibold text-gray-800">
          Verbinde dich mit deinem Partner
        </Text>
        <Text className="mb-6 text-center text-sm text-gray-500">
          Teile deinen Code oder gib den Code deines Partners ein — ihr teilt euch dann einen gemeinsamen
          Kalender.
        </Text>

        <Text className="mb-1.5 text-sm font-medium text-gray-600">Dein Einladungscode</Text>
        <TouchableOpacity
          onPress={copyCode}
          className="mb-6 flex-row items-center justify-between rounded-xl border border-purple-200 bg-purple-50 px-4 py-3.5">
          <Text className="font-display-bold text-2xl tracking-widest text-purple-700">
            {profile?.invite_code ?? '——————'}
          </Text>
          <Text className="text-sm text-purple-600">Kopieren</Text>
        </TouchableOpacity>

        <TextField
          label="Code deines Partners"
          value={code}
          onChangeText={(v) => setCode(v.toUpperCase())}
          autoCapitalize="characters"
          maxLength={6}
          placeholder="ABC123"
        />
        <Button label="Verbinden" onPress={handleConnect} loading={loading} fullWidth />

        <TouchableOpacity className="mt-4" onPress={handleSkip}>
          <Text className="text-center text-sm text-gray-500">Später verbinden — erstmal allein nutzen</Text>
        </TouchableOpacity>
      </Card>
    </Screen>
  );
}
