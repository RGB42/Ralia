/**
 * Design tokens for Ralia.
 *
 * Structure is modelled on Apple's Human Interface semantic color system
 * (grouped backgrounds, layered labels, translucent fills, separators) because
 * it produces a calm, native-feeling hierarchy that works in both appearances
 * without hand-tuning every screen. Ralia's own violet/pink identity rides on
 * top of it as the accent layer.
 *
 * Rules of the road:
 *  - Screens/lists use `bg.grouped`; cards and rows sit on `bg.groupedElevated`.
 *  - Text uses `label` → `labelSecondary` → `labelTertiary`, never raw greys.
 *  - Anything interactive-but-unstyled (chips, inert buttons) uses `fill.*`,
 *    which are translucent so they adapt to whatever is behind them.
 */

export type Appearance = 'light' | 'dark';

/**
 * Structural + system colors. Explicitly typed as `string` rather than inferred
 * literals: the theme's `color` object is an intersection of this and
 * {@link AccentColors}, and two conflicting string *literals* under the same key
 * would collapse the whole intersection to `never`.
 */
export interface StructuralColors {
  background: string;
  backgroundSecondary: string;
  backgroundTertiary: string;
  grouped: string;
  groupedElevated: string;
  groupedSecondary: string;

  label: string;
  labelSecondary: string;
  labelTertiary: string;
  labelQuaternary: string;
  labelInverted: string;

  separator: string;
  separatorOpaque: string;

  fill: string;
  fillSecondary: string;
  fillTertiary: string;
  fillQuaternary: string;

  blue: string;
  green: string;
  indigo: string;
  orange: string;
  pink: string;
  purple: string;
  red: string;
  teal: string;
  yellow: string;
  mint: string;
  cyan: string;
  brown: string;

  gray: string;
  gray2: string;
  gray3: string;
  gray4: string;
  gray5: string;
  gray6: string;
}

/** Ralia's own identity layer, kept namespaced so it can't clash with system colors. */
export interface AccentColors {
  brand: string;
  brandPressed: string;
  brandSoft: string;
  brandBorder: string;
  /** The second stop of the signature violet→pink gradient. */
  brandPink: string;
  brandPinkSoft: string;
}

export interface EventRoleColors {
  /** Dots, bars, borders. */
  solid: string;
  /** Chip and cell backgrounds. */
  soft: string;
  /** Text/icon color when placed on `solid`. */
  on: string;
}

