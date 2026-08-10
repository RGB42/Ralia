import { describe, expect, it, vi } from 'vitest';
import type { RaliaSupabaseClient } from '../client.js';
import type { RecurringEventExceptionsRow } from '../database.types.js';
import {
  createRecurringEventExceptionsRepo,
  createSupabaseRecurringEventExceptionsRepo,
  type RecurringEventExceptionsGateway,
} from './recurring-event-exceptions-repo.js';

const CALENDAR_ID = '11111111-1111-4111-8111-111111111111';
const MASTER_ID = '22222222-2222-4222-8222-222222222222';
const OTHER_MASTER_ID = '33333333-3333-4333-8333-333333333333';
const EXCEPTION_ID = '44444444-4444-4444-8444-444444444444';
const USER_ID = '55555555-5555-4555-8555-555555555555';
const NOW = '2026-08-10T12:00:00.000Z';

const OVERRIDE = {
  name: 'Verschobenes Abendessen',
  nested: { start_time: '20:00:00' },
  reminders: [30, 60],
};

const EXCEPTION: RecurringEventExceptionsRow = {
  calendar_id: CALENDAR_ID,
  created_at: '2026-08-10T08:00:00.000Z',
  created_by: USER_ID,
  id: EXCEPTION_ID,
  is_deleted: false,
  master_event_id: MASTER_ID,
  original_occurrence_date: '2026-08-14',
  override_event_data: OVERRIDE,
  updated_at: NOW,
};

function gateway(
  overrides: Partial<RecurringEventExceptionsGateway> = {},
): RecurringEventExceptionsGateway {
  return {
    listByCalendar: vi.fn().mockResolvedValue({ data: [EXCEPTION], error: null }),
    insert: vi.fn().mockResolvedValue({ data: EXCEPTION, error: null }),
    update: vi.fn().mockResolvedValue({ data: EXCEPTION, error: null }),
    delete: vi.fn().mockResolvedValue({
      data: { calendar_id: CALENDAR_ID, master_event_id: MASTER_ID, id: EXCEPTION_ID },
      error: null,
    }),
    ...overrides,
  };
}

