import { forwardRef, useState } from 'react';
import {
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { Icon, type IconName } from '@/components/ui/Icon';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/ThemeProvider';

export interface FieldProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  error?: string | null;
  /** Helper text under the input; hidden while an error is showing. */
  hint?: string;
  icon?: IconName;
  /** Adds a show/hide toggle and manages `secureTextEntry` itself. */
  secureToggle?: boolean;
  /** Right-hand adornment (unit label, currency symbol, …). */
  suffix?: string;
  containerStyle?: StyleProp<ViewStyle>;
  /** Extra styles for the TextInput itself — e.g. `minHeight` for multiline. */
  inputStyle?: StyleProp<TextStyle>;
}

/**
 * Text input with a focus ring.
 *
 * The border animates between three states (idle / focused / error) — a focus
 * ring is the main affordance that tells you which field is live on a form with
 * several inputs, and it's what the previous flat-bordered version lacked.
 */
export const Field = forwardRef<TextInput, FieldProps>(function Field(
  {
    label,
    error,
    hint,
    icon,
    secureToggle,
    suffix,
    containerStyle,
    inputStyle,
    onFocus,
    onBlur,
    ...props
  },
  ref
) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const borderColor = error
    ? theme.color.red
    : focused
      ? theme.color.brand
      : theme.color.separator;

  return (
    <View style={[{ marginBottom: theme.space.lg }, containerStyle]}>
      {label ? (
        <Text variant="footnote" tone="secondary" weight="500" style={{ marginBottom: 6 }}>
          {label}
        </Text>
      ) : null}

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.space.sm,
          backgroundColor: theme.color.groupedElevated,
          borderRadius: theme.radius.md,
          borderCurve: 'continuous',
          borderWidth: focused || error ? 2 : 1,
          borderColor,
          paddingHorizontal: theme.space.md,
          // Compensate for the thicker focused border so the field doesn't jump.
          paddingVertical: focused || error ? 11 : 12,
        }}>
        {icon ? <Icon name={icon} size={18} color={theme.color.labelTertiary} /> : null}

        <TextInput
          ref={ref}
          placeholderTextColor={theme.color.labelTertiary}
          secureTextEntry={secureToggle ? !revealed : props.secureTextEntry}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[
            {
              flex: 1,
              fontSize: theme.typography.body.fontSize,
              color: theme.color.label,
              // Let the wrapper own the padding so the border hugs the text box.
              paddingVertical: 0,
            },
            inputStyle,
          ]}
          {...props}
        />

        {suffix ? (
          <Text variant="subheadline" tone="tertiary">
            {suffix}
          </Text>
        ) : null}

        {secureToggle ? (
          <PressableScale onPress={() => setRevealed((v) => !v)} activeScale={0.88} hitSlop={8} haptic="none">
            <Icon name={revealed ? 'eyeOff' : 'eye'} size={18} color={theme.color.labelTertiary} />
          </PressableScale>
        ) : null}
      </View>

      {error ? (
        <Text variant="caption" tone="danger" style={{ marginTop: 5 }}>
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" tone="tertiary" style={{ marginTop: 5 }}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
});
