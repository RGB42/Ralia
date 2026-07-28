import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { Alert, ScrollView, View } from 'react-native';

import { Chip } from '@/components/ui/Chip';
import { Icon } from '@/components/ui/Icon';
import { ListRow, ListSection } from '@/components/ui/ListSection';
import { Screen } from '@/components/ui/Screen';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Text } from '@/components/ui/Text';
import { hasProAccess } from '@/lib/premium';
import { useAuthStore } from '@/store/auth-store';
import { toast } from '@/store/toast-store';
import { SCROLL_BOTTOM_PADDING } from '@/theme/layout';
import { useAppearancePreference, useTheme } from '@/theme/ThemeProvider';
import type { AppearancePreference } from '@/theme/ThemeProvider';

export default function MoreScreen() {
  const theme = useTheme();
  const profile = useAuthStore((s) => s.profile);
  const partner = useAuthStore((s) => s.partner);
  const signOut = useAuthStore((s) => s.signOut);
  const isPro = hasProAccess(profile);
  const { preference, setPreference } = useAppearancePreference();

  const copyInviteCode = async () => {
    if (!profile?.invite_code) return;
    await Clipboard.setStringAsync(profile.invite_code);
    toast.success('Code kopiert');
  };

  const confirmSignOut = () => {
    Alert.alert('Abmelden?', 'Du kannst dich jederzeit wieder anmelden.', [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Abmelden', style: 'destructive', onPress: signOut },
    ]);
  };

  const soon = () => toast.show('Kommt als Nächstes');

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: theme.space.lg,
          paddingBottom: SCROLL_BOTTOM_PADDING,
        }}
        showsVerticalScrollIndicator={false}>
        <View style={{ paddingHorizontal: theme.space.xs, paddingTop: theme.space.sm, paddingBottom: theme.space.lg }}>
          <Text variant="title1">Mehr</Text>
        </View>

        {/* Profile card */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.space.lg,
            backgroundColor: theme.color.groupedElevated,
            borderRadius: theme.radius.lg,
            borderCurve: 'continuous',
            padding: theme.space.lg,
            marginBottom: theme.space['2xl'],
          }}>
          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: 26,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: theme.color.brandSoft,
            }}>
            <Text variant="title3" weight="600" color={theme.color.brand}>
              {(profile?.name ?? '?').charAt(0).toUpperCase()}
            </Text>
          </View>

          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="headline" numberOfLines={1}>
              {profile?.name ?? '—'}
            </Text>
            <Text variant="footnote" tone="secondary" numberOfLines={1}>
              {profile?.email}
            </Text>
            <View style={{ flexDirection: 'row', gap: 5, marginTop: 4, flexWrap: 'wrap' }}>
              <Chip
                label={isPro ? 'Pro' : 'Free'}
                icon={isPro ? 'pro' : undefined}
                color={isPro ? theme.color.orange : undefined}
                size="sm"
              />
              <Chip
                label={partner ? `mit ${partner.name}` : 'Nicht verbunden'}
                icon={partner ? 'people' : 'person'}
                color={partner ? theme.event.both.solid : undefined}
                size="sm"
              />
            </View>
          </View>
        </View>

        {/* Appearance — the one setting that has to be reachable and obvious */}
        <View style={{ marginBottom: theme.space['2xl'] }}>
          <Text
            variant="footnote"
            tone="secondary"
            weight="500"
            style={{
              marginLeft: theme.space.lg,
              marginBottom: theme.space.sm,
              textTransform: 'uppercase',
              letterSpacing: 0.6,
            }}>
            Darstellung
          </Text>
          <View
            style={{
              backgroundColor: theme.color.groupedElevated,
              borderRadius: theme.radius.lg,
              borderCurve: 'continuous',
              padding: theme.space.md,
            }}>
            <SegmentedControl<AppearancePreference>
              value={preference}
              onChange={setPreference}
              options={[
                { value: 'light', label: 'Hell', icon: 'sun' },
                { value: 'dark', label: 'Dunkel', icon: 'moon' },
                { value: 'system', label: 'System', icon: 'contrast' },
              ]}
            />
          </View>
          <Text
            variant="footnote"
            tone="secondary"
            style={{ marginLeft: theme.space.lg, marginRight: theme.space.lg, marginTop: theme.space.sm }}>
            {preference === 'system'
              ? 'Folgt der Einstellung deines Geräts.'
              : preference === 'light'
                ? 'Immer helles Design.'
                : 'Immer dunkles Design.'}
          </Text>
        </View>

        <ListSection title="Partner">
          <ListRow
            label={partner ? 'Partner-Verbindung' : 'Mit Partner verbinden'}
            detail={partner ? `Verbunden mit ${partner.name}` : 'Gemeinsamer Kalender, To-dos und Ausgaben'}
            icon={partner ? 'people' : 'partnerLink'}
            iconColor={theme.event.both.solid}
            onPress={() => router.push('/connect-partner')}
          />
          {profile?.invite_code ? (
            <ListRow
              label="Einladungscode"
              value={profile.invite_code}
              icon="invite"
              iconColor={theme.color.blue}
              onPress={copyInviteCode}
              chevron={false}
              accessory={<Icon name="share" size={16} color={theme.color.labelTertiary} />}
            />
          ) : null}
          <ListRow
            label="Jahrestag"
            detail="Wird automatisch im Kalender angezeigt"
            value={profile?.anniversary_date ?? 'Nicht gesetzt'}
            icon="anniversary"
            iconColor={theme.event.anniversary.solid}
            onPress={soon}
          />
        </ListSection>

        <ListSection title="Funktionen">
          <ListRow
            label="Erinnerungen"
            detail="Benachrichtigungen für Termine"
            icon="bell"
            iconColor={theme.color.red}
            onPress={soon}
          />
          <ListRow
            label="Import / Export"
            detail="Kalender als ICS-Datei"
            icon="download"
            iconColor={theme.color.teal}
            onPress={soon}
          />
          <ListRow
            label="Google Kalender"
            detail="Synchronisieren"
            icon="google"
            iconColor={theme.color.green}
            onPress={soon}
          />
        </ListSection>

        <ListSection title="Konto">
          <ListRow
            label={isPro ? 'Pro verwalten' : 'Auf Pro upgraden'}
            detail={isPro ? 'Abo und Zahlungen' : 'Mehr Erinnerungen, Google Sync, Export'}
            icon="pro"
            iconColor={theme.color.orange}
            onPress={soon}
          />
          <ListRow
            label="Profil & Sicherheit"
            detail="Name, Passwort"
            icon="person"
            iconColor={theme.color.gray}
            onPress={soon}
          />
          <ListRow label="Abmelden" icon="logout" iconColor={theme.color.red} onPress={confirmSignOut} destructive />
        </ListSection>
      </ScrollView>
    </Screen>
  );
}