describe('recurring event exceptions list', () => {
  it('lists within one calendar and normalizes an optional master filter', async () => {
    const later = {
      ...EXCEPTION,
      id: '66666666-6666-4666-8666-666666666666',
      original_occurrence_date: '2026-08-21',
    };
    const source = [later, EXCEPTION];
    const gw = gateway({
      listByCalendar: vi.fn().mockResolvedValue({ data: source, error: null }),
    });

    const rows = await createRecurringEventExceptionsRepo(gw).list(` ${CALENDAR_ID} `, [
      ` ${MASTER_ID} `,
      MASTER_ID,
    ]);

    expect(gw.listByCalendar).toHaveBeenCalledWith(CALENDAR_ID, [MASTER_ID]);
    expect(rows.map((row) => row.id)).toEqual([EXCEPTION_ID, later.id]);
    expect(source).toEqual([later, EXCEPTION]);
  });

  it('lists every master in a calendar when no master filter is supplied', async () => {
    const second = { ...EXCEPTION, id: 'other-id', master_event_id: OTHER_MASTER_ID };
    const gw = gateway({
      listByCalendar: vi.fn().mockResolvedValue({ data: [second, EXCEPTION], error: null }),
    });

    await expect(createRecurringEventExceptionsRepo(gw).list(CALENDAR_ID)).resolves.toHaveLength(2);

    expect(gw.listByCalendar).toHaveBeenCalledWith(CALENDAR_ID);
  });

  it('returns early for an explicitly empty master filter', async () => {
    const gw = gateway();

    await expect(createRecurringEventExceptionsRepo(gw).list(CALENDAR_ID, [])).resolves.toEqual([]);

    expect(gw.listByCalendar).not.toHaveBeenCalled();
  });

  it.each([
    ['empty calendar', '', undefined],
    ['empty master id', CALENDAR_ID, ['']],
    ['non-array master ids', CALENDAR_ID, 'not-an-array'],
  ])('rejects %s before reading', async (_label, calendarId, masterIds) => {
    const gw = gateway();

    await expect(
      createRecurringEventExceptionsRepo(gw).list(
        calendarId,
        masterIds as unknown as readonly string[] | undefined,
      ),
    ).rejects.toMatchObject({
      code: 'invalid_input',
      operation: 'recurring_event_exceptions.list',
    });
    expect(gw.listByCalendar).not.toHaveBeenCalled();
  });

  it.each([
    ['another calendar', { ...EXCEPTION, calendar_id: 'other-calendar' }],
    ['another filtered master', { ...EXCEPTION, master_event_id: OTHER_MASTER_ID }],
    ['invalid occurrence date', { ...EXCEPTION, original_occurrence_date: '2026-02-30' }],
    ['array override', { ...EXCEPTION, override_event_data: [] }],
    ['deleted row with override', { ...EXCEPTION, is_deleted: true }],
    ['override row without data', { ...EXCEPTION, override_event_data: null }],
    ['invalid timestamp', { ...EXCEPTION, updated_at: 'not-a-date' }],
  ])('rejects an invalid gateway response: %s', async (_label, row) => {
    const gw = gateway({
      listByCalendar: vi.fn().mockResolvedValue({ data: [row], error: null }),
    });

    await expect(
      createRecurringEventExceptionsRepo(gw).list(CALENDAR_ID, [MASTER_ID]),
    ).rejects.toMatchObject({
      code: 'invalid_response',
      operation: 'recurring_event_exceptions.list',
    });
  });

  it('normalizes gateway errors through RepositoryError', async () => {
    const gw = gateway({
      listByCalendar: vi.fn().mockResolvedValue({
        data: null,
        error: { code: '42501', message: 'permission denied' },
      }),
    });

    await expect(createRecurringEventExceptionsRepo(gw).list(CALENDAR_ID)).rejects.toMatchObject({
      code: 'forbidden',
      backendCode: '42501',
      operation: 'recurring_event_exceptions.list',
    });
  });
});

