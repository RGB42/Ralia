import {
  isOfflineSyncError,
  isPermanentRequestError,
  type FlushOutcome,
  type OfflineProbe,
  type OutboxRecord,
} from '@ralia/core';
import {
  EventRepoError,
  type CreateEventInput,
  type EventRepo,
  type UpdateEventInput,
} from '../repositories/event-repo.js';
import type {
  CreateRecurringEventExceptionInput,
  DeleteRecurringEventExceptionInput,
  RecurringEventExceptionsRepo,
  UpdateRecurringEventExceptionInput,
} from '../repositories/recurring-event-exceptions-repo.js';
import type {
  RecurringSeriesRepo,
  SplitRecurringSeriesInput,
} from '../repositories/recurring-series-repo.js';
import { RepositoryError } from '../repositories/repository-error.js';

type EventCreateInput = Omit<CreateEventInput, 'id'>;
type ExceptionCreateInput = Omit<CreateRecurringEventExceptionInput, 'calendarId'>;
type ExceptionUpdateInput = Omit<UpdateRecurringEventExceptionInput, 'calendarId'>;
type ExceptionDeleteInput = Omit<DeleteRecurringEventExceptionInput, 'calendarId'>;

interface ScopedMutation {
  /** Optional diagnostic copy only. The containing outbox record remains authoritative. */
  calendarId?: string;
}

export type EventMutation =
  | (ScopedMutation & {
      kind: 'event.create';
      tempId: string;
      input: EventCreateInput;
    })
  | (ScopedMutation & {
      kind: 'event.update';
      eventId: string;
      changes: UpdateEventInput;
    })
  | (ScopedMutation & {
      kind: 'event.delete';
      eventId: string;
    })
  | (ScopedMutation & {
      kind: 'exception.create';
      tempId: string;
      input: ExceptionCreateInput;
    })
  | (ScopedMutation & {
      kind: 'exception.update';
      input: ExceptionUpdateInput;
    })
  | (ScopedMutation & {
      kind: 'exception.delete';
      input: ExceptionDeleteInput;
    })
  | (ScopedMutation & {
      kind: 'series.splitFuture';
      input: SplitRecurringSeriesInput;
    });

export interface EventOutboxExecutorDependencies {
  eventRepo: EventRepo;
  recurringEventExceptionsRepo: RecurringEventExceptionsRepo;
  recurringSeriesRepo: RecurringSeriesRepo;
  /** Injectable to make browser connectivity state deterministic in tests. */
  offlineProbe?: OfflineProbe;
}

type FailureOutcome = Extract<FlushOutcome, { status: 'drop' | 'retry' }>;
type FailureDisposition = FailureOutcome['status'];

const SCOPE_FIELDS = ['calendarId', 'calendar_id'] as const;