/** Opaque and translucent values are both used; translucent ones must stay rgba so they layer correctly. */
const palette: Record<Appearance, StructuralColors> = {
  light: {
    // Structural backgrounds
    background: '#FFFFFF',
    backgroundSecondary: '#F2F2F7',
    backgroundTertiary: '#FFFFFF',
    grouped: '#F2F2F7',
    groupedElevated: '#FFFFFF',
    groupedSecondary: '#F2F2F7',

    // Text
    label: '#000000',
    labelSecondary: 'rgba(60,60,67,0.60)',
    labelTertiary: 'rgba(60,60,67,0.30)',
    labelQuaternary: 'rgba(60,60,67,0.18)',
    labelInverted: '#FFFFFF',

    // Hairlines
    separator: 'rgba(60,60,67,0.29)',
    separatorOpaque: '#C6C6C8',

    // Translucent fills for inert interactive surfaces
    fill: 'rgba(120,120,128,0.20)',
    fillSecondary: 'rgba(120,120,128,0.16)',
    fillTertiary: 'rgba(118,118,128,0.12)',
    fillQuaternary: 'rgba(116,116,128,0.08)',

    // System accents
    blue: '#007AFF',
    green: '#34C759',
    indigo: '#5856D6',
    orange: '#FF9500',
    pink: '#FF2D55',
    purple: '#AF52DE',
    red: '#FF3B30',
    teal: '#30B0C7',
    yellow: '#FFCC00',
    mint: '#00C7BE',
    cyan: '#32ADE6',
    brown: '#A2845E',

    gray: '#8E8E93',
    gray2: '#AEAEB2',
    gray3: '#C7C7CC',
    gray4: '#D1D1D6',
    gray5: '#E5E5EA',
    gray6: '#F2F2F7',
  },
  dark: {
    background: '#000000',
    backgroundSecondary: '#1C1C1E',
    backgroundTertiary: '#2C2C2E',
    grouped: '#000000',
    groupedElevated: '#1C1C1E',
    groupedSecondary: '#2C2C2E',

    label: '#FFFFFF',
    labelSecondary: 'rgba(235,235,245,0.60)',
    labelTertiary: 'rgba(235,235,245,0.30)',
    labelQuaternary: 'rgba(235,235,245,0.16)',
    labelInverted: '#000000',

    separator: 'rgba(84,84,88,0.65)',
    separatorOpaque: '#38383A',

    fill: 'rgba(120,120,128,0.36)',
    fillSecondary: 'rgba(120,120,128,0.32)',
    fillTertiary: 'rgba(118,118,128,0.24)',
    fillQuaternary: 'rgba(118,118,128,0.18)',

    blue: '#0A84FF',
    green: '#30D158',
    indigo: '#5E5CE6',
    orange: '#FF9F0A',
    pink: '#FF375F',
    purple: '#BF5AF2',
    red: '#FF453A',
    teal: '#40C8E0',
    yellow: '#FFD60A',
    mint: '#63E6E2',
    cyan: '#64D2FF',
    brown: '#AC8E68',

    gray: '#8E8E93',
    gray2: '#636366',
    gray3: '#48484A',
    gray4: '#3A3A3C',
    gray5: '#2C2C2E',
    gray6: '#1C1C1E',
  },
};

/**
 * Ralia's accent identity. The violet is the existing brand token (#8b5cf6,
 * also the PWA `theme_color` and adaptive-icon tint) so the native app stays
 * recognisably the same product; the dark variants are lifted for contrast
 * against black, matching how Apple lightens its system colors in dark mode.
 */
const accent: Record<Appearance, AccentColors> = {
  light: {
    brand: '#8B5CF6',
    brandPressed: '#7C3AED',
    brandSoft: 'rgba(139,92,246,0.12)',
    brandBorder: 'rgba(139,92,246,0.28)',
    brandPink: '#EC4899',
    brandPinkSoft: 'rgba(236,72,153,0.12)',
  },
  dark: {
    brand: '#A78BFA',
    brandPressed: '#8B5CF6',
    brandSoft: 'rgba(167,139,250,0.18)',
    brandBorder: 'rgba(167,139,250,0.35)',
    brandPink: '#F472B6',
    brandPinkSoft: 'rgba(244,114,182,0.18)',
  },
};

/**
 * Event role colors. `belongs_to` drives which of user1/user2/both applies;
 * birthday/anniversary override it via `event_type`. Each role carries a solid
 * value (dots, bars, borders) and a soft tint (chip and cell backgrounds), so
 * callers never have to synthesise opacity themselves.
 */