describe('recurring event exceptions create', () => {
  it('creates a deleted occurrence with both scope columns and no override', async () => {
    const deleted = { ...EXCEPTION, is_deleted: true, override_event_data: null };
    const gw = gateway({ insert: vi.fn().mockResolvedValue({ data: deleted, error: null }) });

    await createRecurringEventExceptionsRepo(gw).create({
      calendarId: ` ${CALENDAR_ID} `,
      masterEventId: ` ${MASTER_ID} `,
      createdBy: ` ${USER_ID} `,
      originalOccurrenceDate: '2026-08-14',
      isDeleted: true,
    });

    expect(gw.insert).toHaveBeenCalledWith({
      calendar_id: CALENDAR_ID,
      master_event_id: MASTER_ID,
      created_by: USER_ID,
      original_occurrence_date: '2026-08-14',
      is_deleted: true,
      override_event_data: null,
    });
  });

  it('creates an override occurrence with a validated JSON object', async () => {
    const gw = gateway();

    await createRecurringEventExceptionsRepo(gw).create({
      calendarId: CALENDAR_ID,
      masterEventId: MASTER_ID,
      createdBy: USER_ID,
      originalOccurrenceDate: '2026-08-14',
      isDeleted: false,
      overrideEventData: OVERRIDE,
    });

    expect(gw.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        is_deleted: false,
        override_event_data: OVERRIDE,
      }),
    );
  });

  it.each([
    ['invalid date', { originalOccurrenceDate: '2026-02-30' }],
    ['array override', { overrideEventData: [] }],
    ['primitive override', { overrideEventData: 'name' }],
    ['non-finite JSON number', { overrideEventData: { offset: Number.NaN } }],
    ['deleted exception with override', { isDeleted: true, overrideEventData: OVERRIDE }],
  ])('rejects %s before inserting', async (_label, changes) => {
    const gw = gateway();
    const input = {
      calendarId: CALENDAR_ID,
      masterEventId: MASTER_ID,
      createdBy: USER_ID,
      originalOccurrenceDate: '2026-08-14',
      isDeleted: false,
      overrideEventData: OVERRIDE,
      ...changes,
    };

    await expect(
      createRecurringEventExceptionsRepo(gw).create(
        input as Parameters<ReturnType<typeof createRecurringEventExceptionsRepo>['create']>[0],
      ),
    ).rejects.toMatchObject({ code: 'invalid_input' });
    expect(gw.insert).not.toHaveBeenCalled();
  });

  it('rejects cyclic override data before inserting', async () => {
    const gw = gateway();
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;

    await expect(
      createRecurringEventExceptionsRepo(gw).create({
        calendarId: CALENDAR_ID,
        masterEventId: MASTER_ID,
        createdBy: USER_ID,
        originalOccurrenceDate: '2026-08-14',
        isDeleted: false,
        overrideEventData: cyclic as never,
      }),
    ).rejects.toMatchObject({ code: 'invalid_input' });
    expect(gw.insert).not.toHaveBeenCalled();
  });

  it('rejects a successful response for another scope', async () => {
    const gw = gateway({
      insert: vi.fn().mockResolvedValue({
        data: { ...EXCEPTION, master_event_id: OTHER_MASTER_ID },
        error: null,
      }),
    });

    await expect(
      createRecurringEventExceptionsRepo(gw).create({
        calendarId: CALENDAR_ID,
        masterEventId: MASTER_ID,
        createdBy: USER_ID,
        originalOccurrenceDate: '2026-08-14',
        isDeleted: false,
        overrideEventData: OVERRIDE,
      }),
    ).rejects.toMatchObject({ code: 'invalid_response' });
  });

  it('normalizes unique conflicts', async () => {
    const gw = gateway({
      insert: vi.fn().mockResolvedValue({ data: null, error: { code: '23505' } }),
    });

    await expect(
      createRecurringEventExceptionsRepo(gw).create({
        calendarId: CALENDAR_ID,
        masterEventId: MASTER_ID,
        createdBy: USER_ID,
        originalOccurrenceDate: '2026-08-14',
        isDeleted: false,
        overrideEventData: OVERRIDE,
      }),
    ).rejects.toMatchObject({ code: 'conflict', backendCode: '23505' });
  });
});

describe('recurring event exceptions update', () => {
  it('updates by calendar, master and id and refreshes updated_at', async () => {
    const updated = {
      ...EXCEPTION,
      original_occurrence_date: '2026-08-15',
      override_event_data: { name: 'Neu' },
    };
    const gw = gateway({ update: vi.fn().mockResolvedValue({ data: updated, error: null }) });

    await createRecurringEventExceptionsRepo(gw, () => NOW).update({
      calendarId: CALENDAR_ID,
      masterEventId: MASTER_ID,
      id: EXCEPTION_ID,
      originalOccurrenceDate: '2026-08-15',
      overrideEventData: { name: 'Neu' },
    });

    expect(gw.update).toHaveBeenCalledWith(CALENDAR_ID, MASTER_ID, EXCEPTION_ID, {
      original_occurrence_date: '2026-08-15',
      is_deleted: false,
      override_event_data: { name: 'Neu' },
      updated_at: NOW,
    });
  });

  it('changes an override to a deleted exception atomically', async () => {
    const deleted = { ...EXCEPTION, is_deleted: true, override_event_data: null };
    const gw = gateway({ update: vi.fn().mockResolvedValue({ data: deleted, error: null }) });

    await createRecurringEventExceptionsRepo(gw, () => NOW).update({
      calendarId: CALENDAR_ID,
      masterEventId: MASTER_ID,
      id: EXCEPTION_ID,
      isDeleted: true,
    });

    expect(gw.update).toHaveBeenCalledWith(CALENDAR_ID, MASTER_ID, EXCEPTION_ID, {
      is_deleted: true,
      override_event_data: null,
      updated_at: NOW,
    });
  });

  it.each([
    ['empty changes', {}],
    ['invalid date', { originalOccurrenceDate: '2025-02-29' }],
    ['override state without data', { isDeleted: false }],
    ['null override without deleted state', { overrideEventData: null }],
    ['deleted state with override', { isDeleted: true, overrideEventData: OVERRIDE }],
    ['array override', { overrideEventData: [] }],
  ])('rejects %s before updating', async (_label, changes) => {
    const gw = gateway();

    await expect(
      createRecurringEventExceptionsRepo(gw).update({
        calendarId: CALENDAR_ID,
        masterEventId: MASTER_ID,
        id: EXCEPTION_ID,
        ...changes,
      } as Parameters<ReturnType<typeof createRecurringEventExceptionsRepo>['update']>[0]),
    ).rejects.toMatchObject({ code: 'invalid_input' });
    expect(gw.update).not.toHaveBeenCalled();
  });

  it('reports a scoped row that does not exist', async () => {
    const gw = gateway({ update: vi.fn().mockResolvedValue({ data: null, error: null }) });

    await expect(
      createRecurringEventExceptionsRepo(gw).update({
        calendarId: CALENDAR_ID,
        masterEventId: MASTER_ID,
        id: EXCEPTION_ID,
        originalOccurrenceDate: '2026-08-15',
      }),
    ).rejects.toMatchObject({
      code: 'not_found',
      operation: 'recurring_event_exceptions.update',
    });
  });

  it('rejects a response that did not apply the requested values', async () => {
    const gw = gateway();

    await expect(
      createRecurringEventExceptionsRepo(gw).update({
        calendarId: CALENDAR_ID,
        masterEventId: MASTER_ID,
        id: EXCEPTION_ID,
        originalOccurrenceDate: '2026-08-15',
      }),
    ).rejects.toMatchObject({ code: 'invalid_response' });
  });
});

