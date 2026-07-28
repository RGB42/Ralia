import type { IconName } from '@/components/ui/Icon';
import type { EventRole } from '@/theme/tokens';
import type { CalendarEvent } from '@/types/calendar';
import type { BelongsTo, EventRow } from '@/types/database';

/**
 * `belongs_to` is stored relative to `created_by` (permanently — `created_by` is
 * never rewritten): `user1` always means "the creator", `user2` "the creator's
 * partner". This re-projects it into the CURRENT viewer's frame, so `user1`
 * always reads as "mine" in the UI. Mirrors getDisplayBelongsTo() in the legacy app.
 */
export function getDisplayBelongsTo(
  event: Pick<EventRow, 'belongs_to' | 'created_by'>,
  viewerId: string | undefined,
  partnerId: string | undefined
): BelongsTo {
  if (event.belongs_to === 'both' || !partnerId || !event.created_by) return event.belongs_to;
  if (event.created_by === viewerId) return event.belongs_to;
  if (event.created_by === partnerId) {
    if (event.belongs_to === 'user1') return 'user2';
    if (event.belongs_to === 'user2') return 'user1';
  }
  return event.belongs_to;
}

/**
 * The inverse of {@link getDisplayBelongsTo} — converts a viewer-frame choice
 * back into the creator-relative value that must be written to the DB.
 *
 * Without this, editing an event your partner created silently transfers
 * ownership: the form shows the flipped value, saving it verbatim leaves
 * `created_by` pointing at your partner, and the row then reads back inverted.
 * That is a real bug in the legacy web app; every write path here must go
 * through this function.
 */
export function toStorageBelongsTo(
  displayValue: BelongsTo,
  creatorId: string | null | undefined,
  viewerId: string | undefined,
  partnerId: string | undefined
): BelongsTo {
  if (displayValue === 'both' || !partnerId || !creatorId) return displayValue;
  if (creatorId === viewerId) return displayValue;
  if (creatorId === partnerId) {
    // The mapping is an involution, so the same swap undoes it.
    if (displayValue === 'user1') return 'user2';
    if (displayValue === 'user2') return 'user1';
  }
  return displayValue;
}

/**
 * Which themed color role an event renders in. `event_type` outranks ownership,
 * matching the legacy precedence (anniversary → birthday → ownership).
 */
export function getEventRole(
  event: Pick<EventRow, 'belongs_to' | 'created_by' | 'event_type'>,
  viewerId: string | undefined,
  partnerId: string | undefined
): EventRole {
  if (event.event_type === 'anniversary') return 'anniversary';
  if (event.event_type === 'birthday') return 'birthday';
  const display = getDisplayBelongsTo(event, viewerId, partnerId);
  return display;
}

/** Real icons, never emoji. `null` for ordinary events so callers can skip the slot. */
export function getEventIconName(event: Pick<EventRow, 'event_type'>): IconName | null {
  if (event.event_type === 'anniversary') return 'anniversary';
  if (event.event_type === 'birthday') return 'birthday';
  return null;
}

/** German label for the ownership pill shown on event cards. */
export function getOwnerLabel(
  event: Pick<EventRow, 'belongs_to' | 'created_by'>,
  viewerId: string | undefined,
  partnerId: string | undefined,
  myName: string | null | undefined,
  partnerName: string | null | undefined
): string {
  const display = getDisplayBelongsTo(event, viewerId, partnerId);
  if (display === 'both') return 'Beide';
  if (display === 'user1') return myName || 'Ich';
  return partnerName || 'Partner';
}

/**
 * `event_type === 'anniversary' && is_special_auto` marks the auto-maintained
 * relationship anniversary, which is owned by the profile's `anniversary_date`
 * and must not be editable or deletable from the calendar.
 */
export function isProfileManagedEvent(event: Pick<EventRow, 'event_type' | 'is_special_auto'>): boolean {
  return event.event_type === 'anniversary' && !!event.is_special_auto;
}

/** Recurrence instances share the master's `id`, so lists must key on this instead. */
export function getRenderKey(event: CalendarEvent): string {
  return event.renderKey;
}
