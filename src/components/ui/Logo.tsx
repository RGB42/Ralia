import { Image } from 'expo-image';
import { Text, View } from 'react-native';

export function Logo({ subtitle }: { subtitle?: string }) {
  return (
    <View className="mb-8 items-center">
      <Image
        source={require('@/assets/images/icon.png')}
        style={{ width: 88, height: 88, borderRadius: 24 }}
        contentFit="cover"
      />
      <Text className="mt-4 font-display-bold text-3xl text-purple-700">Ralia</Text>
      {subtitle ? <Text className="mt-1 text-gray-500">{subtitle}</Text> : null}
    </View>
  );
}
