import type { RaliaSupabaseClient } from '../client.js';
import type {
  ItemType,
  NotesTodosRow,
  TablesInsert,
  TablesUpdate,
  WorkflowStatus,
} from '../database.types.js';
import {
  RepositoryError,
  invalidInput,
  requireGatewayData,
  requiredText,
} from './repository-error.js';
import type { GatewayResult } from './repository-error.js';

export type NotesTodo = Omit<NotesTodosRow, 'item_type' | 'workflow_status'> & {
  item_type: ItemType;
  workflow_status: WorkflowStatus;
};

export interface CreateNotesTodoInput {
  calendarId: string;
  createdBy: string;
  groupName: string;
  itemType: ItemType;
  title: string;
  content?: string | null;
  quantity?: number | null;
  unit?: string | null;
  category?: string | null;
  assignedTo: string;
  workflowStatus?: WorkflowStatus;
  sortOrder: number;
}

export interface UpdateNotesTodoInput {
  calendarId: string;
  id: string;
  groupName?: string;
  itemType?: ItemType;
  title?: string;
  content?: string | null;
  quantity?: number | null;
  unit?: string | null;
  category?: string | null;
  assignedTo?: string;
  workflowStatus?: WorkflowStatus;
}

export interface ToggleNotesTodoInput {
  calendarId: string;
  id: string;
  currentIsDone: boolean;
}

export interface DeleteNotesTodoInput {
  calendarId: string;
  id: string;
}

export interface ReorderNotesTodosInput {
  calendarId: string;
  groupName: string;
  itemIds: readonly string[];
}

type NotesTodoInsert = Pick<
  TablesInsert<'notes_todos'>,
  | 'calendar_id'
  | 'created_by'
  | 'group_name'
  | 'item_type'
  | 'title'
  | 'content'
  | 'quantity'
  | 'unit'
  | 'category'
  | 'assigned_to'
  | 'workflow_status'
  | 'is_done'
  | 'completed_at'
  | 'sort_order'
>;

type NotesTodoUpdate = Pick<
  TablesUpdate<'notes_todos'>,
  | 'group_name'
  | 'item_type'
  | 'title'
  | 'content'
  | 'quantity'
  | 'unit'
  | 'category'
  | 'assigned_to'
  | 'workflow_status'
  | 'is_done'
  | 'completed_at'
  | 'updated_at'
>;

export interface NotesTodosGateway {
  listByCalendar(calendarId: string): Promise<GatewayResult<NotesTodosRow[]>>;
  insert(values: NotesTodoInsert): Promise<GatewayResult<NotesTodosRow>>;
  update(
    calendarId: string,
    id: string,
    values: NotesTodoUpdate,
  ): Promise<GatewayResult<NotesTodosRow>>;
  delete(calendarId: string, id: string): Promise<GatewayResult<{ id: string }>>;
  /** Applies all positions as one calendar- and group-scoped operation. */
  reorder(
    calendarId: string,
    groupName: string,
    positions: ReadonlyArray<{ id: string; sort_order: number }>,
    updatedAt: string,
  ): Promise<GatewayResult<number>>;
}

export interface NotesTodosRepo {
  list(calendarId: string): Promise<NotesTodo[]>;
  create(input: CreateNotesTodoInput): Promise<NotesTodo>;
  update(input: UpdateNotesTodoInput): Promise<NotesTodo>;
  toggleDone(input: ToggleNotesTodoInput): Promise<NotesTodo>;
  delete(input: DeleteNotesTodoInput): Promise<void>;
  reorder(input: ReorderNotesTodosInput): Promise<void>;
}

const ITEM_TYPES: ReadonlySet<string> = new Set<ItemType>(['todo', 'note']);
const WORKFLOW_STATUSES: ReadonlySet<string> = new Set<WorkflowStatus>([
  'open',
  'in_progress',
  'waiting',
]);
const GROUP_NAME_MAX_LENGTH = 60;

function itemType(value: unknown, operation: string): ItemType {
  if (typeof value !== 'string' || !ITEM_TYPES.has(value)) {
    throw invalidInput(operation, 'itemType', 'must be todo or note');
  }
  return value as ItemType;
}

function workflowStatus(value: unknown, operation: string): WorkflowStatus {
  if (typeof value !== 'string' || !WORKFLOW_STATUSES.has(value)) {
    throw invalidInput(operation, 'workflowStatus', 'is not supported');
  }
  return value as WorkflowStatus;
}

