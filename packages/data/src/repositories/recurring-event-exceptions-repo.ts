import type { RaliaSupabaseClient } from '../client.js';
import type {
  Json,
  RecurringEventExceptionsRow,
  TablesInsert,
  TablesUpdate,
} from '../database.types.js';
import {
  RepositoryError,
  invalidInput,
  requireGatewayData,
  requiredText,
} from './repository-error.js';
import type { GatewayResult } from './repository-error.js';

export type RecurringEventOverrideData = Record<string, Json>;

type RecurringEventExceptionInsert = Pick<
  TablesInsert<'recurring_event_exceptions'>,
  | 'calendar_id'
  | 'created_by'
  | 'is_deleted'
  | 'master_event_id'
  | 'original_occurrence_date'
  | 'override_event_data'
>;

type RecurringEventExceptionUpdate = Pick<
  TablesUpdate<'recurring_event_exceptions'>,
  'is_deleted' | 'original_occurrence_date' | 'override_event_data' | 'updated_at'
>;

interface CreateRecurringEventExceptionBase {
  calendarId: string;
  masterEventId: string;
  createdBy: string;
  originalOccurrenceDate: string;
}

export interface CreateDeletedRecurringEventExceptionInput extends CreateRecurringEventExceptionBase {
  isDeleted: true;
  overrideEventData?: null;
}

export interface CreateOverrideRecurringEventExceptionInput extends CreateRecurringEventExceptionBase {
  isDeleted: false;
  overrideEventData: RecurringEventOverrideData;
}

export type CreateRecurringEventExceptionInput =
  CreateDeletedRecurringEventExceptionInput | CreateOverrideRecurringEventExceptionInput;

export interface UpdateRecurringEventExceptionInput {
  calendarId: string;
  masterEventId: string;
  id: string;
  originalOccurrenceDate?: string;
  isDeleted?: boolean;
  overrideEventData?: RecurringEventOverrideData | null;
}

export interface DeleteRecurringEventExceptionInput {
  calendarId: string;
  masterEventId: string;
  id: string;
}

interface DeletedRecurringEventException {
  calendar_id: string;
  master_event_id: string;
  id: string;
}

export interface RecurringEventExceptionsGateway {
  listByCalendar(
    calendarId: string,
    masterEventIds?: readonly string[],
  ): Promise<GatewayResult<RecurringEventExceptionsRow[]>>;
  insert(
    values: RecurringEventExceptionInsert,
  ): Promise<GatewayResult<RecurringEventExceptionsRow>>;
  update(
    calendarId: string,
    masterEventId: string,
    id: string,
    values: RecurringEventExceptionUpdate,
  ): Promise<GatewayResult<RecurringEventExceptionsRow>>;
  delete(
    calendarId: string,
    masterEventId: string,
    id: string,
  ): Promise<GatewayResult<DeletedRecurringEventException>>;
}

export interface RecurringEventExceptionsRepo {
  list(
    calendarId: string,
    masterEventIds?: readonly string[],
  ): Promise<RecurringEventExceptionsRow[]>;
  create(input: CreateRecurringEventExceptionInput): Promise<RecurringEventExceptionsRow>;
  update(input: UpdateRecurringEventExceptionInput): Promise<RecurringEventExceptionsRow>;
  delete(input: DeleteRecurringEventExceptionInput): Promise<void>;
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
  if (typeof value !== 'object' || ancestors.has(value)) return false;

  ancestors.add(value);
  let valid: boolean;
  if (Array.isArray(value)) {
    valid =
      Object.keys(value).length === value.length &&
      value.every((entry, index) => Object.hasOwn(value, index) && isJsonValue(entry, ancestors));
  } else if (isPlainObject(value) && Object.getOwnPropertySymbols(value).length === 0) {
    valid = Object.values(value).every((entry) => isJsonValue(entry, ancestors));
  } else {
    valid = false;
  }
  ancestors.delete(value);
  return valid;
}

