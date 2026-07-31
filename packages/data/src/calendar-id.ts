/**
 * Calendar identity.
 *
 * Every row in every shared table is scoped by `calendar_id`. The rule, ported
 * from `getCalendarId()` in `Ralia_Opus/public/js/events.js` and mirrored by the
 * `connect_partner` RPC in migration 018:
 *
 *   connected → the two user ids, sorted, joined with `_`
 *   solo      → the user's own id
 *
 * The sort is what makes it deterministic from both partners' devices. Getting
 * this wrong does not error — it silently reads an empty calendar — so it lives
 * in one tested function rather than being inlined at call sites.
 *
 * The RLS policies rely on the shape too: most tables authorise with
 * `position(auth.uid()::text in calendar_id) > 0`, i.e. substring containment.
 */

export function computeCalendarId(userId: string, partnerId?: string | null): string {
  if (!userId) throw new Error('computeCalendarId requires a user id');
  if (!partnerId || partnerId === userId) return userId;
  return [userId, partnerId].sort().join('_');
}

/** True when the id represents a connected pair rather than a solo user. */
export function isPairedCalendarId(calendarId: string): boolean {
  return calendarId.includes('_');
}

/** The user ids encoded in a calendar id. */
export function calendarMembers(calendarId: string): string[] {
  return calendarId.split('_').filter(Boolean);
}

/**
 * Mirrors `belongs_to` into the viewer's frame of reference.
 *
 * `belongs_to` is stored from the *creator's* perspective: `user1` means "the
 * person who created this row". The partner looking at the same row has to see
 * it as `user2`. Ralia 1.x calls this `getDisplayBelongsTo()`.
 */
export function displayBelongsTo(
  belongsTo: 'user1' | 'user2' | 'both' | null,
  createdBy: string | null,
  viewerId: string,
): 'user1' | 'user2' | 'both' {
  if (belongsTo === 'both' || belongsTo === null) return 'both';
  // Rows the viewer created need no mirroring.
  if (!createdBy || createdBy === viewerId) return belongsTo;
  return belongsTo === 'user1' ? 'user2' : 'user1';
}
