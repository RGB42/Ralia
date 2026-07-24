import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { Text, TouchableOpacity, View } from 'react-native';

import { hasProAccess } from '@/lib/premium';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { useAuthStore } from '@/store/auth-store';
import { toast } from '@/store/toast-store';

function MenuRow({ label, icon, onPress, danger }: { label: string; icon: string; onPress: () => void; danger?: boolean }) {
  return (
    <TouchableOpacity onPress={onPress} className="flex-row items-center justify-between py-3.5">
      <View className="flex-row items-center gap-3">
        <Text className="text-xl">{icon}</Text>
        <Text className={`text-base ${danger ? 'text-red-500' : 'text-gray-800'}`}>{label}</Text>
      </View>
      <Text className="text-gray-300">›</Text>
    </TouchableOpacity>
  );
}

export default function MoreScreen() {
  const profile = useAuthStore((s) => s.profile);
  const partner = useAuthStore((s) => s.partner);
  const signOut = useAuthStore((s) => s.signOut);
  const isPro = hasProAccess(profile);

  return (
    <Screen>
      <View className="px-5 pt-4">
        <Text className="mb-4 text-2xl font-semibold text-gray-800">Mehr</Text>

        <Card className="mb-4 p-5">
          <View className="flex-row items-center gap-4">
            <View className="h-14 w-14 items-center justify-center rounded-full bg-purple-100">
              <Text className="text-xl font-semibold text-purple-600">
                {(profile?.name ?? '?').charAt(0).toUpperCase()}
              </Text>
            </View>
            <View className="flex-1">
              <Text className="text-base font-semibold text-gray-800">{profile?.name ?? '—'}</Text>
              <Text className="text-sm text-gray-500">{profile?.email}</Text>
              <Text className="mt-0.5 text-xs font-medium text-purple-600">
                {isPro ? '✨ Pro' : 'Free'}
                {partner ? ` · verbunden mit ${partner.name}` : ' · nicht verbunden'}
              </Text>
            </View>
          </View>
        </Card>

        <Card className="mb-4 divide-y divide-gray-100 p-5">
          <MenuRow icon="🍽️" label="Wochenplaner" onPress={() => toast.show('Bald verfügbar')} />
          <MenuRow icon="🔁" label="Wiederkehrende Aufgaben" onPress={() => toast.show('Bald verfügbar')} />
          <MenuRow icon="📥" label="Import / Export" onPress={() => toast.show('Bald verfügbar')} />
          <MenuRow icon="🔗" label="Google Kalender" onPress={() => toast.show('Bald verfügbar')} />
        </Card>

        <Card className="mb-4 divide-y divide-gray-100 p-5">
          <MenuRow
            icon="💕"
            label={partner ? 'Partner-Verbindung verwalten' : 'Mit Partner verbinden'}
            onPress={() => router.push('/connect-partner')}
          />
          {profile?.invite_code ? (
            <MenuRow
              icon="📋"
              label={`Einladungscode: ${profile.invite_code}`}
              onPress={async () => {
                await Clipboard.setStringAsync(profile.invite_code!);
                toast.success('Code kopiert!');
              }}
            />
          ) : null}
          <MenuRow icon={isPro ? '⭐' : '🚀'} label={isPro ? 'Pro verwalten' : 'Auf Pro upgraden'} onPress={() => toast.show('Bald verfügbar')} />
        </Card>

        <Card className="p-5">
          <MenuRow icon="🚪" label="Abmelden" danger onPress={signOut} />
        </Card>
      </View>
    </Screen>
  );
}
