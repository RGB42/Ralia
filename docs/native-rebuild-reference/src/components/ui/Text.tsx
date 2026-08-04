import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import type { TypographyVariant } from '@/theme/tokens';

/** Semantic text roles map to the theme's layered label colors. */
type Tone = 'primary' | 'secondary' | 'tertiary' | 'inverted' | 'brand' | 'danger' | 'success';

export interface TextProps extends RNTextProps {
  variant?: TypographyVariant;
  tone?: Tone;
  /** Override the variant's weight without redefining the whole style. */
  weight?: TextStyle['fontWeight'];
  /** Explicit color wins over `tone` — for event-role colors and similar. */
  color?: string;
  align?: TextStyle['textAlign'];
  /** Poppins, reserved for brand/display moments (logo, big empty-state titles). */
  display?: boolean;
}

/**
 * The app's only text primitive. Using the platform system font for UI text is
 * deliberate: it's what makes the app feel native rather than like a webview.
 * Poppins is opt-in via `display` for brand moments.
 */
export function Text({
  variant = 'body',
  tone = 'primary',
  weight,
  color,
  align,
  display,
  style,
  ...rest
}: TextProps) {
  const theme = useTheme();
  const base = theme.typography[variant];

  const toneColor: Record<Tone, string> = {
    primary: theme.color.label,
    secondary: theme.color.labelSecondary,
    tertiary: theme.color.labelTertiary,
    inverted: theme.color.labelInverted,
    brand: theme.color.brand,
    danger: theme.color.red,
    success: theme.color.green,
  };

  return (
    <RNText
      style={[
        {
          fontSize: base.fontSize,
          lineHeight: base.lineHeight,
          fontWeight: weight ?? (base.fontWeight as TextStyle['fontWeight']),
          color: color ?? toneColor[tone],
          textAlign: align,
        },
        // Poppins ships as separate weight-specific families, so pick the file
        // that matches the requested weight instead of relying on synthesis.
        display ? { fontFamily: poppinsFamily(weight ?? base.fontWeight) } : null,
        style,
      ]}
      {...rest}
    />
  );
}

function poppinsFamily(weight: TextStyle['fontWeight'] | string): string {
  switch (String(weight)) {
    case '700':
    case 'bold':
      return 'Poppins_700Bold';
    case '600':
      return 'Poppins_600SemiBold';
    case '500':
      return 'Poppins_500Medium';
    default:
      return 'Poppins_400Regular';
  }
}
