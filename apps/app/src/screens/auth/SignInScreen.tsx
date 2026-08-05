import { Button, FieldLabel, Input, SegmentSwitch } from '@ralia/ui';
import { useId, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useAuth } from '../../auth/useAuth.js';
import { useT } from '../../i18n/useT.js';
import styles from './AuthLayout.module.css';
import { AuthLayout } from './AuthLayout.js';

type Mode = 'signIn' | 'signUp';

interface LocationState {
  from?: string;
}

/**
 * Anmelden und Registrieren als ein Screen mit Segment-Umschalter.
 *
 * Wie in Ralia 1.x, das dieselben zwei Reiter hat — und mit dem
 * `SegmentSwitch`-Baustein aus SP0, damit der Wechsel per Pfeiltaste geht und
 * die Optik nicht driftet.
 */
export function SignInScreen(): React.JSX.Element {
  const { t } = useT();
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, signUp, signInWithGoogle, callbackErrorKey } = useAuth();

  const [mode, setMode] = useState<Mode>('signIn');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const ids = useId();
  const errorId = `${ids}-error`;

  // Der Fehler aus der Rücksprung-URL wiegt schwerer: er erklärt, warum der
  // Nutzer überhaupt hier steht.
  const shownError = errorKey ?? callbackErrorKey;

  /**
   * Wohin nach der Anmeldung.
   *
   * Drei Möglichkeiten, in dieser Ordnung:
   *
   *   1. Das Ziel, das die Wache gemerkt hat. Wer einen Link auf die
   *      Geld-Ansicht geöffnet hat, will dorthin und nicht in den Kalender.
   *   2. Der Verbinden-Screen, wenn kein Partner verbunden ist. So hält es
   *      Ralia 1.x (`navigateAfterAuth`: ohne `partner_id` → `connectionScreen`),
   *      und für ein Paar ist das Verbinden der eigentliche Anfang.
   *   3. Der Kalender.
   *
   * „Überspringen" wird nicht gemerkt — auch das wie Ralia 1.x. Ein Nutzer, der
   * allein bleibt, sieht den Screen bei der nächsten Anmeldung wieder; das ist
   * der Preis dafür, dass ein Paar den Weg nicht verpasst.
   */
  function afterAuth(needsPartner: boolean | undefined): string {
    const from = (location.state as LocationState | null)?.from;
    if (from !== undefined && from !== '/anmelden') return from;
    return needsPartner === true ? '/partner-verbinden' : '/kalender';
  }

  async function submit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setErrorKey(null);

    if (email.trim() === '' || password === '' || (mode === 'signUp' && name.trim() === '')) {
      setErrorKey('authFillAllFields');
      return;
    }
    if (mode === 'signUp' && password.length < 6) {
      setErrorKey('authPasswordTooShort');
      return;
    }

    setBusy(true);
    try {
      if (mode === 'signIn') {
        const result = await signIn(email.trim(), password);
        if (!result.ok) setErrorKey(result.messageKey);
        else void navigate(afterAuth(result.needsPartner), { replace: true });
        return;
      }

      const result = await signUp(name.trim(), email.trim(), password);
      if (!result.ok) {
        setErrorKey(result.messageKey);
        return;
      }
      if (result.needsVerification) {
        void navigate('/bestaetigen', { replace: true, state: { email: email.trim() } });
        return;
      }
      void navigate(afterAuth(result.needsPartner), { replace: true });
    } finally {
      setBusy(false);
    }
  }

  async function google(): Promise<void> {
    setErrorKey(null);
    setBusy(true);
    const result = await signInWithGoogle();
    // Bei Erfolg verlässt der Browser die Seite — hierher kommt nur der Fehler.
    if (!result.ok) setErrorKey(result.messageKey);
    setBusy(false);
  }

  return (
    <AuthLayout title={t(mode === 'signIn' ? 'authSignIn' : 'authSignUp')}>
      <div style={{ marginBottom: 14 }}>
        <SegmentSwitch<Mode>
          label={t('authModeLabel')}
          value={mode}
          onChange={(next) => {
            setMode(next);
            setErrorKey(null);
          }}
          options={[
            { value: 'signIn', label: t('authSignIn') },
            { value: 'signUp', label: t('authSignUp') },
          ]}
        />
      </div>

      <form className={styles.form} onSubmit={(event) => void submit(event)} noValidate>
        {mode === 'signUp' && (
          <div className={styles.field}>
            <FieldLabel htmlFor={`${ids}-name`}>{t('authName')}</FieldLabel>
            <Input
              id={`${ids}-name`}
              name="name"
              autoComplete="name"
              value={name}
              onChange={setName}
              placeholder={t('authNamePlaceholder')}
            />
          </div>
        )}

        <div className={styles.field}>
          <FieldLabel htmlFor={`${ids}-email`}>{t('authEmail')}</FieldLabel>
          <Input
            id={`${ids}-email`}
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={setEmail}
            invalid={shownError !== null}
            {...(shownError !== null ? { describedBy: errorId } : {})}
          />
        </div>

        <div className={styles.field}>
          <FieldLabel htmlFor={`${ids}-password`}>{t('authPassword')}</FieldLabel>
          <Input
            id={`${ids}-password`}
            name="password"
            type="password"
            /*
             * `new-password` beim Registrieren, damit der Passwortmanager ein
             * neues anbietet statt das alte einzusetzen.
             */
            autoComplete={mode === 'signUp' ? 'new-password' : 'current-password'}
            value={password}
            onChange={setPassword}
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
          {t(mode === 'signIn' ? 'authSignIn' : 'authSignUp')}
        </Button>
      </form>

      <div className={styles.divider}>{t('authOr')}</div>

      <Button variant="secondary" fullWidth disabled={busy} onClick={() => void google()}>
        {t('signInGoogle')}
      </Button>

      {mode === 'signIn' && (
        <div className={styles.linkRow}>
          <button
            type="button"
            className={styles.link}
            onClick={() => void navigate('/passwort-vergessen', { state: { email: email.trim() } })}
          >
            {t('authForgotPassword')}
          </button>
        </div>
      )}
    </AuthLayout>
  );
}
