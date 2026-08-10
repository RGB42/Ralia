import { describe, expect, it, vi } from 'vitest';
import type { ExpenseSettlementsRow } from '../database.types.js';
import {
  createExpenseSettlementsRepo,
  type ExpenseSettlementsGateway,
} from './expense-settlements-repo.js';

const CALENDAR_ID = '11111111-1111-4111-8111-111111111111';
const FROM_USER_ID = '22222222-2222-4222-8222-222222222222';
const TO_USER_ID = '33333333-3333-4333-8333-333333333333';
const SETTLEMENT_ID = '44444444-4444-4444-8444-444444444444';

const SETTLEMENT: ExpenseSettlementsRow = {
  amount: 50.75,
  calendar_id: CALENDAR_ID,
  created_at: '2026-08-10T08:00:00.000Z',
  created_by: FROM_USER_ID,
  from_user_id: FROM_USER_ID,
  id: SETTLEMENT_ID,
  notes: 'August-Ausgleich',
  settled_at: '2026-08-10',
  to_user_id: TO_USER_ID,
};

function gateway(overrides: Partial<ExpenseSettlementsGateway> = {}): ExpenseSettlementsGateway {
  return {
    listByCalendarAndDateRange: vi.fn().mockResolvedValue({ data: [SETTLEMENT], error: null }),
    insert: vi.fn().mockResolvedValue({ data: SETTLEMENT, error: null }),
    delete: vi.fn().mockResolvedValue({ data: { id: SETTLEMENT_ID }, error: null }),
    ...overrides,
  };
}

describe('expense settlements list', () => {
  it('requires both calendar and an inclusive date range', async () => {
    const gw = gateway();

    await expect(
      createExpenseSettlementsRepo(gw).list(CALENDAR_ID, {
        startDate: '2026-08-01',
        endDate: '2026-08-31',
      }),
    ).resolves.toEqual([SETTLEMENT]);
    expect(gw.listByCalendarAndDateRange).toHaveBeenCalledWith(
      CALENDAR_ID,
      '2026-08-01',
      '2026-08-31',
    );
  });

  it.each([
    ['', '2026-08-01', '2026-08-31'],
    [CALENDAR_ID, '2026-02-30', '2026-08-31'],
    [CALENDAR_ID, '2026-09-01', '2026-08-31'],
  ])('rejects invalid scope before querying', async (calendarId, startDate, endDate) => {
    const gw = gateway();

    await expect(
      createExpenseSettlementsRepo(gw).list(calendarId, { startDate, endDate }),
    ).rejects.toMatchObject({ code: 'invalid_input' });
    expect(gw.listByCalendarAndDateRange).not.toHaveBeenCalled();
  });

  it('rejects rows outside the requested calendar or date range', async () => {
    const gw = gateway({
      listByCalendarAndDateRange: vi.fn().mockResolvedValue({
        data: [{ ...SETTLEMENT, settled_at: '2026-07-31' }],
        error: null,
      }),
    });

    await expect(
      createExpenseSettlementsRepo(gw).list(CALENDAR_ID, {
        startDate: '2026-08-01',
        endDate: '2026-08-31',
      }),
    ).rejects.toMatchObject({ code: 'invalid_response' });
  });
});

describe('expense settlement mutations', () => {
  it('creates a dated calendar settlement with a positive exact amount', async () => {
    const gw = gateway();

    await createExpenseSettlementsRepo(gw).create({
      amount: '50,75',
      calendarId: CALENDAR_ID,
      createdBy: FROM_USER_ID,
      fromUserId: FROM_USER_ID,
      notes: ' August-Ausgleich ',
      settledAt: '2026-08-10',
      toUserId: TO_USER_ID,
    });

    expect(gw.insert).toHaveBeenCalledWith({
      amount: 50.75,
      calendar_id: CALENDAR_ID,
      created_by: FROM_USER_ID,
      from_user_id: FROM_USER_ID,
      notes: 'August-Ausgleich',
      settled_at: '2026-08-10',
      to_user_id: TO_USER_ID,
    });
  });

  it.each([
    { amount: '0', fromUserId: FROM_USER_ID, settledAt: '2026-08-10', toUserId: TO_USER_ID },
    { amount: '1.001', fromUserId: FROM_USER_ID, settledAt: '2026-08-10', toUserId: TO_USER_ID },
    { amount: '1', fromUserId: FROM_USER_ID, settledAt: '2026-02-30', toUserId: TO_USER_ID },
    { amount: '1', fromUserId: FROM_USER_ID, settledAt: '2026-08-10', toUserId: FROM_USER_ID },
  ])('rejects invalid settlement data before writing', async (values) => {
    const gw = gateway();

    await expect(
      createExpenseSettlementsRepo(gw).create({
        calendarId: CALENDAR_ID,
        createdBy: FROM_USER_ID,
        ...values,
      }),
    ).rejects.toMatchObject({ code: 'invalid_input' });
    expect(gw.insert).not.toHaveBeenCalled();
  });

  it('deletes by calendar, settlement date and id', async () => {
    const gw = gateway();

    await createExpenseSettlementsRepo(gw).delete({
      calendarId: CALENDAR_ID,
      id: SETTLEMENT_ID,
      settledAt: SETTLEMENT.settled_at,
    });

    expect(gw.delete).toHaveBeenCalledWith(CALENDAR_ID, SETTLEMENT.settled_at, SETTLEMENT_ID);
  });

  it('normalizes a thrown transport error', async () => {
    const gw = gateway({
      listByCalendarAndDateRange: vi.fn().mockRejectedValue(new TypeError('Failed to fetch')),
    });

    await expect(
      createExpenseSettlementsRepo(gw).list(CALENDAR_ID, {
        startDate: '2026-08-01',
        endDate: '2026-08-31',
      }),
    ).rejects.toMatchObject({ code: 'unavailable' });
  });
});
