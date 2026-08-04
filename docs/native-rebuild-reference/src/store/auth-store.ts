import type { Session } from '@supabase/supabase-js';
import { create } from 'zustand';

import { generateInviteCode } from '@/lib/auth';
import { getCalendarId } from '@/lib/calendar-id';
import { readLocalJson, writeLocalJson } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/types/database';

const SKIP_PARTNER_KEY = 'ralia:skipped-partner-connect';

interface AuthState {
  initializing: boolean;
  session: Session | null;
  profile: Profile | null;
  partner: Profile | null;
  /** Sorted `${uid}_${partnerId}` (or just uid when solo) — the single filter every query uses. */
  calendarId: string;
  /** True right after a password-recovery deep link establishes a session — routes to reset-password instead of the app. */
  passwordRecoveryPending: boolean;
  /** Device-local "I'll connect later" choice — re-asked once per fresh signup, not nagged every launch. */
  skippedPartnerConnect: boolean;
  init: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  skipPartnerConnect: () => Promise<void>;
  clearPasswordRecovery: () => void;
  signOut: () => Promise<void>;
}

let initialized = false;

export const useAuthStore = create<AuthState>((set, get) => ({
  initializing: true,
  session: null,
  profile: null,
  partner: null,
  calendarId: '',
  passwordRecoveryPending: false,
  skippedPartnerConnect: false,

  init: async () => {
    if (initialized) return;
    initialized = true;

    const skipped = await readLocalJson<boolean>(SKIP_PARTNER_KEY, false);
    set({ skippedPartnerConnect: skipped });

    const { data } = await supabase.auth.getSession();
    await applySession(data.session, set, get);
    set({ initializing: false });

    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        set({ passwordRecoveryPending: true });
      }
      await applySession(session, set, get);
    });
  },

  refreshProfile: async () => {
    const { session } = get();
    if (!session?.user) return;
    await applySession(session, set, get);
  },

  skipPartnerConnect: async () => {
    await writeLocalJson(SKIP_PARTNER_KEY, true);
    set({ skippedPartnerConnect: true });
  },

  clearPasswordRecovery: () => set({ passwordRecoveryPending: false }),

  signOut: async () => {
    await supabase.auth.signOut({ scope: 'local' });
    set({ session: null, profile: null, partner: null, calendarId: '' });
  },
}));

async function applySession(
  session: Session | null,
  set: (partial: Partial<AuthState>) => void,
  get: () => AuthState
) {
  if (!session?.user) {
    set({ session: null, profile: null, partner: null, calendarId: '' });
    return;
  }

  const profile = await loadOrCreateProfile(session);
  syncTimezoneIfNeeded(profile).catch(() => {});

  let partner: Profile | null = null;
  if (profile?.partner_id) {
    const { data: partnerRow } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', profile.partner_id)
      .single();
    partner = partnerRow ?? null;
  }

  set({
    session,
    profile: profile ?? null,
    partner,
    calendarId: getCalendarId(session.user.id, profile?.partner_id),
  });
}

/** Mirrors navigateAfterAuth()'s create-on-missing fallback: a profile row can be absent right after signup. */
async function loadOrCreateProfile(session: Session): Promise<Profile | null> {
  const { data: existing, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .maybeSingle();

  if (existing) return existing;
  if (error && error.code !== 'PGRST116') {
    // Real error (not just "no row") — surface it rather than masking with a bad insert.
    return null;
  }

  const name = (session.user.user_metadata?.name as string | undefined) || 'User';
  const { data: created } = await supabase
    .from('profiles')
    .insert({
      id: session.user.id,
      name,
      email: session.user.email,
      invite_code: generateInviteCode(),
    })
    .select('*')
    .single();

  return created ?? null;
}

async function syncTimezoneIfNeeded(profile: Profile | null) {
  if (!profile) return;
  const deviceTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (!deviceTz || profile.timezone === deviceTz) return;
  await supabase.from('profiles').update({ timezone: deviceTz }).eq('id', profile.id);
}