function isJsonObject(value: unknown): value is RecurringEventOverrideData {
  return isPlainObject(value) && isJsonValue(value, new Set());
}

function overrideData(value: unknown, operation: string): RecurringEventOverrideData {
  try {
    if (isJsonObject(value)) return value;
  } catch (cause) {
    throw new RepositoryError('invalid_input', operation, {
      cause,
      message: `${operation}: overrideEventData must be a JSON object`,
    });
  }
  throw invalidInput(operation, 'overrideEventData', 'must be a JSON object');
}

function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match === null) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;

  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= (daysInMonth[month - 1] ?? 0);
}

function isoDate(value: unknown, operation: string): string {
  if (!isIsoDate(value)) {
    throw invalidInput(operation, 'originalOccurrenceDate', 'must be a valid YYYY-MM-DD date');
  }
  return value;
}

function timestamp(now: () => string, operation: string): string {
  let value: string;
  try {
    value = now();
  } catch (cause) {
    throw new RepositoryError('invalid_response', operation, { cause });
  }
  if (typeof value !== 'string' || value.length === 0 || Number.isNaN(Date.parse(value))) {
    throw new RepositoryError('invalid_response', operation);
  }
  return value;
}

function assertInput(value: unknown, operation: string): asserts value is Record<string, unknown> {
  if (!isPlainObject(value)) throw invalidInput(operation, 'input', 'must be an object');
}

function normalizeMasterEventIds(
  value: readonly string[] | undefined,
  operation: string,
): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    throw invalidInput(operation, 'masterEventIds', 'must be an array');
  }
  return [...new Set(value.map((id) => requiredText(id, operation, 'masterEventIds')))];
}

function validTimestamp(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && !Number.isNaN(Date.parse(value));
}

function assertException(
  value: unknown,
  operation: string,
  calendarId: string,
  masterEventIds?: ReadonlySet<string>,
  expectedId?: string,
): RecurringEventExceptionsRow {
  try {
    if (!isPlainObject(value)) throw new Error('row must be an object');
    const row = value as unknown as RecurringEventExceptionsRow;
    if (
      typeof row.id !== 'string' ||
      row.id.trim().length === 0 ||
      row.calendar_id !== calendarId ||
      typeof row.master_event_id !== 'string' ||
      row.master_event_id.trim().length === 0 ||
      (masterEventIds !== undefined && !masterEventIds.has(row.master_event_id)) ||
      (expectedId !== undefined && row.id !== expectedId) ||
      typeof row.created_by !== 'string' ||
      row.created_by.trim().length === 0 ||
      !isIsoDate(row.original_occurrence_date) ||
      typeof row.is_deleted !== 'boolean' ||
      !validTimestamp(row.created_at) ||
      !validTimestamp(row.updated_at) ||
      (row.is_deleted ? row.override_event_data !== null : !isJsonObject(row.override_event_data))
    ) {
      throw new Error('invalid exception row');
    }
    return row;
  } catch (cause) {
    throw new RepositoryError('invalid_response', operation, { cause });
  }
}

function jsonEqual(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (Array.isArray(left) && Array.isArray(right)) {
    return (
      left.length === right.length && left.every((entry, index) => jsonEqual(entry, right[index]))
    );
  }
  if (!isPlainObject(left) || !isPlainObject(right)) return false;
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every((key) => Object.hasOwn(right, key) && jsonEqual(left[key], right[key]))
  );
}

function assertMutationValues(
  row: RecurringEventExceptionsRow,
  operation: string,
  values: RecurringEventExceptionInsert | RecurringEventExceptionUpdate,
): RecurringEventExceptionsRow {
  if (
    ('calendar_id' in values && row.calendar_id !== values.calendar_id) ||
    ('master_event_id' in values && row.master_event_id !== values.master_event_id) ||
    ('created_by' in values && row.created_by !== values.created_by) ||
    ('original_occurrence_date' in values &&
      row.original_occurrence_date !== values.original_occurrence_date) ||
    ('is_deleted' in values && row.is_deleted !== values.is_deleted) ||
    ('override_event_data' in values &&
      !jsonEqual(row.override_event_data, values.override_event_data))
  ) {
    throw new RepositoryError('invalid_response', operation);
  }
  return row;
}

