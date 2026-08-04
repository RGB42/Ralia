import { create } from 'zustand';

import { enqueue, flushQueue, rebaseQueuedReferences } from '@/lib/mutation-queue';
import { makeLocalId, readLocalJson, writeLocalJson } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import type { NotesTodo, NotesTodoGroup, TodoAssignedTo, TodoItemType, TodoWorkflowStatus } from '@/types/database';

const DEFAULT_GROUP = 'Allgemein';

function cacheKey(calendarId: string) {
  return `ralia:todo-cache:${calendarId}`;
}
function queueKey(calendarId: string) {
  return `ralia:todo-queue:${calendarId}`;
}

interface TodosState {
  calendarId: string | null;
  items: NotesTodo[];
  groups: NotesTodoGroup[];
  selectedGroup: string | null;
  loading: boolean;
  load: (calendarId: string, userId: string) => Promise<void>;
  selectGroup: (name: string | null) => void;
  createGroup: (name: string, userId: string) => Promise<void>;
  deleteGroup: (name: string) => Promise<void>;
  addItem: (input: {
    title: string;
    itemType: TodoItemType;
    quantity: number | null;
    unit: string | null;
    category: string | null;
    assignedTo: TodoAssignedTo;
    userId: string;
  }) => Promise<'created' | 'reactivated' | 'blocked'>;
  toggleDone: (id: string) => Promise<void>;
  setWorkflowStatus: (id: string, status: TodoWorkflowStatus) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
}

/** Union of distinct group names from both notes_todo_groups and item rows — no FK between them by design. */
export function distinctGroupNames(groups: NotesTodoGroup[], items: NotesTodo[]): string[] {
  const names = new Set<string>();
  groups.forEach((g) => names.add(g.name));
  items.forEach((i) => names.add(i.group_name));
  if (names.size === 0) names.add(DEFAULT_GROUP);
  return Array.from(names).sort((a, b) => a.localeCompare(b));
}

