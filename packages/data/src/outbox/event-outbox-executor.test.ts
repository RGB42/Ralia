import type { FlushOutcome, OutboxRecord } from '@ralia/core';
import { describe, expect, it, vi } from 'vitest';
import type { EventsRow, RecurringEventExceptionsRow } from '../database.types.js';
import {
  EventRepoError,
  type CreateEventInput,
  type EventRepo,
} from '../repositories/event-repo.js';
import type { RecurringEventExceptionsRepo } from '../repositories/recurring-event-exceptions-repo.js';
import type { RecurringSeriesRepo } from '../repositories/recurring-series-repo.js';
import { RepositoryError } from '../repositories/repository-error.js';
import {
  createEventOutboxExecutor,
  type EventMutation,
  type EventOutboxExecutorDependencies,
} from './event-outbox-executor.js';

const CALENDAR_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER_CALENDAR_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const EVENT_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const NEW_EVENT_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const EXCEPTION_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const NEW_EXCEPTION_ID = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const USER_ID = '11111111-1111-4111-8111-111111111111';

const EVENT: EventsRow = {
  id: EVENT_ID,
  calendar_id: CALENDAR_ID,
  name: 'Weekly dinner',
  subtitle: null,
  short_description: null,
  location: null,
  notes: null,
  start_date: '2026-08-10',
  start_time: '18:00:00',
  end_date: '2026-08-10',
  end_time: '19:00:00',
  belongs_to: 'both',
  created_by: USER_ID,
  created_at: '2026-08-10T08:00:00Z',
  updated_at: '2026-08-10T08:00:00Z',
  recurrence_type: 'weekly',
  recurrence_interval: 1,
  recurrence_end_date: null,
  parent_event_id: null,
  google_event_id: null,
  reminder_enabled: false,
  reminder_offset_minutes: 60,
  reminder_offsets: null,
  event_type: 'default',
  is_special_auto: false,
  special_key: null,
  category: null,
  extended_data: null,
};

const CREATE_EVENT_INPUT: Omit<CreateEventInput, 'id'> = {
  name: EVENT.name,
  start_date: EVENT.start_date,
  start_time: EVENT.start_time,
  end_date: EVENT.end_date,
  end_time: EVENT.end_time,
  belongs_to: EVENT.belongs_to,
  created_by: EVENT.created_by,
};

const EXCEPTION: RecurringEventExceptionsRow = {
  id: EXCEPTION_ID,
  calendar_id: CALENDAR_ID,
  master_event_id: EVENT_ID,
  created_by: USER_ID,
  original_occurrence_date: '2026-08-17',
  is_deleted: false,
  override_event_data: { name: 'Moved dinner' },
  created_at: '2026-08-10T08:00:00Z',
  updated_at: '2026-08-10T08:00:00Z',
};

const MUTATIONS = {
  eventCreate: {
    kind: 'event.create',
    tempId: 'local-event-1',
    input: CREATE_EVENT_INPUT,
  },
  eventUpdate: {
    kind: 'event.update',
    eventId: EVENT_ID,
    changes: { name: 'Updated dinner' },
  },
  eventDelete: { kind: 'event.delete', eventId: EVENT_ID },
  exceptionCreate: {
    kind: 'exception.create',
    tempId: 'local-exception-1',
    input: {
      masterEventId: EVENT_ID,
      createdBy: USER_ID,
      originalOccurrenceDate: '2026-08-17',
      isDeleted: false,
      overrideEventData: { name: 'Moved dinner' },
    },
  },
  exceptionUpdate: {
    kind: 'exception.update',
    input: {
      masterEventId: EVENT_ID,
      id: EXCEPTION_ID,
      overrideEventData: { name: 'Updated occurrence' },
    },
  },
  exceptionDelete: {
    kind: 'exception.delete',
    input: { masterEventId: EVENT_ID, id: EXCEPTION_ID },
  },
  splitFuture: {
    kind: 'series.splitFuture',
    input: {
      masterEventId: EVENT_ID,
      originalOccurrenceDate: '2026-08-24',
      changes: { name: 'New tail' },
      deleteFuture: false,
    },
  },
} as const satisfies Record<string, EventMutation>;

function outboxRecord(mutation: unknown): OutboxRecord<EventMutation> {
  return {
    id: 1,
    ownerUserId: USER_ID,
    domain: 'events',
    calendarId: CALENDAR_ID,
    mutation: mutation as EventMutation,
    enqueuedAt: Date.parse('2026-08-10T08:00:00Z'),
    attempts: 0,
    retryAfter: 0,
    legacy: false,
    lastError: null,
  };
}

