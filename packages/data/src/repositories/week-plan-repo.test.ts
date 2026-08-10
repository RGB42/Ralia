import { describe, expect, it, vi } from 'vitest';
import type { WeekPlansRow } from '../database.types.js';
import { createWeekPlanRepo, type WeekPlanGateway } from './week-plan-repo.js';

const CALENDAR_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '22222222-2222-4222-8222-222222222222';
const ENTRY_ID = '33333333-3333-4333-8333-333333333333';
const WEEK_START = '2026-08-10';

const ENTRY: WeekPlansRow = {
  assigned_to: 'both',
  calendar_id: CALENDAR_ID,
  completed_at: null,
  created_at: '2026-08-10T08:00:00Z',
  created_by: USER_ID,
  day_of_week: 0,
  entry_type: 'meal',
  id: ENTRY_ID,
  is_done: false,
  notes: null,
  sort_order: 0,
  title: 'Pasta',
  updated_at: '2026-08-10T08:00:00Z',
  week_start: WEEK_START,
};

function gateway(overrides: Partial<WeekPlanGateway> = {}): WeekPlanGateway {
  return {
    selectByWeek: vi.fn().mockResolvedValue({ data: [ENTRY], error: null }),
    insert: vi.fn().mockResolvedValue({ data: ENTRY, error: null }),
    updateById: vi.fn().mockResolvedValue({ data: ENTRY, error: null }),
    deleteById: vi.fn().mockResolvedValue({ error: null }),
    ...overrides,
  };
}

describe('week plan list', () => {
  it('lists only through the calendar and week-bound gateway operation', async () => {
    const gw = gateway();

    expect(await createWeekPlanRepo(gw).list(CALENDAR_ID, WEEK_START)).toEqual([ENTRY]);
    expect(gw.selectByWeek).toHaveBeenCalledWith(CALENDAR_ID, WEEK_START);
  });

  it('normalizes an empty successful response to an empty list', async () => {
    const gw = gateway({
      selectByWeek: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    expect(await createWeekPlanRepo(gw).list(CALENDAR_ID, WEEK_START)).toEqual([]);
  });

  it('forwards gateway errors', async () => {
    const gw = gateway({
      selectByWeek: vi.fn().mockResolvedValue({ data: null, error: { message: 'denied' } }),
    });

    await expect(createWeekPlanRepo(gw).list(CALENDAR_ID, WEEK_START)).rejects.toThrow('denied');
  });
});

describe('week plan mutations', () => {
  it('creates an entry with the generated database insert shape', async () => {
    const gw = gateway();
    const result = await createWeekPlanRepo(gw).create({
      calendar_id: CALENDAR_ID,
      created_by: USER_ID,
      day_of_week: 0,
      entry_type: 'meal',
      notes: null,
      sort_order: 0,
      title: 'Pasta',
      week_start: WEEK_START,
    });

    expect(result).toEqual(ENTRY);
    expect(gw.insert).toHaveBeenCalledWith({
      calendar_id: CALENDAR_ID,
      created_by: USER_ID,
      day_of_week: 0,
      entry_type: 'meal',
      notes: null,
      sort_order: 0,
      title: 'Pasta',
      week_start: WEEK_START,
    });
  });

  it('updates only editable fields and scopes the mutation to the calendar', async () => {
    const gw = gateway();

    await createWeekPlanRepo(gw).update(CALENDAR_ID, ENTRY_ID, {
      day_of_week: 4,
      entry_type: 'task',
      notes: null,
      title: 'Einkaufen',
    });

    expect(gw.updateById).toHaveBeenCalledWith(CALENDAR_ID, ENTRY_ID, {
      day_of_week: 4,
      entry_type: 'task',
      notes: null,
      title: 'Einkaufen',
    });
  });

  it('deletes through a calendar-scoped gateway operation', async () => {
    const gw = gateway();

    await createWeekPlanRepo(gw).delete(CALENDAR_ID, ENTRY_ID);

    expect(gw.deleteById).toHaveBeenCalledWith(CALENDAR_ID, ENTRY_ID);
  });

  it('rejects invalid weekdays before writing', async () => {
    const gw = gateway();

    await expect(
      createWeekPlanRepo(gw).create({
        calendar_id: CALENDAR_ID,
        created_by: USER_ID,
        day_of_week: 7,
        entry_type: 'meal',
        title: 'Pasta',
        week_start: WEEK_START,
      }),
    ).rejects.toThrow(/day_of_week/);
    expect(gw.insert).not.toHaveBeenCalled();
  });

  it('rejects empty updates before writing', async () => {
    const gw = gateway();

    await expect(createWeekPlanRepo(gw).update(CALENDAR_ID, ENTRY_ID, {})).rejects.toThrow(
      /at least one/,
    );
    expect(gw.updateById).not.toHaveBeenCalled();
  });

  it('does not report a mutation as successful when no row is returned', async () => {
    const gw = gateway({
      updateById: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    await expect(
      createWeekPlanRepo(gw).update(CALENDAR_ID, ENTRY_ID, { title: 'Neu' }),
    ).rejects.toThrow(/not returned/);
  });
});
