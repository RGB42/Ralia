import { describe, expect, it, vi } from 'vitest';
import type { RaliaSupabaseClient } from '../client.js';
import type { AppPreferencesRow } from '../database.types.js';
import {
  DEFAULT_APP_PREFERENCES,
  createAppPreferencesRepo,
  createSupabaseAppPreferencesRepo,
  type AppPreferencesGateway,
  type UpdateAppPreferencesInput,
} from './app-preferences-repo.js';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const NOW = '2026-08-10T12:00:00.000Z';

const PREFERENCES: AppPreferencesRow = {
  created_at: '2026-08-10T08:00:00.000Z',
  locale: 'de',
  notification_settings: {
    email: true,
    quiet_hours: { from: '22:00', through: '07:00' },
  },
  solo_mode: false,
  updated_at: '2026-08-10T08:00:00.000Z',
  user_id: USER_ID,
  week_start: 'mo',
};

function gateway(overrides: Partial<AppPreferencesGateway> = {}): AppPreferencesGateway {
  return {
    selectByUserId: vi.fn().mockResolvedValue({ data: PREFERENCES, error: null }),
    upsertDefault: vi.fn().mockResolvedValue({ data: PREFERENCES, error: null }),
    updateByUserId: vi.fn().mockResolvedValue({ data: PREFERENCES, error: null }),
    ...overrides,
  };
}

