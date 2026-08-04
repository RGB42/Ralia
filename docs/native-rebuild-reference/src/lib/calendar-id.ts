/**
 * Mirrors getCalendarId() from the legacy web app (public/js/state.js /
 * partner.js) and the server-side calendar_id computation in
 * migrations/018_partner_rpcs_and_billing_guard.sql (connect_partner RPC).
 *
 * A couple shares one calendar_id: their two user ids, sorted, joined by "_".
 * A solo (unpartnered) user's calendar_id is just their own id. Every RLS
 * policy in the DB checks `calendar_id LIKE '%<uid>%'`, so this exact format
 * must be preserved everywhere we compute it client-side.
 */
export function getCalendarId(userId: string | null | undefined, partnerId?: string | null): string {
  if (!userId) return '';
  if (!partnerId) return userId;
  return [userId, partnerId].sort().join('_');
}
