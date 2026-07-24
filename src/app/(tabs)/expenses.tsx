import { Text, View } from 'react-native';

import { Screen } from '@/components/ui/Screen';

/**
 * Placeholder — shared_expenses CRUD + the "single vs shared split" balance
 * calculation is fully specced (see conversation research) but not yet
 * wired up. Deliberately scoped out of this pass to prioritize Calendar and
 * Todos, the two flows the product brief calls out as primary.
 */
export default function ExpensesScreen() {
  return (
    <Screen>
      <View className="flex-1 items-center justify-center px-8">
        <Text className="mb-3 text-5xl">💰</Text>
        <Text className="mb-2 text-center text-lg font-semibold text-gray-800">Finanzen — bald hier</Text>
        <Text className="text-center text-sm text-gray-500">
          Gemeinsame Ausgaben und der Kostenausgleich ziehen als Nächstes hier ein.
        </Text>
      </View>
    </Screen>
  );
}
