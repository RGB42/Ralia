import type { RaliaSupabaseClient } from '../client.js';
import type { ExpenseCategoriesRow, TablesInsert, TablesUpdate } from '../database.types.js';
import type { ExpenseAmountInput } from './expense-money.js';
import { expenseAmountToCents, normalizeExpenseAmount } from './expense-money.js';
import {
  RepositoryError,
  invalidInput,
  requireGatewayData,
  requiredText,
} from './repository-error.js';
import type { GatewayResult } from './repository-error.js';

export const EXPENSE_CATEGORY_NAME_MAX_LENGTH = 60;

type ExpenseCategoryInsert = Pick<
  TablesInsert<'expense_categories'>,
  'calendar_id' | 'created_by' | 'name' | 'color' | 'monthly_limit' | 'sort_order'
>;

type ExpenseCategoryUpdate = Pick<
  TablesUpdate<'expense_categories'>,
  'name' | 'color' | 'monthly_limit' | 'sort_order' | 'updated_at'
>;

export interface CreateExpenseCategoryInput {
  calendarId: string;
  createdBy: string;
  name: string;
  color?: string | null;
  monthlyLimit?: ExpenseAmountInput | null;
  sortOrder?: number;
}

export interface UpdateExpenseCategoryInput {
  calendarId: string;
  id: string;
  name?: string;
  color?: string | null;
  monthlyLimit?: ExpenseAmountInput | null;
  sortOrder?: number;
}

export interface DeleteExpenseCategoryInput {
  calendarId: string;
  id: string;
}

export interface ExpenseCategoriesGateway {
  listByCalendar(calendarId: string): Promise<GatewayResult<ExpenseCategoriesRow[]>>;
  insert(values: ExpenseCategoryInsert): Promise<GatewayResult<ExpenseCategoriesRow>>;
  update(
    calendarId: string,
    id: string,
    values: ExpenseCategoryUpdate,
  ): Promise<GatewayResult<ExpenseCategoriesRow>>;
  delete(calendarId: string, id: string): Promise<GatewayResult<{ id: string }>>;
}

export interface ExpenseCategoriesRepo {
  list(calendarId: string): Promise<ExpenseCategoriesRow[]>;
  create(input: CreateExpenseCategoryInput): Promise<ExpenseCategoriesRow>;
  update(input: UpdateExpenseCategoryInput): Promise<ExpenseCategoriesRow>;
  delete(input: DeleteExpenseCategoryInput): Promise<void>;
}

const COLOR = /^#[0-9A-Fa-f]{6}$/;

function categoryName(value: unknown, operation: string): string {
  return requiredText(value, operation, 'name', EXPENSE_CATEGORY_NAME_MAX_LENGTH);
}

function categoryColor(value: unknown, operation: string): string | null {
  if (value === null) return null;
  if (typeof value !== 'string') {
    throw invalidInput(operation, 'color', 'must be a hex color or null');
  }
  const normalized = value.trim();
  if (!COLOR.test(normalized)) {
    throw invalidInput(operation, 'color', 'must use #RRGGBB format');
  }
  return normalized;
}

function sortOrder(value: unknown, operation: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw invalidInput(operation, 'sortOrder', 'must be a non-negative safe integer');
  }
  return value;
}

function amount(value: ExpenseAmountInput, operation: string, field: string): number {
  try {
    return normalizeExpenseAmount(value, true);
  } catch (cause) {
    throw new RepositoryError('invalid_input', operation, {
      cause,
      message: `${operation}: ${field} must be a numeric(12, 2) amount of zero or more`,
    });
  }
}

function timestamp(now: () => string, operation: string): string {
  const value = now();
  if (typeof value !== 'string' || value.length === 0 || Number.isNaN(Date.parse(value))) {
    throw new RepositoryError('invalid_response', operation);
  }
  return value;
}

function assertCategory(
  row: ExpenseCategoriesRow,
  operation: string,
  calendarId: string,
  expectedId?: string,
): ExpenseCategoriesRow {
  if (row.calendar_id !== calendarId || (expectedId !== undefined && row.id !== expectedId)) {
    throw new RepositoryError('invalid_response', operation);
  }

  try {
    categoryName(row.name, operation);
    if (row.color !== null) categoryColor(row.color, operation);
    sortOrder(row.sort_order, operation);
    if (row.monthly_limit !== null) expenseAmountToCents(row.monthly_limit, true);
  } catch (cause) {
    throw new RepositoryError('invalid_response', operation, { cause });
  }
  return row;
}

