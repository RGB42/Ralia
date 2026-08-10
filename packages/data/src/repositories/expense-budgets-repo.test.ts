import { describe, expect, it, vi } from 'vitest';
import type { ExpenseBudgetsRow } from '../database.types.js';
import { createExpenseBudgetsRepo, type ExpenseBudgetsGateway } from './expense-budgets-repo.js';

const CALENDAR_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '22222222-2222-4222-8222-222222222222';
const BUDGET_ID = '33333333-3333-4333-8333-333333333333';
const NOW = '2026-08-10T12:00:00.000Z';

const BUDGET: ExpenseBudgetsRow = {
  amount: 900,
  calendar_id: CALENDAR_ID,
  created_at: '2026-08-10T08:00:00.000Z',
  created_by: USER_ID,
  id: BUDGET_ID,
  month_start: '2026-08-01',
  updated_at: '2026-08-10T08:00:00.000Z',
};

function gateway(overrides: Partial<ExpenseBudgetsGateway> = {}): ExpenseBudgetsGateway {
  return {
    listByCalendar: vi.fn().mockResolvedValue({ data: [BUDGET], error: null }),
    insert: vi.fn().mockResolvedValue({ data: BUDGET, error: null }),
    update: vi.fn().mockResolvedValue({ data: BUDGET, error: null }),
    delete: vi.fn().mockResolvedValue({ data: { id: BUDGET_ID }, error: null }),
    ...overrides,
  };
}

describe('expense budgets', () => {
  it('lists calendar budgets newest first and rejects cross-calendar rows', async () => {
    const older = {
      ...BUDGET,
      id: '44444444-4444-4444-8444-444444444444',
      month_start: '2026-07-01',
    };
    const gw = gateway({
      listByCalendar: vi.fn().mockResolvedValue({ data: [older, BUDGET], error: null }),
    });

    const rows = await createExpenseBudgetsRepo(gw).list(CALENDAR_ID);

    expect(gw.listByCalendar).toHaveBeenCalledWith(CALENDAR_ID);
    expect(rows.map((row) => row.month_start)).toEqual(['2026-08-01', '2026-07-01']);

    const leaking = gateway({
      listByCalendar: vi.fn().mockResolvedValue({
        data: [{ ...BUDGET, calendar_id: 'other-calendar' }],
        error: null,
      }),
    });
    await expect(createExpenseBudgetsRepo(leaking).list(CALENDAR_ID)).rejects.toMatchObject({
      code: 'invalid_response',
    });
  });

  it('creates a calendar-bound monthly budget with exact cent normalization', async () => {
    const gw = gateway();

    await createExpenseBudgetsRepo(gw).create({
      amount: '900,50',
      calendarId: CALENDAR_ID,
      createdBy: USER_ID,
      monthStart: '2026-08-01',
    });

    expect(gw.insert).toHaveBeenCalledWith({
      amount: 900.5,
      calendar_id: CALENDAR_ID,
      created_by: USER_ID,
      month_start: '2026-08-01',
    });
  });

  it.each([
    ['2026-02-30', '100'],
    ['2026-08-02', '100'],
    ['2026-08-01', '100.001'],
    ['2026-08-01', '-1'],
  ])('rejects invalid month %s or amount %s before creating', async (monthStart, amount) => {
    const gw = gateway();

    await expect(
      createExpenseBudgetsRepo(gw).create({
        amount,
        calendarId: CALENDAR_ID,
        createdBy: USER_ID,
        monthStart,
      }),
    ).rejects.toMatchObject({ code: 'invalid_input' });
    expect(gw.insert).not.toHaveBeenCalled();
  });

  it('updates only editable values within the calendar and refreshes updated_at', async () => {
    const gw = gateway();

    await createExpenseBudgetsRepo(gw, () => NOW).update({
      amount: '1000.25',
      calendarId: CALENDAR_ID,
      id: BUDGET_ID,
    });

    expect(gw.update).toHaveBeenCalledWith(CALENDAR_ID, BUDGET_ID, {
      amount: 1000.25,
      updated_at: NOW,
    });
  });

  it('rejects an empty update and scopes deletion to calendar plus id', async () => {
    const gw = gateway();
    const repo = createExpenseBudgetsRepo(gw);

    await expect(repo.update({ calendarId: CALENDAR_ID, id: BUDGET_ID })).rejects.toMatchObject({
      code: 'invalid_input',
    });
    await repo.delete({ calendarId: CALENDAR_ID, id: BUDGET_ID });

    expect(gw.update).not.toHaveBeenCalled();
    expect(gw.delete).toHaveBeenCalledWith(CALENDAR_ID, BUDGET_ID);
  });
});
