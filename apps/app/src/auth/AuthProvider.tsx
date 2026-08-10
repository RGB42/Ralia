import {
  authErrorKey,
  browserTimeZone,
  cleanCallbackUrl,
  clearAuthData,
  computeCalendarId,
  createPartnerRepo,
  createProfileRepo,
  getMailLinkClient,
  getSupabaseClient,
  parseAuthCallback,
  resetMailLinkClient,
  restoreSession,
  writeIdentitySnapshot,
  type AuthCallback,
  type ProfileGateway,
  type ProfilesRow,
  type RaliaSupabaseClient,
  type SessionState,
} from '@ralia/data';
import { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useBoot } from '../boot/BootContext.js';

/**
 * Zustand und Handlungen der Anmeldung, an einer Stelle.
 *
 * Die Regeln stehen in `@ralia/data` und sind dort ohne Browser geprüft. Hier
 * liegt nur die Verkabelung: React-Zustand, der Supabase-Client aus der
 * Runtime-Konfiguration, und das Lesen der Rücksprung-URL genau einmal.
 */

export type ActionResult = { ok: true } | { ok: false; messageKey: string };

export interface AuthContextValue {
  session: SessionState;
  /** `true`, solange der Startzustand noch ermittelt wird. */
  loading: boolean;
  /**
   * Gesetzt, wenn die App über einen `type=recovery`-Link hereinkam. Die
   * Sitzung ist dann gültig, darf aber nur zum Setzen eines neuen Passworts
   * dienen — sonst wäre ein weitergeleiteter Mail-Link ein Zugang zur ganzen App.
   */
  pendingRecovery: boolean;
  /** Fehler aus der Rücksprung-URL, als i18n-Schlüssel. */
  callbackErrorKey: string | null;

  /**
   * `needsPartner` ist gesetzt, wenn die Anmeldung geklappt hat und das Profil
   * keinen Partner trägt. Der Screen entscheidet damit, ob es in den Kalender
   * oder auf den Verbinden-Screen geht — er kann es nicht selbst wissen, weil
   * `session` in seinem Abschluss noch der Zustand von vorher ist.
   */
  signIn(email: string, password: string): Promise<ActionResult & { needsPartner?: boolean }>;
  signUp(
    name: string,
    email: string,
    password: string,
  ): Promise<ActionResult & { needsVerification?: boolean; needsPartner?: boolean }>;
  signInWithGoogle(): Promise<ActionResult>;
  requestPasswordReset(email: string): Promise<ActionResult>;
  resendConfirmation(email: string): Promise<ActionResult>;
  updatePassword(password: string): Promise<ActionResult>;
  signOut(): Promise<void>;