function harness() {
  const eventRepo = {
    list: vi.fn<EventRepo['list']>().mockResolvedValue([EVENT]),
    create: vi
      .fn<EventRepo['create']>()
      .mockResolvedValue({ ...EVENT, id: NEW_EVENT_ID }),
    update: vi.fn<EventRepo['update']>().mockResolvedValue(EVENT),
    delete: vi.fn<EventRepo['delete']>().mockResolvedValue(undefined),
  } satisfies EventRepo;
  const recurringEventExceptionsRepo = {
    list: vi.fn<RecurringEventExceptionsRepo['list']>().mockResolvedValue([EXCEPTION]),
    create: vi
      .fn<RecurringEventExceptionsRepo['create']>()
      .mockResolvedValue({ ...EXCEPTION, id: NEW_EXCEPTION_ID }),
    update: vi.fn<RecurringEventExceptionsRepo['update']>().mockResolvedValue(EXCEPTION),
    delete: vi
      .fn<RecurringEventExceptionsRepo['delete']>()
      .mockResolvedValue(undefined),
  } satisfies RecurringEventExceptionsRepo;
  const recurringSeriesRepo = {
    splitFuture: vi.fn<RecurringSeriesRepo['splitFuture']>().mockResolvedValue({
      oldMaster: EVENT,
      newMaster: { ...EVENT, id: NEW_EVENT_ID },
      deletedFuture: false,
    }),
  } satisfies RecurringSeriesRepo;
  const dependencies = {
    eventRepo,
    recurringEventExceptionsRepo,
    recurringSeriesRepo,
    offlineProbe: { isOnline: () => true },
  } satisfies EventOutboxExecutorDependencies;

  return {
    ...dependencies,
    execute: createEventOutboxExecutor(dependencies),
  };
}

function expectNoMutationCalls(value: ReturnType<typeof harness>): void {
  expect(value.eventRepo.create).not.toHaveBeenCalled();
  expect(value.eventRepo.update).not.toHaveBeenCalled();
  expect(value.eventRepo.delete).not.toHaveBeenCalled();
  expect(value.recurringEventExceptionsRepo.create).not.toHaveBeenCalled();
  expect(value.recurringEventExceptionsRepo.update).not.toHaveBeenCalled();
  expect(value.recurringEventExceptionsRepo.delete).not.toHaveBeenCalled();
  expect(value.recurringSeriesRepo.splitFuture).not.toHaveBeenCalled();
}

describe('event mutations', () => {
  it('creates an event under the record scope and rebases its temporary id', async () => {
    const value = harness();
    const mutation = {
      ...MUTATIONS.eventCreate,
      calendarId: CALENDAR_ID,
      input: {
        ...MUTATIONS.eventCreate.input,
        id: 'local-event-must-not-reach-the-repository',
        calendar_id: CALENDAR_ID,
      },
    } as unknown as EventMutation;

    await expect(value.execute(outboxRecord(mutation))).resolves.toEqual({
      status: 'done',
      rebase: { tempId: 'local-event-1', realId: NEW_EVENT_ID },
    });
    expect(value.eventRepo.create).toHaveBeenCalledWith(CALENDAR_ID, CREATE_EVENT_INPUT);
  });

  it('updates an event under the record scope', async () => {
    const value = harness();

    await expect(value.execute(outboxRecord(MUTATIONS.eventUpdate))).resolves.toEqual({
      status: 'done',
    });
    expect(value.eventRepo.update).toHaveBeenCalledWith(CALENDAR_ID, EVENT_ID, {
      name: 'Updated dinner',
    });
  });

  it('deletes an event under the record scope', async () => {
    const value = harness();

    await expect(value.execute(outboxRecord(MUTATIONS.eventDelete))).resolves.toEqual({
      status: 'done',
    });
    expect(value.eventRepo.delete).toHaveBeenCalledWith(CALENDAR_ID, EVENT_ID);
  });
});

describe('recurring exception mutations', () => {
  it('creates an exception under the record scope and rebases its temporary id', async () => {
    const value = harness();

    await expect(value.execute(outboxRecord(MUTATIONS.exceptionCreate))).resolves.toEqual({
      status: 'done',
      rebase: { tempId: 'local-exception-1', realId: NEW_EXCEPTION_ID },
    });
    expect(value.recurringEventExceptionsRepo.create).toHaveBeenCalledWith({
      ...MUTATIONS.exceptionCreate.input,
      calendarId: CALENDAR_ID,
    });
  });

  it('updates an exception under the record scope', async () => {
    const value = harness();

    await expect(value.execute(outboxRecord(MUTATIONS.exceptionUpdate))).resolves.toEqual({
      status: 'done',
    });
    expect(value.recurringEventExceptionsRepo.update).toHaveBeenCalledWith({
      ...MUTATIONS.exceptionUpdate.input,
      calendarId: CALENDAR_ID,
    });
  });

  it('deletes an exception under the record scope', async () => {
    const value = harness();

    await expect(value.execute(outboxRecord(MUTATIONS.exceptionDelete))).resolves.toEqual({
      status: 'done',
    });
    expect(value.recurringEventExceptionsRepo.delete).toHaveBeenCalledWith({
      ...MUTATIONS.exceptionDelete.input,
      calendarId: CALENDAR_ID,
    });
  });
});