const eventRoles: Record<Appearance, Record<EventRole, EventRoleColors>> = {
  light: {
    user1: { solid: '#0A84FF', soft: 'rgba(10,132,255,0.14)', on: '#FFFFFF' },
    user2: { solid: '#EC4899', soft: 'rgba(236,72,153,0.14)', on: '#FFFFFF' },
    both: { solid: '#8B5CF6', soft: 'rgba(139,92,246,0.14)', on: '#FFFFFF' },
    birthday: { solid: '#FF9500', soft: 'rgba(255,149,0,0.16)', on: '#FFFFFF' },
    anniversary: { solid: '#FF2D55', soft: 'rgba(255,45,85,0.14)', on: '#FFFFFF' },
    holiday: { solid: '#34C759', soft: 'rgba(52,199,89,0.14)', on: '#FFFFFF' },
  },
  dark: {
    user1: { solid: '#409CFF', soft: 'rgba(64,156,255,0.22)', on: '#000000' },
    user2: { solid: '#F472B6', soft: 'rgba(244,114,182,0.22)', on: '#000000' },
    both: { solid: '#A78BFA', soft: 'rgba(167,139,250,0.22)', on: '#000000' },
    birthday: { solid: '#FF9F0A', soft: 'rgba(255,159,10,0.24)', on: '#000000' },
    anniversary: { solid: '#FF6482', soft: 'rgba(255,100,130,0.22)', on: '#000000' },
    holiday: { solid: '#30D158', soft: 'rgba(48,209,88,0.22)', on: '#000000' },
  },
};

/**
 * `belongs_to` supplies user1/user2/both; `event_type` overrides it with
 * birthday/anniversary. `holiday` is synthetic — public holidays are never rows
 * in `events`, they're a parallel lookup consulted at render time.
 */
export type EventRole = 'user1' | 'user2' | 'both' | 'birthday' | 'anniversary' | 'holiday';

/** 4-point grid. Named by size so intent survives refactors better than t-shirt sizes. */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 48,
} as const;

/** iOS leans on generous, continuous corners — see `borderCurve: 'continuous'` at the call sites. */
export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 26,
  full: 999,
} as const;

/**
 * iOS text styles (size / lineHeight / weight). Using the platform's own scale
 * keeps density familiar and means Dynamic Type ratios stay sane if we later
 * multiply these by a user scale factor.
 */
export const typography = {
  largeTitle: { fontSize: 34, lineHeight: 41, fontWeight: '700' },
  title1: { fontSize: 28, lineHeight: 34, fontWeight: '700' },
  title2: { fontSize: 22, lineHeight: 28, fontWeight: '600' },
  title3: { fontSize: 20, lineHeight: 25, fontWeight: '600' },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: '600' },
  body: { fontSize: 17, lineHeight: 22, fontWeight: '400' },
  callout: { fontSize: 16, lineHeight: 21, fontWeight: '400' },
  subheadline: { fontSize: 15, lineHeight: 20, fontWeight: '400' },
  footnote: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '400' },
  caption2: { fontSize: 11, lineHeight: 13, fontWeight: '400' },
} as const;

export type TypographyVariant = keyof typeof typography;

/**
 * Elevation. Kept deliberately soft and violet-tinted rather than neutral black
 * so cards read as "lifted paper" instead of "drop shadow". Android only honours
 * `elevation`, so each level ships both.
 */
export const elevation = {
  none: {},
  sm: {
    shadowColor: '#4C1D95',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  md: {
    shadowColor: '#4C1D95',
    shadowOpacity: 0.1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  lg: {
    shadowColor: '#4C1D95',
    shadowOpacity: 0.16,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 12 },
    elevation: 14,
  },
} as const;

export type ElevationLevel = keyof typeof elevation;

/** Standard iOS timings. Springs live at the call site (reanimated), these cover fades/layout. */
export const motion = {
  fast: 150,
  base: 220,
  slow: 320,
} as const;

export interface Theme {
  appearance: Appearance;
  isDark: boolean;
  color: StructuralColors & AccentColors;
  event: Record<EventRole, EventRoleColors>;
  space: typeof space;
  radius: typeof radius;
  typography: typeof typography;
  elevation: typeof elevation;
  motion: typeof motion;
}

export function buildTheme(appearance: Appearance): Theme {
  return {
    appearance,
    isDark: appearance === 'dark',
    color: { ...palette[appearance], ...accent[appearance] },
    event: eventRoles[appearance],
    space,
    radius,
    typography,
    elevation,
    motion,
  };
}

export const themes: Record<Appearance, Theme> = {
  light: buildTheme('light'),
  dark: buildTheme('dark'),
};
