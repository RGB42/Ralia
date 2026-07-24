import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { CATEGORY_OPTIONS, UNIT_OPTIONS } from './helpers';
import type { TodoAssignedTo, TodoItemType } from '@/types/database';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSubmit: (input: {
    title: string;
    itemType: TodoItemType;
    quantity: number | null;
    unit: string | null;
    category: string | null;
    assignedTo: TodoAssignedTo;
  }) => Promise<void>;
  partnerName?: string | null;
}

function Segmented<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <View className="mb-4 flex-row rounded-xl bg-gray-100 p-1">
      {options.map((opt) => (
        <Pressable
          key={opt.value}
          onPress={() => onChange(opt.value)}
          className={`flex-1 items-center rounded-lg py-2 ${value === opt.value ? 'bg-white shadow-sm' : ''}`}>
          <Text className={`text-sm font-medium ${value === opt.value ? 'text-purple-600' : 'text-gray-500'}`}>{opt.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function QuickAddTodoModal({ visible, onClose, onSubmit, partnerName }: Props) {
  const [title, setTitle] = useState('');
  const [itemType, setItemType] = useState<TodoItemType>('todo');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('');
  const [category, setCategory] = useState('');
  const [assignedTo, setAssignedTo] = useState<TodoAssignedTo>('both');
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setTitle('');
    setItemType('todo');
    setQuantity('');
    setUnit('');
    setCategory('');
    setAssignedTo('both');
  };

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onSubmit({
        title,
        itemType,
        quantity: quantity ? Math.round(parseFloat(quantity) * 100) / 100 : null,
        unit: unit || null,
        category: category || null,
        assignedTo,
      });
      reset();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView className="flex-1 bg-white">
        <View className="flex-row items-center justify-between border-b border-gray-100 px-5 py-4">
          <Pressable onPress={onClose}>
            <Text className="text-base text-gray-500">Abbrechen</Text>
          </Pressable>
          <Text className="text-base font-semibold text-gray-800">Neuer Eintrag</Text>
          <Pressable onPress={handleSave} disabled={!title.trim() || saving}>
            <Text className={`text-base font-semibold ${title.trim() ? 'text-purple-600' : 'text-gray-300'}`}>Fertig</Text>
          </Pressable>
        </View>

        <ScrollView className="flex-1 px-5 pt-5" keyboardShouldPersistTaps="handled">
          <TextInput
            autoFocus
            value={title}
            onChangeText={setTitle}
            placeholder="Milch, Eier, Brot…"
            placeholderTextColor="#9ca3af"
            className="mb-5 rounded-xl border border-gray-200 px-4 py-3.5 text-base"
            returnKeyType="done"
            onSubmitEditing={handleSave}
          />

          <Segmented
            options={[
              { value: 'todo', label: '✅ Todo' },
              { value: 'note', label: '📝 Notiz' },
            ]}
            value={itemType}
            onChange={setItemType}
          />

          {itemType === 'todo' && (
            <>
              <View className="mb-4 flex-row gap-3">
                <TextInput
                  value={quantity}
                  onChangeText={setQuantity}
                  placeholder="Menge"
                  placeholderTextColor="#9ca3af"
                  keyboardType="decimal-pad"
                  className="flex-1 rounded-xl border border-gray-200 px-4 py-3 text-base"
                />
                <View className="flex-1 flex-row flex-wrap gap-1.5">
                  {UNIT_OPTIONS.filter(Boolean).map((u) => (
                    <Pressable
                      key={u}
                      onPress={() => setUnit(unit === u ? '' : u)}
                      className={`rounded-lg border px-2.5 py-1.5 ${unit === u ? 'border-purple-400 bg-purple-50' : 'border-gray-200'}`}>
                      <Text className={`text-xs ${unit === u ? 'text-purple-600' : 'text-gray-500'}`}>{u}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <Text className="mb-2 text-sm font-medium text-gray-600">Kategorie</Text>
              <View className="mb-5 flex-row flex-wrap gap-2">
                {CATEGORY_OPTIONS.map((c) => (
                  <Pressable
                    key={c.value}
                    onPress={() => setCategory(category === c.value ? '' : c.value)}
                    className={`flex-row items-center gap-1.5 rounded-full border px-3 py-2 ${
                      category === c.value ? 'border-purple-400 bg-purple-50' : 'border-gray-200'
                    }`}>
                    <Text>{c.icon}</Text>
                    <Text className={`text-xs ${category === c.value ? 'text-purple-600' : 'text-gray-500'}`}>{c.label}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}

          <Text className="mb-2 text-sm font-medium text-gray-600">Wer?</Text>
          <Segmented
            options={[
              { value: 'both', label: 'Beide 💕' },
              { value: 'user1', label: 'Ich' },
              { value: 'user2', label: partnerName ?? 'Partner' },
            ]}
            value={assignedTo}
            onChange={setAssignedTo}
          />
        </ScrollView>

        <View className="px-5 pb-4">
          <Button label="Speichern" onPress={handleSave} loading={saving} disabled={!title.trim()} fullWidth />
        </View>
      </SafeAreaView>
    </Modal>
  );
}
