import { ScrollView, View } from 'react-native';

import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { SCROLL_BOTTOM_PADDING } from '@/theme/layout';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Week planner (`week_plans`): a Monday-based board of meal and task entries per
 * day, independent of the calendar. Not yet implemented — see the spec notes.
 */
export default function WeekPlannerScreen() {
  const theme = useTheme();

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingBottom: SCROLL_BOTTOM_PADDING }}
        showsVerticalScrollIndicator={false}>
        <View style={{ paddingHorizontal: theme.space.xl, paddingTop: theme.space.sm }}>
          <Text variant="title1">Woche</Text>
          <Text variant="subheadline" tone="secondary">
            Essensplan und Aufgaben
          </Text>
        </View>

        <View style={{ flex: 1, justifyContent: 'center' }}>
          <EmptyState
            icon="weekPlan"
            title="Wochenplaner kommt als Nächstes"
            message="Hier planst ihr Essen und Aufgaben für jeden Tag der Woche."
          />
        </View>
      </ScrollView>
    </Screen>
  );
}
