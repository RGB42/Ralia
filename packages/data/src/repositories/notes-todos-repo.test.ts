import { describe, expect, it, vi } from 'vitest';
import type { ItemType, NotesTodosRow, WorkflowStatus } from '../database.types.js';
import {
  createNotesTodosRepo,
  type CreateNotesTodoInput,
  type NotesTodosGateway,
} from './notes-todos-repo.js';

const CALENDAR = '11111111-1111-4111-8111-111111111111';
const USER = CALENDAR;
const NOW = '2026-08-10T10:00:00.000Z';

const TODO: NotesTodosRow = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  calendar_id: CALENDAR,
  created_by: USER,
  group_name: 'Einkauf',
  item_type: 'todo',
  title: 'Milch',
  content: null,
  is_done: false,
  sort_order: 1,
  created_at: '2026-08-10T08:00:00.000Z',
  updated_at: '2026-08-10T08:00:00.000Z',
  quantity: 2,
  unit: 'Liter',
  category: 'Kuehlregal',
  assigned_to: 'both',
  workflow_status: 'open',
  completed_at: null,
};

const NOTE: NotesTodosRow = {
  ...TODO,
  id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  group_name: 'Allgemein',
  item_type: 'note',
  title: 'Idee',
  content: 'Sommerfest planen',
  quantity: null,
  unit: null,
  category: null,
  sort_order: 0,
};

const CREATE_INPUT: CreateNotesTodoInput = {
  calendarId: CALENDAR,
  createdBy: USER,
  groupName: 'Einkauf',
  itemType: 'todo',
  title: 'Milch',
  content: null,
  quantity: 2,
  unit: 'Liter',
  category: 'Kuehlregal',
  assignedTo: 'both',
  workflowStatus: 'open',
  sortOrder: 1,
};

function gateway(overrides: Partial<NotesTodosGateway> = {}): NotesTodosGateway {
  return {
    listByCalendar: vi.fn().mockResolvedValue({ data: [TODO], error: null }),
    insert: vi.fn().mockResolvedValue({ data: TODO, error: null }),
    update: vi.fn().mockResolvedValue({ data: TODO, error: null }),
    delete: vi.fn().mockResolvedValue({ data: { id: TODO.id }, error: null }),
    reorder: vi.fn().mockResolvedValue({ data: 1, error: null }),
    ...overrides,
  };
}

describe('notes_todos list', () => {
  it('lists by calendar and returns todos and notes in stable group/sort order', async () => {
    const laterTodo = { ...TODO, id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', sort_order: 3 };
    const gw = gateway({
      listByCalendar: vi.fn().mockResolvedValue({ data: [laterTodo, TODO, NOTE], error: null }),
    });

    const result = await createNotesTodosRepo(gw).list(` ${CALENDAR} `);

    expect(gw.listByCalendar).toHaveBeenCalledWith(CALENDAR);
    expect(result.map((item) => item.id)).toEqual([NOTE.id, TODO.id, laterTodo.id]);
    expect(result.map((item) => item.item_type)).toEqual(['note', 'todo', 'todo']);
  });

  it('rejects unknown item types and cross-calendar rows', async () => {
    const unknownType = gateway({
      listByCalendar: vi.fn().mockResolvedValue({
        data: [{ ...TODO, item_type: 'reminder' }],
        error: null,
      }),
    });
    const wrongCalendar = gateway({
      listByCalendar: vi.fn().mockResolvedValue({
        data: [{ ...TODO, calendar_id: 'another-calendar' }],
        error: null,
      }),
    });

    await expect(createNotesTodosRepo(unknownType).list(CALENDAR)).rejects.toMatchObject({
      code: 'invalid_response',
    });
    await expect(createNotesTodosRepo(wrongCalendar).list(CALENDAR)).rejects.toMatchObject({
      code: 'invalid_response',
    });
  });
});

describe('notes_todos create', () => {
  it('creates a validated todo with shopping fields and explicit sort order', async () => {
    const gw = gateway();

    await createNotesTodosRepo(gw).create({
      ...CREATE_INPUT,
      groupName: ' Einkauf ',
      title: ' Milch ',
    });

    expect(gw.insert).toHaveBeenCalledWith({
      calendar_id: CALENDAR,
      created_by: USER,
      group_name: 'Einkauf',
      item_type: 'todo',
      title: 'Milch',
      content: null,
      quantity: 2,
      unit: 'Liter',
      category: 'Kuehlregal',
      assigned_to: 'both',
      workflow_status: 'open',
      is_done: false,
      completed_at: null,
      sort_order: 1,
    });
  });

  it('creates notes and clears todo-only shopping fields', async () => {
    const gw = gateway({ insert: vi.fn().mockResolvedValue({ data: NOTE, error: null }) });

    await createNotesTodosRepo(gw).create({
      ...CREATE_INPUT,
      groupName: NOTE.group_name,
      itemType: 'note',
      title: NOTE.title,
      content: NOTE.content,
      quantity: 12,
      unit: 'kg',
      category: 'ignored',
      sortOrder: 0,
    });

    expect(gw.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        item_type: 'note',
        content: NOTE.content,
        quantity: null,
        unit: null,
        category: null,
      }),
    );
  });

  it('rejects malformed type, title, quantity, workflow and sort order before writing', async () => {
    const invalidInputs: CreateNotesTodoInput[] = [
      { ...CREATE_INPUT, itemType: 'reminder' as ItemType },
      { ...CREATE_INPUT, title: '   ' },
      { ...CREATE_INPUT, quantity: Number.NaN },
      { ...CREATE_INPUT, workflowStatus: 'done' as WorkflowStatus },
      { ...CREATE_INPUT, sortOrder: -1 },
    ];

    for (const input of invalidInputs) {
      const gw = gateway();
      await expect(createNotesTodosRepo(gw).create(input)).rejects.toMatchObject({
        code: 'invalid_input',
      });
      expect(gw.insert).not.toHaveBeenCalled();
    }
  });
});