describe('recurring event exceptions delete', () => {
  it('deletes only by calendar, master and exception id', async () => {
    const gw = gateway();

    await createRecurringEventExceptionsRepo(gw).delete({
      calendarId: ` ${CALENDAR_ID} `,
      masterEventId: ` ${MASTER_ID} `,
      id: ` ${EXCEPTION_ID} `,
    });

    expect(gw.delete).toHaveBeenCalledWith(CALENDAR_ID, MASTER_ID, EXCEPTION_ID);
  });

  it('reports a missing scoped row', async () => {
    const gw = gateway({ delete: vi.fn().mockResolvedValue({ data: null, error: null }) });

    await expect(
      createRecurringEventExceptionsRepo(gw).delete({
        calendarId: CALENDAR_ID,
        masterEventId: MASTER_ID,
        id: EXCEPTION_ID,
      }),
    ).rejects.toMatchObject({ code: 'not_found' });
  });

  it('rejects an identity response from another master', async () => {
    const gw = gateway({
      delete: vi.fn().mockResolvedValue({
        data: { calendar_id: CALENDAR_ID, master_event_id: OTHER_MASTER_ID, id: EXCEPTION_ID },
        error: null,
      }),
    });

    await expect(
      createRecurringEventExceptionsRepo(gw).delete({
        calendarId: CALENDAR_ID,
        masterEventId: MASTER_ID,
        id: EXCEPTION_ID,
      }),
    ).rejects.toMatchObject({ code: 'invalid_response' });
  });
});

