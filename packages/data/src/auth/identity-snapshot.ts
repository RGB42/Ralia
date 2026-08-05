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

  const snapshot: IdentitySnapshot = {
    version: SNAPSHOT_VERSION,
    userId: profile.id,
    name: profile.name,
    email: profile.email,
    calendarId: computeCalendarId(profile.id, profile.partner_id),
    profile,
    partner,
    savedAt: new Date().toISOString(),
  };

  try {
    storage.setItem(IDENTITY_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Kein Abzug ist besser als eine gescheiterte Anmeldung.
  }
}

function isUsable(value: unknown): value is IdentitySnapshot {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<IdentitySnapshot>;
  /*
   * Die Version wird nach oben *nicht* toleriert. Eine spätere Fassung könnte
   * die Bedeutung eines Feldes ändern, und ein halb verstandener Abzug führt zu
   * einer Identität, die nicht stimmt — schlimmer als gar keine.
   */
  if (candidate.version !== SNAPSHOT_VERSION) return false;
  // Dieselbe Prüfung wie `restoreIdentityFromSnapshot` in Ralia 1.x.
  return typeof candidate.profile?.id === 'string' && candidate.profile.id.length > 0;
}

export function readIdentitySnapshot(storage: SnapshotStorage): IdentitySnapshot | null {
  let raw: string | null;
  try {
    raw = storage.getItem(IDENTITY_STORAGE_KEY);
  } catch {
    return null;
  }
  if (raw === null || raw.length === 0) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    return isUsable(parsed) ? parsed : null;
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
