import { Redirect, Tabs } from 'expo-router';
import { Platform } from 'react-native';

import { Icon, type IconName } from '@/components/ui/Icon';
import { useAuthStore } from '@/store/auth-store';
import { TAB_BAR_HEIGHT } from '@/theme/layout';
import { useTheme } from '@/theme/ThemeProvider';

const TABS: { name: string; title: string; icon: IconName }[] = [
  { name: 'index', title: 'Kalender', icon: 'calendar' },
  { name: 'week', title: 'Woche', icon: 'weekPlan' },
  { name: 'todos', title: 'To-dos', icon: 'todos' },
  { name: 'expenses', title: 'Geld', icon: 'expenses' },
  { name: 'more', title: 'Mehr', icon: 'more' },
];

export default function TabsLayout() {
  const theme = useTheme();
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
        tabBarActiveTintColor: theme.color.brand,
        tabBarInactiveTintColor: theme.color.labelTertiary,
        tabBarStyle: {
          height: TAB_BAR_HEIGHT,
          paddingTop: 6,
          backgroundColor: theme.color.groupedElevated,
          borderTopColor: theme.color.separator,
          // RN's default 0.5pt hairline reads as invisible on Android.
          borderTopWidth: Platform.OS === 'android' ? 0.5 : undefined,
          elevation: 0,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600', marginTop: -2 },
        tabBarItemStyle: { paddingVertical: 2 },
      }}>
      {TABS.map(({ name, title, icon }) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title,
            // Filled variant when active is the iOS convention and makes the
            // selected tab readable without relying on color alone.
            // `color` is typed as ColorValue but is always a resolved string here,
            // since both tint options above are plain hex/rgba.
            tabBarIcon: ({ color, focused }) => (
              <Icon name={icon} size={23} color={color as string} filled={focused} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
