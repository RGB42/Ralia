import type { RaliaSupabaseClient } from '../client.js';
import type { NotesTodoGroupsRow } from '../database.types.js';
import { RepositoryError, requireGatewayData, requiredText } from './repository-error.js';
import type { GatewayResult } from './repository-error.js';

export const NOTES_TODO_GROUP_NAME_MAX_LENGTH = 60;

export interface CreateNotesTodoGroupInput {
  calendarId: string;
  createdBy: string;
  name: string;
}

export interface RenameNotesTodoGroupInput {
  calendarId: string;
  id: string;
  currentName: string;
  name: string;
}

export interface DeleteNotesTodoGroupInput {
  calendarId: string;
  id: string;
  name: string;
}

export interface NotesTodoGroupsGateway {
  listByCalendar(calendarId: string): Promise<GatewayResult<NotesTodoGroupsRow[]>>;
  insert(values: {
    calendar_id: string;
    created_by: string;
    name: string;
  }): Promise<GatewayResult<NotesTodoGroupsRow>>;
  /** Must rename the group and matching notes_todos.group_name values atomically. */
  rename(input: {
    calendarId: string;
    id: string;
    currentName: string;
    name: string;
  }): Promise<GatewayResult<NotesTodoGroupsRow>>;
  /** Must reject deletion as a conflict while items still use the group name. */
  delete(input: {
    calendarId: string;
    id: string;
    name: string;
  }): Promise<GatewayResult<{ id: string }>>;
}

export interface NotesTodoGroupsRepo {
  list(calendarId: string): Promise<NotesTodoGroupsRow[]>;
  create(input: CreateNotesTodoGroupInput): Promise<NotesTodoGroupsRow>;
  rename(input: RenameNotesTodoGroupInput): Promise<NotesTodoGroupsRow>;
  delete(input: DeleteNotesTodoGroupInput): Promise<void>;
}

function groupName(value: unknown, operation: string, field = 'name'): string {
  return requiredText(value, operation, field, NOTES_TODO_GROUP_NAME_MAX_LENGTH);
}

function assertGroup(
  group: NotesTodoGroupsRow,
  operation: string,
  calendarId: string,
  expectedId?: string,
): NotesTodoGroupsRow {
  if (group.calendar_id !== calendarId || (expectedId !== undefined && group.id !== expectedId)) {
    throw new RepositoryError('invalid_response', operation);
  }
  if (
    typeof group.name !== 'string' ||
    group.name.trim().length === 0 ||
    group.name.trim().length > NOTES_TODO_GROUP_NAME_MAX_LENGTH
  ) {
    throw new RepositoryError('invalid_response', operation);
  }
  return group;
}

export function createNotesTodoGroupsRepo(gateway: NotesTodoGroupsGateway): NotesTodoGroupsRepo {
  return {
    async list(rawCalendarId) {
      const operation = 'notes_todo_groups.list';
      const calendarId = requiredText(rawCalendarId, operation, 'calendarId');
      const groups = await requireGatewayData(operation, () => gateway.listByCalendar(calendarId));

      return groups
        .map((group) => assertGroup(group, operation, calendarId))
        .sort(
          (left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id),
        );
    },

    async create(input) {
      const operation = 'notes_todo_groups.create';
      const calendarId = requiredText(input.calendarId, operation, 'calendarId');
      const createdBy = requiredText(input.createdBy, operation, 'createdBy');
      const name = groupName(input.name, operation);
      const group = await requireGatewayData(operation, () =>
        gateway.insert({ calendar_id: calendarId, created_by: createdBy, name }),
      );
      return assertGroup(group, operation, calendarId);
    },

    async rename(input) {
      const operation = 'notes_todo_groups.rename';
      const calendarId = requiredText(input.calendarId, operation, 'calendarId');
      const id = requiredText(input.id, operation, 'id');
      const currentName = groupName(input.currentName, operation, 'currentName');
      const name = groupName(input.name, operation);
      const group = await requireGatewayData(
        operation,
        () => gateway.rename({ calendarId, id, currentName, name }),
        'not_found',
      );
      return assertGroup(group, operation, calendarId, id);
    },

    async delete(input) {
      const operation = 'notes_todo_groups.delete';
      const calendarId = requiredText(input.calendarId, operation, 'calendarId');
      const id = requiredText(input.id, operation, 'id');
      const name = groupName(input.name, operation);
      const deleted = await requireGatewayData(
        operation,
        () => gateway.delete({ calendarId, id, name }),
        'not_found',
      );
      if (deleted.id !== id) throw new RepositoryError('invalid_response', operation);
    },
  };
}

export function createSupabaseNotesTodoGroupsRepo(
  client: RaliaSupabaseClient,
): NotesTodoGroupsRepo {
  return createNotesTodoGroupsRepo({
    async listByCalendar(calendarId) {
      const { data, error } = await client
        .from('notes_todo_groups')
        .select('*')
        .eq('calendar_id', calendarId)
        .order('name');
      return { data, error };
    },

    async insert(values) {
      const { data, error } = await client
        .from('notes_todo_groups')
        .insert(values)
        .select('*')
        .single();
      return { data, error };
    },

    async rename(input) {
      const { data, error } = await client.rpc('rename_notes_todo_group', {
        p_calendar_id: input.calendarId,
        p_group_id: input.id,
        p_current_name: input.currentName,
        p_new_name: input.name,
      });
      return { data, error };
    },

    async delete(input) {
      const { data, error } = await client.rpc('delete_notes_todo_group', {
        p_calendar_id: input.calendarId,
        p_group_id: input.id,
        p_group_name: input.name,
      });
      return { data: data ? { id: data } : null, error };
    },
  });
}