function nullableText(value: unknown, operation: string, field: string): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') throw invalidInput(operation, field, 'must be a string or null');
  const normalized = value.trim();
  return normalized.length === 0 ? null : normalized;
}

function quantity(value: unknown, operation: string): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw invalidInput(operation, 'quantity', 'must be a non-negative finite number or null');
  }
  return value;
}

function sortOrder(value: unknown, operation: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw invalidInput(operation, 'sortOrder', 'must be a non-negative integer');
  }
  return value;
}

function timestamp(now: () => string, operation: string): string {
  const value = now();
  if (typeof value !== 'string' || value.length === 0 || Number.isNaN(Date.parse(value))) {
    throw new RepositoryError('invalid_response', operation);
  }
  return value;
}

function assertItem(
  row: NotesTodosRow,
  operation: string,
  calendarId: string,
  expectedId?: string,
): NotesTodo {
  if (row.calendar_id !== calendarId || (expectedId !== undefined && row.id !== expectedId)) {
    throw new RepositoryError('invalid_response', operation);
  }
  if (!ITEM_TYPES.has(row.item_type) || !WORKFLOW_STATUSES.has(row.workflow_status)) {
    throw new RepositoryError('invalid_response', operation);
  }
  return row as NotesTodo;
}

function todoUpdate(input: UpdateNotesTodoInput, operation: string): NotesTodoUpdate {
  const values: NotesTodoUpdate = {};

  if ('groupName' in input) {
    values.group_name = requiredText(
      input.groupName,
      operation,
      'groupName',
      GROUP_NAME_MAX_LENGTH,
    );
  }
  if ('itemType' in input) values.item_type = itemType(input.itemType, operation);
  if ('title' in input) values.title = requiredText(input.title, operation, 'title');
  if ('content' in input) values.content = nullableText(input.content, operation, 'content');
  if ('assignedTo' in input) {
    values.assigned_to = requiredText(input.assignedTo, operation, 'assignedTo');
  }
  if ('workflowStatus' in input) {
    values.workflow_status = workflowStatus(input.workflowStatus, operation);
  }

  if (values.item_type === 'note') {
    values.quantity = null;
    values.unit = null;
    values.category = null;
  } else {
    if ('quantity' in input) values.quantity = quantity(input.quantity, operation);
    if ('unit' in input) values.unit = nullableText(input.unit, operation, 'unit');
    if ('category' in input) {
      values.category = nullableText(input.category, operation, 'category');
    }
  }

  return values;
}

