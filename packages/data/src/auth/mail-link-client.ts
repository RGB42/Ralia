/**
 * Der Client für die drei Aufrufe, die eine E-Mail mit Link auslösen.
 *
 * Warum ein zweiter Client neben `getSupabaseClient()` — ausführlich im
 * SP1-Spec, hier die Kurzfassung: `auth-js` legt bei `flowType: 'pkce'` den
 * Code-Verifier in seinem Speicher ab (`GoTrueClient._getCodeChallengeAndMethod`
 * → `getCodeChallengeAndMethod(this.storage, …)`). Der Mail-Link trägt dann
 * `?code=…` und ist nur in genau dem Browser einlösbar, der ihn angefordert hat.
 *
 * Das trifft die zwei Wege, auf denen es am meisten weh tut:
 *
 *   - **Passwort vergessen.** Man ist ausgesperrt, fordert am Rechner an und
 *     öffnet die Mail auf dem Telefon.
 *   - **Registrierung bestätigen.** `mailer_autoconfirm` ist im Projekt aus,
 *     jede Anmeldung läuft über einen Link — oft auf einem anderen Gerät.
 *
 * Ralia 1.x kann beides, weil es Implicit fährt. „Feature-Parität vor Go-Live"
 * steht im Programm-Spec, also darf das hier nicht schlechter werden. PKCE beim
 * Sitzungs-Client aufzugeben ist aber ebenso keine Option: für OAuth landen die
 * Tokens sonst in der URL und damit in der Chronik, und für die
 * Deep-Link-Anmeldung der nativen Schalen in SP7 ist PKCE praktisch Pflicht.
 *
 * Also beide, getrennt nach Aufgabe. Dieser hier ist kein zweiter Zustand,
 * sondern ein Briefkasten: er speichert nichts (`persistSession: false`) und
 * erneuert nichts (`autoRefreshToken: false`), kann dem Sitzungs-Client den
 * Speicher also nicht wegziehen. Ein Test prüft genau das.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './../database.types.js';

export interface MailLinkClientOptions {
  supabaseUrl: string;
  supabaseAnonKey: string;
}

let cached: { key: string; client: SupabaseClient<Database> } | undefined;

export function getMailLinkClient(options: MailLinkClientOptions): SupabaseClient<Database> {
  // Wie beim Sitzungs-Client auf url+key gecacht: der Runtime-Key aus /config
  // kommt erst nach dem Boot, danach muss ein neuer Client entstehen.
  const cacheKey = `${options.supabaseUrl}::${options.supabaseAnonKey}`;
  if (cached && cached.key === cacheKey) return cached.client;

  const client = createClient<Database>(options.supabaseUrl, options.supabaseAnonKey, {
    auth: {
      flowType: 'implicit',
      persistSession: false,
      autoRefreshToken: false,
      // Dieser Client sieht nie eine Rücksprung-URL; die liest `auth-callback.ts`.
      detectSessionInUrl: false,
    },
    global: {
      headers: { 'x-ralia-client': 'ralia-2.0-mail' },
    },
  });

  cached = { key: cacheKey, client };
  return client;
}

/** Verwirft den gecachten Client. Für Tests und für eine vollständige Abmeldung. */
export function resetMailLinkClient(): void {
  cached = undefined;
}