describe('Supabase recurring event exceptions adapter', () => {
  it('lists by calendar and optional master ids with deterministic ordering', async () => {
    const thirdOrder = vi.fn().mockResolvedValue({ data: [EXCEPTION], error: null });
    const secondOrder = vi.fn().mockReturnValue({ order: thirdOrder });
    const firstOrder = vi.fn().mockReturnValue({ order: secondOrder });
    const inFilter = vi.fn().mockReturnValue({ order: firstOrder });
    const eq = vi.fn().mockReturnValue({ in: inFilter, order: firstOrder });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });
    const client = { from } as unknown as RaliaSupabaseClient;

    await createSupabaseRecurringEventExceptionsRepo(client).list(CALENDAR_ID, [MASTER_ID]);

    expect(from).toHaveBeenCalledWith('recurring_event_exceptions');
    expect(select).toHaveBeenCalledWith('*');
    expect(eq).toHaveBeenCalledWith('calendar_id', CALENDAR_ID);
    expect(inFilter).toHaveBeenCalledWith('master_event_id', [MASTER_ID]);
    expect(firstOrder).toHaveBeenCalledWith('master_event_id');
    expect(secondOrder).toHaveBeenCalledWith('original_occurrence_date');
    expect(thirdOrder).toHaveBeenCalledWith('id');
  });

  it('inserts and returns the created row', async () => {
    const single = vi.fn().mockResolvedValue({ data: EXCEPTION, error: null });
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });
    const from = vi.fn().mockReturnValue({ insert });
    const client = { from } as unknown as RaliaSupabaseClient;

    await createSupabaseRecurringEventExceptionsRepo(client).create({
      calendarId: CALENDAR_ID,
      masterEventId: MASTER_ID,
      createdBy: USER_ID,
      originalOccurrenceDate: '2026-08-14',
      isDeleted: false,
      overrideEventData: OVERRIDE,
    });

    expect(from).toHaveBeenCalledWith('recurring_event_exceptions');
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        calendar_id: CALENDAR_ID,
        master_event_id: MASTER_ID,
      }),
    );
    expect(select).toHaveBeenCalledWith('*');
    expect(single).toHaveBeenCalledOnce();
  });

  it('updates with calendar, master and exception filters', async () => {
    const updated = { ...EXCEPTION, override_event_data: { name: 'Neu' } };
    const maybeSingle = vi.fn().mockResolvedValue({ data: updated, error: null });
    const select = vi.fn().mockReturnValue({ maybeSingle });
    const idEq = vi.fn().mockReturnValue({ select });
    const masterEq = vi.fn().mockReturnValue({ eq: idEq });
    const calendarEq = vi.fn().mockReturnValue({ eq: masterEq });
    const update = vi.fn().mockReturnValue({ eq: calendarEq });
    const from = vi.fn().mockReturnValue({ update });
    const client = { from } as unknown as RaliaSupabaseClient;

    await createSupabaseRecurringEventExceptionsRepo(client).update({
      calendarId: CALENDAR_ID,
      masterEventId: MASTER_ID,
      id: EXCEPTION_ID,
      overrideEventData: { name: 'Neu' },
    });

    expect(calendarEq).toHaveBeenCalledWith('calendar_id', CALENDAR_ID);
    expect(masterEq).toHaveBeenCalledWith('master_event_id', MASTER_ID);
    expect(idEq).toHaveBeenCalledWith('id', EXCEPTION_ID);
    expect(select).toHaveBeenCalledWith('*');
    expect(maybeSingle).toHaveBeenCalledOnce();
  });

  it('deletes with calendar, master and exception filters', async () => {
    const identity = {
      calendar_id: CALENDAR_ID,
      master_event_id: MASTER_ID,
      id: EXCEPTION_ID,
    };
    const maybeSingle = vi.fn().mockResolvedValue({ data: identity, error: null });
    const select = vi.fn().mockReturnValue({ maybeSingle });
    const idEq = vi.fn().mockReturnValue({ select });
    const masterEq = vi.fn().mockReturnValue({ eq: idEq });
    const calendarEq = vi.fn().mockReturnValue({ eq: masterEq });
    const remove = vi.fn().mockReturnValue({ eq: calendarEq });
    const from = vi.fn().mockReturnValue({ delete: remove });
    const client = { from } as unknown as RaliaSupabaseClient;

    await createSupabaseRecurringEventExceptionsRepo(client).delete({
      calendarId: CALENDAR_ID,
      masterEventId: MASTER_ID,
      id: EXCEPTION_ID,
    });

    expect(calendarEq).toHaveBeenCalledWith('calendar_id', CALENDAR_ID);
    expect(masterEq).toHaveBeenCalledWith('master_event_id', MASTER_ID);
    expect(idEq).toHaveBeenCalledWith('id', EXCEPTION_ID);
    expect(select).toHaveBeenCalledWith('calendar_id, master_event_id, id');
    expect(maybeSingle).toHaveBeenCalledOnce();
  });
});
