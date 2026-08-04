/**
 * Freemium gating — ported 1:1 from public/js/premium.js. Access is driven
 * purely by plan_tier + pro_expires_at; plan_status is display-only (kept in
 * sync server-side by the LemonSqueezy webhook) and is NOT part of this check.
 */
import type { Profile } from '@/types/database';

export function hasProAccess(profile: Profile | null): boolean {
  if (!profile) return false;
  if (profile.plan_tier !== 'pro') return false;
  if (!profile.pro_expires_at) return true; // no expiry -> pro forever (admin-granted / lifetime)
  const expires = new Date(profile.pro_expires_at).getTime();
  if (Number.isNaN(expires)) return true; // malformed date -> fail open, matches legacy behavior
  return expires > Date.now();
}

export type FeatureKey =
  | 'maxRemindersPerEvent'
  | 'maxRecurrenceInterval'
  | 'googleSync'
  | 'calendarExport'
  | 'sharedNotesTodos';

/** Matches PREMIUM_LIMITS in premium.js. */
export const FEATURE_LIMITS: Record<'maxRemindersPerEvent' | 'maxRecurrenceInterval', { free: number; pro: number }> = {
  maxRemindersPerEvent: { free: 1, pro: 5 },
  maxRecurrenceInterval: { free: 1, pro: 24 },
};

export function getFeatureLimit(key: keyof typeof FEATURE_LIMITS, profile: Profile | null): number {
  const limit = FEATURE_LIMITS[key];
  return hasProAccess(profile) ? limit.pro : limit.free;
}

/** Boolean (all-or-nothing) Pro features — googleSync, calendarExport, sharedNotesTodos (Todos/Tasks section). */
export function isFeatureUnlocked(_key: 'googleSync' | 'calendarExport' | 'sharedNotesTodos', profile: Profile | null): boolean {
  return hasProAccess(profile);
}
