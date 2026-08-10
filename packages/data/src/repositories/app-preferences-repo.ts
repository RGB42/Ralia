import type { RaliaSupabaseClient } from '../client.js';
import type { AppPreferencesRow, Json, TablesInsert, TablesUpdate } from '../database.types.js';
import {
  RepositoryError,
  invalidInput,
  normalizeRepositoryError,
  requireGatewayData,
  requiredText,
} from './repository-error.js';
import type { GatewayResult } from './repository-error.js';

export type AppLocale = 'de' | 'en';
export type AppWeekStart = 'mo' | 'so';
export type NotificationSettings = Record<string, Json>;

export type AppPreferences = Omit<
  AppPreferencesRow,
  'locale' | 'notification_settings' | 'week_start'
> & {
  locale: AppLocale;
  notification_settings: NotificationSettings;
  week_start: AppWeekStart;
};

export interface UpdateAppPreferencesInput {
  locale?: AppLocale;
  notification_settings?: NotificationSettings;
  solo_mode?: boolean;
  week_start?: AppWeekStart;
}

export const DEFAULT_APP_PREFERENCES: Readonly<{
  locale: AppLocale;
  notification_settings: NotificationSettings;
  solo_mode: boolean;
  week_start: AppWeekStart;
}> = {
  locale: 'de',
  notification_settings: {},
  solo_mode: false,
  week_start: 'mo',
};

export type AppPreferencesDefaultInsert = Pick<
  TablesInsert<'app_preferences'>,
  'locale' | 'notification_settings' | 'solo_mode' | 'user_id' | 'week_start'
>;

export type AppPreferencesUpdateValues = Pick<
  TablesUpdate<'app_preferences'>,
  'locale' | 'notification_settings' | 'solo_mode' | 'updated_at' | 'week_start'
>;

export interface AppPreferencesGateway {
  selectByUserId(userId: string): Promise<GatewayResult<AppPreferencesRow>>;
  upsertDefault(values: AppPreferencesDefaultInsert): Promise<GatewayResult<AppPreferencesRow>>;
  updateByUserId(
    userId: string,
    values: AppPreferencesUpdateValues,
  ): Promise<GatewayResult<AppPreferencesRow>>;
}

export interface AppPreferencesRepo {
  getByUserId(userId: string): Promise<AppPreferences | null>;
  ensure(userId: string): Promise<AppPreferences>;
  update(userId: string, changes: UpdateAppPreferencesInput): Promise<AppPreferences>;
}

const LOCALES: ReadonlySet<string> = new Set<AppLocale>(['de', 'en']);
const WEEK_STARTS: ReadonlySet<string> = new Set<AppWeekStart>(['mo', 'so']);
const UPDATE_FIELDS: ReadonlySet<string> = new Set([
  'locale',
  'notification_settings',
  'solo_mode',
  'week_start',
]);

function locale(value: unknown, operation: string): AppLocale {
  if (typeof value !== 'string' || !LOCALES.has(value)) {
    throw invalidInput(operation, 'locale', 'must be de or en');
  }
  return value as AppLocale;
}

function weekStart(value: unknown, operation: string): AppWeekStart {
  if (typeof value !== 'string' || !WEEK_STARTS.has(value)) {
    throw invalidInput(operation, 'week_start', 'must be mo or so');
  }
  return value as AppWeekStart;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isJsonValue(value: unknown, ancestors: Set<object>): value is Json {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value))
  ) {
    return true;
  }
  if (typeof value !== 'object') return false;
  if (ancestors.has(value)) return false;

  ancestors.add(value);
  let valid: boolean;
  if (Array.isArray(value)) {
    valid = value.every((entry) => isJsonValue(entry, ancestors));
  } else if (isPlainObject(value)) {
    valid = Object.values(value).every((entry) => isJsonValue(entry, ancestors));
  } else {
    valid = false;
  }
  ancestors.delete(value);
  return valid;
}

function notificationSettings(value: unknown, operation: string): NotificationSettings {
  if (!isPlainObject(value) || !isJsonValue(value, new Set())) {
    throw invalidInput(operation, 'notification_settings', 'must be a JSON object');
  }
  return value as NotificationSettings;
}

function timestamp(now: () => string, operation: string): string {
  let value: string;
  try {
    value = now();
  } catch (error) {
    throw new RepositoryError('invalid_response', operation, { cause: error });
  }
  if (typeof value !== 'string' || value.length === 0 || Number.isNaN(Date.parse(value))) {
    throw new RepositoryError('invalid_response', operation);
  }
  return value;
}