describe('series mutations', () => {
  it('splits future occurrences and keeps scope fields out of the changes', async () => {
    const value = harness();
    const mutation = {
      ...MUTATIONS.splitFuture,
      input: {
        ...MUTATIONS.splitFuture.input,
        calendarId: CALENDAR_ID,
        changes: {
          ...MUTATIONS.splitFuture.input.changes,
          calendar_id: CALENDAR_ID,
        },
      },
    } as unknown as EventMutation;

    await expect(value.execute(outboxRecord(mutation))).resolves.toEqual({ status: 'done' });
    expect(value.recurringSeriesRepo.splitFuture).toHaveBeenCalledWith(
      MUTATIONS.splitFuture.input,
    );
  });
});

describe('scope and payload validation', () => {
  it.each([
    [
      'top-level calendarId',
      { ...MUTATIONS.eventDelete, calendarId: OTHER_CALENDAR_ID },
    ],
    [
      'top-level calendar_id',
      { ...MUTATIONS.eventDelete, calendar_id: OTHER_CALENDAR_ID },
    ],
    [
      'event create input',
      {
        ...MUTATIONS.eventCreate,
        input: { ...MUTATIONS.eventCreate.input, calendar_id: OTHER_CALENDAR_ID },
      },
    ],
    [
      'event update changes',
      {
        ...MUTATIONS.eventUpdate,
        changes: { ...MUTATIONS.eventUpdate.changes, calendarId: OTHER_CALENDAR_ID },
      },
    ],
    [
      'exception create input',
      {
        ...MUTATIONS.exceptionCreate,
        input: { ...MUTATIONS.exceptionCreate.input, calendarId: OTHER_CALENDAR_ID },
      },
    ],
    [
      'exception update input',
      {
        ...MUTATIONS.exceptionUpdate,
        input: { ...MUTATIONS.exceptionUpdate.input, calendar_id: OTHER_CALENDAR_ID },
      },
    ],
    [
      'exception delete input',
      {
        ...MUTATIONS.exceptionDelete,
        input: { ...MUTATIONS.exceptionDelete.input, calendarId: OTHER_CALENDAR_ID },
      },
    ],
    [
      'series input',
      {
        ...MUTATIONS.splitFuture,
        input: { ...MUTATIONS.splitFuture.input, calendarId: OTHER_CALENDAR_ID },
      },
    ],
    [
      'series changes',
      {
        ...MUTATIONS.splitFuture,
        input: {
          ...MUTATIONS.splitFuture.input,
          changes: {
            ...MUTATIONS.splitFuture.input.changes,
            calendar_id: OTHER_CALENDAR_ID,
          },
        },
      },
    ],
  ])('permanently rejects a conflicting %s before writing', async (_name, mutation) => {
    const value = harness();

    const outcome = await value.execute(outboxRecord(mutation));

    expect(outcome).toMatchObject({ status: 'drop' });
    expect((outcome as Extract<FlushOutcome, { status: 'drop' }>).reason).toContain(
      'scope mismatch',
    );
    expectNoMutationCalls(value);
  });

  it.each([
    [{ kind: 'event.create', input: CREATE_EVENT_INPUT }, 'tempId'],
    [{ kind: 'event.update', eventId: EVENT_ID, changes: null }, 'changes'],
    [{ kind: 'unknown' }, 'unsupported kind'],
  ])('drops malformed persisted payloads instead of retrying forever', async (mutation, reason) => {
    const value = harness();

    await expect(value.execute(outboxRecord(mutation))).resolves.toMatchObject({
      status: 'drop',
      reason: expect.stringContaining(reason),
    });
    expectNoMutationCalls(value);
  });

  it('rejects a non-events record before dispatching', async () => {
    const value = harness();
    const record = { ...outboxRecord(MUTATIONS.eventDelete), domain: 'todos' as const };

    await expect(value.execute(record as OutboxRecord<EventMutation>)).resolves.toMatchObject({
      status: 'drop',
      reason: expect.stringContaining('domain'),
    });
    expectNoMutationCalls(value);
  });
});

