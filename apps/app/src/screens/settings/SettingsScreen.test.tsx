import { THEME_ATTRIBUTE, THEME_STORAGE_KEY, ThemeProvider, ToastProvider } from '@ralia/ui';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PushRepo } from '@ralia/data';
import { AuthContext, type AuthContextValue } from '../../auth/AuthProvider.js';
import { BootContext } from '../../boot/BootContext.js';
import { DataContext, type DataServices } from '../../data/DataProvider.js';
import { I18nProvider } from '../../i18n/I18nProvider.js';
import { LANG_STORAGE_KEY } from '../../i18n/catalog.js';
import { authDouble, dataDouble, outboxDouble, signedInState, TEST_PROFILE } from '../../test-harness.js';
import {
  appPreferencesDouble,
  TEST_PARTNER_ID,
  TEST_USER_ID,
} from '../../test-harness.js';
import { AppPreferencesContext, type AppPreferencesValue } from '../../preferences/AppPreferencesProvider.js';
import { SettingsScreen } from './SettingsScreen.js';

function renderScreen(
  auth: Partial<AuthContextValue> = {},
  preferences: Partial<AppPreferencesValue> = {},
  data: Partial<DataServices> = {},
) {
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    media: '',
    addEventListener() {},
    removeEventListener() {},
  }));
  return render(
    <MemoryRouter>
      <ThemeProvider>
        <I18nProvider>
          <ToastProvider>
            <AuthContext.Provider value={authDouble(auth)}>
              <BootContext.Provider
                value={{
                  config: {
                    supabaseUrl: 'https://example.supabase.co',
                    supabaseAnonKey: 'publishable-key',
                    googleClientId: null,
                    googleRedirectUri: null,
                    // Ein gueltiger Platzhalter, kein `null`: sonst waere der
                    // Push-Schalter in jedem Test dieser Datei 'unconfigured',
                    // noch bevor eine Browser-Faehigkeit ueberhaupt geprueft wird.
                    vapidPublicKey: 'UmFsaWE',
                    billingEnabled: false,
                  },
                  outbox: outboxDouble(),
                }}
              >
                <DataContext.Provider value={dataDouble(data)}>
                  <AppPreferencesContext.Provider value={appPreferencesDouble(preferences)}>
                    <SettingsScreen />
                  </AppPreferencesContext.Provider>
                </DataContext.Provider>
              </BootContext.Provider>
            </AuthContext.Provider>
          </ToastProvider>
        </I18nProvider>
      </ThemeProvider>
    </MemoryRouter>,
  );
}

/**
 * Stubbt die Browser-Push-APIs, die jsdom nicht kennt (`navigator.serviceWorker`,
 * `PushManager`, `Notification`) -- Muster aus `usePushRegistration.test.tsx`.
 * `configurable: true` macht die Properties in `afterEach` wieder loeschbar,
 * sonst traegt ein Stub in Nachbartests dieser grossen Datei weiter.
 */
function stubPushSupport(permission: NotificationPermission = 'granted') {
  const registration = {
    pushManager: {
      getSubscription: vi.fn(async () => null),
      subscribe: vi.fn(async () => ({
        toJSON: () => ({
          endpoint: 'https://push.example/settings-screen',
          keys: { p256dh: 'p256dh-value', auth: 'auth-value' },
        }),
        unsubscribe: vi.fn(async () => true),
      })),
    },
  };
  Object.defineProperty(globalThis.navigator, 'serviceWorker', {
    configurable: true,
    value: { register: vi.fn(async () => undefined), ready: Promise.resolve(registration) },
  });
  Object.defineProperty(globalThis, 'PushManager', { configurable: true, value: class {} });
  Object.defineProperty(globalThis, 'Notification', {
    configurable: true,
    value: { permission, requestPermission: vi.fn(async () => permission) },
  });
  return registration;
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(LANG_STORAGE_KEY, 'de');
  document.documentElement.removeAttribute(THEME_ATTRIBUTE);
});
afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(globalThis.navigator, 'serviceWorker');
  Reflect.deleteProperty(globalThis, 'PushManager');
  Reflect.deleteProperty(globalThis, 'Notification');
});

