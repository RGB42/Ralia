import type { RaliaSupabaseClient } from '../client.js';
import type { ExpenseBudgetsRow, TablesInsert, TablesUpdate } from '../database.types.js';
import { expenseIsoDate, isExpenseIsoDate } from './expense-date.js';
import type { ExpenseAmountInput } from './expense-money.js';
import { expenseAmountToCents, normalizeExpenseAmount } from './expense-money.js';
import {
  RepositoryError,
  invalidInput,
  requireGatewayData,
  requiredText,
} from './repository-error.js';
import type { GatewayResult } from './repository-error.js';

type ExpenseBudgetInsert = Pick<
  TablesInsert<'expense_budgets'>,
  'amount' | 'calendar_id' | 'created_by' | 'month_start'
>;

type ExpenseBudgetUpdate = Pick<
  TablesUpdate<'expense_budgets'>,
  'amount' | 'month_start' | 'updated_at'
>;

export interface CreateExpenseBudgetInput {
  calendarId: string;
  createdBy: string;
  monthStart: string;
  amount: ExpenseAmountInput;
}

export interface UpdateExpenseBudgetInput {
  calendarId: string;
  id: string;
  monthStart?: string;
  amount?: ExpenseAmountInput;
}

export interface DeleteExpenseBudgetInput {
  calendarId: string;
  id: string;
}

export interface ExpenseBudgetsGateway {
  listByCalendar(calendarId: string): Promise<GatewayResult<ExpenseBudgetsRow[]>>;
  insert(values: ExpenseBudgetInsert): Promise<GatewayResult<ExpenseBudgetsRow>>;
  update(
    calendarId: string,
    id: string,
    values: ExpenseBudgetUpdate,
  ): Promise<GatewayResult<ExpenseBudgetsRow>>;
  delete(calendarId: string, id: string): Promise<GatewayResult<{ id: string }>>;
}

export interface ExpenseBudgetsRepo {
  list(calendarId: string): Promise<ExpenseBudgetsRow[]>;
  create(input: CreateExpenseBudgetInput): Promise<ExpenseBudgetsRow>;
  update(input: UpdateExpenseBudgetInput): Promise<ExpenseBudgetsRow>;
  delete(input: DeleteExpenseBudgetInput): Promise<void>;
}

function monthStart(value: unknown, operation: string): string {
  const date = expenseIsoDate(value, operation, 'monthStart');
  if (!date.endsWith('-01')) {
    throw invalidInput(operation, 'monthStart', 'must be the first day of a month');
  }
  return date;
}

function amount(value: ExpenseAmountInput, operation: string): number {
  try {
    return normalizeExpenseAmount(value, true);
  } catch (cause) {
    throw new RepositoryError('invalid_input', operation, {
      cause,
      message: `${operation}: amount must be a numeric(12, 2) amount of zero or more`,
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

function assertBudget(
  row: ExpenseBudgetsRow,
  operation: string,
  calendarId: string,
  expectedId?: string,
): ExpenseBudgetsRow {
  if (row.calendar_id !== calendarId || (expectedId !== undefined && row.id !== expectedId)) {
    throw new RepositoryError('invalid_response', operation);
  }
  try {
    if (!isExpenseIsoDate(row.month_start) || !row.month_start.endsWith('-01')) throw new Error();
    expenseAmountToCents(row.amount, true);
  } catch (cause) {
    throw new RepositoryError('invalid_response', operation, { cause });
  }
  return row;
}

export function createExpenseBudgetsRepo(
  gateway: ExpenseBudgetsGateway,
  now: () => string = () => new Date().toISOString(),
): ExpenseBudgetsRepo {
  return {
    async list(rawCalendarId) {
      const operation = 'expense_budgets.list';
      const calendarId = requiredText(rawCalendarId, operation, 'calendarId');
      const rows = await requireGatewayData(operation, () => gateway.listByCalendar(calendarId));
      return rows
        .map((row) => assertBudget(row, operation, calendarId))
        .sort(
          (left, right) =>
            right.month_start.localeCompare(left.month_start) || left.id.localeCompare(right.id),
        );
    },

    async create(input) {
      const operation = 'expense_budgets.create';
      const values: ExpenseBudgetInsert = {
        amount: amount(input.amount, operation),
        calendar_id: requiredText(input.calendarId, operation, 'calendarId'),
        created_by: requiredText(input.createdBy, operation, 'createdBy'),
        month_start: monthStart(input.monthStart, operation),
      };
      const row = await requireGatewayData(operation, () => gateway.insert(values));
      return assertBudget(row, operation, values.calendar_id);
    },

    async update(input) {
      const operation = 'expense_budgets.update';
      const calendarId = requiredText(input.calendarId, operation, 'calendarId');
      const id = requiredText(input.id, operation, 'id');
      const values: ExpenseBudgetUpdate = {};
      if (input.monthStart !== undefined)
        values.month_start = monthStart(input.monthStart, operation);
      if (input.amount !== undefined) values.amount = amount(input.amount, operation);
      if (Object.keys(values).length === 0) {
        throw invalidInput(operation, 'changes', 'must not be empty');
      }
      values.updated_at = timestamp(now, operation);

      const row = await requireGatewayData(
        operation,
        () => gateway.update(calendarId, id, values),
        'not_found',
      );
      return assertBudget(row, operation, calendarId, id);
    },

    async delete(input) {
      const operation = 'expense_budgets.delete';
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

export function createSupabaseExpenseBudgetsRepo(client: RaliaSupabaseClient): ExpenseBudgetsRepo {
  return createExpenseBudgetsRepo({
    async listByCalendar(calendarId) {
      const { data, error } = await client
        .from('expense_budgets')
        .select('*')
        .eq('calendar_id', calendarId)
        .order('month_start', { ascending: false });
      return { data, error };
    },

    async insert(values) {
      const { data, error } = await client
        .from('expense_budgets')
        .insert(values)
        .select('*')
        .single();
      return { data, error };
    },

    async update(calendarId, id, values) {
      const { data, error } = await client
        .from('expense_budgets')
        .update(values)
        .eq('calendar_id', calendarId)
        .eq('id', id)
        .select('*')
        .maybeSingle();
      return { data, error };
    },

    async delete(calendarId, id) {
      const { data, error } = await client
        .from('expense_budgets')
        .delete()
        .eq('calendar_id', calendarId)
        .eq('id', id)
        .select('id')
        .maybeSingle();
      return { data, error };
    },
  });
}
