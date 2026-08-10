import type { RaliaSupabaseClient } from '../client.js';
import type { ExpenseSplitsRow, TablesInsert, TablesUpdate } from '../database.types.js';
import type { ExpenseAmountInput } from './expense-money.js';
import { expenseAmountToCents, normalizeExpenseAmount } from './expense-money.js';
import {
  RepositoryError,
  invalidInput,
  requireGatewayData,
  requiredText,
} from './repository-error.js';
import type { GatewayResult } from './repository-error.js';

type ExpenseSplitInsert = Pick<TablesInsert<'expense_splits'>, 'amount' | 'expense_id' | 'user_id'>;

type ExpenseSplitUpdate = Pick<TablesUpdate<'expense_splits'>, 'amount' | 'user_id'>;

export interface CreateExpenseSplitInput {
  expenseId: string;
  userId: string;
  amount: ExpenseAmountInput;
}

export interface UpdateExpenseSplitInput {
  expenseId: string;
  id: string;
  userId?: string;
  amount?: ExpenseAmountInput;
}

export interface DeleteExpenseSplitInput {
  expenseId: string;
  id: string;
}

export interface ExpenseSplitsGateway {
  listByExpense(expenseId: string): Promise<GatewayResult<ExpenseSplitsRow[]>>;
  insert(values: ExpenseSplitInsert): Promise<GatewayResult<ExpenseSplitsRow>>;
  update(
    expenseId: string,
    id: string,
    values: ExpenseSplitUpdate,
  ): Promise<GatewayResult<ExpenseSplitsRow>>;
  delete(expenseId: string, id: string): Promise<GatewayResult<{ id: string }>>;
}

export interface ExpenseSplitsRepo {
  list(expenseId: string): Promise<ExpenseSplitsRow[]>;
  create(input: CreateExpenseSplitInput): Promise<ExpenseSplitsRow>;
  update(input: UpdateExpenseSplitInput): Promise<ExpenseSplitsRow>;
  delete(input: DeleteExpenseSplitInput): Promise<void>;
}

function amount(value: ExpenseAmountInput, operation: string): number {
  try {
    return normalizeExpenseAmount(value, false);
  } catch (cause) {
    throw new RepositoryError('invalid_input', operation, {
      cause,
      message: `${operation}: amount must be a positive numeric(12, 2) amount`,
    });
  }
}

function assertSplit(
  row: ExpenseSplitsRow,
  operation: string,
  expenseId: string,
  expectedId?: string,
): ExpenseSplitsRow {
  if (row.expense_id !== expenseId || (expectedId !== undefined && row.id !== expectedId)) {
    throw new RepositoryError('invalid_response', operation);
  }
  try {
    requiredText(row.user_id, operation, 'userId');
    expenseAmountToCents(row.amount, false);
  } catch (cause) {
    throw new RepositoryError('invalid_response', operation, { cause });
  }
  return row;
}

export function createExpenseSplitsRepo(gateway: ExpenseSplitsGateway): ExpenseSplitsRepo {
  return {
    async list(rawExpenseId) {
      const operation = 'expense_splits.list';
      const expenseId = requiredText(rawExpenseId, operation, 'expenseId');
      const rows = await requireGatewayData(operation, () => gateway.listByExpense(expenseId));
      return rows
        .map((row) => assertSplit(row, operation, expenseId))
        .sort(
          (left, right) =>
            left.created_at.localeCompare(right.created_at) || left.id.localeCompare(right.id),
        );
    },

    async create(input) {
      const operation = 'expense_splits.create';
      const values: ExpenseSplitInsert = {
        amount: amount(input.amount, operation),
        expense_id: requiredText(input.expenseId, operation, 'expenseId'),
        user_id: requiredText(input.userId, operation, 'userId'),
      };
      const row = await requireGatewayData(operation, () => gateway.insert(values));
      return assertSplit(row, operation, values.expense_id);
    },

    async update(input) {
      const operation = 'expense_splits.update';
      const expenseId = requiredText(input.expenseId, operation, 'expenseId');
      const id = requiredText(input.id, operation, 'id');
      const values: ExpenseSplitUpdate = {};
      if (input.userId !== undefined) {
        values.user_id = requiredText(input.userId, operation, 'userId');
      }
      if (input.amount !== undefined) values.amount = amount(input.amount, operation);
      if (Object.keys(values).length === 0) {
        throw invalidInput(operation, 'changes', 'must not be empty');
      }

      const row = await requireGatewayData(
        operation,
        () => gateway.update(expenseId, id, values),
        'not_found',
      );
      return assertSplit(row, operation, expenseId, id);
    },

    async delete(input) {
      const operation = 'expense_splits.delete';
      const expenseId = requiredText(input.expenseId, operation, 'expenseId');
      const id = requiredText(input.id, operation, 'id');
      const deleted = await requireGatewayData(
        operation,
        () => gateway.delete(expenseId, id),
        'not_found',
      );
      if (deleted.id !== id) throw new RepositoryError('invalid_response', operation);
    },
  };
}

export function createSupabaseExpenseSplitsRepo(client: RaliaSupabaseClient): ExpenseSplitsRepo {
  return createExpenseSplitsRepo({
    async listByExpense(expenseId) {
      const { data, error } = await client
        .from('expense_splits')
        .select('*')
        .eq('expense_id', expenseId)
        .order('created_at')
        .order('id');
      return { data, error };
    },

    async insert(values) {
      const { data, error } = await client
        .from('expense_splits')
        .insert(values)
        .select('*')
        .single();
      return { data, error };
    },

    async update(expenseId, id, values) {
      const { data, error } = await client
        .from('expense_splits')
        .update(values)
        .eq('expense_id', expenseId)
        .eq('id', id)
        .select('*')
        .maybeSingle();
      return { data, error };
    },

    async delete(expenseId, id) {
      const { data, error } = await client
        .from('expense_splits')
        .delete()
        .eq('expense_id', expenseId)
        .eq('id', id)
        .select('id')
        .maybeSingle();
      return { data, error };
    },
  });
}
