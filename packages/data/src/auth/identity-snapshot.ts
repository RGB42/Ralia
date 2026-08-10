/**
 * Identitäts-Abzug für den Start ohne Netz.
 *
 * Ohne ihn müsste die App beim Start eine Sitzung prüfen und ein Profil laden,
 * bevor sie irgendetwas zeigen kann — und ein Nutzer im Zug landete im
 * Anmeldebildschirm, obwohl er angemeldet ist. Mit ihm kann der Boot Profil und
 * Partner ohne eine einzige Anfrage wiederherstellen.
 *
 * Schlüssel und Form sind wortgleich aus `saveIdentitySnapshot()` in
 * `Ralia_Opus/public/js/auth.js` übernommen: `ralia:identity`, `version: 1`,
 * dieselben acht Felder. Das ist kein Zierrat, sondern der Grund, warum ein
 * Nutzer, der die alte App offen hatte, beim ersten Start der neuen angemeldet
 * bleibt. Der Abzug ist die einzige Brücke über den Umbau, die ohne Netz trägt.
 *
 * `calendarId` wird gerechnet, nicht gelesen: `profiles` hat keine solche
 * Spalte (siehe `database.types.ts`). Die Regel steht in `computeCalendarId` und
 * ist dieselbe wie in der `connect_partner`-RPC.
 */

import { computeCalendarId } from '../calendar-id.js';
import type { ProfilesRow } from '../database.types.js';

export const IDENTITY_STORAGE_KEY = 'ralia:identity';

/** Offline identity is a short-lived convenience, not a permanent credential. */
export const IDENTITY_SNAPSHOT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/** Die einzige Fassung, die gelesen wird. */
const SNAPSHOT_VERSION = 1;

export interface IdentitySnapshot {
  version: number;
  userId: string;
  name: string | null;
  email: string | null;
  calendarId: string;
  profile: ProfilesRow;
  partner: ProfilesRow | null;
  savedAt: string;
}

function snapshotProfile(profile: ProfilesRow, partner: boolean): ProfilesRow {
  return {
    ...profile,
    email: partner ? null : profile.email,
    invite_code: partner ? null : profile.invite_code,
    ls_customer_id: null,
    ls_subscription_id: null,
    plan_status: partner ? null : profile.plan_status,
    plan_tier: partner ? null : profile.plan_tier,
    pro_expires_at: partner ? null : profile.pro_expires_at,
  };
}

/** Nur der Teil von `Storage`, den der Abzug braucht — so ist er einsetzbar. */
type SnapshotStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/**
 * Schreibt den Abzug und schluckt jeden Fehler dabei.
 *
 * Im privaten Modus mancher Browser wirft `setItem`, und bei vollem Speicher
 * ebenso. Der Abzug ist eine Annehmlichkeit für den nächsten Start — sein
 * Fehlschlag darf die laufende Anmeldung nicht mitnehmen.
 */
export function writeIdentitySnapshot(
  storage: SnapshotStorage,
  profile: ProfilesRow,
  partner: ProfilesRow | null,
): void {
  if (!profile.id) return;

  const localProfile = snapshotProfile(profile, false);
  const localPartner = partner ? snapshotProfile(partner, true) : null;

  const snapshot: IdentitySnapshot = {
    version: SNAPSHOT_VERSION,
    userId: localProfile.id,
    name: localProfile.name,
    email: localProfile.email,
    calendarId: computeCalendarId(localProfile.id, localProfile.partner_id),
    profile: localProfile,
    partner: localPartner,
    savedAt: new Date().toISOString(),
  };

  try {
    storage.setItem(IDENTITY_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Kein Abzug ist besser als eine gescheiterte Anmeldung.
  }
}

function isUsable(value: unknown, now: number): value is IdentitySnapshot {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<IdentitySnapshot>;
  /*
   * Die Version wird nach oben *nicht* toleriert. Eine spätere Fassung könnte
   * die Bedeutung eines Feldes ändern, und ein halb verstandener Abzug führt zu
   * einer Identität, die nicht stimmt — schlimmer als gar keine.
   */
  if (candidate.version !== SNAPSHOT_VERSION) return false;
  if (typeof candidate.savedAt !== 'string') return false;
  const savedAt = Date.parse(candidate.savedAt);
  if (!Number.isFinite(savedAt) || savedAt > now || now - savedAt > IDENTITY_SNAPSHOT_MAX_AGE_MS) {
    return false;
  }
  // Dieselbe Prüfung wie `restoreIdentityFromSnapshot` in Ralia 1.x.
  return typeof candidate.profile?.id === 'string' && candidate.profile.id.length > 0;
}

export function readIdentitySnapshot(
  storage: SnapshotStorage,
  now: number = Date.now(),
): IdentitySnapshot | null {
  let raw: string | null;
  try {
    raw = storage.getItem(IDENTITY_STORAGE_KEY);
  } catch {
    return null;
  }
  if (raw === null || raw.length === 0) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isUsable(parsed, now)) return null;
    return {
      ...parsed,
      profile: snapshotProfile(parsed.profile, false),
      partner: parsed.partner ? snapshotProfile(parsed.partner, true) : null,
    };
  } catch {
    // Angebrochenes JSON entsteht, wenn der Browser mitten im Schreiben zumacht.
    return null;
  }
}

export function clearIdentitySnapshot(storage: SnapshotStorage): void {
  try {
    storage.removeItem(IDENTITY_STORAGE_KEY);
  } catch {
    // Nichts zu retten — beim nächsten Schreiben ist er ohnehin überschrieben.
  }
}
