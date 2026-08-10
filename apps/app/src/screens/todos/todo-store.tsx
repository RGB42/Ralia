import { useToast } from '@ralia/ui';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from '../../auth/useAuth.js';
import { useData } from '../../data/DataProvider.js';
import type { MockTodoItem, MockTodoList } from '../../mock/fixtures.js';

export type TodoFilter = 'alle' | 'u1' | 'u2' | 'offen';

export interface TodoDraft {
  text: string;
  note: string;
  listId: string;
  slot: MockTodoItem['slot'];
}

export interface TodoStoreValue {
  items: readonly MockTodoItem[];
  lists: readonly MockTodoList[];
  toggle(id: string): void;
  add(draft: TodoDraft): void;
  update(next: MockTodoItem): void;
  remove(id: string): void;
  addList(name: string): Promise<string | null>;
  filter: TodoFilter;
  setFilter(next: TodoFilter): void;
}

const TodoStoreContext = createContext<TodoStoreValue | null>(null);

const LIST_COLORS = ['var(--both)', 'var(--u1)', 'var(--u2)'] as const;

export function TodoStoreProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const { session } = useAuth();
  const { notesTodoGroups, notesTodos } = useData();
  const { show } = useToast();
  const [items, setItems] = useState<readonly MockTodoItem[]>([]);
  const [lists, setLists] = useState<readonly MockTodoList[]>([]);
  const [filter, setFilter] = useState<TodoFilter>('alle');
  const identity = session.status === 'signed-in' ? session.identity : null;

  useEffect(() => {
    if (!identity) return;
    let active = true;
    void Promise.all([
      notesTodoGroups.list(identity.calendarId),
      notesTodos.list(identity.calendarId),
    ])
      .then(([groups, rows]) => {
        if (!active) return;
        const nextLists = groups.map((group, index) => listFromGroup(group.id, group.name, index));
        const knownNames = new Set(nextLists.map((list) => list.title));
        for (const row of rows) {
          if (!knownNames.has(row.group_name)) {
            knownNames.add(row.group_name);
            nextLists.push(listFromGroup(`group:${row.group_name}`, row.group_name, nextLists.length));
          }
        }
        setLists(nextLists);
        setItems(rows.map((row) => itemFromRow(row, nextLists, identity.userId, identity.partner?.id)));
      })
      .catch(() => {
        if (active) show('Listen und Notizen konnten nicht geladen werden.', 'danger');
      });
    return () => {
      active = false;
    };
  }, [identity, notesTodoGroups, notesTodos, show]);

  const toggle = useCallback(
    (id: string) => {
      if (!identity) return;
      const previous = items.find((item) => item.id === id);
      if (!previous) return;
      setItems((current) =>
        current.map((item) => (item.id === id ? { ...item, done: !item.done } : item)),
      );
      void notesTodos
        .toggleDone({
          calendarId: identity.calendarId,
          id,
          currentIsDone: previous.done,
        })
        .catch(() => {
          setItems((current) => current.map((item) => (item.id === id ? previous : item)));
          show('Der Eintrag konnte nicht aktualisiert werden.', 'danger');
        });
    },
    [identity, items, notesTodos, show],
  );

  const add = useCallback(
    (draft: TodoDraft) => {
      if (!identity) return;
      const list = lists.find((entry) => entry.id === draft.listId);
      if (!list) return;
      const sortOrder = items.filter((item) => item.listId === draft.listId).length;
      void notesTodos
        .create({
          calendarId: identity.calendarId,
          createdBy: identity.userId,
          groupName: list.title,
          itemType: 'todo',
          title: draft.text,
          content: draft.note,
          assignedTo: assignedTo(draft.slot, identity.userId, identity.partner?.id),
          sortOrder,
        })
        .then((row) => {
          setItems((current) => [
            ...current,
            itemFromRow(row, lists, identity.userId, identity.partner?.id),
          ]);
        })
        .catch(() => show('Der Eintrag konnte nicht gespeichert werden.', 'danger'));
    },
    [identity, items, lists, notesTodos, show],
  );

  const update = useCallback(
    (next: MockTodoItem) => {
      if (!identity) return;
      const previous = items.find((item) => item.id === next.id);
      const list = lists.find((entry) => entry.id === next.listId);
      if (!previous || !list) return;
      setItems((current) => current.map((item) => (item.id === next.id ? next : item)));
      void notesTodos
        .update({
          calendarId: identity.calendarId,
          id: next.id,
          groupName: list.title,
          title: next.text,
          content: next.note,
          assignedTo: assignedTo(next.slot, identity.userId, identity.partner?.id),
        })
        .catch(() => {
          setItems((current) => current.map((item) => (item.id === next.id ? previous : item)));
          show('Der Eintrag konnte nicht gespeichert werden.', 'danger');
        });
    },
    [identity, items, lists, notesTodos, show],
  );

  const remove = useCallback(
    (id: string) => {
      if (!identity) return;
      const previous = items.find((item) => item.id === id);
      if (!previous) return;
      setItems((current) => current.filter((item) => item.id !== id));
      void notesTodos.delete({ calendarId: identity.calendarId, id }).catch(() => {
        setItems((current) => [...current, previous]);
        show('Der Eintrag konnte nicht gelöscht werden.', 'danger');
      });
    },
    [identity, items, notesTodos, show],
  );

  const addList = useCallback(
    async (name: string): Promise<string | null> => {
      if (!identity || name.trim() === '') return null;
      try {
        const group = await notesTodoGroups.create({
          calendarId: identity.calendarId,
          createdBy: identity.userId,
          name,
        });
        const list = listFromGroup(group.id, group.name, lists.length);
        setLists((current) => [...current, list]);
        return list.id;
      } catch {
        show('Die Liste konnte nicht erstellt werden.', 'danger');
        return null;
      }
    },
    [identity, lists.length, notesTodoGroups, show],
  );

  const value = useMemo<TodoStoreValue>(
    () => ({ items, lists, toggle, add, update, remove, addList, filter, setFilter }),
    [items, lists, toggle, add, update, remove, addList, filter],
  );

  return <TodoStoreContext.Provider value={value}>{children}</TodoStoreContext.Provider>;
}

