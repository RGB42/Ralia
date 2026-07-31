import { describe, expect, it } from 'vitest';
import { isLocalId, localIdScope, makeLocalId } from './ids.js';

const deterministic = { now: () => 1_700_000_000_000, random: () => 0.5 };

describe('makeLocalId', () => {
  it('keeps the `local-<scope>-` shape Ralia 1.x depends on', () => {
    expect(makeLocalId('event', deterministic)).toMatch(/^local-event-1700000000000-[0-9a-z]+$/);
  });

  it('falls back to a generic scope when none is given', () => {
    expect(makeLocalId('', deterministic)).toMatch(/^local-item-/);
  });

  it('produces distinct ids across calls', () => {
    const ids = new Set(Array.from({ length: 50 }, () => makeLocalId('event')));
    expect(ids.size).toBe(50);
  });
});

describe('isLocalId', () => {
  it('accepts ids the app minted', () => {
    expect(isLocalId('local-event-1700000000000-abc123')).toBe(true);
    // Ralia 1.x wrote this exact prefix; imported mutations must still match.
    expect(isLocalId('local-event-1-x')).toBe(true);
  });

  it('rejects database ids and non-strings', () => {
    expect(isLocalId('8f14e45f-ceea-467a-9d0f-2b3c4d5e6f70')).toBe(false);
    expect(isLocalId(42)).toBe(false);
    expect(isLocalId(null)).toBe(false);
    expect(isLocalId(undefined)).toBe(false);
  });
});

describe('localIdScope', () => {
  it('extracts the scope segment', () => {
    expect(localIdScope('local-event-1700000000000-abc123')).toBe('event');
    expect(localIdScope('local-todo-item-1700000000000-abc123')).toBe('todo-item');
  });

  it('returns null for ids that are not local or lack a scope', () => {
    expect(localIdScope('db-1')).toBeNull();
    expect(localIdScope('local-onlyscope')).toBeNull();
  });
});