function createValues(
  input: CreateRecurringEventExceptionInput,
  operation: string,
): RecurringEventExceptionInsert {
  assertInput(input, operation);
  if (typeof input.isDeleted !== 'boolean') {
    throw invalidInput(operation, 'isDeleted', 'must be a boolean');
  }

  const hasOverride = Object.hasOwn(input, 'overrideEventData');
  let normalizedOverride: RecurringEventOverrideData | null;
  if (input.isDeleted) {
    if (hasOverride && input.overrideEventData !== null) {
      throw invalidInput(operation, 'overrideEventData', 'must be null for a deleted exception');
    }
    normalizedOverride = null;
  } else {
    if (!hasOverride) {
      throw invalidInput(operation, 'overrideEventData', 'is required for an override exception');
    }
    normalizedOverride = overrideData(input.overrideEventData, operation);
  }

  return {
    calendar_id: requiredText(input.calendarId, operation, 'calendarId'),
    master_event_id: requiredText(input.masterEventId, operation, 'masterEventId'),
    created_by: requiredText(input.createdBy, operation, 'createdBy'),
    original_occurrence_date: isoDate(input.originalOccurrenceDate, operation),
    is_deleted: input.isDeleted,
    override_event_data: normalizedOverride,
  };
}

function updateValues(
  input: UpdateRecurringEventExceptionInput,
  operation: string,
  now: () => string,
): RecurringEventExceptionUpdate {
  assertInput(input, operation);
  const values: RecurringEventExceptionUpdate = {};
  if (Object.hasOwn(input, 'originalOccurrenceDate')) {
    values.original_occurrence_date = isoDate(input.originalOccurrenceDate, operation);
  }

  const hasDeleted = Object.hasOwn(input, 'isDeleted');
  const hasOverride = Object.hasOwn(input, 'overrideEventData');
  if (hasDeleted && typeof input.isDeleted !== 'boolean') {
    throw invalidInput(operation, 'isDeleted', 'must be a boolean');
  }

  if (hasOverride) {
    if (input.overrideEventData === null) {
      if (input.isDeleted !== true) {
        throw invalidInput(
          operation,
          'overrideEventData',
          'may only be null for a deleted exception',
        );
      }
      values.override_event_data = null;
    } else {
      if (input.isDeleted === true) {
        throw invalidInput(operation, 'overrideEventData', 'must be null for a deleted exception');
      }
      values.override_event_data = overrideData(input.overrideEventData, operation);
      values.is_deleted = false;
    }
  }

  if (hasDeleted) {
    if (input.isDeleted === true) {
      values.is_deleted = true;
      values.override_event_data = null;
    } else if (!hasOverride) {
      throw invalidInput(
        operation,
        'overrideEventData',
        'is required when changing to an override exception',
      );
    }
  }

  if (Object.keys(values).length === 0) {
    throw invalidInput(operation, 'changes', 'must not be empty');
  }
  values.updated_at = timestamp(now, operation);
  return values;
}

