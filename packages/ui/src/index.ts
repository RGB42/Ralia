/**
 * @ralia/ui — das Design-System aus der Vorlage.
 *
 * Kein Import aus @ralia/data: dieses Paket kennt keine Datenbankbegriffe.
 * Alle Maße und Farben stammen aus tokens.css, abgesichert durch
 * tokens/tokens.parity.test.ts gegen docs/design-reference.
 */
export { ICON_NAMES, Icon, type IconName, type IconProps } from './icons/Icon.js';

export { PERSON_SLOTS, personTokens, type PersonSlot, type PersonTokens } from './person.js';

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
