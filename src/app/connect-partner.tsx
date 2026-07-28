import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { PressableScale } from '@/components/ui/PressableScale';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { connectPartner } from '@/lib/partner';
import { useAuthStore } from '@/store/auth-store';
import { toast } from '@/store/toast-store';
import { useTheme } from '@/theme/ThemeProvider';

export default function ConnectPartnerScreen() {
  const theme = useTheme();
  const profile = useAuthStore((s) => s.profile);
  const refreshProfile = useAuthStore((s) => s.refreshProfile);
  const skipPartnerConnect = useAuthStore((s) => s.skipPartnerConnect);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const copyCode = async () => {
    if (!profile?.invite_code) return;
    await Clipboard.setStringAsync(profile.invite_code);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    toast.success('Code kopiert');
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
      toast.success(`Verbunden mit ${partner.name}`);
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
        <View style={{ alignItems: 'center', marginBottom: theme.space['3xl'] }}>
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: theme.color.brandSoft,
              marginBottom: theme.space.lg,
            }}>
            <Icon name="people" size={30} color={theme.color.brand} />
          </View>
          <Text variant="title2" align="center">
            Verbinde dich mit deinem Partner
          </Text>
          <Text variant="subheadline" tone="secondary" align="center" style={{ marginTop: 6, maxWidth: 320 }}>
            Teilt euren Code miteinander — danach seht ihr denselben Kalender, dieselben Aufgaben und Ausgaben.
          </Text>
        </View>

        <Text variant="footnote" tone="secondary" weight="500" style={{ marginBottom: 6 }}>
          Dein Einladungscode
        </Text>
        <PressableScale
          onPress={copyCode}
          activeScale={0.98}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: theme.color.brandSoft,
            borderWidth: 1,
            borderColor: theme.color.brandBorder,
            borderRadius: theme.radius.md,
            borderCurve: 'continuous',
            paddingHorizontal: theme.space.lg,
            paddingVertical: theme.space.md,
            marginBottom: theme.space['2xl'],
          }}>
          <Text
            variant="title2"
            display
            weight="700"
            color={theme.color.brand}
            style={{ letterSpacing: 4 }}>
            {profile?.invite_code ?? '——————'}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Icon name="share" size={16} color={theme.color.brand} />
            <Text variant="subheadline" tone="brand" weight="600">
              Kopieren
            </Text>
          </View>
        </PressableScale>

        <Field
          label="Code deines Partners"
          icon="partnerLink"
          value={code}
          onChangeText={(v) => setCode(v.toUpperCase())}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={6}
          placeholder="ABC123"
          returnKeyType="go"
          onSubmitEditing={handleConnect}
        />

        <Button label="Verbinden" onPress={handleConnect} loading={loading} fullWidth />
        <Button
          label="Später verbinden"
          onPress={handleSkip}
          variant="plain"
          size="md"
          style={{ alignSelf: 'center', marginTop: theme.space.md }}
        />
      </ScrollView>
    </Screen>
  );
}