  connectPartner(code: string): Promise<ActionResult & { partner?: ProfilesRow }>;
  disconnectPartner(): Promise<ActionResult>;
  setAnniversary(date: string | null): Promise<ActionResult>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

/** Angemeldet, aber ohne verbundenen Partner. */
function lacksPartner(state: SessionState): boolean {
  return state.status === 'signed-in' && state.identity.profile.partner_id === null;
}

/** Wohin Mail-Links und der OAuth-Rundlauf zurückkommen. */
function callbackUrl(): string {
  // Nicht auf die aktuelle Route: die App entscheidet nach dem Lesen der URL,
  // wohin es weitergeht. BASE_URL haelt Web-Root und /app/ konsistent.
  return new URL(import.meta.env.BASE_URL, globalThis.location.origin).toString();
}

function profileGateway(client: RaliaSupabaseClient): ProfileGateway {
  return {
    async selectById(id) {
      const { data, error } = await client.from('profiles').select('*').eq('id', id).single();
      return { data: data ?? null, error: error ?? null };
    },
    async insert(row) {
      const { error } = await client.from('profiles').insert(row);
      return { error: error ?? null };
    },
    async updateTimezone(id, timezone) {
      const { error } = await client.from('profiles').update({ timezone }).eq('id', id);
      return { error: error ?? null };
    },
  };
}

export interface AuthProviderProps {
  children: ReactNode;
  /** Einsetzbar für Tests; die App nimmt `globalThis.location.href`. */
  initialHref?: string;
}

export function AuthProvider({ children, initialHref }: AuthProviderProps): React.JSX.Element {
  const { config } = useBoot();
  const [session, setSession] = useState<SessionState>({ status: 'signed-out' });
  const [loading, setLoading] = useState(true);
  const [pendingRecovery, setPendingRecovery] = useState(false);
  const [callbackErrorKey, setCallbackErrorKey] = useState<string | null>(null);

  const client = useMemo(
    () =>
      getSupabaseClient({
        supabaseUrl: config.supabaseUrl,
        supabaseAnonKey: config.supabaseAnonKey,
      }),
    [config.supabaseUrl, config.supabaseAnonKey],
  );

  const mailClient = useMemo(
    () =>
      getMailLinkClient({
        supabaseUrl: config.supabaseUrl,
        supabaseAnonKey: config.supabaseAnonKey,
      }),
    [config.supabaseUrl, config.supabaseAnonKey],
  );

  const profiles = useMemo(() => createProfileRepo(profileGateway(client)), [client]);
  const partners = useMemo(
    () =>
      createPartnerRepo(async (name, args) => {
        // `rpc` ist auf den Funktionsnamen typisiert; die Repository arbeitet
        // absichtlich mit einem engen, untypisierten Port, damit sie ohne
        // Supabase prüfbar bleibt.
        const result = await (
          client.rpc as unknown as (
            fn: string,
            params: Record<string, unknown>,
          ) => Promise<{ data?: unknown; error?: { message?: string } | null }>
        )(name, args);
        return result;
      }),
    [client],
  );

  const refresh = useCallback(async (): Promise<SessionState> => {
    const next = await restoreSession({
      getSession: async () => {
        const { data, error } = await client.auth.getSession();
        if (error) throw error;
        const user = data.session?.user;
        const metadataName = user?.user_metadata?.name;
        return {
          session: user
            ? {
                user: {
                  id: user.id,
                  email: user.email ?? null,
                  name: typeof metadataName === 'string' ? metadataName : null,
                },
              }
            : null,
        };
      },
      loadIdentity: async (user) => {
        const profile = await profiles.ensure({
          id: user.id,
          email: user.email,
          name: user.name ?? null,
        });
        // Nicht abwarten: die Zeitzone dient den Erinnerungen, nicht dem Start.
        void profiles.syncTimezone(profile, browserTimeZone());
        const partner = await profiles.loadPartner(profile.partner_id);
        return { profile, partner };
      },
      storage: globalThis.localStorage,
      isOnline: () => globalThis.navigator?.onLine !== false,
    });
    setSession(next);
    return next;
  }, [client, profiles]);

  /**
   * Rücksprung-URL genau einmal lesen, vor allem anderen.
   *
   * `detectSessionInUrl` ist aus, es frisst also niemand die URL weg. Aber ein
   * zweiter Lauf würde einen schon verbrauchten Token erneut einlösen wollen,
   * und `history.replaceState` hat den Fragmentteil bis dahin entfernt.
   */
  const consumed = useRef(false);

  useEffect(() => {
    if (consumed.current) return;
    consumed.current = true;

    const href = initialHref ?? globalThis.location.href;
    const callback: AuthCallback = parseAuthCallback(href);

    async function start(): Promise<void> {
      if (callback.kind === 'error') {
        setCallbackErrorKey(authErrorKey({ message: callback.description ?? callback.code ?? '' }));
      } else if (callback.kind === 'code') {
        const { error } = await client.auth.exchangeCodeForSession(callback.code);
        // Ohne Verifier scheitert das — der Fall „Link auf einem anderen Geraet".
        if (error) setCallbackErrorKey(authErrorKey(error));
      } else if (callback.kind !== 'none') {
        const { error } = await client.auth.setSession({
          access_token: callback.accessToken,
          refresh_token: callback.refreshToken,
        });
        if (error) setCallbackErrorKey(authErrorKey(error));
        else if (callback.kind === 'recovery') setPendingRecovery(true);
      }

      /*
       * Token aus der Adresszeile nehmen, sobald sie gelesen sind: sonst
       * bleiben sie in der Chronik und in jedem geteilten Link stehen.
       * `replaceState`, damit „Zurück" nicht wieder hineinführt.
       */
      if (callback.kind !== 'none' && initialHref === undefined) {
        globalThis.history.replaceState(null, '', cleanCallbackUrl(href));
      }

      await refresh();
      setLoading(false);
    }

    void start().catch(() => setLoading(false));
  }, [client, initialHref, refresh]);

  /**
   * Auf Sitzungswechsel hören.
   *
   * Deckt zwei Fälle, die sonst durchfallen: ein Abmelden in einem zweiten Tab,
   * und `PASSWORD_RECOVERY`, das `auth-js` selbst meldet.
   */
  useEffect(() => {
    const { data } = client.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setPendingRecovery(true);
      if (event === 'SIGNED_OUT') setSession({ status: 'signed-out' });
    });
    return () => data.subscription.unsubscribe();
  }, [client]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      loading,
      pendingRecovery,
      callbackErrorKey,

