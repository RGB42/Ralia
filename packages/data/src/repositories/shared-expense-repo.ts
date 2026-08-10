import type {
  SharedExpensesRow,
  SplitType,
  TablesInsert,
  TablesUpdate,
} from '../database.types.js';
import type { RaliaSupabaseClient } from '../client.js';

type SharedExpenseInsert = TablesInsert<'shared_expenses'>;
type SharedExpenseUpdate = TablesUpdate<'shared_expenses'>;

export type DecimalInput = string | number;

export interface SharedExpenseGatewayError {
  code?: string | undefined;
  message?: string | undefined;
}

export type SharedExpenseCreateInput = Omit<
  SharedExpenseInsert,
  'amount' | 'created_at' | 'id' | 'split_type' | 'updated_at'
> & {
  amount: DecimalInput;
  split_type?: SplitType | null;
};

export type SharedExpenseUpdateInput = Omit<
  SharedExpenseUpdate,
  'amount' | 'calendar_id' | 'created_at' | 'id' | 'split_type' | 'updated_at'
> & {
  amount?: DecimalInput;
  split_type?: SplitType | null;
};

export interface SharedExpenseGateway {
  selectByDateRange(
    calendarId: string,
    fromDate: string,
    throughDate: string,
  ): Promise<{ data: SharedExpensesRow[] | null; error: SharedExpenseGatewayError | null }>;
  insert(
    row: SharedExpenseInsert,
  ): Promise<{ data: SharedExpensesRow | null; error: SharedExpenseGatewayError | null }>;
  updateById(
    calendarId: string,
    id: string,
    changes: SharedExpenseUpdate,
  ): Promise<{ data: SharedExpensesRow | null; error: SharedExpenseGatewayError | null }>;
  deleteById(calendarId: string, id: string): Promise<{ error: SharedExpenseGatewayError | null }>;
}

export interface SharedExpenseRepo {
  list(calendarId: string, fromDate: string, throughDate: string): Promise<SharedExpensesRow[]>;
  create(input: SharedExpenseCreateInput): Promise<SharedExpensesRow>;
  update(
    calendarId: string,
    id: string,
    changes: SharedExpenseUpdateInput,
  ): Promise<SharedExpensesRow>;
  delete(calendarId: string, id: string): Promise<void>;
}

const DECIMAL_AMOUNT = /^(\d+)(?:[.,](\d{1,2}))?$/;
const MAX_SAFE_CENTS = BigInt(Number.MAX_SAFE_INTEGER);

/**
 * Validates a complete decimal input. It intentionally does not use parseFloat:
 * parseFloat('12.34 EUR') would silently accept a different value than entered.
 */
export function parseExpenseAmount(input: DecimalInput): SharedExpenseInsert['amount'] {
  const raw = (typeof input === 'number' ? String(input) : input).trim();
  const match = DECIMAL_AMOUNT.exec(raw);
  const whole = match?.[1];
  if (whole === undefined) {
    throw new TypeError('amount must be a positive decimal with at most two decimal places.');
  }

  const fraction = match?.[2] ?? '';
  const cents = BigInt(`${whole}${fraction.padEnd(2, '0')}`);
  if (cents === 0n) throw new RangeError('amount must be greater than zero.');
  if (cents > MAX_SAFE_CENTS) {
    throw new RangeError('amount is too large to preserve cent precision.');
  }

  const amount = Number(raw.replace(',', '.'));
  if (!Number.isFinite(amount)) throw new RangeError('amount is outside the supported range.');

  const roundTrip = DECIMAL_AMOUNT.exec(String(amount));
  const roundTripWhole = roundTrip?.[1];
  if (roundTripWhole === undefined) {
    throw new RangeError('amount cannot be represented as a plain decimal.');
  }
  const roundTripFraction = roundTrip?.[2] ?? '';
  const roundTripCents = BigInt(`${roundTripWhole}${roundTripFraction.padEnd(2, '0')}`);
  if (roundTripCents !== cents) {
    throw new RangeError('amount is too large to preserve cent precision.');
  }
  return amount;
}

function fail(error: SharedExpenseGatewayError): never {
  throw new Error(error.message ?? error.code ?? 'Shared expense request failed.');
}

function requireText(value: string, field: string): void {
  if (value.trim() === '') throw new TypeError(`${field} must not be empty.`);
}

