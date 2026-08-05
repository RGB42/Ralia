/**
 * Profil laden, bei Fehlen anlegen, Zeitzone abgleichen, Partnerprofil holen.
 *
 * Die Datenbank kennt keinen Trigger, der zu einem neuen `auth.users`-Eintrag
 * eine `profiles`-Zeile legt. Nach einer Anmeldung kann es also eine Identität
 * ohne Profil geben — bei einem Erstlogin über Google ist das der Normalfall.
 * Ralia 1.x fängt es ab (`navigateAfterAuth`: laden, bei Fehlschlag anlegen,
 * erneut laden), und das bleibt so: scheitern würde einen Nutzer mit gültigem
 * Konto vor eine Wand stellen.
 *
 * Der Zugang zur Datenbank steckt hinter `ProfileGateway`. Nicht aus Prinzip,
 * sondern damit die Fälle, auf die es ankommt — Profil fehlt, Zeitzone weicht ab,
 * Partner nicht lesbar — ohne Netz und ohne Supabase-Attrappe prüfbar sind.
 */

import { createProfileWithInviteCode } from '../auth/invite-code.js';
import type { ProfilesRow } from '../database.types.js';

/** PostgREST-Code für „`.single()` hat keine Zeile gefunden". */
const NO_ROWS = 'PGRST116';

export interface GatewayError {
  code?: string | undefined;
  message?: string | undefined;
}

export interface ProfileGateway {
  selectById(id: string): Promise<{ data: ProfilesRow | null; error: GatewayError | null }>;
  insert(row: {
    id: string;
    name: string | null;
    email: string | null;
    timezone: string | null;
    invite_code: string;
  }): Promise<{ error: GatewayError | null }>;
  updateTimezone(id: string, timezone: string): Promise<{ error: GatewayError | null }>;
}

/** Die angemeldete Identität, soweit sie zum Anlegen eines Profils reicht. */
export interface AuthenticatedUser {
  id: string;
  email: string | null;
  name: string | null;
}

export interface ProfileRepo {
  /** Das Profil, oder `null` wenn es keines gibt. Wirft nur bei echten Fehlern. */
  load(userId: string): Promise<ProfilesRow | null>;
  /** Wie `load`, legt es aber an, wenn es fehlt. */
  ensure(user: AuthenticatedUser): Promise<ProfilesRow>;
  /** Gleicht die Zeitzone ab. `true`, wenn geschrieben wurde. */
  syncTimezone(profile: ProfilesRow, timeZone?: string): Promise<boolean>;
  loadPartner(partnerId: string | null): Promise<ProfilesRow | null>;
}

/**
 * Zeitzone der Umgebung, mit demselben Rückfall wie `getBrowserTimeZone()` in
 * `Ralia_Opus/public/js/state.js`.
 */
export function browserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Berlin';
}

function isMissingRow(error: GatewayError | null): boolean {
  return error !== null && error.code === NO_ROWS;
}

function fail(error: GatewayError): never {
  throw new Error(error.message ?? error.code ?? 'unbekannter Fehler');
}

export function createProfileRepo(gateway: ProfileGateway): ProfileRepo {
  async function load(userId: string): Promise<ProfilesRow | null> {
    const { data, error } = await gateway.selectById(userId);

    /*
     * „Keine Zeile" ist kein Fehler, jeder andere Fehler schon. Der
     * Unterschied ist wichtig: ein Netzfehler als „kein Profil" zu lesen würde
     * `ensure` ein zweites Profil anlegen lassen, das an der Unique-Verletzung
     * auf der Id scheitert — und der Nutzer sähe einen Fehler, der nichts mit
     * seiner Lage zu tun hat.
     */
    if (error !== null && !isMissingRow(error)) fail(error);
    return data ?? null;
  }

  return {
    load,

    async ensure(user) {
      const existing = await load(user.id);
      if (existing !== null) return existing;

      await createProfileWithInviteCode((row) => gateway.insert(row), {
        id: user.id,
        // 'User' ist der Ersatzname aus Ralia 1.x; ein Google-Konto muss
        // keinen Anzeigenamen mitbringen.
        name: user.name ?? 'User',
        email: user.email,
        timezone: browserTimeZone(),
      });

      const created = await load(user.id);
      if (created === null) {
        /*
         * Der Insert hat keinen Fehler gemeldet, gelesen wird die Zeile
         * trotzdem nicht. Das ist kein Zustand, in dem weiterlaufen darf —
         * ohne Profil hat die App keine `calendar_id` und lädt einen leeren
         * Kalender, was aussieht wie Datenverlust.
         */
        throw new Error('Profil wurde angelegt, ist aber nicht lesbar.');
      }
      return created;
    },

    async syncTimezone(profile, timeZone = browserTimeZone()) {
      if (!profile.id || timeZone.length === 0) return false;
      if (profile.timezone === timeZone) return false;

      const { error } = await gateway.updateTimezone(profile.id, timeZone);
      /*
       * Fehlschlag ist eine Warnung, kein Abbruch — wie in `syncUserTimeZone()`
       * der Altversion. Die Zeitzone dient den Erinnerungen; sie beim nächsten
       * Start nachzuziehen ist billiger als eine gescheiterte Anmeldung.
       */
      return error === null;
    },

    async loadPartner(partnerId) {
      if (partnerId === null || partnerId.length === 0) return null;
      /*
       * Nicht lesbar heißt hier „kein Partner", nicht „Fehler": die
       * SELECT-Policy verlangt `auth.uid() = partner_id` auf der Zielzeile, und
       * nach einer einseitig gelösten Verbindung ist das nicht mehr wahr.
       */
      return load(partnerId);
    },
  };
}
