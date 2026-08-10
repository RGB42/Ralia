import {
  AppHeader,
  Avatar,
  Button,
  Card,
  ConfirmDialog,
  Input,
  ListRow,
  SectionLabel,
  SegmentSwitch,
  Toggle,
  useTheme,
  useToast,
} from '@ralia/ui';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../auth/useAuth.js';
import { useAppPreferences } from '../../preferences/AppPreferencesProvider.js';
import type { Lang } from '../../i18n/catalog.js';
import { useT } from '../../i18n/useT.js';
import screen from '../screen.module.css';
import styles from './SettingsScreen.module.css';

export function SettingsScreen(): React.JSX.Element {
  const { t, lang, setLang } = useT();
  const { resolved, setChoice } = useTheme();
  const { show } = useToast();
  const navigate = useNavigate();
  const { session, signOut, disconnectPartner, setAnniversary } = useAuth();
  const { preferences, update: updatePreferences } = useAppPreferences();

  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  const identity = session.status === 'signed-in' ? session.identity : null;
  const inviteCode = identity?.profile.invite_code ?? '';
  const [anniversary, setAnniversaryValue] = useState(identity?.profile.anniversary_date ?? '');
  const pushOn = preferences?.notification_settings.pushEnabled === true;
  const weekStart = preferences?.week_start ?? 'mo';

  const savePreferences = async (changes: Parameters<typeof updatePreferences>[0]) => {
    const saved = await updatePreferences(changes);
    if (!saved) show(t('settingsPreferencesError'), 'danger');
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(inviteCode);
      show(t('settingsCodeCopied'), 'ok');
    } catch {
      // Kein Clipboard-Zugriff (aelterer WebView, verweigerte Berechtigung):
      // der Code steht sichtbar da, also bleibt Abschreiben der Weg.
      show(t('settingsCodeCopyFailed'), 'info');
    }
  };

  const saveAnniversary = async (next: string) => {
    setAnniversaryValue(next);
    // Leeres Feld heisst „kein Jahrestag" — die RPC nimmt dafuer null.
    const result = await setAnniversary(next === '' ? null : next);
    show(result.ok ? t('anniversaryUpdated') : t(result.messageKey), result.ok ? 'ok' : 'info');
  };

  const doDisconnect = async () => {
    setConfirmDisconnect(false);
    const result = await disconnectPartner();
    if (result.ok) void savePreferences({ solo_mode: true });
    show(
      result.ok ? t('disconnectedFromPartner') : t(result.messageKey),
      result.ok ? 'ok' : 'info',
    );
  };

  const shareCode = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ text: inviteCode });
      } else {
        await copyCode();
      }
    } catch {
      show(t('settingsCodeCopyFailed'), 'info');
    }
  };

  const doSignOut = async () => {
    await signOut();
    show(t('authSignedOut'), 'info');
    void navigate('/anmelden', { replace: true });
  };

  return (
    <div className={screen.screen}>
      <AppHeader kicker={t('navProfileShort')} title={t('navSettings')} />
      <div className={screen.body}>
        <div className={screen.stack}>
          <Card padding="15px">
            <div className={styles.profileHead}>
              <Avatar
                initial={identity?.profile.name?.trim().charAt(0).toUpperCase() || '?'}
                slot="u1"
                size={52}
                shape="rounded"
              />
              <div className={styles.profileText}>
                <div className={styles.profileName}>{identity?.profile.name ?? t('me')}</div>
                <div className={styles.profileMail}>{identity?.profile.email ?? ''}</div>
              </div>
            </div>
          </Card>

          <Card flush>
            <div className={styles.sectionHeadWide}>
              <SectionLabel>{t('settingsPartner')}</SectionLabel>
            </div>
            {identity?.partner ? (
              <div className={styles.partnerRow}>
                <Avatar
                  initial={identity.partner.name?.trim().charAt(0).toUpperCase() || '?'}
                  slot="u2"
                  size={34}
                  shape="rounded"
                />
                <div className={styles.partnerText}>
                  <div className={styles.partnerName}>{identity.partner.name ?? t('partner')}</div>
                  <div className={styles.partnerSince}>{t('settingsAllShared')}</div>
                </div>
                <Button variant="danger" onClick={() => setConfirmDisconnect(true)}>
                  {t('settingsDisconnect')}
                </Button>
              </div>
            ) : (
              <div className={styles.partnerRow}>
                <div className={styles.partnerText}>
                  <div className={styles.partnerName}>{t('partnerNotConnected')}</div>
                  <div className={styles.partnerSince}>{t('connectSkipHint')}</div>
                </div>
                <Button onClick={() => void navigate('/partner-verbinden')}>{t('connectAction')}</Button>
              </div>
            )}
            <div className={styles.codeRow}>
              <div className={styles.codeText}>
                <div className={styles.codeLabel}>{t('settingsInviteCode')}</div>
                <div className={styles.code}>{inviteCode}</div>
                <div className={styles.codeHint}>{t('settingsInviteHint')}</div>
              </div>
              <div className={styles.qr} aria-hidden="true">
                QR
                <br />
                Code
              </div>
            </div>
            <div className={styles.codeActions}>
              <Button fullWidth onClick={() => void copyCode()}>
                {t('settingsCopy')}
              </Button>
              <Button variant="secondary" fullWidth onClick={() => void shareCode()}>
                {t('settingsShare')}
              </Button>
            </div>
          </Card>

          <Card flush>
            <div className={styles.sectionHead}>
              <SectionLabel>{t('settingsPersonal')}</SectionLabel>
            </div>
            {/*
             * Der Jahrestag steht hier und nicht im Verbinden-Screen: er gilt
             * fuer beide Profile (`set_shared_anniversary` schreibt beide) und
             * ist auch ohne Partner zulaessig.
             */}
            <ListRow title={t('settingsAnniversary')} hint={t('settingsAnniversaryHint')}>
              <Input
                type="date"
                value={anniversary}
                onChange={(next) => void saveAnniversary(next)}
                /* Der Zeilentitel ist die Beschriftung, steht aber als Text daneben. */
                ariaLabel={t('settingsAnniversary')}
              />
            </ListRow>
            <ListRow
              title={t('settingsDarkMode')}
              hint={resolved === 'dark' ? t('settingsThemeDark') : t('settingsThemeLight')}
            >
              {/*
               * Der Schalter bildet `resolved` ab und setzt ausdruecklich
               * 'dark' oder 'light' — nicht 'system'. Ein Dreizustands-Schalter
               * ist in der Vorlage nicht vorgesehen und waere eine Erfindung;
               * 'system' bleibt der Ausgangszustand, bis jemand waehlt.
               */}
              <Toggle
                checked={resolved === 'dark'}
                label={t('settingsDarkMode')}
                onChange={(next) => setChoice(next ? 'dark' : 'light')}
              />
            </ListRow>
            <ListRow title={t('settingsPush')} hint={t('settingsPushHint')}>
              <Toggle
                checked={pushOn}
                label={t('settingsPush')}
                onChange={(next) =>
                  void savePreferences({
                    notification_settings: {
                      ...(preferences?.notification_settings ?? {}),
                      pushEnabled: next,
                    },
                  })
                }
              />
            </ListRow>
            <ListRow title={t('settingsLanguage')} last={false}>
              <span className={styles.compactSwitch}>
                <SegmentSwitch<Lang>
                  label={t('settingsLanguage')}
                  value={lang}
                   onChange={(next) => {
                     setLang(next);
                     void savePreferences({ locale: next });
                   }}
                  options={[
                    { value: 'de', label: 'DE' },
                    { value: 'en', label: 'EN' },
                  ]}
                />
              </span>
            </ListRow>
             <ListRow title={t('settingsWeekStart')} last>
              <span className={styles.compactSwitch}>
                 <SegmentSwitch<'mo' | 'so'>
                  label={t('settingsWeekStart')}
                  value={weekStart}
                   onChange={(next) => void savePreferences({ week_start: next })}
                  options={[
                    { value: 'mo', label: t('settingsWeekStartMo') },
                    { value: 'so', label: t('settingsWeekStartSo') },
                  ]}
                />
              </span>
            </ListRow>
          </Card>

          <Card flush>
            <div className={styles.sectionHead}>
              <SectionLabel>{t('settingsGoogle')}</SectionLabel>
            </div>
            <ListRow
              title={t('settingsManageCalendars')}
              hint={t('googleNotConnected')}
              onClick={() => void navigate('/profil/sync')}
              last
            />
          </Card>

          {/*
           * Die Vorlage hat „Abmelden" als Teil einer Textzeile
           * („Ralia 2.0 · Datenschutz · Abmelden"). Ein Abmelden, das man nur
           * treffen kann, wenn man den richtigen Teil einer Zeile antippt, ist
           * kein Bedienelement — hier steht ein Knopf.
           */}
          <div className={styles.rowActions}>
            <Button variant="ghost" fullWidth onClick={() => void doSignOut()}>
              {t('authSignOut')}
            </Button>
          </div>
          <div className={styles.footer}>{t('settingsFooter')}</div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDisconnect}
        title={t('settingsDisconnect')}
        message={t('disconnectConfirm')}
        confirmLabel={t('settingsDisconnect')}
        cancelLabel={t('back')}
        tone="danger"
        onConfirm={() => void doDisconnect()}
        onCancel={() => setConfirmDisconnect(false)}
      />
    </div>
  );
}
