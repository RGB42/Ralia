import { Button, FieldLabel, Input } from '@ralia/ui';
import { useId, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useAuth } from '../../auth/useAuth.js';
import { useT } from '../../i18n/useT.js';
import styles from './AuthLayout.module.css';
import { AuthLayout } from './AuthLayout.js';

interface LocationState {
  email?: string;
}

/**
 * Passwort zurücksetzen anfordern.
 *
 * Der Hinweis „funktioniert auch auf einem anderen Gerät" ist keine Zierde: er
 * ist die Zusage, für die der Mail-Client mit Implicit-Flow überhaupt existiert
 * (siehe SP1-Spec). Wer ausgesperrt ist, liest die Mail meist auf dem Telefon.
 */
export function ForgotPasswordScreen(): React.JSX.Element {
  const { t } = useT();
  const navigate = useNavigate();
  const location = useLocation();
  const { requestPasswordReset } = useAuth();

  // Die Adresse aus dem Anmeldeformular mitnehmen — sie ist meist schon getippt.
  const [email, setEmail] = useState((location.state as LocationState | null)?.email ?? '');
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const ids = useId();
  const errorId = `${ids}-error`;

  async function submit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setErrorKey(null);

    if (email.trim() === '') {
      setErrorKey('enterEmail');
      return;
    }

    setBusy(true);
    const result = await requestPasswordReset(email.trim());
    setBusy(false);

    if (result.ok) setSent(true);
    else setErrorKey(result.messageKey);
  }

  return (
    <AuthLayout title={t('authResetTitle')} hint={t('authResetHint')}>
      {sent ? (
        <>
          <div className={styles.notice} role="status">
            {t('authResetSent')}
          </div>
          <p className={styles.hint} style={{ marginTop: 12, marginBottom: 0 }}>
            {t('authResetOpenAnywhere')}
          </p>
          <div style={{ marginTop: 14 }}>
            <Button variant="secondary" fullWidth onClick={() => void navigate('/anmelden')}>
              {t('authBackToSignIn')}
            </Button>
          </div>
        </>
      ) : (
        <form className={styles.form} onSubmit={(event) => void submit(event)} noValidate>
          <div className={styles.field}>
            <FieldLabel htmlFor={`${ids}-email`}>{t('authEmail')}</FieldLabel>
            <Input
              id={`${ids}-email`}
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={setEmail}
              invalid={errorKey !== null}
              {...(errorKey !== null ? { describedBy: errorId } : {})}
            />
          </div>

          {errorKey !== null && (
            <div className={styles.error} id={errorId} role="alert">
              {t(errorKey)}
            </div>
          )}

          <Button type="submit" fullWidth disabled={busy}>
            {t('authResetAction')}
          </Button>

          <div className={styles.linkRow}>
            <button
              type="button"
              className={styles.link}
              onClick={() => void navigate('/anmelden')}
            >
              {t('authBackToSignIn')}
            </button>
          </div>
        </form>
      )}
    </AuthLayout>
  );
}
