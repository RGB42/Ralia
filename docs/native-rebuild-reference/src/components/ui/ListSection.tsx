import { Children, Fragment, type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { Icon, type IconName } from '@/components/ui/Icon';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/ThemeProvider';

interface ListSectionProps {
  /** Uppercase section header, iOS grouped-table style. */
  title?: string;
  /** Explanatory text under the group. */
  footer?: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * iOS grouped-table section: a rounded card containing rows separated by inset
 * hairlines. Separators are injected between children here rather than drawn by
 * each row, so the first/last row never shows a stray line.
 */
export function ListSection({ title, footer, children, style }: ListSectionProps) {
  const theme = useTheme();
  const rows = Children.toArray(children).filter(Boolean);

  return (
    <View style={[{ marginBottom: theme.space['2xl'] }, style]}>
      {title ? (
        <Text
          variant="footnote"
          tone="secondary"
          weight="500"
          style={{
            marginLeft: theme.space.lg,
            marginBottom: theme.space.sm,
            textTransform: 'uppercase',
            letterSpacing: 0.6,
          }}>
          {title}
        </Text>
      ) : null}

      <View
        style={{
          backgroundColor: theme.color.groupedElevated,
          borderRadius: theme.radius.lg,
          borderCurve: 'continuous',
          overflow: 'hidden',
        }}>
        {rows.map((row, index) => (
          <Fragment key={index}>
            {index > 0 ? (
              <View
                style={{
                  height: 1,
                  backgroundColor: theme.color.separator,
                  // Inset to align with the label column, matching iOS.
                  marginLeft: theme.space.lg,
                }}
              />
            ) : null}
            {row}
          </Fragment>
        ))}
      </View>

      {footer ? (
        <Text
          variant="footnote"
          tone="secondary"
          style={{ marginLeft: theme.space.lg, marginRight: theme.space.lg, marginTop: theme.space.sm }}>
          {footer}
        </Text>
      ) : null}
    </View>
  );
}

interface ListRowProps {
  label: string;
  /** Second line under the label. */
  detail?: string;
  /** Right-aligned value text (settings-style). */
  value?: string;
  icon?: IconName;
  /** Tinted rounded square behind the icon — use for top-level navigation rows. */
  iconColor?: string;
  onPress?: () => void;
  /** Show a disclosure chevron. Implied by `onPress` unless `accessory` is given. */
  chevron?: boolean;
  /** Custom right-hand control (Switch, badge, …). Replaces value/chevron. */
  accessory?: ReactNode;
  destructive?: boolean;
  disabled?: boolean;
}

export function ListRow({
  label,
  detail,
  value,
  icon,
  iconColor,
  onPress,
  chevron,
  accessory,
  destructive,
  disabled,
}: ListRowProps) {
  const theme = useTheme();
  const showChevron = chevron ?? (!!onPress && !accessory);
  const labelColor = destructive ? theme.color.red : theme.color.label;

  const content = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: theme.space.lg,
        paddingVertical: theme.space.md,
        minHeight: 48,
        opacity: disabled ? 0.4 : 1,
      }}>
      {icon ? (
        <View
          style={{
            width: 30,
            height: 30,
            borderRadius: theme.radius.sm,
            borderCurve: 'continuous',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: theme.space.md,
            backgroundColor: iconColor ?? theme.color.brand,
          }}>
          <Icon name={icon} size={17} color="#FFFFFF" />
        </View>
      ) : null}

      <View style={{ flex: 1 }}>
        <Text variant="body" color={labelColor} numberOfLines={1}>
          {label}
        </Text>
        {detail ? (
          <Text variant="footnote" tone="secondary" numberOfLines={2} style={{ marginTop: 1 }}>
            {detail}
          </Text>
        ) : null}
      </View>

      {accessory ??
        (value ? (
          <Text variant="body" tone="secondary" numberOfLines={1} style={{ marginLeft: theme.space.sm }}>
            {value}
          </Text>
        ) : null)}

      {showChevron ? (
        <Icon name="chevronRight" size={17} color={theme.color.labelTertiary} style={{ marginLeft: 4 }} />
      ) : null}
    </View>
  );

  if (!onPress || disabled) return content;

  return (
    <PressableScale onPress={onPress} activeScale={0.995} dim>
      {content}
    </PressableScale>
  );
}