/** Executes every mutation owned by the events outbox queue. */
export function createEventOutboxExecutor({
  eventRepo,
  recurringEventExceptionsRepo,
  recurringSeriesRepo,
  offlineProbe,
}: EventOutboxExecutorDependencies): (
  record: OutboxRecord<EventMutation>,
) => Promise<FlushOutcome> {
  return async (record) => {
    const recordError = validateRecord(record);
    if (recordError !== undefined) return drop(recordError);

    const mutation = record.mutation as unknown;
    if (!isRecord(mutation) || typeof mutation.kind !== 'string') {
      return drop('Invalid event outbox mutation: expected a discriminated object.');
    }

    const topLevelScopeError = scopeError(record.calendarId, mutation, 'mutation');
    if (topLevelScopeError !== undefined) return drop(topLevelScopeError);

    try {
      switch (mutation.kind) {
        case 'event.create': {
          const tempId = identifier(mutation.tempId, 'tempId');
          const input = objectField(mutation, 'input');
          const inputScopeError = scopeError(record.calendarId, input, 'event.create input');
          if (inputScopeError !== undefined) return drop(inputScopeError);

          const created = await eventRepo.create(
            record.calendarId,
            withoutFields(input, [...SCOPE_FIELDS, 'id']) as EventCreateInput,
          );
          assertEventResult(created, record.calendarId, 'event.create');
          return doneWithRebase(tempId, created.id);
        }

        case 'event.update': {
          const eventId = identifier(mutation.eventId, 'eventId');
          const changes = objectField(mutation, 'changes');
          const changesScopeError = scopeError(
            record.calendarId,
            changes,
            'event.update changes',
          );
          if (changesScopeError !== undefined) return drop(changesScopeError);

          const updated = await eventRepo.update(
            record.calendarId,
            eventId,
            withoutFields(changes, SCOPE_FIELDS) as UpdateEventInput,
          );
          assertEventResult(updated, record.calendarId, 'event.update', eventId);
          return { status: 'done' };
        }

        case 'event.delete':
          await eventRepo.delete(record.calendarId, identifier(mutation.eventId, 'eventId'));
          return { status: 'done' };

        case 'exception.create': {
          const tempId = identifier(mutation.tempId, 'tempId');
          const input = objectField(mutation, 'input');
          const inputScopeError = scopeError(record.calendarId, input, 'exception.create input');
          if (inputScopeError !== undefined) return drop(inputScopeError);

          const created = await recurringEventExceptionsRepo.create({
            ...withoutFields(input, SCOPE_FIELDS),
            calendarId: record.calendarId,
          } as CreateRecurringEventExceptionInput);
          assertExceptionResult(created, record.calendarId, 'exception.create');
          return doneWithRebase(tempId, created.id);
        }

        case 'exception.update': {
          const input = objectField(mutation, 'input');
          const inputScopeError = scopeError(record.calendarId, input, 'exception.update input');
          if (inputScopeError !== undefined) return drop(inputScopeError);

          const updated = await recurringEventExceptionsRepo.update({
            ...withoutFields(input, SCOPE_FIELDS),
            calendarId: record.calendarId,
          } as UpdateRecurringEventExceptionInput);
          assertExceptionResult(updated, record.calendarId, 'exception.update');
          return { status: 'done' };
        }

        case 'exception.delete': {
          const input = objectField(mutation, 'input');
          const inputScopeError = scopeError(record.calendarId, input, 'exception.delete input');
          if (inputScopeError !== undefined) return drop(inputScopeError);

          await recurringEventExceptionsRepo.delete({
            ...withoutFields(input, SCOPE_FIELDS),
            calendarId: record.calendarId,
          } as DeleteRecurringEventExceptionInput);
          return { status: 'done' };
        }

        case 'series.splitFuture': {
          const input = objectField(mutation, 'input');
          const inputScopeError = scopeError(record.calendarId, input, 'series.splitFuture input');
          if (inputScopeError !== undefined) return drop(inputScopeError);
          const changes = objectField(input, 'changes');
          const changesScopeError = scopeError(
            record.calendarId,
            changes,
            'series.splitFuture changes',
          );
          if (changesScopeError !== undefined) return drop(changesScopeError);

          const splitInput = {
            ...withoutFields(input, SCOPE_FIELDS),
            changes: withoutFields(changes, SCOPE_FIELDS),
          } as unknown as SplitRecurringSeriesInput;
          const result = await recurringSeriesRepo.splitFuture(splitInput);
          assertSplitResult(result, record.calendarId, splitInput.masterEventId);
          return { status: 'done' };
        }

        default:
          return drop(`Invalid event outbox mutation: unsupported kind "${mutation.kind}".`);
      }
    } catch (error) {
      if (error instanceof InvalidMutationError) return drop(error.message);
      const outcome = failureOutcome(error, offlineProbe);
      if (outcome !== undefined) return outcome;
      throw error;
    }
  };
}

class InvalidMutationError extends Error {
  override readonly name = 'InvalidMutationError';

  constructor(message: string) {
    super(`Invalid event outbox mutation: ${message}.`);
  }
}

function validateRecord(record: OutboxRecord<EventMutation>): string | undefined {
  if (record.domain !== 'events') return 'Invalid event outbox record: domain must be "events".';
  if (
    typeof record.calendarId !== 'string' ||
    record.calendarId.length === 0 ||
    record.calendarId.trim() !== record.calendarId
  ) {
    return 'Invalid event outbox record: calendarId must be a non-empty normalized string.';
  }
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function objectField(value: Record<string, unknown>, field: string): Record<string, unknown> {
  const fieldValue = value[field];
  if (!isRecord(fieldValue)) throw new InvalidMutationError(`${field} must be an object`);
  return fieldValue;
}

function identifier(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.trim() !== value) {
    throw new InvalidMutationError(`${field} must be a non-empty normalized string`);
  }
  return value;
}

function scopeError(
  calendarId: string,
  value: Record<string, unknown>,
  location: string,
): string | undefined {
  for (const field of SCOPE_FIELDS) {
    if (!Object.hasOwn(value, field) || value[field] === undefined) continue;
    if (value[field] !== calendarId) {
      return `Event outbox scope mismatch: ${location}.${field} contradicts record.calendarId.`;
    }
  }
  return undefined;
}

function withoutFields(
  value: Record<string, unknown>,
  fields: readonly string[],
): Record<string, unknown> {
  const copy = { ...value };
  for (const field of fields) delete copy[field];
  return copy;
}

function assertEventResult(
  value: unknown,
  calendarId: string,
  operation: string,
  eventId?: string,
): asserts value is { id: string; calendar_id: string } {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    value.id.length === 0 ||
    value.calendar_id !== calendarId ||
    (eventId !== undefined && value.id !== eventId)
  ) {
    throw new Error(`${operation} returned an event outside the requested scope`);
  }
}

