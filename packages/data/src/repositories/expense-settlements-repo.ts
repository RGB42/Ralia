import type { RaliaSupabaseClient } from '../client.js';
import type { ExpenseSettlementsRow, TablesInsert } from '../database.types.js';
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

type ExpenseSettlementInsert = Pick<
  TablesInsert<'expense_settlements'>,
  'amount' | 'calendar_id' | 'created_by' | 'from_user_id' | 'notes' | 'settled_at' | 'to_user_id'
>;

export interface ExpenseSettlementDateRange {
  startDate: string;
  endDate: string;
}

export interface CreateExpenseSettlementInput {
  calendarId: string;
  createdBy: string;
  fromUserId: string;
  toUserId: string;
  amount: ExpenseAmountInput;
  settledAt: string;
  notes?: string | null;
}

export interface DeleteExpenseSettlementInput {
  calendarId: string;
  id: string;
  settledAt: string;
}

export interface ExpenseSettlementsGateway {
  listByCalendarAndDateRange(
    calendarId: string,
    startDate: string,
    endDate: string,
  ): Promise<GatewayResult<ExpenseSettlementsRow[]>>;
  insert(values: ExpenseSettlementInsert): Promise<GatewayResult<ExpenseSettlementsRow>>;
  delete(calendarId: string, settledAt: string, id: string): Promise<GatewayResult<{ id: string }>>;
}

export interface ExpenseSettlementsRepo {
  list(calendarId: string, range: ExpenseSettlementDateRange): Promise<ExpenseSettlementsRow[]>;
  create(input: CreateExpenseSettlementInput): Promise<ExpenseSettlementsRow>;
  delete(input: DeleteExpenseSettlementInput): Promise<void>;
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

function notes(value: unknown, operation: string): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') throw invalidInput(operation, 'notes', 'must be a string or null');
  const normalized = value.trim();
  return normalized.length === 0 ? null : normalized;
}

function assertSettlement(
  row: ExpenseSettlementsRow,
  operation: string,
  calendarId: string,
  expected?: { id?: string; settledAt?: string },
): ExpenseSettlementsRow {
  if (
    row.calendar_id !== calendarId ||
    (expected?.id !== undefined && row.id !== expected.id) ||
    (expected?.settledAt !== undefined && row.settled_at !== expected.settledAt)
  ) {
    throw new RepositoryError('invalid_response', operation);
  }
  try {
    if (!isExpenseIsoDate(row.settled_at)) throw new Error();
    requiredText(row.from_user_id, operation, 'fromUserId');
    requiredText(row.to_user_id, operation, 'toUserId');
    if (row.from_user_id === row.to_user_id) throw new Error();
    expenseAmountToCents(row.amount, false);
  } catch (cause) {
    throw new RepositoryError('invalid_response', operation, { cause });
  }
  return row;
}

export function createExpenseSettlementsRepo(
  gateway: ExpenseSettlementsGateway,
): ExpenseSettlementsRepo {
  return {
    async list(rawCalendarId, range) {
      const operation = 'expense_settlements.list';
      const calendarId = requiredText(rawCalendarId, operation, 'calendarId');
      const startDate = expenseIsoDate(range.startDate, operation, 'startDate');
      const endDate = expenseIsoDate(range.endDate, operation, 'endDate');
      if (startDate > endDate) {
        throw invalidInput(operation, 'range', 'must start on or before its end date');
      }

      const rows = await requireGatewayData(operation, () =>
        gateway.listByCalendarAndDateRange(calendarId, startDate, endDate),
      );
      return rows
        .map((row) => {
          const settlement = assertSettlement(row, operation, calendarId);
          if (settlement.settled_at < startDate || settlement.settled_at > endDate) {
            throw new RepositoryError('invalid_response', operation);
          }
          return settlement;
        })
        .sort(
          (left, right) =>
            right.settled_at.localeCompare(left.settled_at) ||
            right.created_at.localeCompare(left.created_at) ||
            left.id.localeCompare(right.id),
        );
    },

    async create(input) {
      const operation = 'expense_settlements.create';
      const calendarId = requiredText(input.calendarId, operation, 'calendarId');
      const fromUserId = requiredText(input.fromUserId, operation, 'fromUserId');
      const toUserId = requiredText(input.toUserId, operation, 'toUserId');
      if (fromUserId === toUserId) {
        throw invalidInput(operation, 'toUserId', 'must differ from fromUserId');
      }
      const settledAt = expenseIsoDate(input.settledAt, operation, 'settledAt');
      const values: ExpenseSettlementInsert = {
        amount: amount(input.amount, operation),
        calendar_id: calendarId,
        created_by: requiredText(input.createdBy, operation, 'createdBy'),
        from_user_id: fromUserId,
        notes: notes(input.notes, operation),
        settled_at: settledAt,
        to_user_id: toUserId,
      };
      const row = await requireGatewayData(operation, () => gateway.insert(values));
      return assertSettlement(row, operation, calendarId, { settledAt });
    },

    async delete(input) {
      const operation = 'expense_settlements.delete';
      const calendarId = requiredText(input.calendarId, operation, 'calendarId');
      const id = requiredText(input.id, operation, 'id');
      const settledAt = expenseIsoDate(input.settledAt, operation, 'settledAt');
      const deleted = await requireGatewayData(
        operation,
        () => gateway.delete(calendarId, settledAt, id),
        'not_found',
      );
      if (deleted.id !== id) throw new RepositoryError('invalid_response', operation);
    },
  };
}

export function createSupabaseExpenseSettlementsRepo(
  client: RaliaSupabaseClient,
): ExpenseSettlementsRepo {
  return createExpenseSettlementsRepo({
    async listByCalendarAndDateRange(calendarId, startDate, endDate) {
      const { data, error } = await client
        .from('expense_settlements')
        .select('*')
        .eq('calendar_id', calendarId)
        .gte('settled_at', startDate)
        .lte('settled_at', endDate)
        .order('settled_at', { ascending: false })
        .order('created_at', { ascending: false });
      return { data, error };
    },

    async insert(values) {
      const { data, error } = await client
        .from('expense_settlements')
        .insert(values)
        .select('*')
        .single();
      return { data, error };
    },

    async delete(calendarId, settledAt, id) {
      const { data, error } = await client
        .from('expense_settlements')
        .delete()
        .eq('calendar_id', calendarId)
        .eq('settled_at', settledAt)
        .eq('id', id)
        .select('id')
        .maybeSingle();
      return { data, error };
    },
  });
}
