/**
 * Sitzungszustand beim Start, Aufräumen beim Abmelden, Fehlermeldungen.
 *
 * Die eine Regel, die alles hier trägt und aus `session.js` der Altversion
 * stammt: **nur eine echte Abmeldung meldet ab.** Kein Netz, ein Zeitüberlauf
 * oder ein Transportfehler dürfen nicht in den Anmeldebildschirm führen, solange
 * ein Identitäts-Abzug daliegt. Wer im Zug die App öffnet, ist angemeldet.
 *
 * Die Gegenrichtung gilt genauso streng: online und keine Sitzung heißt
 * wirklich abgemeldet. Würde der Abzug auch dort retten, käme ein abgemeldeter
 * Nutzer nie zum Anmeldebildschirm zurück.
 */

import { isOfflineSyncError } from '@ralia/core';
import { computeCalendarId } from '../calendar-id.js';
import type { ProfilesRow } from '../database.types.js';
import {
  clearIdentitySnapshot,
  readIdentitySnapshot,
  writeIdentitySnapshot,
} from './identity-snapshot.js';

export interface Identity {
  userId: string;
  profile: ProfilesRow;
  partner: ProfilesRow | null;
  /** Gerechnet, nicht gelesen — `profiles` hat keine solche Spalte. */
  calendarId: string;
}

export type SessionState =
  | { status: 'signed-out' }
  /** `offline` heißt: aus dem Abzug wiederhergestellt, nicht frisch geladen. */
  | { status: 'signed-in'; identity: Identity; offline: boolean };

// ---------------------------------------------------------------------------
// Fehlermeldungen
// ---------------------------------------------------------------------------

/**
 * Meldungsteil von Supabase → i18n-Schlüssel.
 *
 * Ralia 1.x zeigt `error.message` unverändert an, auch in der deutschen
 * Oberfläche. Das wird nicht weitergetragen: die Fälle, die wirklich vorkommen,
 * bekommen eigene Schlüssel, alles andere fällt auf eine allgemeine Meldung
 * zurück. Der Originaltext geht in die Konsole.
 *
 * Die Zeichenketten stammen aus GoTrue und sind auf Kleinschreibung verglichen,
 * damit eine geänderte Groß-/Kleinschreibung sie nicht durchfallen lässt.
 */
const AUTH_ERROR_MATCHERS: readonly (readonly [fragment: string, key: string])[] = [
  ['invalid login credentials', 'authInvalidCredentials'],
  ['email not confirmed', 'authEmailNotConfirmed'],
  ['user already registered', 'authEmailTaken'],
  ['already been registered', 'authEmailTaken'],
  ['email link is invalid or has expired', 'authLinkExpired'],
  ['token has expired', 'authLinkExpired'],
  ['for security purposes', 'authTooManyRequests'],
  ['too many requests', 'authTooManyRequests'],
  ['rate limit', 'authTooManyRequests'],
  ['password should be at least', 'authPasswordTooShort'],
  ['code verifier', 'authVerifierMissing'],
];