describe('notes_todos update and toggle', () => {
  it('updates editable fields within the calendar and stamps updated_at', async () => {
    const changed = { ...TODO, title: 'Hafermilch', quantity: 3, updated_at: NOW };
    const gw = gateway({ update: vi.fn().mockResolvedValue({ data: changed, error: null }) });

    const result = await createNotesTodosRepo(gw, () => NOW).update({
      calendarId: CALENDAR,
      id: TODO.id,
      title: ' Hafermilch ',
      quantity: 3,
    });

    expect(gw.update).toHaveBeenCalledWith(CALENDAR, TODO.id, {
      title: 'Hafermilch',
      quantity: 3,
      updated_at: NOW,
    });
    expect(result).toEqual(changed);
  });

  it('clears shopping fields when an item changes to a note', async () => {
    const gw = gateway({ update: vi.fn().mockResolvedValue({ data: NOTE, error: null }) });

    await createNotesTodosRepo(gw, () => NOW).update({
      calendarId: CALENDAR,
      id: NOTE.id,
      itemType: 'note',
    });

    expect(gw.update).toHaveBeenCalledWith(CALENDAR, NOTE.id, {
      item_type: 'note',
      quantity: null,
      unit: null,
      category: null,
      updated_at: NOW,
    });
  });

  it('rejects an empty update', async () => {
    const gw = gateway();

    await expect(
      createNotesTodosRepo(gw, () => NOW).update({ calendarId: CALENDAR, id: TODO.id }),
    ).rejects.toMatchObject({ code: 'invalid_input' });
    expect(gw.update).not.toHaveBeenCalled();
  });

  it('toggles open items done with a completion timestamp', async () => {
    const completed = { ...TODO, is_done: true, completed_at: NOW, updated_at: NOW };
    const gw = gateway({ update: vi.fn().mockResolvedValue({ data: completed, error: null }) });

    const result = await createNotesTodosRepo(gw, () => NOW).toggleDone({
      calendarId: CALENDAR,
      id: TODO.id,
      currentIsDone: false,
    });

    expect(gw.update).toHaveBeenCalledWith(CALENDAR, TODO.id, {
      is_done: true,
      completed_at: NOW,
      updated_at: NOW,
    });
    expect(result.is_done).toBe(true);
  });

  it('reopens completed items and clears completed_at', async () => {
    const reopened = { ...TODO, is_done: false, completed_at: null, updated_at: NOW };
    const gw = gateway({ update: vi.fn().mockResolvedValue({ data: reopened, error: null }) });

    await createNotesTodosRepo(gw, () => NOW).toggleDone({
      calendarId: CALENDAR,
      id: TODO.id,
      currentIsDone: true,
    });

    expect(gw.update).toHaveBeenCalledWith(
      CALENDAR,
      TODO.id,
      expect.objectContaining({ is_done: false, completed_at: null }),
    );
  });
});

describe('notes_todos delete and reorder', () => {
  it('deletes by id and calendar', async () => {
    const gw = gateway();

    await createNotesTodosRepo(gw).delete({ calendarId: CALENDAR, id: TODO.id });

    expect(gw.delete).toHaveBeenCalledWith(CALENDAR, TODO.id);
  });

  it('writes a complete zero-based group order in one gateway operation', async () => {
    const gw = gateway({ reorder: vi.fn().mockResolvedValue({ data: 2, error: null }) });

    await createNotesTodosRepo(gw, () => NOW).reorder({
      calendarId: CALENDAR,
      groupName: ' Einkauf ',
      itemIds: [NOTE.id, TODO.id],
    });

    expect(gw.reorder).toHaveBeenCalledWith(
      CALENDAR,
      'Einkauf',
      [
        { id: NOTE.id, sort_order: 0 },
        { id: TODO.id, sort_order: 1 },
      ],
      NOW,
    );
  });

  it('rejects duplicate ids and treats an empty order as a no-op', async () => {
    const gw = gateway();
    const repo = createNotesTodosRepo(gw, () => NOW);

    await expect(
      repo.reorder({
        calendarId: CALENDAR,
        groupName: TODO.group_name,
        itemIds: [TODO.id, TODO.id],
      }),
    ).rejects.toMatchObject({ code: 'invalid_input' });
    await repo.reorder({ calendarId: CALENDAR, groupName: TODO.group_name, itemIds: [] });

    expect(gw.reorder).not.toHaveBeenCalled();
  });

  it('reports a partial reorder and permission errors with stable categories', async () => {
    const partial = gateway({ reorder: vi.fn().mockResolvedValue({ data: 1, error: null }) });
    const forbidden = gateway({
      delete: vi.fn().mockResolvedValue({ data: null, error: { code: '42501' } }),
    });

    await expect(
      createNotesTodosRepo(partial, () => NOW).reorder({
        calendarId: CALENDAR,
        groupName: TODO.group_name,
        itemIds: [TODO.id, NOTE.id],
      }),
    ).rejects.toMatchObject({ code: 'not_found' });
    await expect(
      createNotesTodosRepo(forbidden).delete({ calendarId: CALENDAR, id: TODO.id }),
    ).rejects.toMatchObject({ code: 'forbidden', backendCode: '42501' });
  });
});
