/**
 * Partner verbinden, trennen, Jahrestag setzen.
 *
 * Alle drei laufen über SECURITY-DEFINER-RPCs aus `migrations/018`, und das ist
 * keine Bequemlichkeit: die SELECT-Policy auf `profiles` gibt nur die eigene und
 * die Partnerzeile heraus (`auth.uid() = id OR auth.uid() = partner_id`). Ein
 * fremder Einladungscode ist vom Client damit **nicht auflösbar** — ein Versuch
 * käme leer zurück, und die App würde „Code falsch" behaupten, obwohl sie nur
 * nicht hinsehen darf.
 *
 * Die RPCs melden Fehler als Wortmarken (`raise exception 'invalid_code'`). Sie
 * werden hier auf i18n-Schlüssel abgebildet, nicht auf fertige Sätze: die
 * Übersetzung gehört in den Katalog, nicht in die Datenschicht.
 */

import { normalizeInviteCode } from '../auth/invite-code.js';
import type { ProfilesRow } from '../database.types.js';

/**
 * Wortmarke der RPC → i18n-Schlüssel.
 *
 * Übernommen aus `PARTNER_RPC_ERROR_KEYS` in `Ralia_Opus/public/js/partner.js`,
 * ergänzt um `profile_not_found`: `migrations/018` wirft es, die Altversion hat
 * keinen Eintrag dafür und lässt es auf „Einladungscode ungültig" fallen. Das
 * behauptet etwas Falsches — der Code war richtig, das eigene Profil fehlte.
 */
export const PARTNER_ERROR_KEYS: Readonly<Record<string, string>> = {
  invalid_code: 'invalidInviteCode',
  cant_connect_self: 'cantConnectYourself',
  already_connected: 'alreadyConnected',
  partner_taken: 'partnerTaken',
  not_authenticated: 'sessionError',
  profile_not_found: 'profileError',
};

/** Wenn keine Marke passt. Besser eine allgemeine Meldung als eine falsche. */
const FALLBACK_KEY = 'genericError';

export function partnerErrorKey(error: unknown): string {
  if (typeof error !== 'object' || error === null) return FALLBACK_KEY;
  const message = (error as { message?: unknown }).message;
  if (typeof message !== 'string') return FALLBACK_KEY;

  /*
   * Nicht auf Gleichheit prüfen: PostgREST verpackt die Ausnahme in eine
   * Meldung mit Kontext ('ERROR: invalid_code (SQLSTATE P0001)'). Geprüft wird
   * auf Enthaltensein, und die längeren Marken kommen zuerst, damit keine
   * kürzere in einer längeren fälschlich trifft.
   */
  const tokens = Object.keys(PARTNER_ERROR_KEYS).sort((a, b) => b.length - a.length);
  for (const token of tokens) {
    if (message.includes(token)) return PARTNER_ERROR_KEYS[token] as string;
  }
  return FALLBACK_KEY;
}

/** Der Ausschnitt des Supabase-Clients, den diese Repository braucht. */
export type RpcCall = (
  name: string,
  args: Record<string, unknown>,
) => Promise<{ data?: unknown; error?: { message?: string | undefined } | null }>;

export type PartnerResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? Record<never, never> : T))
  | { ok: false; messageKey: string };

export interface PartnerRepo {
  /**
   * Verbindet mit dem Code. `ownInviteCode` ist wahlfrei; ist er da, wird der
   * eigene Code abgefangen, bevor eine Anfrage rausgeht.
   */
  connect(
    code: string,
    ownUserId: string,
    ownInviteCode?: string | null,
  ): Promise<PartnerResult<{ partner: ProfilesRow }>>;
  disconnect(): Promise<PartnerResult>;
  setAnniversary(date: string | null): Promise<PartnerResult>;
}

export function createPartnerRepo(rpc: RpcCall): PartnerRepo {
  return {
    async connect(code, _ownUserId, ownInviteCode) {
      const normalized = normalizeInviteCode(code);
      if (normalized.length === 0) return { ok: false, messageKey: 'pleaseEnterCode' };

      /*
       * Die einzige Prüfung, die der Client führen darf und soll: den eigenen
       * Code kennt er, die Antwort der RPC wäre `cant_connect_self`. Eine
       * Rundreise für ein bekanntes Ergebnis.
       */
      if (ownInviteCode && normalized === normalizeInviteCode(ownInviteCode)) {
        return { ok: false, messageKey: 'cantConnectYourself' };
      }

      const { data, error } = await rpc('connect_partner', { p_invite_code: normalized });
      if (error) return { ok: false, messageKey: partnerErrorKey(error) };

      /*
       * `connect_partner` gibt `to_jsonb(v_target)` zurück. Leer ohne Fehler
       * darf nicht als Erfolg durchgehen — die App stünde mit `partner === null`
       * da und hielte sich für verbunden.
       */
      if (typeof data !== 'object' || data === null) {
        return { ok: false, messageKey: 'invalidInviteCode' };
      }

      return { ok: true, partner: data as ProfilesRow };
    },

    async disconnect() {
      const { error } = await rpc('disconnect_partner', {});
      return error ? { ok: false, messageKey: partnerErrorKey(error) } : { ok: true };
    },

    async setAnniversary(date) {
      /*
       * `p_date`, nicht `p_anniversary_date`. Die Funktion heißt
       * `set_shared_anniversary(p_date date)` — nachgesehen in der laufenden
       * Datenbank. PostgREST löst Argumente über den Namen auf; der falsche Name
       * gibt keinen Typfehler, sondern einen Laufzeitfehler.
       */
      const { error } = await rpc('set_shared_anniversary', { p_date: date });
      return error ? { ok: false, messageKey: partnerErrorKey(error) } : { ok: true };
    },
  };
}
