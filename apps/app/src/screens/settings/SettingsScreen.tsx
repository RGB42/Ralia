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
import { PrivacyApiError, type PrivacyExportRequests } from '@ralia/data';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../auth/useAuth.js';
import { useBoot } from '../../boot/BootContext.js';
import { useData } from '../../data/DataProvider.js';
import { useAppPreferences } from '../../preferences/AppPreferencesProvider.js';
import type { Lang } from '../../i18n/catalog.js';
import { useT } from '../../i18n/useT.js';
import { usePushRegistration } from '../../push/usePushRegistration.js';
import screen from '../screen.module.css';
import styles from './SettingsScreen.module.css';

async function downloadExport(response: Response): Promise<void> {
  const disposition = response.headers.get('content-disposition') ?? '';
  const fileName = disposition.match(/filename="?([^";]+)"?/)?.[1] ?? 'ralia-data.json';
  const url = URL.createObjectURL(await response.blob());
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function SettingsScreen(): React.JSX.Element {
  const { t, lang, setLang } = useT();
  const { resolved, setChoice } = useTheme();
  const { show } = useToast();
  const navigate = useNavigate();
  const { session, signOut, disconnectPartner, setAnniversary } = useAuth();
  const { privacy } = useData();
  const { outbox } = useBoot();
  const { preferences, update: updatePreferences } = useAppPreferences();
  const push = usePushRegistration();

  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [confirmAccountDeletion, setConfirmAccountDeletion] = useState(false);
  const [privacyAction, setPrivacyAction] = useState<'personal' | 'shared' | 'delete' | null>(null);
  const [privacyRequests, setPrivacyRequests] = useState<PrivacyExportRequests>({
    incoming: [],
    outgoing: [],
  });

  const identity = session.status === 'signed-in' ? session.identity : null;
  const userId = identity?.userId ?? null;
  const inviteCode = identity?.profile.invite_code ?? '';
  const [anniversary, setAnniversaryValue] = useState(identity?.profile.anniversary_date ?? '');
  const pushOn = preferences?.notification_settings.pushEnabled === true;
  /* Ersetzt den statischen Hinweistext, solange der Schalter nicht einfach
   * „an" oder „aus" ist -- ein Klick, der wirkungslos bleibt, ist schlimmer
   * als eine Erklaerung, warum. */
  const pushHint =
    push.state === 'unsupported'
      ? t('pushUnsupported')
      : push.state === 'unconfigured'
        ? t('pushUnconfigured')
        : push.state === 'denied'
          ? t('pushDenied')
          : push.state === 'working'
            ? t('pushEnabling')
            : t('settingsPushHint');
  const weekStart = preferences?.week_start ?? 'mo';
  const incomingRequest = privacyRequests.incoming.find(
    (request) => request.status === 'pending',
  );
  const approvedSharedRequest = privacyRequests.outgoing.find(
    (request) => request.status === 'approved',
  );
  const pendingSharedRequest = privacyRequests.outgoing.find(
    (request) => request.status === 'pending',
  );

  useEffect(() => {
    if (!userId || !identity?.partner) return;
    let active = true;
    void privacy
      .listSharedExportRequests()
      .then((requests) => {
        if (active) setPrivacyRequests(requests);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [identity?.partner, privacy, userId]);

  const savePreferences = useCallback(
    async (changes: Parameters<typeof updatePreferences>[0]) => {
      const saved = await updatePreferences(changes);
      if (!saved) show(t('settingsPreferencesError'), 'danger');
    },
    [updatePreferences, show, t],
  );

  /*
   * `notification_settings.pushEnabled` wird erst geschrieben, nachdem
   * enable()/disable() tatsaechlich durchgelaufen sind -- sonst zeigte der
   * Schalter „an", waehrend gar kein Abo existiert.
   *
   * Der Effekt reagiert bewusst nur auf den Uebergang AUS 'working' heraus,
   * nicht auf jeden Abgleich von state und Praeferenz: usePushRegistration
   * prueft beim Einhaengen kein vorhandenes Browser-Abo (siehe dort), der
   * Anfangszustand ist also 'off', selbst wenn die Praeferenz aus einer
   * frueheren Sitzung noch `true` ist. Ohne die Uebergangs-Pruefung wuerde
   * das blosse Oeffnen dieses Screens die Praeferenz still auf `false`
   * zuruecksetzen.
   */
  const previousPushStateRef = useRef(push.state);
  useEffect(() => {
    const previousPushState = previousPushStateRef.current;
    previousPushStateRef.current = push.state;
    if (previousPushState !== 'working' || !preferences) return;
    if (push.state === 'on' && preferences.notification_settings.pushEnabled !== true) {
      void savePreferences({
        notification_settings: { ...preferences.notification_settings, pushEnabled: true },
      });
    } else if (push.state === 'off' && preferences.notification_settings.pushEnabled === true) {
      void savePreferences({
        notification_settings: { ...preferences.notification_settings, pushEnabled: false },
      });
    }
  }, [push.state, preferences, savePreferences]);

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

  const showPrivacyError = (error: unknown) => {
    const code = error instanceof PrivacyApiError ? error.code : 'request_failed';
    const key =
      code === 'shared_data'
        ? 'privacyAccountDeleteShared'
        : code === 'active_subscription'
          ? 'privacyAccountDeleteSubscription'
          : 'privacyActionFailed';
    show(t(key), 'danger');
  };

  const downloadPersonalExport = async () => {
    setPrivacyAction('personal');
    try {
      await downloadExport(await privacy.personalExport());
      show(t('privacyPersonalExported'), 'ok');
    } catch (error) {
      showPrivacyError(error);
    } finally {
      setPrivacyAction(null);
    }
  };

  const requestSharedExport = async () => {
    setPrivacyAction('shared');
    try {
      await privacy.requestSharedExport();
      setPrivacyRequests(await privacy.listSharedExportRequests());
      show(t('privacySharedRequested'), 'ok');
    } catch (error) {
      showPrivacyError(error);
    } finally {
      setPrivacyAction(null);
    }
  };

  const downloadSharedExport = async (requestId: string) => {
    setPrivacyAction('shared');
    try {
      await downloadExport(await privacy.sharedExport(requestId));
      show(t('privacySharedExported'), 'ok');
    } catch (error) {
      showPrivacyError(error);
    } finally {
      setPrivacyAction(null);
    }
  };

  const resolveSharedExportRequest = async (requestId: string, resolution: 'approve' | 'reject') => {
    setPrivacyAction('shared');
    try {
      await privacy.resolveSharedExportRequest(requestId, resolution);
      setPrivacyRequests(await privacy.listSharedExportRequests());
      show(t(resolution === 'approve' ? 'privacySharedApproved' : 'privacySharedRejected'), 'ok');
    } catch (error) {
      showPrivacyError(error);
    } finally {
      setPrivacyAction(null);
    }
  };

  const doDeleteAccount = async () => {
    if (!userId) return;
    setConfirmAccountDeletion(false);
    setPrivacyAction('delete');
    try {
      await privacy.deleteAccount();
      // A missing or blocked IndexedDB must not leave a server-deleted account signed in.
      await outbox.purgeOwner(userId).catch(() => undefined);
      await signOut();
      show(t('privacyAccountDeleted'), 'ok');
      void navigate('/anmelden', { replace: true });
    } catch (error) {
      showPrivacyError(error);
    } finally {
      setPrivacyAction(null);
    }
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
            <ListRow title={t('settingsPush')} hint={pushHint}>
              <Toggle
                checked={pushOn}
                label={t('settingsPush')}
                disabled={push.state === 'working'}
                onChange={(next) => void (next ? push.enable() : push.disable())}
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

          <Card flush>
            <div className={styles.sectionHead}>
              <SectionLabel>{t('privacyTitle')}</SectionLabel>
            </div>
            <ListRow title={t('privacyPersonalExport')} hint={t('privacyPersonalHint')}>
              <Button
                variant="secondary"
                disabled={privacyAction !== null}
                onClick={() => void downloadPersonalExport()}
              >
                {t('privacyDownload')}
              </Button>
            </ListRow>
            <ListRow
              title={t('privacySharedExport')}
              hint={identity?.partner ? t('privacySharedHint') : t('privacySharedUnavailable')}
              last
            >
              {identity?.partner ? (
                approvedSharedRequest ? (
                  <Button
                    variant="secondary"
                    disabled={privacyAction !== null}
                    onClick={() => void downloadSharedExport(approvedSharedRequest.id)}
                  >
                    {t('privacyDownload')}
                  </Button>
                ) : pendingSharedRequest ? (
                  <span className={styles.value}>{t('privacySharedPending')}</span>
                ) : (
                  <Button
                    variant="secondary"
                    disabled={privacyAction !== null}
                    onClick={() => void requestSharedExport()}
                  >
                    {t('privacyRequestApproval')}
                  </Button>
                )
              ) : null}
            </ListRow>
          </Card>

          {incomingRequest ? (
            <Card flush>
              <div className={styles.sectionHead}>
                <SectionLabel>{t('privacyApprovalTitle')}</SectionLabel>
              </div>
              <ListRow title={t('privacyIncomingRequest')} hint={t('privacyIncomingHint')} last>
                <div className={styles.privacyActions}>
                  <Button
                    variant="secondary"
                    disabled={privacyAction !== null}
                    onClick={() => void resolveSharedExportRequest(incomingRequest.id, 'reject')}
                  >
                    {t('privacyReject')}
                  </Button>
                  <Button
                    disabled={privacyAction !== null}
                    onClick={() => void resolveSharedExportRequest(incomingRequest.id, 'approve')}
                  >
                    {t('privacyApprove')}
                  </Button>
                </div>
              </ListRow>
            </Card>
          ) : null}

          <Card flush>
            <div className={styles.sectionHead}>
              <SectionLabel>{t('privacyDangerTitle')}</SectionLabel>
            </div>
            <ListRow
              title={t('privacyAccountDelete')}
              hint={identity?.partner ? t('privacyAccountDeletePartnerHint') : t('privacyAccountDeleteHint')}
              last
            >
              {!identity?.partner ? (
                <Button
                  variant="danger"
                  disabled={privacyAction !== null}
                  onClick={() => setConfirmAccountDeletion(true)}
                >
                  {t('privacyAccountDelete')}
                </Button>
              ) : null}
            </ListRow>
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
      <ConfirmDialog
        open={confirmAccountDeletion}
        title={t('privacyAccountDelete')}
        message={t('privacyAccountDeleteConfirm')}
        confirmLabel={t('privacyAccountDelete')}
        cancelLabel={t('back')}
        tone="danger"
        onConfirm={() => void doDeleteAccount()}
        onCancel={() => setConfirmAccountDeletion(false)}
      />
    </div>
  );
}
