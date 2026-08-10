import { describe, expect, it, vi } from 'vitest';
import type { NotesTodoGroupsRow } from '../database.types.js';
import {
  NOTES_TODO_GROUP_NAME_MAX_LENGTH,
  createNotesTodoGroupsRepo,
  type NotesTodoGroupsGateway,
} from './notes-todo-groups-repo.js';

const CALENDAR = '11111111-1111-4111-8111-111111111111';
const USER = CALENDAR;

const GROUP: NotesTodoGroupsRow = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  calendar_id: CALENDAR,
  created_by: USER,
  name: 'Allgemein',
  created_at: '2026-08-10T08:00:00.000Z',
};

function gateway(overrides: Partial<NotesTodoGroupsGateway> = {}): NotesTodoGroupsGateway {
  return {
    listByCalendar: vi.fn().mockResolvedValue({ data: [GROUP], error: null }),
    insert: vi.fn().mockResolvedValue({ data: GROUP, error: null }),
    rename: vi.fn().mockResolvedValue({ data: GROUP, error: null }),
    delete: vi.fn().mockResolvedValue({ data: { id: GROUP.id }, error: null }),
    ...overrides,
  };
}

describe('notes_todo_groups list', () => {
  it('lists only through the calendar-scoped gateway and sorts without mutating its data', async () => {
    const shopping = { ...GROUP, id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', name: 'Einkauf' };
    const source = [GROUP, shopping];
    const gw = gateway({
      listByCalendar: vi.fn().mockResolvedValue({ data: source, error: null }),
    });

    const result = await createNotesTodoGroupsRepo(gw).list(` ${CALENDAR} `);

    expect(gw.listByCalendar).toHaveBeenCalledWith(CALENDAR);
    expect(result.map((group) => group.name)).toEqual(['Allgemein', 'Einkauf']);
    expect(source).toEqual([GROUP, shopping]);
  });

  it('rejects rows leaking from another calendar', async () => {
    const gw = gateway({
      listByCalendar: vi.fn().mockResolvedValue({
        data: [{ ...GROUP, calendar_id: 'another-calendar' }],
        error: null,
      }),
    });

    await expect(createNotesTodoGroupsRepo(gw).list(CALENDAR)).rejects.toMatchObject({
      code: 'invalid_response',
      operation: 'notes_todo_groups.list',
    });
  });
});

describe('notes_todo_groups mutations', () => {
  it('normalizes and validates a group before creating it', async () => {
    const gw = gateway();
    await createNotesTodoGroupsRepo(gw).create({
      calendarId: CALENDAR,
      createdBy: USER,
      name: '  Allgemein  ',
    });

    expect(gw.insert).toHaveBeenCalledWith({
      calendar_id: CALENDAR,
      created_by: USER,
      name: 'Allgemein',
    });
  });

  it('rejects empty and overlong names before calling the gateway', async () => {
    const gw = gateway();
    const repo = createNotesTodoGroupsRepo(gw);

    await expect(
      repo.create({ calendarId: CALENDAR, createdBy: USER, name: '   ' }),
    ).rejects.toMatchObject({ code: 'invalid_input' });
    await expect(
      repo.create({
        calendarId: CALENDAR,
        createdBy: USER,
        name: 'x'.repeat(NOTES_TODO_GROUP_NAME_MAX_LENGTH + 1),
      }),
    ).rejects.toMatchObject({ code: 'invalid_input' });
    expect(gw.insert).not.toHaveBeenCalled();
  });

  it('renames by id, calendar and old name so item labels can be updated atomically', async () => {
    const renamed = { ...GROUP, name: 'Haushalt' };
    const gw = gateway({ rename: vi.fn().mockResolvedValue({ data: renamed, error: null }) });

    const result = await createNotesTodoGroupsRepo(gw).rename({
      calendarId: CALENDAR,
      id: GROUP.id,
      currentName: ' Allgemein ',
      name: ' Haushalt ',
    });

    expect(gw.rename).toHaveBeenCalledWith({
      calendarId: CALENDAR,
      id: GROUP.id,
      currentName: 'Allgemein',
      name: 'Haushalt',
    });
    expect(result).toEqual(renamed);
  });

  it('deletes by id, name and calendar', async () => {
    const gw = gateway();

    await createNotesTodoGroupsRepo(gw).delete({
      calendarId: CALENDAR,
      id: GROUP.id,
      name: GROUP.name,
    });

    expect(gw.delete).toHaveBeenCalledWith({
      calendarId: CALENDAR,
      id: GROUP.id,
      name: GROUP.name,
    });
  });

  it('normalizes database and thrown network errors', async () => {
    const conflictGateway = gateway({
      insert: vi.fn().mockResolvedValue({ data: null, error: { code: '23505' } }),
    });
    const offlineGateway = gateway({
      listByCalendar: vi.fn().mockRejectedValue(new TypeError('Failed to fetch')),
    });

    await expect(
      createNotesTodoGroupsRepo(conflictGateway).create({
        calendarId: CALENDAR,
        createdBy: USER,
        name: GROUP.name,
      }),
    ).rejects.toMatchObject({ code: 'conflict', backendCode: '23505' });
    await expect(createNotesTodoGroupsRepo(offlineGateway).list(CALENDAR)).rejects.toMatchObject({
      code: 'unavailable',
    });
  });
});
