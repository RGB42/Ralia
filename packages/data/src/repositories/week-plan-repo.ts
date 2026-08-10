import type {
  TablesInsert,
  TablesUpdate,
  WeekPlanEntryType,
  WeekPlansRow,
} from '../database.types.js';
import type { RaliaSupabaseClient } from '../client.js';

type WeekPlanInsert = TablesInsert<'week_plans'>;
type WeekPlanUpdate = TablesUpdate<'week_plans'>;

export interface WeekPlanGatewayError {
  code?: string | undefined;
  message?: string | undefined;
}

export type WeekPlanCreateInput = Omit<
  WeekPlanInsert,
  'created_at' | 'entry_type' | 'id' | 'updated_at'
> & {
  entry_type: WeekPlanEntryType;
};

export type WeekPlanUpdateInput = Omit<
  WeekPlanUpdate,
  'calendar_id' | 'created_at' | 'created_by' | 'entry_type' | 'id' | 'updated_at'
> & {
  entry_type?: WeekPlanEntryType;
};

export interface WeekPlanGateway {
  selectByWeek(
    calendarId: string,
    weekStart: string,
  ): Promise<{ data: WeekPlansRow[] | null; error: WeekPlanGatewayError | null }>;
  insert(
    row: WeekPlanInsert,
  ): Promise<{ data: WeekPlansRow | null; error: WeekPlanGatewayError | null }>;
  updateById(
    calendarId: string,
    id: string,
    changes: WeekPlanUpdate,
  ): Promise<{ data: WeekPlansRow | null; error: WeekPlanGatewayError | null }>;
  deleteById(calendarId: string, id: string): Promise<{ error: WeekPlanGatewayError | null }>;
}

export interface WeekPlanRepo {
  list(calendarId: string, weekStart: string): Promise<WeekPlansRow[]>;
  create(input: WeekPlanCreateInput): Promise<WeekPlansRow>;
  update(calendarId: string, id: string, changes: WeekPlanUpdateInput): Promise<WeekPlansRow>;
  delete(calendarId: string, id: string): Promise<void>;
}

function fail(error: WeekPlanGatewayError): never {
  throw new Error(error.message ?? error.code ?? 'Week plan request failed.');
}

function requireText(value: string, field: string): void {
  if (value.trim() === '') throw new TypeError(`${field} must not be empty.`);
}

function requireDayOfWeek(value: number): void {
  if (!Number.isInteger(value) || value < 0 || value > 6) {
    throw new RangeError('day_of_week must be an integer from 0 through 6.');
  }
}

function requireEntryType(value: string): void {
  if (value !== 'meal' && value !== 'task') {
    throw new TypeError('entry_type must be meal or task.');
  }
}

function requireSortOrder(value: number | null): void {
  if (value !== null && !Number.isInteger(value)) {
    throw new TypeError('sort_order must be an integer or null.');
  }
}

function createRow(input: WeekPlanCreateInput): WeekPlanInsert {
  requireText(input.calendar_id, 'calendar_id');
  requireText(input.created_by, 'created_by');
  requireText(input.week_start, 'week_start');
  requireText(input.title, 'title');
  requireDayOfWeek(input.day_of_week);
  requireEntryType(input.entry_type);
  if (input.sort_order !== undefined) requireSortOrder(input.sort_order);

  const row: WeekPlanInsert = {
    calendar_id: input.calendar_id,
    created_by: input.created_by,
    day_of_week: input.day_of_week,
    entry_type: input.entry_type,
    title: input.title,
    week_start: input.week_start,
  };
  if (input.notes !== undefined) row.notes = input.notes;
  if (input.sort_order !== undefined) row.sort_order = input.sort_order;
  return row;
}

function updateRow(input: WeekPlanUpdateInput): WeekPlanUpdate {
  const row: WeekPlanUpdate = {};

  if (input.week_start !== undefined) {
    requireText(input.week_start, 'week_start');
    row.week_start = input.week_start;
  }
  if (input.day_of_week !== undefined) {
    requireDayOfWeek(input.day_of_week);
    row.day_of_week = input.day_of_week;
  }
  if (input.entry_type !== undefined) {
    requireEntryType(input.entry_type);
    row.entry_type = input.entry_type;
  }
  if (input.title !== undefined) {
    requireText(input.title, 'title');
    row.title = input.title;
  }
  if (input.notes !== undefined) row.notes = input.notes;
  if (input.sort_order !== undefined) {
    requireSortOrder(input.sort_order);
    row.sort_order = input.sort_order;
  }

  if (Object.keys(row).length === 0) {
    throw new TypeError('Week plan update must contain at least one editable field.');
  }
  return row;
}

export function createWeekPlanRepo(gateway: WeekPlanGateway): WeekPlanRepo {
  return {
    async list(calendarId, weekStart) {
      requireText(calendarId, 'calendar_id');
      requireText(weekStart, 'week_start');

      const { data, error } = await gateway.selectByWeek(calendarId, weekStart);
      if (error !== null) fail(error);
      return data ?? [];
    },

    async create(input) {
      const { data, error } = await gateway.insert(createRow(input));
      if (error !== null) fail(error);
      if (data === null) throw new Error('Created week plan entry was not returned.');
      return data;
    },

    async update(calendarId, id, changes) {
      requireText(calendarId, 'calendar_id');
      requireText(id, 'id');

      const { data, error } = await gateway.updateById(calendarId, id, updateRow(changes));
      if (error !== null) fail(error);
      if (data === null) throw new Error('Updated week plan entry was not returned.');
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

export function createSupabaseWeekPlanRepo(client: RaliaSupabaseClient): WeekPlanRepo {
  return createWeekPlanRepo({
    async selectByWeek(calendarId, weekStart) {
      const { data, error } = await client
        .from('week_plans')
        .select('*')
        .eq('calendar_id', calendarId)
        .eq('week_start', weekStart)
        .order('day_of_week')
        .order('sort_order');
      return { data, error };
    },

    async insert(row) {
      const { data, error } = await client.from('week_plans').insert(row).select('*').single();
      return { data, error };
    },

    async updateById(calendarId, id, changes) {
      const { data, error } = await client
        .from('week_plans')
        .update(changes)
        .eq('calendar_id', calendarId)
        .eq('id', id)
        .select('*')
        .maybeSingle();
      return { data, error };
    },

    async deleteById(calendarId, id) {
      const { error } = await client
        .from('week_plans')
        .delete()
        .eq('calendar_id', calendarId)
        .eq('id', id);
      return { error };
    },
  });
}