function createValues(input: CreateExpenseCategoryInput, operation: string): ExpenseCategoryInsert {
  const values: ExpenseCategoryInsert = {
    calendar_id: requiredText(input.calendarId, operation, 'calendarId'),
    created_by: requiredText(input.createdBy, operation, 'createdBy'),
    name: categoryName(input.name, operation),
  };
  if (input.color !== undefined) values.color = categoryColor(input.color, operation);
  if (input.monthlyLimit !== undefined) {
    values.monthly_limit =
      input.monthlyLimit === null ? null : amount(input.monthlyLimit, operation, 'monthlyLimit');
  }
  if (input.sortOrder !== undefined) values.sort_order = sortOrder(input.sortOrder, operation);
  return values;
}

function updateValues(
  input: UpdateExpenseCategoryInput,
  operation: string,
  now: () => string,
): ExpenseCategoryUpdate {
  const values: ExpenseCategoryUpdate = {};
  if (input.name !== undefined) values.name = categoryName(input.name, operation);
  if (input.color !== undefined) values.color = categoryColor(input.color, operation);
  if (input.monthlyLimit !== undefined) {
    values.monthly_limit =
      input.monthlyLimit === null ? null : amount(input.monthlyLimit, operation, 'monthlyLimit');
  }
  if (input.sortOrder !== undefined) values.sort_order = sortOrder(input.sortOrder, operation);
  if (Object.keys(values).length === 0) {
    throw invalidInput(operation, 'changes', 'must not be empty');
  }
  values.updated_at = timestamp(now, operation);
  return values;
}

export function createExpenseCategoriesRepo(
  gateway: ExpenseCategoriesGateway,
  now: () => string = () => new Date().toISOString(),
): ExpenseCategoriesRepo {
  return {
    async list(rawCalendarId) {
      const operation = 'expense_categories.list';
      const calendarId = requiredText(rawCalendarId, operation, 'calendarId');
      const rows = await requireGatewayData(operation, () => gateway.listByCalendar(calendarId));
      return rows
        .map((row) => assertCategory(row, operation, calendarId))
        .sort(
          (left, right) =>
            left.sort_order - right.sort_order ||
            left.name.localeCompare(right.name) ||
            left.id.localeCompare(right.id),
        );
    },

    async create(input) {
      const operation = 'expense_categories.create';
      const values = createValues(input, operation);
      const row = await requireGatewayData(operation, () => gateway.insert(values));
      return assertCategory(row, operation, values.calendar_id);
    },

    async update(input) {
      const operation = 'expense_categories.update';
      const calendarId = requiredText(input.calendarId, operation, 'calendarId');
      const id = requiredText(input.id, operation, 'id');
      const values = updateValues(input, operation, now);
      const row = await requireGatewayData(
        operation,
        () => gateway.update(calendarId, id, values),
        'not_found',
      );
      return assertCategory(row, operation, calendarId, id);
    },

    async delete(input) {
      const operation = 'expense_categories.delete';
      const calendarId = requiredText(input.calendarId, operation, 'calendarId');
      const id = requiredText(input.id, operation, 'id');
      const deleted = await requireGatewayData(
        operation,
        () => gateway.delete(calendarId, id),
        'not_found',
      );
      if (deleted.id !== id) throw new RepositoryError('invalid_response', operation);
    },
  };
}

export function createSupabaseExpenseCategoriesRepo(
  client: RaliaSupabaseClient,
): ExpenseCategoriesRepo {
  return createExpenseCategoriesRepo({
    async listByCalendar(calendarId) {
      const { data, error } = await client
        .from('expense_categories')
        .select('*')
        .eq('calendar_id', calendarId)
        .order('sort_order')
        .order('name');
      return { data, error };
    },

    async insert(values) {
      const { data, error } = await client
        .from('expense_categories')
        .insert(values)
        .select('*')
        .single();
      return { data, error };
    },

    async update(calendarId, id, values) {
      const { data, error } = await client
        .from('expense_categories')
        .update(values)
        .eq('calendar_id', calendarId)
        .eq('id', id)
        .select('*')
        .maybeSingle();
      return { data, error };
    },

    async delete(calendarId, id) {
      const { data, error } = await client
        .from('expense_categories')
        .delete()
        .eq('calendar_id', calendarId)
        .eq('id', id)
        .select('id')
        .maybeSingle();
      return { data, error };
    },
  });
}
