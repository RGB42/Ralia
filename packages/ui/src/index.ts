/**
 * @ralia/ui — das Design-System aus der Vorlage.
 *
 * Kein Import aus @ralia/data: dieses Paket kennt keine Datenbankbegriffe.
 * Alle Maße und Farben stammen aus tokens.css, abgesichert durch
 * tokens/tokens.parity.test.ts gegen docs/design-reference.
 */
export { ICON_NAMES, Icon, type IconName, type IconProps } from './icons/Icon.js';

export { PERSON_SLOTS, personTokens, type PersonSlot, type PersonTokens } from './person.js';

export { Avatar, type AvatarProps } from './primitives/Avatar.js';
export {
  AvatarPair,
  type AvatarPairPerson,
  type AvatarPairProps,
} from './primitives/AvatarPair.js';
export { Button, type ButtonProps, type ButtonVariant } from './primitives/Button.js';
export { Card, type CardProps, type CardTone } from './primitives/Card.js';
export {
  EmptyState,
  type EmptyStateAction,
  type EmptyStateProps,
} from './primitives/EmptyState.js';
export { FieldLabel, type FieldLabelProps } from './primitives/FieldLabel.js';
export { Input, type InputProps, type InputType } from './primitives/Input.js';
export { ListRow, type ListRowProps } from './primitives/ListRow.js';
export {
  ProgressBar,
  type ProgressBarProps,
  type ProgressSegment,
} from './primitives/ProgressBar.js';
export { SectionLabel, type SectionLabelProps } from './primitives/SectionLabel.js';
export { Select, type SelectOption, type SelectProps } from './primitives/Select.js';
export { SheetHandle } from './primitives/SheetHandle.js';
export { Skeleton, type SkeletonProps } from './primitives/Skeleton.js';
export { Textarea, type TextareaProps } from './primitives/Textarea.js';
export { Toast, type ToastProps, type ToastTone } from './primitives/Toast.js';
export {
  TOAST_DURATION_MS,
  ToastProvider,
  type ToastContextValue,
  type ToastProviderProps,
} from './primitives/ToastProvider.js';
export { useToast } from './primitives/useToast.js';
export { Chip, type ChipProps } from './primitives/Chip.js';
export { IconButton, type IconButtonProps } from './primitives/IconButton.js';
export { NavItem, type NavItemProps } from './primitives/NavItem.js';
export { PersonChip, type PersonChipProps } from './primitives/PersonChip.js';
export {
  SegmentSwitch,
  type SegmentOption,
  type SegmentSwitchProps,
} from './primitives/SegmentSwitch.js';
export { Toggle, type ToggleProps } from './primitives/Toggle.js';

export {
  THEME_ATTRIBUTE,
  THEME_STORAGE_KEY,
  ThemeProvider,
  type ResolvedTheme,
  type ThemeChoice,
  type ThemeContextValue,
} from './theme/ThemeProvider.js';
export { readStoredChoice, themeBootScript } from './theme/theme-storage.js';
export { useTheme } from './theme/useTheme.js';
