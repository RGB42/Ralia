import { Button } from '@ralia/ui';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useAuth } from '../../auth/useAuth.js';
import { useT } from '../../i18n/useT.js';
import styles from './AuthLayout.module.css';
import { AuthLayout } from './AuthLayout.js';

interface LocationState {
  email?: string;
}

/** Wartezeit, bevor erneut gesendet werden darf — wie in Ralia 1.x. */
const RESEND_COOLDOWN_S = 60;

/**
 * „Schau in dein Postfach" nach einer Registrierung.
 *
 * `mailer_autoconfirm` ist im Projekt aus, dieser Screen ist also nicht der
 * Sonderfall, sondern der Normalweg jeder Registrierung.
 */
export function VerifyNoticeScreen(): React.JSX.Element {
  const { t } = useT();
  const navigate = useNavigate();
  const location = useLocation();
  const { resendConfirmation } = useAuth();

  const email = (location.state as LocationState | null)?.email ?? '';
  const [cooldown, setCooldown] = useState(0);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  /*
   * Wer ohne Zustand hier landet — etwa über einen Lesezeichen-Aufruf — hat
   * keine Adresse, an die etwas gehen könnte. Dann ist die Anmeldung der
   * richtige Ort, nicht ein Knopf, der nichts tun kann.
   */
  if (email === '') {
    return (
      <AuthLayout title={t('authVerifyTitle')}>
        <Button fullWidth onClick={() => void navigate('/anmelden', { replace: true })}>
          {t('authBackToSignIn')}
        </Button>
      </AuthLayout>
    );
  }

  async function resend(): Promise<void> {
    setErrorKey(null);
    const result = await resendConfirmation(email);
    if (!result.ok) {
      setErrorKey(result.messageKey);
      return;
    }
    setSent(true);
    setCooldown(RESEND_COOLDOWN_S);
    /*
     * Der Rückwärtszähler läuft in einem Intervall, das sich selbst abräumt.
     * Kein useEffect: der Zähler startet nur durch diesen Klick, und ihn an den
     * Renderzyklus zu hängen würde ihn bei jedem Zustandswechsel neu aufsetzen.
     */
    const timer = setInterval(() => {
      setCooldown((value) => {
        if (value <= 1) {
          clearInterval(timer);
          return 0;
        }
        return value - 1;
      });
    }, 1000);
  }

  return (
    <AuthLayout title={t('authVerifyTitle')}>
      <p className={styles.hint} style={{ marginBottom: 8 }}>
        {t('authVerifyHint')}
      </p>
      <div className={styles.codeBox} style={{ borderStyle: 'solid' }}>
        <span style={{ fontSize: 13, fontWeight: 600, wordBreak: 'break-all' }}>{email}</span>
      </div>
      <p className={styles.hint} style={{ marginTop: 12 }}>
        {t('authVerifyExpiry')}
      </p>

      {sent && cooldown > 0 && (
        <div className={styles.notice} role="status">
          {t('verificationEmailSent')}
        </div>
      )}
      {errorKey !== null && (
        <div className={styles.error} role="alert">
          {t(errorKey)}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
        <Button variant="secondary" fullWidth disabled={cooldown > 0} onClick={() => void resend()}>
          {cooldown > 0
            ? `${t('resendVerification')} (${String(cooldown)})`
            : t('resendVerification')}
        </Button>
        <Button fullWidth onClick={() => void navigate('/anmelden', { replace: true })}>
          {t('authBackToSignIn')}
        </Button>
      </div>
    </AuthLayout>
  );
}
