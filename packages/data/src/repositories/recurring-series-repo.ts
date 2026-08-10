import type { RaliaSupabaseClient } from '../client.js';
import type { EventsRow, Json, TablesUpdate } from '../database.types.js';
import { RepositoryError, invalidInput, requiredText } from './repository-error.js';

export type RecurringSeriesChanges = Omit<
  TablesUpdate<'events'>,
  'calendar_id' | 'created_at' | 'created_by' | 'id' | 'parent_event_id' | 'updated_at'
>;

export interface SplitRecurringSeriesInput {
  masterEventId: string;
  originalOccurrenceDate: string;
  changes: RecurringSeriesChanges;
  deleteFuture: boolean;
}

export interface SplitRecurringSeriesResult {
  oldMaster: EventsRow;
  newMaster: EventsRow | null;
  deletedFuture: boolean;
}

export interface RecurringSeriesRepo {
  splitFuture(input: SplitRecurringSeriesInput): Promise<SplitRecurringSeriesResult>;
}

export interface RecurringSeriesGateway {
  splitFuture(args: {
    p_master_event_id: string;
    p_original_occurrence_date: string;
    p_event_data: Json;
    p_delete_future: boolean;
  }): Promise<{ data: Json | null; error: { code?: string; message?: string } | null }>;
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isEventRow(value: unknown): value is EventsRow {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.calendar_id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.start_date === 'string' &&
    typeof value.end_date === 'string'
  );
}

function resultFrom(value: unknown, operation: string): SplitRecurringSeriesResult {
  if (
    !isRecord(value) ||
    !isEventRow(value.oldMaster) ||
    (value.newMaster !== null && !isEventRow(value.newMaster)) ||
    typeof value.deletedFuture !== 'boolean'
  ) {
    throw new RepositoryError('invalid_response', operation);
  }
  return {
    oldMaster: value.oldMaster,
    newMaster: value.newMaster,
    deletedFuture: value.deletedFuture,
  };
}

export function createRecurringSeriesRepo(gateway: RecurringSeriesGateway): RecurringSeriesRepo {
  return {
    async splitFuture(input) {
      const operation = 'recurring_series.splitFuture';
      const masterEventId = requiredText(input.masterEventId, operation, 'masterEventId');
      if (!isIsoDate(input.originalOccurrenceDate)) {
        throw invalidInput(operation, 'originalOccurrenceDate', 'must be a valid ISO date');
      }
      if (!isRecord(input.changes)) {
        throw invalidInput(operation, 'changes', 'must be an object');
      }
      if (typeof input.deleteFuture !== 'boolean') {
        throw invalidInput(operation, 'deleteFuture', 'must be a boolean');
      }

      const { data, error } = await gateway.splitFuture({
        p_master_event_id: masterEventId,
        p_original_occurrence_date: input.originalOccurrenceDate,
        p_event_data: { ...input.changes } as Json,
        p_delete_future: input.deleteFuture,
      });
      if (error) {
        throw new RepositoryError('unknown', operation, {
          ...(error.code ? { backendCode: error.code } : {}),
          ...(error.message ? { message: error.message } : {}),
        });
      }
      return resultFrom(data, operation);
    },
  };
}

export function createSupabaseRecurringSeriesRepo(client: RaliaSupabaseClient): RecurringSeriesRepo {
  return createRecurringSeriesRepo({
    async splitFuture(args) {
      const { data, error } = await client.rpc('split_recurring_event_future', args);
      return { data, error };
    },
  });
}