export function createNotesTodosRepo(
  gateway: NotesTodosGateway,
  now: () => string = () => new Date().toISOString(),
): NotesTodosRepo {
  return {
    async list(rawCalendarId) {
      const operation = 'notes_todos.list';
      const calendarId = requiredText(rawCalendarId, operation, 'calendarId');
      const rows = await requireGatewayData(operation, () => gateway.listByCalendar(calendarId));

      return rows
        .map((row) => assertItem(row, operation, calendarId))
        .sort(
          (left, right) =>
            left.group_name.localeCompare(right.group_name) ||
            left.sort_order - right.sort_order ||
            left.created_at.localeCompare(right.created_at) ||
            left.id.localeCompare(right.id),
        );
    },

    async create(input) {
      const operation = 'notes_todos.create';
      const calendarId = requiredText(input.calendarId, operation, 'calendarId');
      const createdBy = requiredText(input.createdBy, operation, 'createdBy');
      const groupName = requiredText(
        input.groupName,
        operation,
        'groupName',
        GROUP_NAME_MAX_LENGTH,
      );
      const kind = itemType(input.itemType, operation);
      const values: NotesTodoInsert = {
        calendar_id: calendarId,
        created_by: createdBy,
        group_name: groupName,
        item_type: kind,
        title: requiredText(input.title, operation, 'title'),
        content: nullableText(input.content, operation, 'content'),
        quantity: kind === 'todo' ? quantity(input.quantity, operation) : null,
        unit: kind === 'todo' ? nullableText(input.unit, operation, 'unit') : null,
        category: kind === 'todo' ? nullableText(input.category, operation, 'category') : null,
        assigned_to: requiredText(input.assignedTo, operation, 'assignedTo'),
        workflow_status: workflowStatus(input.workflowStatus ?? 'open', operation),
        is_done: false,
        completed_at: null,
        sort_order: sortOrder(input.sortOrder, operation),
      };
      const row = await requireGatewayData(operation, () => gateway.insert(values));
      return assertItem(row, operation, calendarId);
    },

    async update(input) {
      const operation = 'notes_todos.update';
      const calendarId = requiredText(input.calendarId, operation, 'calendarId');
      const id = requiredText(input.id, operation, 'id');
      const values = todoUpdate(input, operation);
      if (Object.keys(values).length === 0) {
        throw invalidInput(operation, 'changes', 'must not be empty');
      }
      values.updated_at = timestamp(now, operation);
      const row = await requireGatewayData(
        operation,
        () => gateway.update(calendarId, id, values),
        'not_found',
      );
      return assertItem(row, operation, calendarId, id);
    },

    async toggleDone(input) {
      const operation = 'notes_todos.toggleDone';
      const calendarId = requiredText(input.calendarId, operation, 'calendarId');
      const id = requiredText(input.id, operation, 'id');
      if (typeof input.currentIsDone !== 'boolean') {
        throw invalidInput(operation, 'currentIsDone', 'must be a boolean');
      }
      const isDone = !input.currentIsDone;
      const updatedAt = timestamp(now, operation);
      const row = await requireGatewayData(
        operation,
        () =>
          gateway.update(calendarId, id, {
            is_done: isDone,
            completed_at: isDone ? updatedAt : null,
            updated_at: updatedAt,
          }),
        'not_found',
      );
      const item = assertItem(row, operation, calendarId, id);
      if (item.is_done !== isDone) throw new RepositoryError('invalid_response', operation);
      return item;
    },

    async delete(input) {
      const operation = 'notes_todos.delete';
      const calendarId = requiredText(input.calendarId, operation, 'calendarId');
      const id = requiredText(input.id, operation, 'id');
      const deleted = await requireGatewayData(
        operation,
        () => gateway.delete(calendarId, id),
        'not_found',
      );
      if (deleted.id !== id) throw new RepositoryError('invalid_response', operation);
    },

    async reorder(input) {
      const operation = 'notes_todos.reorder';
      const calendarId = requiredText(input.calendarId, operation, 'calendarId');
      const groupName = requiredText(
        input.groupName,
        operation,
        'groupName',
        GROUP_NAME_MAX_LENGTH,
      );
      if (!Array.isArray(input.itemIds)) {
        throw invalidInput(operation, 'itemIds', 'must be an array');
      }
      const itemIds = input.itemIds.map((id) => requiredText(id, operation, 'itemIds'));
      if (new Set(itemIds).size !== itemIds.length) {
        throw invalidInput(operation, 'itemIds', 'must not contain duplicates');
      }
      if (itemIds.length === 0) return;

      const positions = itemIds.map((id, index) => ({ id, sort_order: index }));
      const updatedAt = timestamp(now, operation);
      const updatedCount = await requireGatewayData(
        operation,
        () => gateway.reorder(calendarId, groupName, positions, updatedAt),
        'not_found',
      );
      if (updatedCount !== positions.length) throw new RepositoryError('not_found', operation);
    },
  };
}

export function createSupabaseNotesTodosRepo(client: RaliaSupabaseClient): NotesTodosRepo {
  return createNotesTodosRepo({
    async listByCalendar(calendarId) {
      const { data, error } = await client
        .from('notes_todos')
        .select('*')
        .eq('calendar_id', calendarId)
        .order('group_name')
        .order('sort_order')
        .order('created_at');
      return { data, error };
    },

    async insert(values) {
      const { data, error } = await client.from('notes_todos').insert(values).select('*').single();
      return { data, error };
    },

    async update(calendarId, id, values) {
      const { data, error } = await client
        .from('notes_todos')
        .update(values)
        .eq('calendar_id', calendarId)
        .eq('id', id)
        .select('*')
        .maybeSingle();
      return { data, error };
    },

    async delete(calendarId, id) {
      const { data, error } = await client
        .from('notes_todos')
        .delete()
        .eq('calendar_id', calendarId)
        .eq('id', id)
        .select('id')
        .maybeSingle();
      return { data, error };
    },

    async reorder(calendarId, groupName, positions, updatedAt) {
      const { data, error } = await client.rpc('reorder_notes_todos', {
        p_calendar_id: calendarId,
        p_group_name: groupName,
        p_positions: positions.map((position) => ({ ...position })),
        p_updated_at: updatedAt,
      });
      return { data, error };
    },
  });
}
