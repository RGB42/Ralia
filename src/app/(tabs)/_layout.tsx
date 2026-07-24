import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';

import { brand } from '@/theme/colors';
import { useAuthStore } from '@/store/auth-store';

export default function TabsLayout() {
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);
  const passwordRecoveryPending = useAuthStore((s) => s.passwordRecoveryPending);
  const skippedPartnerConnect = useAuthStore((s) => s.skippedPartnerConnect);

  const needsPartnerConnect = !!profile && !profile.partner_id && !skippedPartnerConnect;

  if (!session || passwordRecoveryPending || needsPartnerConnect) {
    return <Redirect href="/" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: brand.purple,
        tabBarInactiveTintColor: '#9ca3af',
        tabBarStyle: { paddingTop: 6, height: 58 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Kalender',
          tabBarIcon: ({ color, size }) => <Ionicons name="calendar" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="todos"
        options={{
          title: 'Todos',
          tabBarIcon: ({ color, size }) => <Ionicons name="checkmark-done" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="expenses"
        options={{
          title: 'Finanzen',
          tabBarIcon: ({ color, size }) => <Ionicons name="wallet" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'Mehr',
          tabBarIcon: ({ color, size }) => <Ionicons name="ellipsis-horizontal-circle" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
