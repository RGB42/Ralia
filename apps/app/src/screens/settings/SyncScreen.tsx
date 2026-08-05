import { AppHeader, Button, Card, SectionLabel, Toggle, personTokens } from '@ralia/ui';
import { useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router';
import { useT } from '../../i18n/useT.js';
import {
  MOCK_CALENDARS,
  MOCK_CONFLICT,
  MOCK_SYNC_ACCOUNTS,
  MOCK_SYNC_LOG,
} from '../../mock/fixtures.js';
import screen from '../screen.module.css';
import styles from './SyncScreen.module.css';

type SyncDirection = 'both' | 'toGoogle' | 'fromGoogle';
type ConflictState = 'open' | 'keptRalia' | 'keptGoogle';

export function SyncScreen(): React.JSX.Element {
  const { t } = useT();
  const navigate = useNavigate();
  const [calendars, setCalendars] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(MOCK_CALENDARS.map((cal) => [cal.id, cal.on])),
  );
  const [direction, setDirection] = useState<SyncDirection>('both');
  const [conflict, setConflict] = useState<ConflictState>('open');

  const directions: readonly { value: SyncDirection; label: string; hint: string }[] = [
    { value: 'both', label: t('syncDirBoth'), hint: t('syncDirBothHint') },
    { value: 'toGoogle', label: t('syncDirToGoogle'), hint: t('syncDirToGoogleHint') },
    { value: 'fromGoogle', label: t('syncDirFromGoogle'), hint: t('syncDirFromGoogleHint') },
  ];

  const moveDirection = (delta: number) => {
    const current = directions.findIndex((entry) => entry.value === direction);
    const next = directions[(current + delta + directions.length) % directions.length];
    if (next) setDirection(next.value);
  };

  const onDirectionKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      moveDirection(1);
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      moveDirection(-1);
    }
  };

  const activeCount = Object.values(calendars).filter(Boolean).length;

  return (
    <div className={screen.screen}>
      <AppHeader
        kicker={t('syncKicker')}
        title={t('syncTitle')}
        onBack={() => void navigate('/profil')}
        backLabel={t('back')}
      />
      <div className={screen.body}>
        <div className={screen.stack}>
          <Card tone="brand" padding="14px">
            <div className={styles.status}>
              <div className={styles.badge} aria-hidden="true">
                G
              </div>
              <div className={styles.statusText}>
                <div className={styles.statusTitle}>{t('syncStatusConnected')}</div>
                <div className={styles.statusNote}>
                  {t('syncLastSync')} heute 08:14 · {t('syncEvery')}
                </div>
              </div>
              <Button onClick={() => undefined}>{t('syncNow')}</Button>
            </div>
          </Card>

          <Card flush>
            <div className={styles.sectionHead}>
              <SectionLabel>{t('syncAccounts')}</SectionLabel>
            </div>
            {MOCK_SYNC_ACCOUNTS.map((account) => (
              <div key={account.email} className={styles.account} data-testid="sync-account">
                <span
                  className={styles.badge}
                  style={{ background: personTokens(account.slot).bar, color: '#fff' }}
                  aria-hidden="true"
                >
                  {account.initial}
                </span>
                <div className={styles.accountText}>
                  <div className={styles.accountMail}>{account.email}</div>
                  <div className={styles.accountMeta}>{account.meta}</div>
                </div>
                <span className={styles.accountStatus}>
                  <span className={styles.accountDot} aria-hidden="true" />
                  {account.status}
                </span>
              </div>
            ))}
            <button type="button" className={styles.addRow}>
              + {t('syncAddAccount')}
            </button>
          </Card>

          <Card flush>
            <div className={styles.sectionHead}>
              <SectionLabel>{t('syncCalendars')}</SectionLabel>
            </div>
            {MOCK_CALENDARS.map((cal) => (
              <div key={cal.id} className={styles.calendar}>
                <span
                  className={styles.calendarSwatch}
                  style={{ background: personTokens(cal.slot).bar }}
                  aria-hidden="true"
                />
                <div className={styles.calendarText}>
                  <div className={styles.calendarName}>{cal.label}</div>
                  <div className={styles.calendarMeta}>
                    {calendars[cal.id] ? t('syncCalOn') : t('syncCalOff')}
                  </div>
                </div>
                <Toggle
                  size="sm"
                  checked={calendars[cal.id] ?? false}
                  label={cal.label}
                  onChange={(next) => setCalendars((value) => ({ ...value, [cal.id]: next }))}
                />
              </div>
            ))}
            <div className={styles.note}>{t('syncCalendarsNote')}</div>
          </Card>

          <Card flush>
            <div className={styles.sectionHead}>
              <SectionLabel>{t('syncDirection')}</SectionLabel>
            </div>
            <div
              className={styles.directions}
              role="radiogroup"
              aria-label={t('syncDirection')}
              onKeyDown={onDirectionKeyDown}
            >
              {directions.map((entry) => {
                const active = entry.value === direction;
                return (
                  <button
                    key={entry.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    tabIndex={active ? 0 : -1}
                    className={`${styles.direction} ${active ? styles.directionActive : ''}`}
                    onClick={() => setDirection(entry.value)}
                  >
                    <span className={styles.radioDot} aria-hidden="true">
                      {active ? '✓' : ''}
                    </span>
                    <span className={styles.directionText}>
                      <span className={styles.directionLabel}>{entry.label}</span>
                      <span className={styles.directionHint}>{entry.hint}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </Card>

          {conflict === 'open' ? (
            <Card tone="warn">
              <div className={styles.conflictHead}>
                <span className={styles.conflictCount}>1 {t('syncConflict')}</span>
                <span className={styles.conflictDate}>{MOCK_CONFLICT.date}</span>
              </div>
              <div className={styles.conflictTitle}>
                {MOCK_CONFLICT.title} · {t('syncConflictHint')}
              </div>
              <div className={styles.versions}>
                <div className={styles.version}>
                  <div className={`${styles.versionLabel} ${styles.versionLabelRalia}`}>
                    {t('syncInRalia')}
                  </div>
                  <div className={styles.versionTime}>{MOCK_CONFLICT.ralia.time}</div>
                  <div className={styles.versionPlace}>{MOCK_CONFLICT.ralia.location}</div>
                </div>
                <div className={styles.version}>
                  <div className={styles.versionLabel}>{t('syncInGoogle')}</div>
                  <div className={styles.versionTime}>{MOCK_CONFLICT.google.time}</div>
                  <div className={styles.versionPlace}>{MOCK_CONFLICT.google.location}</div>
                </div>
              </div>
              <div className={styles.conflictActions}>
                <Button fullWidth onClick={() => setConflict('keptRalia')}>
                  {t('syncKeepRalia')}
                </Button>
                <Button variant="secondary" fullWidth onClick={() => setConflict('keptGoogle')}>
                  {t('syncKeepGoogle')}
                </Button>
              </div>
            </Card>
          ) : (
            <div className={styles.resolved}>
              <span className={styles.resolvedMark} aria-hidden="true">
                ✓
              </span>
              <div className={styles.resolvedText}>
                {t('syncResolved')}:{' '}
                {conflict === 'keptRalia' ? t('syncKeepRalia') : t('syncKeepGoogle')}
              </div>
              <button type="button" className={styles.undo} onClick={() => setConflict('open')}>
                {t('syncUndo')}
              </button>
            </div>
          )}

          <Card flush>
            <div className={styles.sectionHead}>
              <SectionLabel>{t('syncLog')}</SectionLabel>
            </div>
            {MOCK_SYNC_LOG.map((entry) => (
              <div key={entry.text} className={styles.logRow} data-testid="sync-log-row">
                <span className={styles.logWhen}>{entry.when}</span>
                <span className={styles.logText}>{entry.text}</span>
              </div>
            ))}
            <div className={styles.note}>
              {t('syncLogNote')} · {activeCount} {t('settingsCalendarsActive')}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