function defaultValues(userId: string): AppPreferencesDefaultInsert {
  return {
    user_id: userId,
    locale: DEFAULT_APP_PREFERENCES.locale,
    notification_settings: { ...DEFAULT_APP_PREFERENCES.notification_settings },
    solo_mode: DEFAULT_APP_PREFERENCES.solo_mode,
    week_start: DEFAULT_APP_PREFERENCES.week_start,
  };
}

function updateValues(
  input: UpdateAppPreferencesInput,
  operation: string,
  now: () => string,
): AppPreferencesUpdateValues {
  if (!isPlainObject(input)) throw invalidInput(operation, 'changes', 'must be an object');

  const keys = Object.keys(input);
  if (keys.length === 0) throw invalidInput(operation, 'changes', 'must not be empty');
  if (keys.some((key) => !UPDATE_FIELDS.has(key))) {
    throw invalidInput(operation, 'changes', 'contains an unsupported field');
  }

  const values: AppPreferencesUpdateValues = {};
  if (Object.hasOwn(input, 'locale')) values.locale = locale(input.locale, operation);
  if (Object.hasOwn(input, 'notification_settings')) {
    values.notification_settings = notificationSettings(input.notification_settings, operation);
  }
  if (Object.hasOwn(input, 'solo_mode')) {
    if (typeof input.solo_mode !== 'boolean') {
      throw invalidInput(operation, 'solo_mode', 'must be a boolean');
    }
    values.solo_mode = input.solo_mode;
  }
  if (Object.hasOwn(input, 'week_start')) {
    values.week_start = weekStart(input.week_start, operation);
  }
  values.updated_at = timestamp(now, operation);
  return values;
}

function assertPreferences(
  row: AppPreferencesRow,
  operation: string,
  userId: string,
): AppPreferences {
  if (typeof row !== 'object' || row === null || row.user_id !== userId) {
    throw new RepositoryError('invalid_response', operation);
  }
  if (
    !LOCALES.has(row.locale) ||
    !WEEK_STARTS.has(row.week_start) ||
    typeof row.solo_mode !== 'boolean' ||
    !isPlainObject(row.notification_settings) ||
    !isJsonValue(row.notification_settings, new Set())
  ) {
    throw new RepositoryError('invalid_response', operation);
  }
  return row as AppPreferences;
}

async function optionalGatewayData<T>(
  operation: string,
  request: () => Promise<GatewayResult<T>>,
): Promise<T | null> {
  try {
    const { data, error } = await request();
    if (error !== null) throw error;
    return data;
  } catch (error) {
    throw normalizeRepositoryError(operation, error);
  }
}

export function createAppPreferencesRepo(
  gateway: AppPreferencesGateway,
  now: () => string = () => new Date().toISOString(),
): AppPreferencesRepo {
  return {
    async getByUserId(rawUserId) {
      const operation = 'app_preferences.getByUserId';
      const userId = requiredText(rawUserId, operation, 'userId');
      const row = await optionalGatewayData(operation, () => gateway.selectByUserId(userId));
      return row === null ? null : assertPreferences(row, operation, userId);
    },

    async ensure(rawUserId) {
      const operation = 'app_preferences.ensure';
      const userId = requiredText(rawUserId, operation, 'userId');
      const row = await requireGatewayData(operation, () =>
        gateway.upsertDefault(defaultValues(userId)),
      );
      return assertPreferences(row, operation, userId);
    },

    async update(rawUserId, changes) {
      const operation = 'app_preferences.update';
      const userId = requiredText(rawUserId, operation, 'userId');
      const values = updateValues(changes, operation, now);
      const row = await requireGatewayData(
        operation,
        () => gateway.updateByUserId(userId, values),
        'not_found',
      );
      return assertPreferences(row, operation, userId);
    },
  };
}

export function createSupabaseAppPreferencesRepo(client: RaliaSupabaseClient): AppPreferencesRepo {
  return createAppPreferencesRepo({
    async selectByUserId(userId) {
      const { data, error } = await client
        .from('app_preferences')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      return { data, error };
    },

    async upsertDefault(values) {
      const { error } = await client
        .from('app_preferences')
        .upsert(values, { onConflict: 'user_id', ignoreDuplicates: true });
      if (error !== null) return { data: null, error };

      const { data, error: selectError } = await client
        .from('app_preferences')
        .select('*')
        .eq('user_id', values.user_id)
        .maybeSingle();
      return { data, error: selectError };
    },

    async updateByUserId(userId, values) {
      const { data, error } = await client
        .from('app_preferences')
        .update(values)
        .eq('user_id', userId)
        .select('*')
        .maybeSingle();
      return { data, error };
    },
  });
}