describe('SettingsScreen', () => {
  it('zeigt die echte Profilkarte ohne Demo-Kennzahlen', () => {
    renderScreen();
    expect(screen.getByText('Lena')).toBeInTheDocument();
    expect(screen.queryByTestId('profile-stat')).toBeNull();
  });

  it('schaltet das Theme auf dunkel und speichert es', async () => {
    renderScreen();
    await userEvent.click(screen.getByRole('switch', { name: /Dark Mode/ }));
    expect(document.documentElement.getAttribute(THEME_ATTRIBUTE)).toBe('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });

  it('schaltet das Theme wieder zurueck', async () => {
    renderScreen();
    await userEvent.click(screen.getByRole('switch', { name: /Dark Mode/ }));
    await userEvent.click(screen.getByRole('switch', { name: /Dark Mode/ }));
    expect(document.documentElement.hasAttribute(THEME_ATTRIBUTE)).toBe(false);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });

  it('wechselt die Sprache auf Englisch', async () => {
    renderScreen();
    // Vorher steht die Abschnittsueberschrift auf Deutsch da.
    expect(screen.getByText('Persönlich')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: 'EN' }));
    expect(localStorage.getItem(LANG_STORAGE_KEY)).toBe('en');
    // Der Screen-Titel lebt im AppHeader; geprueft wird eine Beschriftung,
    // die dieser Screen selbst rendert.
    expect(screen.queryByText('Persönlich')).toBeNull();
    expect(screen.getByText('Personal')).toBeInTheDocument();
  });

  it('zeigt den Einladungscode', () => {
    renderScreen();
    expect(screen.getByText('R7K2QM')).toBeInTheDocument();
  });

  it('meldet das Kopieren des Codes per Toast', async () => {
    const writeText = vi.fn(async () => {});
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    renderScreen();
    await userEvent.click(screen.getByRole('button', { name: /Kopieren/ }));
    expect(writeText).toHaveBeenCalledWith('R7K2QM');
    expect(await screen.findByRole('status')).toBeInTheDocument();
  });

  /** Kein Clipboard: der Nutzer bekommt trotzdem eine Rueckmeldung. */
  it('meldet auch einen fehlgeschlagenen Kopierversuch', async () => {
    vi.stubGlobal('navigator', {
      ...navigator,
      clipboard: {
        writeText: async () => {
          throw new Error('verweigert');
        },
      },
    });
    renderScreen();
    await userEvent.click(screen.getByRole('button', { name: /Kopieren/ }));
    expect(await screen.findByRole('status')).toHaveTextContent(/abschreiben/);
  });

  it('schaltet den Wochenstart um', async () => {
    const update = vi.fn().mockResolvedValue(true);
    renderScreen({}, { update });
    await userEvent.click(screen.getByRole('radio', { name: 'So' }));
    expect(update).toHaveBeenCalledWith({ week_start: 'so' });
  });

  it('fuehrt zur Sync-Unterseite', () => {
    renderScreen();
    expect(
      screen.getByRole('button', { name: /Kalender & Konflikte verwalten/ }),
    ).toBeInTheDocument();
  });

  it('fragt den Partner vor einem gemeinsamen Datenexport um Freigabe', async () => {
    const requestSharedExport = vi.fn().mockResolvedValue({
      id: 'request-1',
      expiresAt: '2026-08-12T10:00:00Z',
      pushDelivered: true,
    });
    const listSharedExportRequests = vi
      .fn()
      .mockResolvedValue({ incoming: [], outgoing: [] });
    renderScreen(
      { session: pairedSession() },
      {},
      { privacy: { ...dataDouble().privacy, requestSharedExport, listSharedExportRequests } },
    );

    await userEvent.click(await screen.findByRole('button', { name: 'Freigabe anfragen' }));

    expect(requestSharedExport).toHaveBeenCalledTimes(1);
  });

  it('zeigt dem Partner eine eingegangene Freigabeanfrage', async () => {
    const resolveSharedExportRequest = vi.fn().mockResolvedValue({
      id: 'request-1',
      status: 'approved',
    });
    const listSharedExportRequests = vi
      .fn()
      .mockResolvedValue({
        incoming: [
          {
            id: 'request-1',
            status: 'pending',
            expiresAt: '2026-08-12T10:00:00Z',
            createdAt: '2026-08-10T10:00:00Z',
          },
        ],
        outgoing: [],
      });
    renderScreen(
      { session: pairedSession() },
      {},
      { privacy: { ...dataDouble().privacy, resolveSharedExportRequest, listSharedExportRequests } },
    );

    await userEvent.click(await screen.findByRole('button', { name: 'Freigeben' }));

    expect(resolveSharedExportRequest).toHaveBeenCalledWith('request-1', 'approve');
  });

  it('loescht ein Solo-Konto erst nach der Bestaetigung', async () => {
    const deleteAccount = vi.fn().mockResolvedValue({ success: true });
    const signOut = vi.fn().mockResolvedValue(undefined);
    renderScreen(
      { signOut },
      {},
      { privacy: { ...dataDouble().privacy, deleteAccount } },
    );

    await userEvent.click(screen.getByRole('button', { name: 'Konto löschen' }));
    expect(deleteAccount).not.toHaveBeenCalled();

    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Konto löschen' }));

    expect(deleteAccount).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
  });

  it('zeigt den Einladungscode aus der Sitzung, nicht aus den Fixtures', () => {
    // Der erste Wert dieses Screens, der ab SP1 echt ist.
    renderScreen({ session: signedInState({ ...TEST_PROFILE, invite_code: 'ABC123' }) });
    expect(screen.getByText('ABC123')).toBeInTheDocument();
  });

  it('speichert den Jahrestag ueber die RPC', async () => {
    const setAnniversary = vi.fn().mockResolvedValue({ ok: true });
    renderScreen({ setAnniversary });

    const field = screen.getByLabelText('Jahrestag');
    await userEvent.type(field, '2019-06-14');

    expect(setAnniversary).toHaveBeenLastCalledWith('2019-06-14');
    expect(await screen.findByRole('status')).toHaveTextContent('Jahrestag gespeichert');
  });

  it('meldet einen Fehler beim Jahrestag statt still zu scheitern', async () => {
    const setAnniversary = vi.fn().mockResolvedValue({ ok: false, messageKey: 'sessionError' });
    renderScreen({ setAnniversary });

    await userEvent.type(screen.getByLabelText('Jahrestag'), '2019-06-14');

    expect(await screen.findByRole('status')).toHaveTextContent('Sitzungsfehler');
  });

  it('fragt vor dem Trennen nach', async () => {
    /*
     * Trennen ist zerstoerend und in Ralia 1.x hinter showConfirmation. Ohne
     * Rueckfrage waere ein Fehlgriff auf dem Telefon nicht rueckholbar.
     */
    const disconnectPartner = vi.fn().mockResolvedValue({ ok: true });
    renderScreen({
      disconnectPartner,
      session: pairedSession(),
    });

    await userEvent.click(screen.getByRole('button', { name: 'Trennen' }));

    expect(disconnectPartner).not.toHaveBeenCalled();
    expect(await screen.findByRole('dialog')).toHaveTextContent('wirklich');
  });

  it('trennt erst nach der Bestaetigung', async () => {
    const disconnectPartner = vi.fn().mockResolvedValue({ ok: true });
    renderScreen({
      disconnectPartner,
      session: pairedSession(),
    });

    await userEvent.click(screen.getByRole('button', { name: 'Trennen' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Trennen' }));

    expect(disconnectPartner).toHaveBeenCalledTimes(1);
  });

  it('meldet ab ueber einen Knopf, nicht ueber eine Textzeile', async () => {
    /*
     * Die Vorlage hat „Abmelden" als Teil von „Ralia 2.0 · Datenschutz ·
     * Abmelden". Etwas, das man nur durch Treffen des richtigen Wortes in einer
     * Zeile ausloest, ist kein Bedienelement.
     */
    const signOut = vi.fn().mockResolvedValue(undefined);
    renderScreen({ signOut });

    await userEvent.click(screen.getByRole('button', { name: 'Abmelden' }));

    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it('legt beim Einschalten ein Push-Abo an', async () => {
    stubPushSupport('granted');
    const save = vi.fn(async () => undefined);
    const push: PushRepo = { save, deactivate: vi.fn(async () => undefined), hasActive: vi.fn(async () => false) };
    const update = vi.fn(async () => true);
    renderScreen({}, { update }, { push });

    await userEvent.click(screen.getByRole('switch', { name: 'Push-Erinnerungen' }));

    await waitFor(() =>
      expect(save).toHaveBeenCalledWith(
        expect.objectContaining({ endpoint: 'https://push.example/settings-screen' }),
      ),
    );
    // Erst nach dem erfolgreichen Abo wird die Praeferenz geschrieben --
    // sonst zeigte der Schalter „an", waehrend kein Abo existiert.
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({ notification_settings: expect.objectContaining({ pushEnabled: true }) }),
      ),
    );
  });

  it('nennt den Grund, wenn der Browser Benachrichtigungen blockiert', () => {
    stubPushSupport('denied');
    renderScreen();

    expect(screen.getByText(/Browser-Einstellungen/)).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Push-Erinnerungen' })).not.toBeChecked();
  });
});

function pairedSession() {
  return {
    status: 'signed-in' as const,
    offline: false,
    identity: {
      userId: TEST_USER_ID,
      profile: { ...TEST_PROFILE, partner_id: TEST_PARTNER_ID },
      partner: {
        ...TEST_PROFILE,
        id: TEST_PARTNER_ID,
        name: 'Jonas Berger',
        partner_id: TEST_USER_ID,
      },
      calendarId: [TEST_USER_ID, TEST_PARTNER_ID].sort().join('_'),
    },
  };
}
