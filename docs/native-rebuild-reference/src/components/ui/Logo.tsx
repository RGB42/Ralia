import { Image } from 'expo-image';
import { View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/ThemeProvider';

interface LogoProps {
  subtitle?: string;
  size?: number;
}

/**
 * Brand lockup for the auth screens. This is the one place Poppins is used —
 * `display` on the wordmark, system font everywhere else in the app.
 */
export function Logo({ subtitle, size = 84 }: LogoProps) {
  const theme = useTheme();

  return (
    <View style={{ alignItems: 'center' }}>
      <Image
        source={require('@/assets/images/icon.png')}
        // ImageStyle has no `borderCurve`, so this stays a plain rounded rect.
        style={{ width: size, height: size, borderRadius: size * 0.28 }}
        contentFit="cover"
      />
      <Text
        variant="largeTitle"
        weight="700"
        display
        color={theme.color.brand}
        style={{ marginTop: theme.space.lg }}>
        Ralia
      </Text>
      {subtitle ? (
        <Text variant="subheadline" tone="secondary" align="center" style={{ marginTop: 2 }}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}
