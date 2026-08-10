import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AuthContext } from '../auth/AuthProvider.js';
import { DataContext } from '../data/DataProvider.js';
import { I18nProvider } from '../i18n/I18nProvider.js';
import { authDouble, dataDouble, TEST_USER_ID } from '../test-harness.js';
import { AppPreferencesProvider, useAppPreferences } from './AppPreferencesProvider.js';

function Probe(): React.JSX.Element {
  const { loading, preferences, update } = useAppPreferences();
  return (
    <>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="locale">{preferences?.locale ?? 'none'}</span>
      <span data-testid="solo-mode">{String(preferences?.solo_mode ?? false)}</span>
      <button onClick={() => void update({ solo_mode: true })}>activate solo mode</button>
    </>
  );
}

function renderProvider(services = dataDouble()) {
  return render(
    <I18nProvider>
      <AuthContext.Provider value={authDouble()}>
        <DataContext.Provider value={services}>
          <AppPreferencesProvider>
            <Probe />
          </AppPreferencesProvider>
        </DataContext.Provider>
      </AuthContext.Provider>
    </I18nProvider>,
  );
}

describe('AppPreferencesProvider', () => {
  it('loads the signed-in user preferences once and applies their locale', async () => {
    const ensure = vi.fn(async (userId: string) => ({
      user_id: userId,
      solo_mode: false,
      week_start: 'so' as const,
      locale: 'en' as const,
      notification_settings: {},
      created_at: '2026-08-10T10:00:00Z',
      updated_at: '2026-08-10T10:00:00Z',
    }));

    renderProvider(dataDouble({ appPreferences: { ...dataDouble().appPreferences, ensure } }));

    expect(screen.getByTestId('loading')).toHaveTextContent('true');
    await waitFor(() => expect(screen.getByTestId('locale')).toHaveTextContent('en'));
    expect(ensure).toHaveBeenCalledOnce();
    expect(ensure).toHaveBeenCalledWith(TEST_USER_ID);
    expect(document.documentElement.lang).toBe('en');
  });

  it('persists updates for the signed-in user and exposes the saved value', async () => {
    const update = vi.fn(async (userId: string) => ({
      user_id: userId,
      solo_mode: true,
      week_start: 'mo' as const,
      locale: 'de' as const,
      notification_settings: {},
      created_at: '2026-08-10T10:00:00Z',
      updated_at: '2026-08-10T10:01:00Z',
    }));
    const services = dataDouble({
      appPreferences: { ...dataDouble().appPreferences, update },
    });

    renderProvider(services);

    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    await userEvent.click(screen.getByRole('button', { name: 'activate solo mode' }));

    await waitFor(() => expect(screen.getByTestId('solo-mode')).toHaveTextContent('true'));
    expect(update).toHaveBeenCalledWith(TEST_USER_ID, { solo_mode: true });
  });
});