export function createRecurringEventExceptionsRepo(
  gateway: RecurringEventExceptionsGateway,
  now: () => string = () => new Date().toISOString(),
): RecurringEventExceptionsRepo {
  return {
    async list(rawCalendarId, rawMasterEventIds) {
      const operation = 'recurring_event_exceptions.list';
      const calendarId = requiredText(rawCalendarId, operation, 'calendarId');
      const masterEventIds = normalizeMasterEventIds(rawMasterEventIds, operation);
      if (masterEventIds?.length === 0) return [];

      const rows = await requireGatewayData(operation, () =>
        masterEventIds === undefined
          ? gateway.listByCalendar(calendarId)
          : gateway.listByCalendar(calendarId, masterEventIds),
      );
      if (!Array.isArray(rows)) throw new RepositoryError('invalid_response', operation);

      const expectedMasters = masterEventIds === undefined ? undefined : new Set(masterEventIds);
      return rows
        .map((row) => assertException(row, operation, calendarId, expectedMasters))
        .sort(
          (left, right) =>
            left.master_event_id.localeCompare(right.master_event_id) ||
            left.original_occurrence_date.localeCompare(right.original_occurrence_date) ||
            left.id.localeCompare(right.id),
        );
    },

    async create(input) {
      const operation = 'recurring_event_exceptions.create';
      const values = createValues(input, operation);
      const result = await requireGatewayData(operation, () => gateway.insert(values));
      const row = assertException(
        result,
        operation,
        values.calendar_id,
        new Set([values.master_event_id]),
      );
      return assertMutationValues(row, operation, values);
    },

    async update(input) {
      const operation = 'recurring_event_exceptions.update';
      assertInput(input, operation);
      const calendarId = requiredText(input.calendarId, operation, 'calendarId');
      const masterEventId = requiredText(input.masterEventId, operation, 'masterEventId');
      const id = requiredText(input.id, operation, 'id');
      const values = updateValues(input, operation, now);
      const result = await requireGatewayData(
        operation,
        () => gateway.update(calendarId, masterEventId, id, values),
        'not_found',
      );
      const row = assertException(result, operation, calendarId, new Set([masterEventId]), id);
      return assertMutationValues(row, operation, values);
    },

    async delete(input) {
      const operation = 'recurring_event_exceptions.delete';
      assertInput(input, operation);
      const calendarId = requiredText(input.calendarId, operation, 'calendarId');
      const masterEventId = requiredText(input.masterEventId, operation, 'masterEventId');
      const id = requiredText(input.id, operation, 'id');
      const deleted = await requireGatewayData(
        operation,
        () => gateway.delete(calendarId, masterEventId, id),
        'not_found',
      );
      if (
        !isPlainObject(deleted) ||
        deleted.calendar_id !== calendarId ||
        deleted.master_event_id !== masterEventId ||
        deleted.id !== id
      ) {
        throw new RepositoryError('invalid_response', operation);
      }
    },
  };
}

export function createSupabaseRecurringEventExceptionsRepo(
  client: RaliaSupabaseClient,
): RecurringEventExceptionsRepo {
  return createRecurringEventExceptionsRepo({
    async listByCalendar(calendarId, masterEventIds) {
      let query = client
        .from('recurring_event_exceptions')
        .select('*')
        .eq('calendar_id', calendarId);
      if (masterEventIds !== undefined) {
        query = query.in('master_event_id', [...masterEventIds]);
      }
      const { data, error } = await query
        .order('master_event_id')
        .order('original_occurrence_date')
        .order('id');
      return { data, error };
    },

    async insert(values) {
      const { data, error } = await client
        .from('recurring_event_exceptions')
        .insert(values)
        .select('*')
        .single();
      return { data, error };
    },

    async update(calendarId, masterEventId, id, values) {
      const { data, error } = await client
        .from('recurring_event_exceptions')
        .update(values)
        .eq('calendar_id', calendarId)
        .eq('master_event_id', masterEventId)
        .eq('id', id)
        .select('*')
        .maybeSingle();
      return { data, error };
    },

    async delete(calendarId, masterEventId, id) {
      const { data, error } = await client
        .from('recurring_event_exceptions')
        .delete()
        .eq('calendar_id', calendarId)
        .eq('master_event_id', masterEventId)
        .eq('id', id)
        .select('calendar_id, master_event_id, id')
        .maybeSingle();
      return { data, error };
    },
  });
}
