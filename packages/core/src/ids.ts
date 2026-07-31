/**
 * Temporary client-side identifiers.
 *
 * Rows created while offline need an id before the database can assign one.
 * The `local-` prefix is load-bearing: it is how every layer tells an
 * optimistic row apart from a persisted one, and it must stay byte-compatible
 * with Ralia 1.x so mutations imported from the legacy queue keep working.
 */

const LOCAL_ID_PREFIX = 'local-';

export interface IdFactoryOptions {
  /** Injectable clock, so tests get deterministic ids. */
  now?: () => number;
  /** Injectable randomness, so tests get deterministic ids. */
  random?: () => number;
}

export function makeLocalId(scope: string, options: IdFactoryOptions = {}): string {
  const now = options.now ?? Date.now;
  const random = options.random ?? Math.random;
  const suffix = random().toString(36).slice(2, 8);
  return `${LOCAL_ID_PREFIX}${scope || 'item'}-${now()}-${suffix}`;
}

export function isLocalId(id: unknown): id is string {
  return typeof id === 'string' && id.startsWith(LOCAL_ID_PREFIX);
}

/** The scope segment of a local id, e.g. `local-event-…` → `event`. */
export function localIdScope(id: string): string | null {
  if (!isLocalId(id)) return null;
  const rest = id.slice(LOCAL_ID_PREFIX.length);
  const parts = rest.split('-');
  // Trailing segments are the timestamp and the random suffix.
  return parts.length > 2 ? parts.slice(0, -2).join('-') : null;
}