describe('app preferences getByUserId', () => {
  it('normalizes the user id and returns validated preferences', async () => {
    const gw = gateway();

    await expect(createAppPreferencesRepo(gw).getByUserId(` ${USER_ID} `)).resolves.toEqual(
      PREFERENCES,
    );
    expect(gw.selectByUserId).toHaveBeenCalledWith(USER_ID);
  });

  it('returns null when the user has no preferences yet', async () => {
    const gw = gateway({
      selectByUserId: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    await expect(createAppPreferencesRepo(gw).getByUserId(USER_ID)).resolves.toBeNull();
  });

  it('rejects an empty user id without querying', async () => {
    const gw = gateway();

    await expect(createAppPreferencesRepo(gw).getByUserId('   ')).rejects.toMatchObject({
      code: 'invalid_input',
      operation: 'app_preferences.getByUserId',
    });
    expect(gw.selectByUserId).not.toHaveBeenCalled();
  });

  it('normalizes returned and thrown gateway errors', async () => {
    const forbidden = gateway({
      selectByUserId: vi.fn().mockResolvedValue({
        data: null,
        error: { code: '42501', message: 'denied' },
      }),
    });
    const offline = gateway({
      selectByUserId: vi.fn().mockRejectedValue(new TypeError('Failed to fetch')),
    });

    await expect(createAppPreferencesRepo(forbidden).getByUserId(USER_ID)).rejects.toMatchObject({
      code: 'forbidden',
      backendCode: '42501',
    });
    await expect(createAppPreferencesRepo(offline).getByUserId(USER_ID)).rejects.toMatchObject({
      code: 'unavailable',
    });
  });
});

describe('app preferences ensure', () => {
  it('upserts explicit defaults and returns the resulting row', async () => {
    const gw = gateway();

    await expect(createAppPreferencesRepo(gw).ensure(USER_ID)).resolves.toEqual(PREFERENCES);
    expect(gw.selectByUserId).not.toHaveBeenCalled();
    expect(gw.upsertDefault).toHaveBeenCalledWith({
      user_id: USER_ID,
      ...DEFAULT_APP_PREFERENCES,
      notification_settings: {},
    });
  });

  it('does not require an existing customized row to equal the defaults', async () => {
    const customized = {
      ...PREFERENCES,
      locale: 'en',
      notification_settings: { push: true },
      solo_mode: true,
      week_start: 'so',
    };
    const gw = gateway({
      upsertDefault: vi.fn().mockResolvedValue({ data: customized, error: null }),
    });

    await expect(createAppPreferencesRepo(gw).ensure(USER_ID)).resolves.toEqual(customized);
  });

  it('rejects an empty successful response as invalid', async () => {
    const gw = gateway({
      upsertDefault: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    await expect(createAppPreferencesRepo(gw).ensure(USER_ID)).rejects.toMatchObject({
      code: 'invalid_response',
      operation: 'app_preferences.ensure',
    });
  });
});

describe('app preferences update', () => {
  it('validates and forwards every editable field with an updated timestamp', async () => {
    const updated = {
      ...PREFERENCES,
      locale: 'en',
      notification_settings: { push: true, offsets: [15, 60], digest: null },
      solo_mode: true,
      updated_at: NOW,
      week_start: 'so',
    };
    const gw = gateway({
      updateByUserId: vi.fn().mockResolvedValue({ data: updated, error: null }),
    });

    await expect(
      createAppPreferencesRepo(gw, () => NOW).update(USER_ID, {
        locale: 'en',
        notification_settings: { push: true, offsets: [15, 60], digest: null },
        solo_mode: true,
        week_start: 'so',
      }),
    ).resolves.toEqual(updated);
    expect(gw.updateByUserId).toHaveBeenCalledWith(USER_ID, {
      locale: 'en',
      notification_settings: { push: true, offsets: [15, 60], digest: null },
      solo_mode: true,
      updated_at: NOW,
      week_start: 'so',
    });
  });

  it('supports a partial update without defaulting omitted settings', async () => {
    const gw = gateway();

    await createAppPreferencesRepo(gw, () => NOW).update(USER_ID, { solo_mode: false });

    expect(gw.updateByUserId).toHaveBeenCalledWith(USER_ID, {
      solo_mode: false,
      updated_at: NOW,
    });
  });

  it.each([
    ['locale', { locale: 'fr' }],
    ['week_start', { week_start: 'monday' }],
    ['solo_mode', { solo_mode: 'false' }],
    ['notification_settings null', { notification_settings: null }],
    ['notification_settings array', { notification_settings: [] }],
    ['notification_settings non-JSON value', { notification_settings: { retry: Infinity } }],
    ['undefined field', { locale: undefined }],
    ['unsupported field', { user_id: 'another-user' }],
  ])('rejects invalid %s before writing', async (_label, rawChanges) => {
    const gw = gateway();

    await expect(
      createAppPreferencesRepo(gw).update(
        USER_ID,
        rawChanges as unknown as UpdateAppPreferencesInput,
      ),
    ).rejects.toMatchObject({ code: 'invalid_input', operation: 'app_preferences.update' });
    expect(gw.updateByUserId).not.toHaveBeenCalled();
  });

  it('rejects an empty update before writing', async () => {
    const gw = gateway();

    await expect(createAppPreferencesRepo(gw).update(USER_ID, {})).rejects.toMatchObject({
      code: 'invalid_input',
    });
    expect(gw.updateByUserId).not.toHaveBeenCalled();
  });

  it('reports an invisible row as not found', async () => {
    const gw = gateway({
      updateByUserId: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    await expect(
      createAppPreferencesRepo(gw, () => NOW).update(USER_ID, { locale: 'en' }),
    ).rejects.toMatchObject({ code: 'not_found', operation: 'app_preferences.update' });
  });
});

describe('app preferences response validation', () => {
  it.each([
    ['another user', { ...PREFERENCES, user_id: 'another-user' }],
    ['unsupported locale', { ...PREFERENCES, locale: 'fr' }],
    ['unsupported week start', { ...PREFERENCES, week_start: 'di' }],
    ['non-boolean solo mode', { ...PREFERENCES, solo_mode: 'false' }],
    ['array notification settings', { ...PREFERENCES, notification_settings: [] }],
  ])('rejects %s from the gateway', async (_label, rawRow) => {
    const gw = gateway({
      selectByUserId: vi.fn().mockResolvedValue({
        data: rawRow as unknown as AppPreferencesRow,
        error: null,
      }),
    });

    await expect(createAppPreferencesRepo(gw).getByUserId(USER_ID)).rejects.toMatchObject({
      code: 'invalid_response',
    });
  });
});

describe('Supabase app preferences adapter', () => {
  it('loads at most one row scoped by user_id', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: PREFERENCES, error: null });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });
    const client = { from } as unknown as RaliaSupabaseClient;

    await createSupabaseAppPreferencesRepo(client).getByUserId(USER_ID);

    expect(from).toHaveBeenCalledWith('app_preferences');
    expect(select).toHaveBeenCalledWith('*');
    expect(eq).toHaveBeenCalledWith('user_id', USER_ID);
    expect(maybeSingle).toHaveBeenCalledOnce();
  });

  it('ensures defaults without overwriting an existing conflict, then reads the row', async () => {
    const upsert = vi.fn().mockResolvedValue({ data: null, error: null });
    const maybeSingle = vi.fn().mockResolvedValue({ data: PREFERENCES, error: null });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ upsert, select });
    const client = { from } as unknown as RaliaSupabaseClient;

    await createSupabaseAppPreferencesRepo(client).ensure(USER_ID);

    expect(upsert).toHaveBeenCalledWith(
      { user_id: USER_ID, ...DEFAULT_APP_PREFERENCES, notification_settings: {} },
      { onConflict: 'user_id', ignoreDuplicates: true },
    );
    expect(from).toHaveBeenCalledTimes(2);
    expect(eq).toHaveBeenCalledWith('user_id', USER_ID);
  });

  it('does not read after a failed default upsert', async () => {
    const upsert = vi.fn().mockResolvedValue({
      data: null,
      error: { code: '42501', message: 'denied' },
    });
    const select = vi.fn();
    const from = vi.fn().mockReturnValue({ upsert, select });
    const client = { from } as unknown as RaliaSupabaseClient;

    await expect(createSupabaseAppPreferencesRepo(client).ensure(USER_ID)).rejects.toMatchObject({
      code: 'forbidden',
    });
    expect(select).not.toHaveBeenCalled();
  });

  it('updates only the user-scoped row and returns it', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { ...PREFERENCES, locale: 'en' },
      error: null,
    });
    const select = vi.fn().mockReturnValue({ maybeSingle });
    const eq = vi.fn().mockReturnValue({ select });
    const update = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ update });
    const client = { from } as unknown as RaliaSupabaseClient;

    await createSupabaseAppPreferencesRepo(client).update(USER_ID, { locale: 'en' });

    expect(from).toHaveBeenCalledWith('app_preferences');
    expect(update).toHaveBeenCalledWith({
      locale: 'en',
      updated_at: expect.any(String),
    });
    expect(eq).toHaveBeenCalledWith('user_id', USER_ID);
    expect(select).toHaveBeenCalledWith('*');
    expect(maybeSingle).toHaveBeenCalledOnce();
  });
});