describe('failure classification', () => {
  it.each([
    ['invalid-input', 'bad input'],
    ['not-found', 'missing'],
    ['conflict', 'duplicate'],
    ['forbidden', 'denied'],
  ] as const)('drops permanent EventRepoError kind %s', async (kind, message) => {
    const value = harness();
    value.eventRepo.update.mockRejectedValue(new EventRepoError('update', kind, message));

    await expect(value.execute(outboxRecord(MUTATIONS.eventUpdate))).resolves.toEqual({
      status: 'drop',
      reason: message,
    });
  });

  it('retries unavailable and unknown EventRepo errors', async () => {
    const unavailable = harness();
    unavailable.eventRepo.delete.mockRejectedValue(
      new EventRepoError('delete', 'unavailable', 'service unavailable'),
    );
    await expect(unavailable.execute(outboxRecord(MUTATIONS.eventDelete))).resolves.toEqual({
      status: 'retry',
      reason: 'service unavailable',
    });

    const unknown = harness();
    unknown.eventRepo.delete.mockRejectedValue(
      new EventRepoError('delete', 'unknown', 'unexpected repository response'),
    );
    await expect(unknown.execute(outboxRecord(MUTATIONS.eventDelete))).resolves.toEqual({
      status: 'retry',
      reason: 'unexpected repository response',
    });
  });

  it.each([
    ['invalid_input', 'drop'],
    ['not_found', 'drop'],
    ['conflict', 'drop'],
    ['forbidden', 'drop'],
    ['unavailable', 'retry'],
    ['invalid_response', 'retry'],
    ['unknown', 'retry'],
  ] as const)('classifies RepositoryError code %s as %s', async (code, status) => {
    const value = harness();
    value.recurringEventExceptionsRepo.update.mockRejectedValue(
      new RepositoryError(code, 'recurring_event_exceptions.update'),
    );

    await expect(value.execute(outboxRecord(MUTATIONS.exceptionUpdate))).resolves.toMatchObject({
      status,
    });
  });

  it('uses backend codes to classify otherwise unknown repository errors', async () => {
    const permanent = harness();
    permanent.recurringSeriesRepo.splitFuture.mockRejectedValue(
      new RepositoryError('unknown', 'recurring_series.splitFuture', {
        backendCode: '23505',
        message: 'duplicate',
      }),
    );
    await expect(permanent.execute(outboxRecord(MUTATIONS.splitFuture))).resolves.toEqual({
      status: 'drop',
      reason: 'duplicate',
    });

    const transient = harness();
    transient.recurringSeriesRepo.splitFuture.mockRejectedValue(
      new RepositoryError('unknown', 'recurring_series.splitFuture', {
        backendCode: 'PGRST000',
        message: 'database unavailable',
      }),
    );
    await expect(transient.execute(outboxRecord(MUTATIONS.splitFuture))).resolves.toEqual({
      status: 'retry',
      reason: 'database unavailable',
    });
  });

  it.each([
    ['P0002', 'event not found'],
    ['PGRST204', 'unknown event field'],
  ])('drops permanent RPC/backend code %s', async (backendCode, message) => {
    const value = harness();
    value.recurringSeriesRepo.splitFuture.mockRejectedValue(
      new RepositoryError('unknown', 'recurring_series.splitFuture', {
        backendCode,
        message,
      }),
    );

    await expect(value.execute(outboxRecord(MUTATIONS.splitFuture))).resolves.toEqual({
      status: 'drop',
      reason: message,
    });
  });

  it.each([
    [422, 'drop'],
    [503, 'retry'],
  ] as const)('classifies HTTP status %i preserved as a repository cause', async (status, outcome) => {
    const value = harness();
    value.recurringEventExceptionsRepo.update.mockRejectedValue(
      new RepositoryError('unknown', 'recurring_event_exceptions.update', {
        cause: { status },
      }),
    );

    await expect(value.execute(outboxRecord(MUTATIONS.exceptionUpdate))).resolves.toMatchObject({
      status: outcome,
    });
  });

  it.each([
    [new TypeError('Failed to fetch'), 'retry'],
    [{ status: 429, message: 'rate limited' }, 'retry'],
    [{ status: 503, message: 'service unavailable' }, 'retry'],
    [{ status: 422, message: 'invalid request' }, 'drop'],
  ])('classifies transport and HTTP failures', async (error, status) => {
    const value = harness();
    value.eventRepo.delete.mockRejectedValue(error);

    await expect(value.execute(outboxRecord(MUTATIONS.eventDelete))).resolves.toMatchObject({
      status,
    });
  });

  it('rethrows unknown programming errors for the core outbox retry boundary', async () => {
    const value = harness();
    const error = new TypeError('Cannot read properties of undefined');
    value.eventRepo.delete.mockRejectedValue(error);

    await expect(value.execute(outboxRecord(MUTATIONS.eventDelete))).rejects.toBe(error);
  });

  it('rethrows an out-of-scope repository response instead of accepting it', async () => {
    const value = harness();
    value.eventRepo.create.mockResolvedValue({
      ...EVENT,
      id: NEW_EVENT_ID,
      calendar_id: OTHER_CALENDAR_ID,
    });

    await expect(value.execute(outboxRecord(MUTATIONS.eventCreate))).rejects.toThrow(
      'outside the requested scope',
    );
  });
});
