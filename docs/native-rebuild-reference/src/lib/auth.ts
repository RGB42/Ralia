import * as QueryParams from 'expo-auth-session/build/QueryParams';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { supabase } from './supabase';

WebBrowser.maybeCompleteAuthSession();

export async function signUpWithPassword(name: string, email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name } },
  });
  if (error) throw error;
  // Supabase returns a user with no session when email confirmation is required.
  return { needsEmailConfirmation: !!data.user && !data.session };
}

export async function signInWithPassword(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

/**
 * Google sign-in via a browser-based OAuth round trip (Supabase's recommended
 * Expo pattern). Requires `ralia://auth/callback` to be added to the Supabase
 * project's Auth > URL Configuration > Redirect URLs allow-list.
 */
export async function signInWithGoogle() {
  const redirectTo = Linking.createURL('auth/callback');

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;
  if (!data?.url) throw new Error('Google sign-in did not return a URL');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success' || !result.url) {
    return null; // user cancelled — not an error
  }
  return createSessionFromUrl(result.url);
}

export async function requestPasswordReset(email: string) {
  const redirectTo = Linking.createURL('reset-password');
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) throw error;
}

export async function updatePassword(newPassword: string) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

export async function verifyCurrentPassword(email: string, currentPassword: string) {
  // Same trick the legacy app uses: there's no dedicated "verify password" call,
  // so re-attempting sign-in with the typed current password doubles as the check.
  const { error } = await supabase.auth.signInWithPassword({ email, password: currentPassword });
  return !error;
}

/**
 * Handles both the Google OAuth callback and password-recovery deep links —
 * both arrive as `ralia://...#access_token=...&refresh_token=...&type=...`.
 * Establishing the session fires `onAuthStateChange` with `PASSWORD_RECOVERY`
 * for recovery links, which the auth store uses to route to the reset screen.
 */
export async function createSessionFromUrl(url: string) {
  const { params, errorCode } = QueryParams.getQueryParams(url);
  if (errorCode) throw new Error(errorCode);

  const { access_token, refresh_token } = params;
  if (!access_token || !refresh_token) return null;

  const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });
  if (error) throw error;
  return data.session;
}

/** generate_invite_code() equivalent — client-side generation for a brand-new profile row. */
export function generateInviteCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