function requireSplitType(value: string | null): void {
  if (value !== null && value !== 'single' && value !== 'shared') {
    throw new TypeError('split_type must be single, shared, or null.');
  }
}

function createRow(input: SharedExpenseCreateInput): SharedExpenseInsert {
  requireText(input.calendar_id, 'calendar_id');
  requireText(input.paid_by, 'paid_by');
  requireText(input.title, 'title');
  if (input.paid_at !== undefined) requireText(input.paid_at, 'paid_at');
  if (input.split_type !== undefined) requireSplitType(input.split_type);

  const row: SharedExpenseInsert = {
    amount: parseExpenseAmount(input.amount),
    calendar_id: input.calendar_id,
    paid_by: input.paid_by,
    title: input.title,
  };
  if (input.category !== undefined) row.category = input.category;
  if (input.notes !== undefined) row.notes = input.notes;
  if (input.paid_at !== undefined) row.paid_at = input.paid_at;
  if (input.split_type !== undefined) row.split_type = input.split_type;
  return row;
}

function updateRow(input: SharedExpenseUpdateInput): SharedExpenseUpdate {
  const row: SharedExpenseUpdate = {};

  if (input.amount !== undefined) row.amount = parseExpenseAmount(input.amount);
  if (input.category !== undefined) row.category = input.category;
  if (input.notes !== undefined) row.notes = input.notes;
  if (input.paid_at !== undefined) {
    requireText(input.paid_at, 'paid_at');
    row.paid_at = input.paid_at;
  }
  if (input.paid_by !== undefined) {
    requireText(input.paid_by, 'paid_by');
    row.paid_by = input.paid_by;
  }
  if (input.split_type !== undefined) {
    requireSplitType(input.split_type);
    row.split_type = input.split_type;
  }
  if (input.title !== undefined) {
    requireText(input.title, 'title');
    row.title = input.title;
  }

  if (Object.keys(row).length === 0) {
    throw new TypeError('Shared expense update must contain at least one editable field.');
  }
  return row;
}

export function createSharedExpenseRepo(gateway: SharedExpenseGateway): SharedExpenseRepo {
  return {
    async list(calendarId, fromDate, throughDate) {
      requireText(calendarId, 'calendar_id');
      requireText(fromDate, 'from_date');
      requireText(throughDate, 'through_date');
      if (fromDate > throughDate) {
        throw new RangeError('from_date must not be after through_date.');
      }

      const { data, error } = await gateway.selectByDateRange(calendarId, fromDate, throughDate);
      if (error !== null) fail(error);
      return data ?? [];
    },

    async create(input) {
      const { data, error } = await gateway.insert(createRow(input));
      if (error !== null) fail(error);
      if (data === null) throw new Error('Created shared expense was not returned.');
      return data;
    },

    async update(calendarId, id, changes) {
      requireText(calendarId, 'calendar_id');
      requireText(id, 'id');

      const { data, error } = await gateway.updateById(calendarId, id, updateRow(changes));
      if (error !== null) fail(error);
      if (data === null) throw new Error('Updated shared expense was not returned.');
      return data;
    },

    async delete(calendarId, id) {
      requireText(calendarId, 'calendar_id');
      requireText(id, 'id');

      const { error } = await gateway.deleteById(calendarId, id);
      if (error !== null) fail(error);
    },
  };
}

export function createSupabaseSharedExpenseRepo(client: RaliaSupabaseClient): SharedExpenseRepo {
  return createSharedExpenseRepo({
    async selectByDateRange(calendarId, fromDate, throughDate) {
      const { data, error } = await client
        .from('shared_expenses')
        .select('*')
        .eq('calendar_id', calendarId)
        .gte('paid_at', fromDate)
        .lte('paid_at', throughDate)
        .order('paid_at', { ascending: false })
        .order('created_at', { ascending: false });
      return { data, error };
    },

    async insert(row) {
      const { data, error } = await client.from('shared_expenses').insert(row).select('*').single();
      return { data, error };
    },

    async updateById(calendarId, id, changes) {
      const { data, error } = await client
        .from('shared_expenses')
        .update(changes)
        .eq('calendar_id', calendarId)
        .eq('id', id)
        .select('*')
        .maybeSingle();
      return { data, error };
    },

    async deleteById(calendarId, id) {
      const { error } = await client
        .from('shared_expenses')
        .delete()
        .eq('calendar_id', calendarId)
        .eq('id', id);
      return { error };
    },
  });
}
