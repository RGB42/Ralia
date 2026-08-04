import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import type { StyleProp, TextStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

/**
 * Semantic icon registry.
 *
 * Screens reference icons by *meaning* (`icon="birthday"`), never by glyph name,
 * so the whole app's iconography can be retuned in one place and no emoji ever
 * leaks into the UI. Ionicons is the default set because its stroke weight and
 * geometry match the iOS-derived visual language; MaterialCommunityIcons fills
 * the gaps where Ionicons has nothing suitable.
 */
const registry = {
  // ── Navigation / tabs ──────────────────────────────────────────────
  calendar: { set: 'ion', name: 'calendar-outline', solid: 'calendar' },
  todos: { set: 'ion', name: 'checkbox-outline', solid: 'checkbox' },
  expenses: { set: 'ion', name: 'wallet-outline', solid: 'wallet' },
  weekPlan: { set: 'ion', name: 'grid-outline', solid: 'grid' },
  more: { set: 'ion', name: 'ellipsis-horizontal-circle-outline', solid: 'ellipsis-horizontal-circle' },
  settings: { set: 'ion', name: 'settings-outline', solid: 'settings' },

  // ── Chrome / controls ──────────────────────────────────────────────
  add: { set: 'ion', name: 'add' },
  close: { set: 'ion', name: 'close' },
  chevronLeft: { set: 'ion', name: 'chevron-back' },
  chevronRight: { set: 'ion', name: 'chevron-forward' },
  chevronUp: { set: 'ion', name: 'chevron-up' },
  chevronDown: { set: 'ion', name: 'chevron-down' },
  check: { set: 'ion', name: 'checkmark' },
  checkCircle: { set: 'ion', name: 'checkmark-circle' },
  circle: { set: 'ion', name: 'ellipse-outline' },
  search: { set: 'ion', name: 'search' },
  filter: { set: 'ion', name: 'funnel-outline' },
  ellipsis: { set: 'ion', name: 'ellipsis-horizontal' },
  drag: { set: 'mc', name: 'drag-horizontal-variant' },
  edit: { set: 'ion', name: 'pencil' },
  trash: { set: 'ion', name: 'trash-outline' },
  today: { set: 'ion', name: 'today-outline' },

  // ── Event semantics ────────────────────────────────────────────────
  birthday: { set: 'mc', name: 'cake-variant' },
  anniversary: { set: 'ion', name: 'heart' },
  holiday: { set: 'mc', name: 'star-four-points' },
  location: { set: 'ion', name: 'location-outline' },
  notes: { set: 'ion', name: 'document-text-outline' },
  clock: { set: 'ion', name: 'time-outline' },
  allDay: { set: 'mc', name: 'weather-sunny' },
  repeat: { set: 'ion', name: 'repeat' },
  bell: { set: 'ion', name: 'notifications-outline' },
  bellOff: { set: 'ion', name: 'notifications-off-outline' },

  // ── People / partner ───────────────────────────────────────────────
  person: { set: 'ion', name: 'person-outline' },
  people: { set: 'ion', name: 'people-outline' },
  partnerLink: { set: 'ion', name: 'link-outline' },
  partnerUnlink: { set: 'ion', name: 'unlink-outline' },
  invite: { set: 'ion', name: 'person-add-outline' },

  // ── Todos / shopping ───────────────────────────────────────────────
  note: { set: 'mc', name: 'note-text-outline' },
  shopping: { set: 'ion', name: 'cart-outline' },
  recurringTask: { set: 'mc', name: 'repeat-variant' },
  inProgress: { set: 'mc', name: 'progress-clock' },
  waiting: { set: 'mc', name: 'pause-circle-outline' },
  folder: { set: 'ion', name: 'folder-outline' },

  // ── Money ──────────────────────────────────────────────────────────
  money: { set: 'mc', name: 'cash-multiple' },
  balance: { set: 'mc', name: 'scale-balance' },
  arrowUp: { set: 'ion', name: 'arrow-up' },
  arrowDown: { set: 'ion', name: 'arrow-down' },
  settle: { set: 'mc', name: 'handshake-outline' },
  chart: { set: 'ion', name: 'stats-chart-outline' },

  // ── Categories (expenses / shopping) ───────────────────────────────
  groceries: { set: 'mc', name: 'basket-outline' },
  restaurant: { set: 'mc', name: 'silverware-fork-knife' },
  home: { set: 'ion', name: 'home-outline' },
  transport: { set: 'mc', name: 'car-outline' },
  leisure: { set: 'mc', name: 'ticket-outline' },
  health: { set: 'mc', name: 'medical-bag' },
  gift: { set: 'ion', name: 'gift-outline' },
  travel: { set: 'mc', name: 'airplane' },
  household: { set: 'mc', name: 'broom' },
  drugstore: { set: 'mc', name: 'bottle-tonic-outline' },
  beverages: { set: 'mc', name: 'bottle-soda-classic-outline' },
  other: { set: 'mc', name: 'dots-horizontal-circle-outline' },

  // ── Account / system ───────────────────────────────────────────────
  mail: { set: 'ion', name: 'mail-outline' },
  lock: { set: 'ion', name: 'lock-closed-outline' },
  key: { set: 'ion', name: 'key-outline' },
  logout: { set: 'ion', name: 'log-out-outline' },
  eye: { set: 'ion', name: 'eye-outline' },
  eyeOff: { set: 'ion', name: 'eye-off-outline' },
  moon: { set: 'ion', name: 'moon-outline' },
  sun: { set: 'ion', name: 'sunny-outline' },
  contrast: { set: 'ion', name: 'contrast-outline' },
  language: { set: 'ion', name: 'globe-outline' },
  pro: { set: 'mc', name: 'crown-outline' },
  google: { set: 'ion', name: 'logo-google' },
  share: { set: 'ion', name: 'share-outline' },
  download: { set: 'ion', name: 'download-outline' },
  upload: { set: 'ion', name: 'cloud-upload-outline' },
  sync: { set: 'ion', name: 'sync' },
  info: { set: 'ion', name: 'information-circle-outline' },
  warning: { set: 'ion', name: 'warning-outline' },
  offline: { set: 'ion', name: 'cloud-offline-outline' },
  shield: { set: 'ion', name: 'shield-checkmark-outline' },
  heart: { set: 'ion', name: 'heart-outline' },
  sparkles: { set: 'mc', name: 'shimmer' },
} as const;

export type IconName = keyof typeof registry;

interface IconProps {
  name: IconName;
  size?: number;
  /** Defaults to the primary label color so icons match adjacent text. */
  color?: string;
  /** Use the filled variant where the registry defines one (active tab states). */
  filled?: boolean;
  style?: StyleProp<TextStyle>;
}

export function Icon({ name, size = 20, color, filled, style }: IconProps) {
  const theme = useTheme();
  const entry = registry[name];
  const resolved = color ?? theme.color.label;

  const glyph =
    filled && 'solid' in entry && entry.solid ? entry.solid : entry.name;

  if (entry.set === 'mc') {
    return (
      <MaterialCommunityIcons
        name={glyph as React.ComponentProps<typeof MaterialCommunityIcons>['name']}
        size={size}
        color={resolved}
        style={style}
      />
    );
  }

  return (
    <Ionicons
      name={glyph as React.ComponentProps<typeof Ionicons>['name']}
      size={size}
      color={resolved}
      style={style}
    />
  );
}