function assertExceptionResult(
  value: unknown,
  calendarId: string,
  operation: string,
): asserts value is { id: string; calendar_id: string } {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    value.id.length === 0 ||
    value.calendar_id !== calendarId
  ) {
    throw new Error(`${operation} returned an exception outside the requested scope`);
  }
}

function assertSplitResult(
  value: Awaited<ReturnType<RecurringSeriesRepo['splitFuture']>>,
  calendarId: string,
  masterEventId: string,
): void {
  if (
    value.oldMaster.id !== masterEventId ||
    value.oldMaster.calendar_id !== calendarId ||
    (value.newMaster !== null && value.newMaster.calendar_id !== calendarId)
  ) {
    throw new Error('series.splitFuture returned events outside the requested scope');
  }
}

function doneWithRebase(tempId: string, realId: string): FlushOutcome {
  return { status: 'done', rebase: { tempId, realId } };
}

function failureOutcome(error: unknown, offlineProbe: OfflineProbe | undefined): FailureOutcome | undefined {
  if (error instanceof EventRepoError) {
    const disposition = eventRepoDisposition(error);
    if (disposition !== undefined) return outcome(disposition, error);
    return genericFailureOutcome(error, offlineProbe) ?? retry(error);
  }

  if (error instanceof RepositoryError) {
    const disposition = repositoryDisposition(error);
    if (disposition !== undefined) return outcome(disposition, error);
    return genericFailureOutcome(error, offlineProbe) ?? retry(error);
  }

  return genericFailureOutcome(error, offlineProbe);
}

function genericFailureOutcome(
  error: unknown,
  offlineProbe: OfflineProbe | undefined,
): FailureOutcome | undefined {
  for (const candidate of errorChain(error)) {
    const status = numberProperty(candidate, 'status');
    if (isPermanentRequestError(status)) return drop(describeError(error));
    if (status === 0 || status === 408 || status === 429 || (status !== undefined && status >= 500)) {
      return retry(error);
    }

    const backendDisposition = dispositionForBackendCode(stringProperty(candidate, 'code'));
    if (backendDisposition !== undefined) return outcome(backendDisposition, error);
    if (isOfflineSyncError(candidate, offlineProbe)) return retry(error);
  }

  return undefined;
}

function eventRepoDisposition(error: EventRepoError): FailureDisposition | undefined {
  switch (error.kind) {
    case 'invalid-input':
    case 'not-found':
    case 'conflict':
    case 'forbidden':
      return 'drop';
    case 'unavailable':
      return 'retry';
    case 'unknown':
      return dispositionForBackendCode(error.databaseCode);
  }
}

function repositoryDisposition(error: RepositoryError): FailureDisposition | undefined {
  switch (error.code) {
    case 'invalid_input':
    case 'not_found':
    case 'conflict':
    case 'forbidden':
      return 'drop';
    case 'unavailable':
      return 'retry';
    case 'invalid_response':
    case 'unknown':
      return dispositionForBackendCode(error.backendCode);
  }
}

function dispositionForBackendCode(code: string | undefined): FailureDisposition | undefined {
  if (code === undefined) return undefined;
  if (
    /^(08|53|58)/.test(code) ||
    code === '40001' ||
    code === '40P01' ||
    code === '55P03' ||
    code === '57014' ||
    /^PGRST00[0-3]$/.test(code)
  ) {
    return 'retry';
  }
  if (
    /^(22|23)/.test(code) ||
    code === '42501' ||
    code === 'P0002' ||
    code === 'PGRST116' ||
    code === 'PGRST301' ||
    code === 'PGRST302' ||
    /^PGRST[12]\d{2}$/.test(code)
  ) {
    return 'drop';
  }
  if (code === 'PGRSTX00') return 'retry';
  return undefined;
}

function errorChain(error: unknown): unknown[] {
  const chain: unknown[] = [];
  const seen = new Set<object>();
  let current: unknown = error;
  while (current !== null && current !== undefined && chain.length < 5) {
    chain.push(current);
    if (typeof current !== 'object' || seen.has(current)) break;
    seen.add(current);
    current = (current as { cause?: unknown }).cause;
  }
  return chain;
}

function stringProperty(value: unknown, field: string): string | undefined {
  if (!isRecord(value)) return undefined;
  const property = value[field];
  return typeof property === 'string' ? property : undefined;
}

function numberProperty(value: unknown, field: string): number | undefined {
  if (!isRecord(value)) return undefined;
  const property = value[field];
  return typeof property === 'number' ? property : undefined;
}

function outcome(disposition: FailureDisposition, error: unknown): FailureOutcome {
  return disposition === 'retry' ? retry(error) : drop(describeError(error));
}

function retry(error: unknown): FailureOutcome {
  return { status: 'retry', reason: describeError(error) };
}

function drop(reason: string): FailureOutcome {
  return { status: 'drop', reason };
}

function describeError(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) return error.message;
  const message = stringProperty(error, 'message');
  if (message !== undefined && message.trim().length > 0) return message;
  return String(error);
}