function listFromGroup(id: string, title: string, index: number): MockTodoList {
  const words = title.trim().split(/\s+/);
  const initial = words
    .slice(0, 2)
    .map((word) => word[0] ?? '')
    .join('')
    .toUpperCase();
  return { id, title, initial: initial || 'LI', color: LIST_COLORS[index % LIST_COLORS.length]! };
}

function itemFromRow(
  row: {
    id: string;
    group_name: string;
    title: string;
    is_done: boolean;
    assigned_to: string;
    content: string | null;
  },
  lists: readonly MockTodoList[],
  userId: string,
  partnerId?: string,
): MockTodoItem {
  const list = lists.find((entry) => entry.title === row.group_name);
  return {
    id: row.id,
    listId: list?.id ?? `group:${row.group_name}`,
    text: row.title,
    done: row.is_done,
    slot:
      row.assigned_to === userId
        ? 'u1'
        : row.assigned_to === 'both'
          ? 'both'
          : row.assigned_to === partnerId || !partnerId
            ? 'u2'
            : 'both',
    note: row.content ?? '',
  };
}

function assignedTo(slot: MockTodoItem['slot'], userId: string, partnerId?: string): string {
  if (slot === 'u1') return userId;
  if (slot === 'u2' && partnerId) return partnerId;
  return 'both';
}

export function useTodoStore(): TodoStoreValue {
  const value = useContext(TodoStoreContext);
  if (!value) throw new Error('useTodoStore braucht einen TodoStoreProvider im Baum');
  return value;
}

export function applyTodoFilter(
  items: readonly MockTodoItem[],
  filter: TodoFilter,
): readonly MockTodoItem[] {
  if (filter === 'alle') return items;
  if (filter === 'offen') return items.filter((item) => !item.done);
  return items.filter((item) => item.slot === filter);
}