export function authErrorKey(error: unknown): string {
  if (typeof error !== 'object' || error === null) return 'authGenericError';
  const candidate = error as { message?: unknown; status?: unknown };

  // 429 ist eindeutig, auch wenn der Text sich ändert.
  if (candidate.status === 429) return 'authTooManyRequests';

  const message = typeof candidate.message === 'string' ? candidate.message.toLowerCase() : '';
  if (message.length === 0) return 'authGenericError';

  for (const [fragment, key] of AUTH_ERROR_MATCHERS) {
    if (message.includes(fragment)) return key;
  }
  return 'authGenericError';
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

interface SessionUser {
  id: string;
  email: string | null;
  /** Display metadata only; never use this user-editable value for authorization. */
  name?: string | null;
}

/**
 * Frist für das Laden der Identität, wenn ein Abzug daliegt.
 *
 * Kurz, und das mit Absicht: `postgrest-js` wiederholt seit 2.111 jeden
 * fehlgeschlagenen GET selbst — dreimal mit 1 s, 2 s, 4 s Backoff. Ohne Frist
 * wartet der Start also gut sieben Sekunden, um herauszufinden, dass kein Netz
 * da ist, obwohl Profil und Partner die ganze Zeit im Speicher liegen. Gemessen
 * am 2026-08-05: 7,5 s bis zum ersten Inhalt.
 *
 * Die Wiederholung selbst wird *nicht* abgeschaltet. Für gewöhnliche
 * Lesezugriffe ist sie richtig — ein 503 von PostgREST beim Nachladen des
 * Schema-Caches ist wirklich vorübergehend. Sie darf nur nicht den Start
 * aufhalten.
 */
export const IDENTITY_TIMEOUT_WITH_SNAPSHOT_MS = 2500;

/**
 * Frist ohne Abzug. Länger, weil hier nichts zum Zurückfallen da ist: das Profil
 * *muss* kommen, sonst hat die App keine `calendar_id`. Derselbe Wert wie die
 * `/config`-Frist im Boot, aus demselben Grund — irgendwann muss ein Ergebnis da
 * sein, auch wenn die Anfrage nie antwortet.
 */
export const IDENTITY_TIMEOUT_WITHOUT_SNAPSHOT_MS = 6000;

export interface RestoreDeps {
  /** Üblicherweise `client.auth.getSession()`, auf das Nötige eingeengt. */
  getSession(): Promise<{ session: { user: SessionUser } | null }>;
  /** Profil und Partner laden — `profileRepo.ensure` plus `loadPartner`. */
  loadIdentity(user: SessionUser): Promise<{ profile: ProfilesRow; partner: ProfilesRow | null }>;
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
  isOnline?: () => boolean;
  /** Nur für Tests: setzt beide Fristen. 0 schaltet sie ab. */
  identityTimeoutMs?: number;
}

/** Fehler einer abgelaufenen Frist. Als Transportfehler eingeordnet. */
class IdentityTimeoutError extends Error {
  constructor(ms: number) {
    // Die Meldung trägt 'timed out', damit `isOfflineSyncError` sie erkennt —
    // eine abgelaufene Frist *ist* ein Transportproblem, kein fachlicher Fehler.
    super(`Identität nach ${ms} ms nicht geladen — timed out`);
    this.name = 'IdentityTimeoutError';
  }
}

function withDeadline<T>(promise: Promise<T>, ms: number): Promise<T> {
  if (ms <= 0) return promise;
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new IdentityTimeoutError(ms)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}

function fromSnapshot(storage: RestoreDeps['storage']): SessionState {
  const snapshot = readIdentitySnapshot(storage);
  if (snapshot === null) return { status: 'signed-out' };

  return {
    status: 'signed-in',
    offline: true,
    identity: {
      userId: snapshot.profile.id,
      profile: snapshot.profile,
      partner: snapshot.partner,
      // Nicht `snapshot.calendarId` blind übernehmen: der Abzug kann von einer
      // Version stammen, die anders gerechnet hat.
      calendarId: computeCalendarId(snapshot.profile.id, snapshot.profile.partner_id),
    },
  };
}

/**
 * Ermittelt den Zustand beim Start.
 *
 * Reihenfolge und Rückfälle sind die Übersetzung von `ensureSession()` +
 * `ensureProfile()` aus der Altversion in einen einzigen Aufruf mit einem
 * eindeutigen Ergebnis.
 */
export async function restoreSession(deps: RestoreDeps): Promise<SessionState> {
  const isOnline = deps.isOnline ?? (() => true);
  const probe = { isOnline };

  let user: SessionUser | null = null;
  try {
    const { session } = await deps.getSession();
    user = session?.user ?? null;
  } catch (error) {
    /*
     * Die Sitzungsprüfung selbst ist gescheitert. Ist es ein Transportfehler,
     * trägt der Abzug; ist es ein echter, ist der Nutzer abgemeldet.
     */
    if (isOfflineSyncError(error, probe)) return fromSnapshot(deps.storage);
    return { status: 'signed-out' };
  }

  // Kein Fehler und keine Sitzung: wirklich abgemeldet.
  if (user === null) return { status: 'signed-out' };

  /*
   * Die Frist haengt daran, ob es etwas zum Zurueckfallen gibt. Mit Abzug darf
   * sie kurz sein — der Nutzer sieht sofort seine Daten und die frischen kommen
   * beim naechsten Start. Ohne Abzug muss das Profil wirklich her.
   */
  const hasSnapshot = readIdentitySnapshot(deps.storage) !== null;
  const deadlineMs =
    deps.identityTimeoutMs ??
    (hasSnapshot ? IDENTITY_TIMEOUT_WITH_SNAPSHOT_MS : IDENTITY_TIMEOUT_WITHOUT_SNAPSHOT_MS);

  try {
    const { profile, partner } = await withDeadline(deps.loadIdentity(user), deadlineMs);
    writeIdentitySnapshot(deps.storage, profile, partner);

    return {
      status: 'signed-in',
      offline: false,
      identity: {
        userId: profile.id,
        profile,
        partner,
        calendarId: computeCalendarId(profile.id, profile.partner_id),
      },
    };
  } catch (error) {
    /*
     * Sitzung gültig, Profil nicht erreichbar. Ohne diesen Zweig wäre ein
     * Netzfehler beim Profil-Laden eine Abmeldung — der Fehler, der in der
     * Altversion `withSession` so kompliziert macht.
     */
    if (isOfflineSyncError(error, probe)) return fromSnapshot(deps.storage);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Aufräumen
// ---------------------------------------------------------------------------

/**
 * Schlüssel, die beim Abmelden fallen müssen. Wortgleich aus
 * `clearAllAuthData()` in `Ralia_Opus/public/js/session.js`.
 */
export const LEGACY_AUTH_KEYS = [
  'googleAccessToken',
  'googleEmail',
  'googleAutoSync',
  'ralia:identity',
] as const;

/**
 * Präfixe der Offline-Zwischenspeicher. Bleiben sie liegen, sieht der nächste
 * Nutzer an diesem Gerät die Termine des vorherigen.
 */
const LEGACY_CACHE_PREFIXES = [
  'ralia:event-cache:',
  'ralia:event-queue:',
  'ralia:todo-cache:',
  'ralia:todo-queue:',
] as const;

function shouldClear(key: string): boolean {
  // Supabase legt seine Token als 'sb-<ref>-auth-token' ab; ältere Fassungen
  // haben 'supabase' im Namen.
  if (key.startsWith('sb-') || key.includes('supabase')) return true;
  if ((LEGACY_AUTH_KEYS as readonly string[]).includes(key)) return true;
  return LEGACY_CACHE_PREFIXES.some((prefix) => key.startsWith(prefix));
}

/**
 * Räumt alles ab, was zu einer Anmeldung gehört — und nur das.
 *
 * `ralia:theme` und `appLanguage` bleiben ausdrücklich stehen: sie sind
 * Einstellungen des Geräts, nicht der Person, und ein Abmelden, das die
 * Sprachwahl mitnimmt, wirkt wie ein Fehler.
 */
export function clearAuthData(storage: Storage): void {
  const doomed: string[] = [];
  try {
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      if (key !== null && shouldClear(key)) doomed.push(key);
    }
  } catch {
    // Ein Speicher, der beim Aufzählen wirft, ist ohnehin nicht zu retten.
  }

  for (const key of doomed) {
    try {
      storage.removeItem(key);
    } catch {
      // Einzelne Schlüssel überspringen, statt das Abmelden abzubrechen.
    }
  }

  clearIdentitySnapshot(storage);
}
