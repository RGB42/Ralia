import { describe, expect, it } from 'vitest';
import {
  MOCK_CATEGORIES,
  MOCK_EVENTS,
  MOCK_EXPENSES,
  MOCK_PLANNER,
  MOCK_TODAY,
  MOCK_TODO_LISTS,
  MOCK_TODOS,
} from './fixtures.js';

describe('Demo-Daten', () => {
  it('hat den Umfang der Vorlage', () => {
    expect(MOCK_EVENTS).toHaveLength(25);
    expect(MOCK_TODOS).toHaveLength(11);
    expect(MOCK_PLANNER).toHaveLength(7);
    expect(MOCK_CATEGORIES).toHaveLength(5);
    expect(MOCK_EXPENSES).toHaveLength(7);
  });

  it('nutzt durchgehend ISO-Datumsangaben', () => {
    for (const event of MOCK_EVENTS) {
      expect(event.iso).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('enthaelt Termine am fiktiven Heute', () => {
    expect(MOCK_EVENTS.filter((e) => e.iso === MOCK_TODAY)).toHaveLength(3);
  });

  it('enthaelt einen Geburtstag als eigenen Slot', () => {
    expect(MOCK_EVENTS.filter((e) => e.slot === 'bday')).toHaveLength(1);
  });

  it('hat fuer ganztaegige Termine leere Zeiten', () => {
    const bday = MOCK_EVENTS.find((e) => e.slot === 'bday');
    expect(bday?.start).toBe('');
    expect(bday?.end).toBe('');
  });

  it('verteilt Kategorieanteile auf u1, u2 und both', () => {
    for (const category of MOCK_CATEGORIES) {
      const sum = category.shares.u1 + category.shares.u2 + category.shares.both;
      expect(sum).toBeGreaterThan(0);
    }
  });

  it('ordnet jedes Todo einer bekannten Liste zu', () => {
    const ids = new Set(MOCK_TODO_LISTS.map((list) => list.id));
    for (const todo of MOCK_TODOS) {
      expect(ids, `${todo.id} zeigt auf ${todo.listId}`).toContain(todo.listId);
    }
  });

  it('nennt Listenfarben als Token, nicht als Hex', () => {
    for (const list of MOCK_TODO_LISTS) {
      expect(list.color).toMatch(/^var\(--/);
    }
  });

  it('ordnet jede Ausgabe einer bekannten Kategorie zu', () => {
    const names = new Set(MOCK_CATEGORIES.map((c) => c.name));
    for (const expense of MOCK_EXPENSES) {
      expect(names, `${expense.title} zeigt auf ${expense.category}`).toContain(expense.category);
    }
  });
});
