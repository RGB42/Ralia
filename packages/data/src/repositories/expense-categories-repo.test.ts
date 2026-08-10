import { describe, expect, it, vi } from 'vitest';
import type { ExpenseCategoriesRow } from '../database.types.js';
import {
  createExpenseCategoriesRepo,
  type ExpenseCategoriesGateway,
} from './expense-categories-repo.js';

const CALENDAR_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '22222222-2222-4222-8222-222222222222';
const CATEGORY_ID = '33333333-3333-4333-8333-333333333333';
const NOW = '2026-08-10T12:00:00.000Z';

const CATEGORY: ExpenseCategoriesRow = {
  calendar_id: CALENDAR_ID,
  color: '#AABBCC',
  created_at: '2026-08-10T08:00:00.000Z',
  created_by: USER_ID,
  id: CATEGORY_ID,
  monthly_limit: 250.5,
  name: 'Lebensmittel',
  sort_order: 1,
  updated_at: '2026-08-10T08:00:00.000Z',
};

function gateway(overrides: Partial<ExpenseCategoriesGateway> = {}): ExpenseCategoriesGateway {
  return {
    listByCalendar: vi.fn().mockResolvedValue({ data: [CATEGORY], error: null }),
    insert: vi.fn().mockResolvedValue({ data: CATEGORY, error: null }),
    update: vi.fn().mockResolvedValue({ data: CATEGORY, error: null }),
    delete: vi.fn().mockResolvedValue({ data: { id: CATEGORY_ID }, error: null }),
    ...overrides,
  };
}

describe('expense categories list', () => {
  it('uses only the calendar-scoped gateway and sorts without mutating gateway data', async () => {
    const later = { ...CATEGORY, id: '44444444-4444-4444-8444-444444444444', sort_order: 2 };
    const first = { ...CATEGORY, id: '55555555-5555-4555-8555-555555555555', name: 'Auto' };
    const source = [later, first];
    const gw = gateway({
      listByCalendar: vi.fn().mockResolvedValue({ data: source, error: null }),
    });

    const rows = await createExpenseCategoriesRepo(gw).list(` ${CALENDAR_ID} `);

    expect(gw.listByCalendar).toHaveBeenCalledWith(CALENDAR_ID);
    expect(rows.map((row) => row.id)).toEqual([first.id, later.id]);
    expect(source).toEqual([later, first]);
  });

  it('rejects a row leaking from another calendar', async () => {
    const gw = gateway({
      listByCalendar: vi.fn().mockResolvedValue({
        data: [{ ...CATEGORY, calendar_id: 'other-calendar' }],
        error: null,
      }),
    });

    await expect(createExpenseCategoriesRepo(gw).list(CALENDAR_ID)).rejects.toMatchObject({
      code: 'invalid_response',
      operation: 'expense_categories.list',
    });
  });
});

describe('expense categories mutations', () => {
  it('normalizes category values and validates monthly limits in cents', async () => {
    const gw = gateway();

    await createExpenseCategoriesRepo(gw).create({
      calendarId: ` ${CALENDAR_ID} `,
      color: ' #a1B2c3 ',
      createdBy: USER_ID,
      monthlyLimit: '250,50',
      name: ' Lebensmittel ',
      sortOrder: 3,
    });

    expect(gw.insert).toHaveBeenCalledWith({
      calendar_id: CALENDAR_ID,
      color: '#a1B2c3',
      created_by: USER_ID,
      monthly_limit: 250.5,
      name: 'Lebensmittel',
      sort_order: 3,
    });
  });

  it('updates only by calendar and id and refreshes updated_at', async () => {
    const gw = gateway();

    await createExpenseCategoriesRepo(gw, () => NOW).update({
      calendarId: CALENDAR_ID,
      id: CATEGORY_ID,
      monthlyLimit: null,
      sortOrder: 4,
    });

    expect(gw.update).toHaveBeenCalledWith(CALENDAR_ID, CATEGORY_ID, {
      monthly_limit: null,
      sort_order: 4,
      updated_at: NOW,
    });
  });

  it.each([{ monthlyLimit: '1.234' }, { monthlyLimit: '-1' }, { color: 'red' }, { sortOrder: -1 }])(
    'rejects invalid changes before writing',
    async (changes) => {
      const gw = gateway();

      await expect(
        createExpenseCategoriesRepo(gw).update({
          calendarId: CALENDAR_ID,
          id: CATEGORY_ID,
          ...changes,
        }),
      ).rejects.toMatchObject({ code: 'invalid_input' });
      expect(gw.update).not.toHaveBeenCalled();
    },
  );

  it('deletes only by calendar and id and reports a missing row', async () => {
    const gw = gateway({ delete: vi.fn().mockResolvedValue({ data: null, error: null }) });

    await expect(
      createExpenseCategoriesRepo(gw).delete({ calendarId: CALENDAR_ID, id: CATEGORY_ID }),
    ).rejects.toMatchObject({ code: 'not_found' });
    expect(gw.delete).toHaveBeenCalledWith(CALENDAR_ID, CATEGORY_ID);
  });

  it('normalizes database conflicts', async () => {
    const gw = gateway({
      insert: vi.fn().mockResolvedValue({ data: null, error: { code: '23505' } }),
    });

    await expect(
      createExpenseCategoriesRepo(gw).create({
        calendarId: CALENDAR_ID,
        createdBy: USER_ID,
        name: CATEGORY.name,
      }),
    ).rejects.toMatchObject({ code: 'conflict', backendCode: '23505' });
  });
});