export const useTodosStore = create<TodosState>((set, get) => ({
  calendarId: null,
  items: [],
  groups: [],
  selectedGroup: null,
  loading: false,

  load: async (calendarId, userId) => {
    set({ loading: true, calendarId });

    const cached = await readLocalJson<{ items: NotesTodo[]; groups: NotesTodoGroup[] }>(cacheKey(calendarId), {
      items: [],
      groups: [],
    });
    set({ items: cached.items, groups: cached.groups });

    await flushQueue(queueKey(calendarId), {
      onRebase: (tempId, realId) => {
        set((state) => ({ items: state.items.map((i) => (i.id === tempId ? { ...i, id: realId } : i)) }));
      },
    });

    const [itemsRes, groupsRes] = await Promise.all([
      supabase.from('notes_todos').select('*').eq('calendar_id', calendarId),
      supabase.from('notes_todo_groups').select('*').eq('calendar_id', calendarId),
    ]);

    const items = itemsRes.data ?? cached.items;
    const groups = groupsRes.data ?? cached.groups;

    // Bootstrap the default group if genuinely nothing exists yet for this calendar.
    if (groups.length === 0 && items.length === 0 && !itemsRes.error && !groupsRes.error) {
      const { data: created } = await supabase
        .from('notes_todo_groups')
        .insert({ calendar_id: calendarId, created_by: userId, name: DEFAULT_GROUP })
        .select('*')
        .single();
      if (created) groups.push(created);
    }

    set({ items, groups, loading: false, selectedGroup: get().selectedGroup ?? distinctGroupNames(groups, items)[0] });
    await writeLocalJson(cacheKey(calendarId), { items, groups });
  },

  selectGroup: (name) => set({ selectedGroup: name }),

  createGroup: async (name, userId) => {
    const { calendarId, groups } = get();
    if (!calendarId) return;
    const trimmed = name.trim().slice(0, 60) || DEFAULT_GROUP;
    if (groups.some((g) => g.name === trimmed)) {
      set({ selectedGroup: trimmed });
      return;
    }
    const tempId = makeLocalId('group');
    const row: NotesTodoGroup = { id: tempId, calendar_id: calendarId, created_by: userId, name: trimmed, created_at: new Date().toISOString() };
    const nextGroups = [...groups, row];
    set({ groups: nextGroups, selectedGroup: trimmed });
    await persist(calendarId, get().items, nextGroups);
    await enqueue(queueKey(calendarId), { op: 'insert', table: 'notes_todo_groups', tempId, values: row });
    await flushQueue(queueKey(calendarId), {
      onRebase: (t, r) => set((s) => ({ groups: s.groups.map((g) => (g.id === t ? { ...g, id: r } : g)) })),
    });
  },

  deleteGroup: async (name) => {
    const { calendarId, groups, items, selectedGroup } = get();
    if (!calendarId) return;
    const stillUsed = items.some((i) => i.group_name === name);
    if (stillUsed) return;
    const target = groups.find((g) => g.name === name);
    const nextGroups = groups.filter((g) => g.name !== name);
    set({ groups: nextGroups, selectedGroup: selectedGroup === name ? distinctGroupNames(nextGroups, items)[0] ?? null : selectedGroup });
    await persist(calendarId, items, nextGroups);
    if (target && !target.id.startsWith('local-')) {
      await enqueue(queueKey(calendarId), { op: 'delete', table: 'notes_todo_groups', targetId: target.id });
      await flushQueue(queueKey(calendarId));
    }
  },

  addItem: async ({ title, itemType, quantity, unit, category, assignedTo, userId }) => {
    const { calendarId, items, selectedGroup } = get();
    if (!calendarId || !selectedGroup) return 'blocked';
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return 'blocked';

    const duplicate = items.find(
      (i) => i.group_name === selectedGroup && i.title.trim().toLowerCase() === trimmedTitle.toLowerCase()
    );
    if (duplicate) {
      if (duplicate.is_done) {
        await get().toggleDone(duplicate.id);
        return 'reactivated';
      }
      return 'blocked';
    }

    const now = new Date().toISOString();
    const tempId = makeLocalId('todo');
    const row: NotesTodo = {
      id: tempId,
      calendar_id: calendarId,
      created_by: userId,
      group_name: selectedGroup,
      item_type: itemType,
      title: trimmedTitle,
      content: null,
      is_done: false,
      sort_order: items.filter((i) => i.group_name === selectedGroup).length,
      created_at: now,
      updated_at: now,
      quantity: itemType === 'todo' ? quantity : null,
      unit: itemType === 'todo' ? unit : null,
      category: itemType === 'todo' ? category : null,
      assigned_to: assignedTo,
      workflow_status: 'open',
      completed_at: null,
    };
    const nextItems = [...items, row];
    set({ items: nextItems });
    await persist(calendarId, nextItems, get().groups);
    await enqueue(queueKey(calendarId), { op: 'insert', table: 'notes_todos', tempId, values: row });
    await flushQueue(queueKey(calendarId), {
      onRebase: (t, r) => {
        set((s) => ({ items: s.items.map((i) => (i.id === t ? { ...i, id: r } : i)) }));
      },
    });
    return 'created';
  },

  toggleDone: async (id) => {
    const { calendarId, items } = get();
    if (!calendarId) return;
    const target = items.find((i) => i.id === id);
    if (!target) return;
    const isDone = !target.is_done;
    const now = new Date().toISOString();
    const nextItems = items.map((i) => (i.id === id ? { ...i, is_done: isDone, completed_at: isDone ? now : null, updated_at: now } : i));
    set({ items: nextItems });
    await persist(calendarId, nextItems, get().groups);
    const values = { is_done: isDone, completed_at: isDone ? now : null, updated_at: now };
    if (id.startsWith('local-')) {
      await rebaseQueuedReferences(queueKey(calendarId), id, id); // no-op safeguard; real rebase handled on insert flush
    }
    await enqueue(queueKey(calendarId), { op: 'update', table: 'notes_todos', targetId: id, values });
    await flushQueue(queueKey(calendarId));
  },

  setWorkflowStatus: async (id, status) => {
    const { calendarId, items } = get();
    if (!calendarId) return;
    const now = new Date().toISOString();
    const nextItems = items.map((i) => (i.id === id ? { ...i, workflow_status: status, updated_at: now } : i));
    set({ items: nextItems });
    await persist(calendarId, nextItems, get().groups);
    await enqueue(queueKey(calendarId), { op: 'update', table: 'notes_todos', targetId: id, values: { workflow_status: status, updated_at: now } });
    await flushQueue(queueKey(calendarId));
  },

  deleteItem: async (id) => {
    const { calendarId, items } = get();
    if (!calendarId) return;
    const nextItems = items.filter((i) => i.id !== id);
    set({ items: nextItems });
    await persist(calendarId, nextItems, get().groups);
    if (!id.startsWith('local-')) {
      await enqueue(queueKey(calendarId), { op: 'delete', table: 'notes_todos', targetId: id });
      await flushQueue(queueKey(calendarId));
    }
  },
}));

async function persist(calendarId: string, items: NotesTodo[], groups: NotesTodoGroup[]) {
  await writeLocalJson(cacheKey(calendarId), { items, groups });
}
