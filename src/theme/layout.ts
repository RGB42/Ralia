/**
 * Layout constants shared between the tab navigator and anything that has to
 * sit clear of it (FABs, sticky footers, scroll-content padding). Kept here so
 * the tab bar's height is defined exactly once — a mismatch between the
 * navigator and a FAB's offset is the classic cause of an unreachable button.
 *
 * Safe-area insets are added on top by the consumer, not baked in.
 */
export const TAB_BAR_HEIGHT = 56;

/** Bottom padding a scrollable tab screen needs so its last row clears the FAB. */
export const SCROLL_BOTTOM_PADDING = 96;
