import { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, ScrollView, Text, TouchableOpacity, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { categoryIcon, formatQuantity, isShoppingItem } from '@/features/todos/helpers';
import { QuickAddTodoModal } from '@/features/todos/QuickAddTodoModal';
import { hasProAccess } from '@/lib/premium';
import { useAuthStore } from '@/store/auth-store';
import { distinctGroupNames, useTodosStore } from '@/store/todos-store';
import { useUpgradeModalStore } from '@/store/upgrade-modal-store';
import type { NotesTodo } from '@/types/database';

function TodoTile({ item, onPress, onLongPress }: { item: NotesTodo; onPress: () => void; onLongPress: () => void }) {
  const shopping = isShoppingItem(item);
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={420}
      className={`mb-2.5 mr-2.5 w-[47%] rounded-2xl border p-3.5 ${
        item.is_done
          ? 'border-gray-100 bg-gray-50'
          : item.item_type === 'note'
            ? 'border-amber-100 bg-amber-50'
            : shopping
              ? 'border-pink-100 bg-pink-50'
              : 'border-gray-100 bg-white'
      }`}>
      <View className="flex-row items-start justify-between">
        <Text className={`flex-1 text-sm font-medium ${item.is_done ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
          {item.item_type === 'todo' ? (shopping ? `${categoryIcon(item.category)} ` : '') : '📝 '}
          {item.title}
        </Text>
      </View>
      {formatQuantity(item) ? <Text className="mt-1 text-xs text-gray-500">{formatQuantity(item)}</Text> : null}
    </Pressable>
  );
}

function Lane({ title, items, ...handlers }: { title: string; items: NotesTodo[] } & { onToggle: (id: string) => void; onLongPress: (item: NotesTodo) => void }) {
  if (items.length === 0) return null;
  return (
    <View className="mb-5">
      <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">{title}</Text>
      <View className="flex-row flex-wrap">
        {items.map((item) => (
          <TodoTile key={item.id} item={item} onPress={() => handlers.onToggle(item.id)} onLongPress={() => handlers.onLongPress(item)} />
        ))}
      </View>
    </View>
  );
}

export default function TodosScreen() {
  const profile = useAuthStore((s) => s.profile);
  const partner = useAuthStore((s) => s.partner);
  const calendarId = useAuthStore((s) => s.calendarId);
  const isPro = hasProAccess(profile);

  const { items, groups, selectedGroup, loading, load, selectGroup, createGroup, addItem, toggleDone, deleteItem } = useTodosStore();
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    if (isPro && calendarId && profile?.id) {
      load(calendarId, profile.id);
    }
  }, [isPro, calendarId, profile?.id, load]);

  const groupNames = useMemo(() => distinctGroupNames(groups, items), [groups, items]);
  const groupItems = useMemo(() => items.filter((i) => i.group_name === selectedGroup), [items, selectedGroup]);

  const shoppingItems = groupItems.filter((i) => !i.is_done && isShoppingItem(i));
  const todoItems = groupItems.filter((i) => !i.is_done && i.item_type === 'todo' && !isShoppingItem(i));
  const noteItems = groupItems.filter((i) => !i.is_done && i.item_type === 'note');
  const doneItems = groupItems
    .filter((i) => i.is_done)
    .sort((a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? ''));

  if (!isPro) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center px-8">
          <Text className="mb-3 text-5xl">🔒</Text>
          <Text className="mb-2 text-center text-lg font-semibold text-gray-800">Todos & Einkaufsliste sind Pro</Text>
          <Text className="mb-6 text-center text-sm text-gray-500">
            Gemeinsame Einkaufslisten, Notizen und Aufgaben sind Teil von Ralia Pro.
          </Text>
          <Button label="Jetzt upgraden" onPress={() => useUpgradeModalStore.getState().open('sharedNotesTodos')} />
        </View>
      </Screen>
    );
  }

  const handleLongPress = (item: NotesTodo) => {
    Alert.alert(item.title, undefined, [
      { text: 'Löschen', style: 'destructive', onPress: () => deleteItem(item.id) },
      { text: 'Abbrechen', style: 'cancel' },
    ]);
  };

  return (
    <Screen>
      <View className="flex-1 px-5 pt-4">
        <Text className="mb-3 text-2xl font-semibold text-gray-800">Todos & Einkauf</Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4 -mx-1">
          {groupNames.map((name) => (
            <TouchableOpacity
              key={name}
              onPress={() => selectGroup(name)}
              className={`mx-1 rounded-full px-4 py-2 ${selectedGroup === name ? 'bg-purple-500' : 'bg-gray-100'}`}>
              <Text className={`text-sm font-medium ${selectedGroup === name ? 'text-white' : 'text-gray-600'}`}>{name}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            onPress={() => {
              Alert.prompt?.('Neue Gruppe', 'Name der Gruppe', (name) => {
                if (name && profile?.id) createGroup(name, profile.id);
              });
            }}
            className="mx-1 rounded-full border border-dashed border-gray-300 px-4 py-2">
            <Text className="text-sm text-gray-400">+ Gruppe</Text>
          </TouchableOpacity>
        </ScrollView>

        <FlatList
          data={[1]}
          keyExtractor={() => 'content'}
          refreshing={loading}
          onRefresh={() => calendarId && profile?.id && load(calendarId, profile.id)}
          contentContainerStyle={{ paddingBottom: 100 }}
          renderItem={() => (
            <View>
              <Lane title="Einkaufsliste" items={shoppingItems} onToggle={toggleDone} onLongPress={handleLongPress} />
              <Lane title="Todos" items={todoItems} onToggle={toggleDone} onLongPress={handleLongPress} />
              <Lane title="Notizen" items={noteItems} onToggle={toggleDone} onLongPress={handleLongPress} />
              <Lane title="Erledigt" items={doneItems} onToggle={toggleDone} onLongPress={handleLongPress} />
              {groupItems.length === 0 && !loading ? (
                <Text className="mt-10 text-center text-sm text-gray-400">Noch nichts hier — tippe auf + um etwas hinzuzufügen.</Text>
              ) : null}
            </View>
          )}
        />
      </View>

      <Pressable
        onPress={() => setModalVisible(true)}
        className="absolute bottom-6 right-6 h-16 w-16 items-center justify-center rounded-full bg-purple-500 shadow-lg shadow-purple-900/30">
        <Text className="text-3xl text-white">＋</Text>
      </Pressable>

      <QuickAddTodoModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        partnerName={partner?.name}
        onSubmit={async (input) => {
          if (!profile?.id) return;
          const result = await addItem({ ...input, userId: profile.id });
          if (result === 'blocked') {
            Alert.alert('Bereits vorhanden', 'Ein aktiver Eintrag mit diesem Namen existiert schon in dieser Gruppe.');
          }
        }}
      />
    </Screen>
  );
}
