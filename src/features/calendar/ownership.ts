import { eventColors, eventIcons } from '@/theme/colors';
import type { CalendarEvent } from '@/types/calendar';
import type { BelongsTo } from '@/types/database';

/**
 * belongs_to is stored relative to created_by (permanently — created_by is
 * never rewritten). This re-projects it into the CURRENT viewer's own frame
 * ("mine" always reads as user1-equivalent, "partner's" as user2-equivalent)
 * — matches getDisplayBelongsTo() in the legacy app exactly.
 *
 * NOTE: this repo only implements event creation, not editing an existing
 * event authored by your partner — so the "non-creator saves and silently
 * flips the owner" bug documented in the legacy app's events.js cannot occur
 * here yet. When an edit flow is added, saving as the non-creator MUST
 * translate the selected value back through this same mapping (invert it)
 * before writing belongs_to, or that bug reappears.
 */
export function getDisplayBelongsTo(event: CalendarEvent, viewerId: string | undefined, partnerId: string | undefined): BelongsTo {
  if (event.belongs_to === 'both' || !partnerId || !event.created_by) return event.belongs_to;
  if (event.created_by === viewerId) return event.belongs_to;
  if (event.created_by === partnerId) {
    if (event.belongs_to === 'user1') return 'user2';
    if (event.belongs_to === 'user2') return 'user1';
  }
  return event.belongs_to;
}

export function getEventColor(event: CalendarEvent, viewerId: string | undefined, partnerId: string | undefined): string {
  if (event.event_type === 'anniversary') return eventColors.anniversary;
  if (event.event_type === 'birthday') return eventColors.birthday;
  const display = getDisplayBelongsTo(event, viewerId, partnerId);
  return eventColors[display];
}

export function getEventIcon(event: CalendarEvent): string {
  if (event.event_type === 'anniversary') return eventIcons.anniversary;
  if (event.event_type === 'birthday') return eventIcons.birthday;
  return '';
}