      async signIn(email, password) {
        const { error } = await client.auth.signInWithPassword({ email, password });
        if (error) return { ok: false, messageKey: authErrorKey(error) };
        const next = await refresh();
        return { ok: true, needsPartner: lacksPartner(next) };
      },

      async signUp(name, email, password) {
        /*
         * Über den Mail-Client, damit der Bestätigungslink Implicit ist und auf
         * jedem Gerät geöffnet werden kann. Begründung im SP1-Spec.
         */
        const { data, error } = await mailClient.auth.signUp({
          email,
          password,
          options: { data: { name }, emailRedirectTo: callbackUrl() },
        });
        if (error) return { ok: false, messageKey: authErrorKey(error) };
        /*
         * `mailer_autoconfirm` ist im Projekt aus, hier kommt also immer ein
         * User ohne Sitzung zurück. Der Zweig für den anderen Fall steht
         * trotzdem da, weil die Einstellung serverseitig ist und sich ändern
         * kann, ohne dass dieser Code es erfährt.
         */
        if (data.user && !data.session) return { ok: true, needsVerification: true };
        const next = await refresh();
        return { ok: true, needsPartner: lacksPartner(next) };
      },

      async signInWithGoogle() {
        const { error } = await client.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: callbackUrl() },
        });
        // Bei Erfolg verlässt der Browser die Seite; alles danach ist der Fehlerfall.
        return error ? { ok: false, messageKey: authErrorKey(error) } : { ok: true };
      },

      async requestPasswordReset(email) {
        const { error } = await mailClient.auth.resetPasswordForEmail(email, {
          redirectTo: callbackUrl(),
        });
        return error ? { ok: false, messageKey: authErrorKey(error) } : { ok: true };
      },

      async resendConfirmation(email) {
        const { error } = await mailClient.auth.resend({
          type: 'signup',
          email,
          options: { emailRedirectTo: callbackUrl() },
        });
        return error ? { ok: false, messageKey: authErrorKey(error) } : { ok: true };
      },

      async updatePassword(password) {
        const { error } = await client.auth.updateUser({ password });
        if (error) return { ok: false, messageKey: authErrorKey(error) };
        // Erst jetzt ist die Sitzung eine gewöhnliche.
        setPendingRecovery(false);
        await refresh();
        return { ok: true };
      },

      async signOut() {
        /*
         * `scope: 'local'` wie in Ralia 1.x: eine globale Abmeldung würde auch
         * das Telefon des Partners aus der Sitzung werfen, wenn dort dasselbe
         * Konto läuft.
         */
        await client.auth.signOut({ scope: 'local' }).catch(() => undefined);
        clearAuthData(globalThis.localStorage);
        resetMailLinkClient();
        setPendingRecovery(false);
        setCallbackErrorKey(null);
        setSession({ status: 'signed-out' });
      },

      async connectPartner(code) {
        if (session.status !== 'signed-in') return { ok: false, messageKey: 'sessionError' };
        const result = await partners.connect(
          code,
          session.identity.userId,
          session.identity.profile.invite_code,
        );
        if (!result.ok) return result;

        /*
         * Nicht neu laden, sondern den bekannten Zustand fortschreiben: die RPC
         * hat das Partnerprofil schon geliefert, und `calendar_id` ist gerechnet.
         * Ein zweiter Rundlauf könnte scheitern und den Erfolg verschlucken.
         */
        const profile: ProfilesRow = {
          ...session.identity.profile,
          partner_id: result.partner.id,
        };
        const nextSession: SessionState = {
          status: 'signed-in',
          offline: false,
          identity: {
            userId: profile.id,
            profile,
            partner: result.partner,
            calendarId: computeCalendarId(profile.id, result.partner.id),
          },
        };
        writeIdentitySnapshot(globalThis.localStorage, profile, result.partner);
        setSession(nextSession);
        return { ok: true, partner: result.partner };
      },

      async disconnectPartner() {
        const result = await partners.disconnect();
        if (!result.ok) return result;
        await refresh();
        return { ok: true };
      },

      async setAnniversary(date) {
        const result = await partners.setAnniversary(date);
        if (!result.ok) return result;
        if (session.status === 'signed-in') {
          // Der Jahrestag steht auf beiden Profilen — die RPC schreibt beide.
          const profile = { ...session.identity.profile, anniversary_date: date };
          const partner = session.identity.partner
            ? { ...session.identity.partner, anniversary_date: date }
            : null;
          writeIdentitySnapshot(globalThis.localStorage, profile, partner);
          setSession({ ...session, identity: { ...session.identity, profile, partner } });
        }
        return { ok: true };
      },
    }),
    [session, loading, pendingRecovery, callbackErrorKey, client, mailClient, partners, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
