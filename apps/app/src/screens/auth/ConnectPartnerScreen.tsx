import { Button, FieldLabel, Input, useToast } from '@ralia/ui';
import { useId, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../auth/useAuth.js';
import { useT } from '../../i18n/useT.js';
import styles from './AuthLayout.module.css';
import { AuthLayout } from './AuthLayout.js';

/**
 * Partner verbinden, direkt nach der Anmeldung.
 *
 * Überspringbar, wie in Ralia 1.x (`skipConnection`): Ralia allein zu nutzen ist
 * ein gültiger Zustand, nicht ein halb fertiger. Wer später verbinden will,
 * findet den Code auch in den Einstellungen.
 */
export function ConnectPartnerScreen(): React.JSX.Element {
  const { t } = useT();
  const navigate = useNavigate();
  const { show } = useToast();
  const { session, connectPartner } = useAuth();

  const [code, setCode] = useState('');
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const ids = useId();
  const errorId = `${ids}-error`;

  const ownCode =
    session.status === 'signed-in' ? (session.identity.profile.invite_code ?? '') : '';

  async function submit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setErrorKey(null);
    setBusy(true);

    const result = await connectPartner(code);
    setBusy(false);

    if (!result.ok) {
      setErrorKey(result.messageKey);
      return;
    }
    show(`${t('connectSuccess')} ${result.partner?.name ?? ''}`.trim(), 'info');
    void navigate('/kalender', { replace: true });
  }

  async function copyCode(): Promise<void> {
    try {
      await navigator.clipboard.writeText(ownCode);
      show(t('inviteCodeCopiedMsg'), 'info');
    } catch {
      // Ohne Berechtigung für die Ablage bleibt der Code sichtbar — abschreiben
      // geht immer, und die Meldung sagt genau das.
      show(t('settingsCodeCopyFailed'), 'info');
    }
  }

  return (
    <AuthLayout title={t('connectTitle')} hint={t('connectYourCodeHint')}>
      <FieldLabel htmlFor={`${ids}-own`}>{t('connectYourCode')}</FieldLabel>
      <div className={styles.codeBox} style={{ marginTop: 6 }}>
        {/* Kein Eingabefeld: der Code ist nicht änderbar, nur ablesbar. */}
        <span className={styles.code} id={`${ids}-own`}>
          {ownCode}
        </span>
        <Button variant="ghost" onClick={() => void copyCode()}>
          {t('settingsCopy')}
        </Button>
      </div>

      <div className={styles.divider}>{t('authOr')}</div>

      <form className={styles.form} onSubmit={(event) => void submit(event)} noValidate>
        <div className={styles.field}>
          <FieldLabel htmlFor={`${ids}-code`}>{t('connectPartnerCode')}</FieldLabel>
          <Input
            id={`${ids}-code`}
            name="invite-code"
            value={code}
            /*
             * Grossbuchstaben schon bei der Eingabe: `connect_partner`
             * vergleicht ohnehin gross, aber ein Code, der beim Tippen anders
             * aussieht als auf dem Zettel, sieht nach einem Fehler aus.
             */
            onChange={(next) => setCode(next.toUpperCase())}
            placeholder="R7K2QM"
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
          {t('connectAction')}
        </Button>
      </form>

      <p className={styles.hint} style={{ marginTop: 14, marginBottom: 0 }}>
        {t('connectSkipHint')}
      </p>
      <div className={styles.linkRow}>
        <button
          type="button"
          className={styles.link}
          onClick={() => void navigate('/kalender', { replace: true })}
        >
          {t('connectSkip')}
        </button>
      </div>
    </AuthLayout>
  );
}
