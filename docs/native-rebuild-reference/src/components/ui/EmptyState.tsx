import { View, type StyleProp, type ViewStyle } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/ThemeProvider';

interface EmptyStateProps {
  icon: IconName;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Tighter spacing for empty states inside a card or list section. */
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * The single empty-state treatment. A tinted icon medallion rather than a bare
 * glyph — it gives the state enough visual weight to read as intentional
 * ("nothing here yet") instead of looking like a failed render.
 */
export function EmptyState({
  icon,
  title,
  message,
  actionLabel,
  onAction,
  compact,
  style,
}: EmptyStateProps) {
  const theme = useTheme();
  const medallion = compact ? 48 : 64;

  return (
    <View
      style={[
        {
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: theme.space['2xl'],
          paddingVertical: compact ? theme.space['2xl'] : theme.space['4xl'],
        },
        style,
      ]}>
      <View
        style={{
          width: medallion,
          height: medallion,
          borderRadius: medallion / 2,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.color.brandSoft,
          marginBottom: theme.space.lg,
        }}>
        <Icon name={icon} size={compact ? 22 : 30} color={theme.color.brand} />
      </View>

      <Text variant={compact ? 'headline' : 'title3'} align="center">
        {title}
      </Text>

      {message ? (
        <Text
          variant="subheadline"
          tone="secondary"
          align="center"
          style={{ marginTop: 6, maxWidth: 300 }}>
          {message}
        </Text>
      ) : null}

      {actionLabel && onAction ? (
        <Button
          label={actionLabel}
          onPress={onAction}
          variant="tinted"
          size="md"
          style={{ marginTop: theme.space.xl }}
        />
      ) : null}
    </View>
  );
}
