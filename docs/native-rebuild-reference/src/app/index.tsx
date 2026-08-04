import { Redirect } from 'expo-router';

import { useAuthStore } from '@/store/auth-store';

/**
 * The single source of truth for "where should the user land right now."
 * Every other layout guard just bounces back here (`<Redirect href="/" />`)
 * when its own precondition isn't met, instead of re-deriving this logic.
 */
export default function Index() {
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);
  const passwordRecoveryPending = useAuthStore((s) => s.passwordRecoveryPending);
  const skippedPartnerConnect = useAuthStore((s) => s.skippedPartnerConnect);

  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }
  if (passwordRecoveryPending) {
    return <Redirect href="/reset-password" />;
  }
  if (profile && !profile.partner_id && !skippedPartnerConnect) {
    return <Redirect href="/connect-partner" />;
  }
  return <Redirect href="/(tabs)" />;
}
