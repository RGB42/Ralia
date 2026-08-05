import { Button, FieldLabel, Input, useToast } from '@ralia/ui';
import { useId, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../auth/useAuth.js';
import { useT } from '../../i18n/useT.js';
import styles from './AuthLayout.module.css';
import { AuthLayout } from './AuthLayout.js';

/**
 * Neues Passwort setzen, nach einem `type=recovery`-Link.
 *
 * Der Link liefert eine **gültige Sitzung** — wer ihn hat, ist angemeldet. Die
 * App darf ihn deshalb nicht einfach in den Kalender lassen: `RequireAuth` hält
 * einen offenen Rücksprung hier fest, bis `updatePassword` durch ist. Genau so
 * hält es Ralia 1.x, und der Grund ist ein weitergeleiteter Mail-Link.
 */
export function NewPasswordScreen(): React.JSX.Element {
  const { t } = useT();
  const navigate = useNavigate();
  const { show } = useToast();
  const { updatePassword, session, callbackErrorKey } = useAuth();

  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const ids = useId();
  const errorId = `${ids}-error`;
  const shownError = errorKey ?? callbackErrorKey;

  /*
   * Ohne Sitzung gibt es nichts zu ändern. Das passiert, wenn der Link
   * abgelaufen war oder ein zweites Mal geöffnet wurde — dann hilft nur ein
   * neuer, und der Weg dorthin steht direkt darunter.
   */
  const hasSession = session.status === 'signed-in';

  async function submit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setErrorKey(null);

    if (password.length < 6) {
      setErrorKey('authPasswordTooShort');
      return;
    }
    if (password !== repeat) {
      setErrorKey('authPasswordMismatch');
      return;
    }

    setBusy(true);
    const result = await updatePassword(password);
    setBusy(false);

    if (!result.ok) {
      setErrorKey(result.messageKey);
      return;
    }
    show(t('authPasswordChanged'), 'info');
    void navigate('/kalender', { replace: true });
  }

  return (
    <AuthLayout title={t('authNewPasswordTitle')}>
      {!hasSession ? (
        <>
          <div className={styles.error} role="alert">
            {t(shownError ?? 'authLinkExpired')}
          </div>
          <div style={{ marginTop: 14 }}>
            <Button fullWidth onClick={() => void navigate('/passwort-vergessen')}>
              {t('authResetAction')}
            </Button>
          </div>
        </>
      ) : (
        <form className={styles.form} onSubmit={(event) => void submit(event)} noValidate>
          <div className={styles.field}>
            <FieldLabel htmlFor={`${ids}-pw`}>{t('authPasswordNew')}</FieldLabel>
            <Input
              id={`${ids}-pw`}
              name="new-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={setPassword}
              invalid={shownError !== null}
              {...(shownError !== null ? { describedBy: errorId } : {})}
            />
          </div>

          <div className={styles.field}>
            <FieldLabel htmlFor={`${ids}-repeat`}>{t('authPasswordRepeat')}</FieldLabel>
            <Input
              id={`${ids}-repeat`}
              name="new-password-repeat"
              type="password"
              autoComplete="new-password"
              value={repeat}
              onChange={setRepeat}
              invalid={shownError !== null}
              {...(shownError !== null ? { describedBy: errorId } : {})}
            />
          </div>

          {shownError !== null && (
            <div className={styles.error} id={errorId} role="alert">
              {t(shownError)}
            </div>
          )}

          <Button type="submit" fullWidth disabled={busy}>
            {t('authNewPasswordAction')}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
