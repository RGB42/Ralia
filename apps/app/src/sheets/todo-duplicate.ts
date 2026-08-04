import type { MockTodoItem } from '../mock/fixtures.js';

/**
 * Duplikatpruefung fuer neue Todo-Eintraege. Regel aus Vorlage Z. 1582–1584:
 * innerhalb der gewaehlten Liste, getrimmt, ohne Gross-/Kleinschreibung.
 *
 * Reine Funktion, damit sie ohne DOM pruefbar ist — sie ist die einzige
 * Logik im Todo-Sheet.
 */
export type DuplicateKind = 'none' | 'open' | 'done';

export interface DuplicateResult {
  kind: DuplicateKind;
  match: MockTodoItem | null;
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase();
}

export function findDuplicate(
  text: string,
  listId: string,
  items: readonly MockTodoItem[],
): DuplicateResult {
  const needle = normalize(text);
  if (needle === '') return { kind: 'none', match: null };
  const match = items.find((item) => item.listId === listId && normalize(item.text) === needle);
  if (!match) return { kind: 'none', match: null };
  return { kind: match.done ? 'done' : 'open', match };
}
