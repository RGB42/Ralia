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
import type { Lang } from '../../i18n/catalog.js';
import { useT } from '../../i18n/useT.js';
import { MOCK_CALENDARS, MOCK_PROFILE } from '../../mock/fixtures.js';
import { ProfileSheet } from '../../sheets/ProfileSheet.js';
import screen from '../screen.module.css';
import styles from './SettingsScreen.module.css';

type WeekStartChoice = 'mo' | 'so';

export function SettingsScreen(): React.JSX.Element {
  const { t, lang, setLang } = useT();
  const { resolved, setChoice } = useTheme();
  const { show } = useToast();
  const navigate = useNavigate();
  const { session, signOut, disconnectPartner, setAnniversary } = useAuth();

  const [pushOn, setPushOn] = useState(true);
  const [googleOn, setGoogleOn] = useState(true);
  const [weekStart, setWeekStart] = useState<WeekStartChoice>('mo');
  const [profileOpen, setProfileOpen] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  const activeCalendars = MOCK_CALENDARS.filter((cal) => cal.on).length;

  /*
   * Identitaet und Partner kommen ab SP1 aus der Sitzung. Die uebrigen Werte
   * dieses Screens — Statistik, Kalenderzahl, Geburtstag — haengen weiter an den
   * Fixtures; sie gehoeren zu SP2 bis SP4.
   */
  const identity = session.status === 'signed-in' ? session.identity : null;
  const inviteCode = identity?.profile.invite_code ?? MOCK_PROFILE.inviteCode;
  const [anniversary, setAnniversaryValue] = useState(identity?.profile.anniversary_date ?? '');

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
    show(
      result.ok ? t('disconnectedFromPartner') : t(result.messageKey),
      result.ok ? 'ok' : 'info',
    );
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
                initial={MOCK_PROFILE.me.initial}
                slot={MOCK_PROFILE.me.slot}
                size={52}
                shape="rounded"
              />
              <div className={styles.profileText}>
                <div className={styles.profileName}>{MOCK_PROFILE.me.name}</div>
                <div className={styles.profileMail}>{MOCK_PROFILE.me.email}</div>
              </div>
              <Button variant="secondary" onClick={() => setProfileOpen(true)}>
                {t('settingsEdit')}
              </Button>
            </div>
            <div className={styles.stats}>
              {(
                [
                  ['862', t('settingsDaysTogether')],
                  ['11', t('settingsEventsPerWeek')],
                  ['6', t('settingsTasksOpen')],
                ] as const
              ).map(([value, label]) => (
                <div key={label} className={styles.stat} data-testid="profile-stat">
                  <div className={styles.statValue}>{value}</div>
                  <div className={styles.statLabel}>{label}</div>
                </div>
              ))}
            </div>
          </Card>

          <Card flush>
            <div className={styles.sectionHeadWide}>
              <SectionLabel>{t('settingsPartner')}</SectionLabel>
            </div>
            <div className={styles.partnerRow}>
              <Avatar
                initial={MOCK_PROFILE.partner.initial}
                slot={MOCK_PROFILE.partner.slot}
                size={34}
                shape="rounded"
              />
              <div className={styles.partnerText}>
                <div className={styles.partnerName}>{MOCK_PROFILE.partner.name}</div>
                <div className={styles.partnerSince}>
                  {t('settingsConnectedSince')} {MOCK_PROFILE.connectedSince} ·{' '}
                  {t('settingsAllShared')}
                </div>
              </div>
              <Button variant="danger" onClick={() => setConfirmDisconnect(true)}>
                {t('settingsDisconnect')}
              </Button>
            </div>
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
              <Button variant="secondary" fullWidth onClick={() => undefined}>
                {t('settingsShare')}
              </Button>
              <Button variant="secondary" onClick={() => undefined}>
                {t('settingsNewCode')}
              </Button>
            </div>
          </Card>

          <Card flush>
            <div className={styles.sectionHead}>
              <SectionLabel>{t('settingsPersonal')}</SectionLabel>
            </div>
            <ListRow title={t('settingsBirthday')} hint={t('settingsBirthdayHint')}>
              <span className={styles.value}>{MOCK_PROFILE.me.birthday}</span>
            </ListRow>
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
              <Toggle checked={pushOn} label={t('settingsPush')} onChange={setPushOn} />
            </ListRow>
            <ListRow title={t('settingsLanguage')} last={false}>
              <span className={styles.compactSwitch}>
                <SegmentSwitch<Lang>
                  label={t('settingsLanguage')}
                  value={lang}
                  onChange={setLang}
                  options={[
                    { value: 'de', label: 'DE' },
                    { value: 'en', label: 'EN' },
                  ]}
                />
              </span>
            </ListRow>
            <ListRow title={t('settingsWeekStart')} last>
              <span className={styles.compactSwitch}>
                <SegmentSwitch<WeekStartChoice>
                  label={t('settingsWeekStart')}
                  value={weekStart}
                  onChange={setWeekStart}
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
              title={t('settingsConnected')}
              hint={`${MOCK_PROFILE.me.email} · ${activeCalendars} ${t('settingsCalendarsActive')}`}
            >
              <Toggle checked={googleOn} label={t('settingsConnected')} onChange={setGoogleOn} />
            </ListRow>
            <div className={styles.rowActions}>
              <Button
                variant="secondary"
                fullWidth
                onClick={() => show(t('settingsImportStarted'))}
              >
                {t('settingsImport')}
              </Button>
              <Button
                variant="secondary"
                fullWidth
                onClick={() => show(t('settingsExportStarted'))}
              >
                {t('settingsExport')}
              </Button>
            </div>
            <ListRow
              title={t('settingsManageCalendars')}
              hint={`2 ${t('settingsAccounts')} · ${activeCalendars} ${t('settingsCalendarsActive')}`}
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

      <ProfileSheet
        key={`profile-${profileOpen}`}
        open={profileOpen}
        profile={MOCK_PROFILE.me}
        onClose={() => setProfileOpen(false)}
        onSave={() => setProfileOpen(false)}
      />

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
