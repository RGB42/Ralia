/**
 * Brand + event color tokens, confirmed against public/css/styles.css directly
 * (the source of truth had THREE slightly divergent "purple" families and 2
 * different variants of the event-color palette across month/week views —
 * this file picks ONE canonical value per token rather than porting that drift).
 *
 * React Native has no CSS `background-image`; anywhere the web app used
 * `bg-gradient-to-r from-* to-*` we use these tuples with <LinearGradient>.
 */
export const gradients = {
  /** Primary CTA buttons: purple-500 → pink-500 — the most-repeated gradient in the app. */
  primary: ['#a855f7', '#ec4899'] as const,
  /** Headings / emphasis (used as a solid color on native — see brand.purpleStrong): purple-600 → pink-600 */
  primaryStrong: ['#9333ea', '#db2777'] as const,
  /** Money/expense CTAs: emerald-500 → teal-500 */
  money: ['#10b981', '#14b8a6'] as const,
  /** Splash background: matches capacitor.config.json + app shell gradient's first two stops */
  splash: ['#667eea', '#764ba2'] as const,
};

export const brand = {
  /** Declared brand color (manifest.json theme_color, capacitor icon tint) — anchor for "both"/shared accents. */
  purple: '#8b5cf6',
  purpleStrong: '#9333ea', // heading/emphasis solid (gradient-text has no clean RN equivalent)
  pink: '#ec4899',
};

/** getEventColorClass() equivalents — canonical hex per belongs_to/event_type role (month-grid variant). */
export const eventColors = {
  user1: '#3b82f6', // "Ich" — blue-500
  user2: '#ec4899', // partner — pink-500
  both: '#8b5cf6', // shared — violet-500 (brand color)
  birthday: '#f97316', // orange-500
  anniversary: '#f59e0b', // amber-500 (paired with dark amber text #6b3f00 when used as a fill)
} as const;

export const eventIcons = {
  birthday: '🎂',
  anniversary: '♥',
} as const;

/** .glass effect: rgba(255,255,255,0.95) + 10px blur — pair with <BlurView> on native. */
export const glass = {
  fill: 'rgba(255,255,255,0.95)',
  blurIntensity: 40,
};
