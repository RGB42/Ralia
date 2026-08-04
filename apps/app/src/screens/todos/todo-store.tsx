import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { MOCK_TODO_LISTS, MOCK_TODOS, type MockTodoItem } from '../../mock/fixtures.js';

/** Vorlage Z. 1382–1400. */
export type TodoFilter = 'alle' | 'u1' | 'u2' | 'offen';

export interface TodoDraft {
  text: string;
  note: string;
  listId: string;
  slot: MockTodoItem['slot'];
}

export interface TodoStoreValue {
  items: readonly MockTodoItem[];
  lists: typeof MOCK_TODO_LISTS;
  toggle(id: string): void;
  add(draft: TodoDraft): void;
  update(next: MockTodoItem): void;
  remove(id: string): void;
  filter: TodoFilter;
  setFilter(next: TodoFilter): void;
}

const TodoStoreContext = createContext<TodoStoreValue | null>(null);

/**
 * SP0-interner Zustand. Er liegt in der Elternroute von `/todos` und
 * `/todos/:listId`, damit Uebersicht und Detail dieselbe Wahrheit sehen —
 * sonst verpufft ein Abhaken im Detail beim Zurueckgehen.
 *
 * SP3 ersetzt das durch ein Repository gegen Supabase.
 */
export function TodoStoreProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [items, setItems] = useState<readonly MockTodoItem[]>(MOCK_TODOS);
  const [filter, setFilter] = useState<TodoFilter>('alle');

  const toggle = useCallback((id: string) => {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, done: !item.done } : item)),
    );
  }, []);

  // Fortlaufende Nummer statt Zufalls-Id: SP0 hat keinen Server, der eine
  // vergibt, und makeLocalId aus @ralia/core gehoert an die echte Datenschicht.
  const nextId = useRef(MOCK_TODOS.length);

  const add = useCallback((draft: TodoDraft) => {
    nextId.current += 1;
    const id = `t${nextId.current}`;
    setItems((current) => [...current, { id, done: false, ...draft }]);
  }, []);

  const update = useCallback((next: MockTodoItem) => {
    setItems((current) => current.map((item) => (item.id === next.id ? next : item)));
  }, []);

  const remove = useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const value = useMemo<TodoStoreValue>(
    () => ({ items, lists: MOCK_TODO_LISTS, toggle, add, update, remove, filter, setFilter }),
    [items, toggle, add, update, remove, filter],
  );

  return <TodoStoreContext.Provider value={value}>{children}</TodoStoreContext.Provider>;
}

export function useTodoStore(): TodoStoreValue {
  const value = useContext(TodoStoreContext);
  if (!value) throw new Error('useTodoStore braucht einen TodoStoreProvider im Baum');
  return value;
}

/** Wendet den Personen-/Offen-Filter an. */
export function applyTodoFilter(
  items: readonly MockTodoItem[],
  filter: TodoFilter,
): readonly MockTodoItem[] {
  if (filter === 'alle') return items;
  if (filter === 'offen') return items.filter((item) => !item.done);
  return items.filter((item) => item.slot === filter);
}
