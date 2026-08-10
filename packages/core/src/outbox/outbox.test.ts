import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BACKOFF_BASE_MS } from './backoff.js';
import { Outbox } from './outbox.js';
import type { FlushOutcome, OutboxExecutor } from './types.js';

interface TestMutation {
  kind: string;
  tempId?: string;
}

let dbCounter = 0;

/** A fresh database per test, so nothing leaks between cases. */
function freshOutbox(now: () => number = () => 1_000): Outbox {
  dbCounter += 1;
  return new Outbox({ now, databaseName: `ralia-test-${dbCounter}` });
}

const done = (): FlushOutcome => ({ status: 'done' });

describe('Outbox', () => {
  let outbox: Outbox;

  beforeEach(() => {
    outbox = freshOutbox();
    outbox.activateScope('user-a', 'cal-1');
  });

  it('stores an enqueued mutation and hands back a keyed record', async () => {
    const record = await outbox.enqueue<TestMutation>('events', 'cal-1', { kind: 'insert' });

    expect(record.id).toBeGreaterThan(0);
    expect(record.ownerUserId).toBe('user-a');
    expect(record.attempts).toBe(0);
    expect(record.legacy).toBe(false);
    expect(await outbox.size()).toBe(1);
  });

  it('returns a queue in enqueue order', async () => {
    await outbox.enqueue<TestMutation>('events', 'cal-1', { kind: 'a' });
    await outbox.enqueue<TestMutation>('events', 'cal-1', { kind: 'b' });
    await outbox.enqueue<TestMutation>('events', 'cal-1', { kind: 'c' });

    const pending = await outbox.peek<TestMutation>('events', 'cal-1');
    expect(pending.map((r) => r.mutation.kind)).toEqual(['a', 'b', 'c']);
  });

  it('keeps queues separate by domain and by calendar', async () => {
    await outbox.enqueue('events', 'cal-1', { kind: 'e1' });
    await outbox.enqueue('todos', 'cal-1', { kind: 't1' });

    expect(await outbox.peek('events', 'cal-1')).toHaveLength(1);
    expect(await outbox.peek('todos', 'cal-1')).toHaveLength(1);
    expect(await outbox.sizeOf('events')).toBe(1);

    outbox.activateScope('user-a', 'cal-2');
    await outbox.enqueue('events', 'cal-2', { kind: 'e2' });
    expect(await outbox.peek('events', 'cal-2')).toHaveLength(1);
    expect(await outbox.size()).toBe(1);

    outbox.activateScope('user-a', 'cal-1');
    expect(await outbox.size()).toBe(2);
  });

  it('removes accepted records and reports the temp id rebase', async () => {
    await outbox.enqueue<TestMutation>('events', 'cal-1', {
      kind: 'insert',
      tempId: 'local-event-1-abc',
    });

    outbox.registerExecutor<TestMutation>('events', async () => ({
      status: 'done',
      rebase: { tempId: 'local-event-1-abc', realId: 'db-42' },
    }));

    const summary = await outbox.flush();

    expect(summary.done).toBe(1);
    expect(summary.rebases).toEqual([{ tempId: 'local-event-1-abc', realId: 'db-42' }]);
    expect(await outbox.size()).toBe(0);
  });

  it('keeps a record and applies backoff when the executor reports a transport failure', async () => {
    const clock = 1_000;
    outbox = freshOutbox(() => clock);
    outbox.activateScope('user-a', 'cal-1');
    await outbox.enqueue<TestMutation>('events', 'cal-1', { kind: 'insert' });
    outbox.registerExecutor<TestMutation>('events', async () => ({
      status: 'retry',
      reason: 'Failed to fetch',
    }));

    const summary = await outbox.flush();

    expect(summary.retried).toBe(1);
    expect(await outbox.size()).toBe(1);

    const [pending] = await outbox.peek<TestMutation>('events', 'cal-1');
    expect(pending?.attempts).toBe(1);
    expect(pending?.retryAfter).toBe(clock + BACKOFF_BASE_MS);
    expect(pending?.lastError).toBe('Failed to fetch');
  });

  it('defers a record whose backoff has not elapsed, then flushes it once it has', async () => {
    let clock = 1_000;
    outbox = freshOutbox(() => clock);
    outbox.activateScope('user-a', 'cal-1');
    await outbox.enqueue<TestMutation>('events', 'cal-1', { kind: 'insert' });

    const executor = vi
      .fn<OutboxExecutor<TestMutation>>()
      .mockResolvedValueOnce({ status: 'retry', reason: 'offline' })
      .mockResolvedValue(done());
    outbox.registerExecutor<TestMutation>('events', executor);

    await outbox.flush();
    expect(executor).toHaveBeenCalledTimes(1);

    // Still inside the backoff window: no second attempt.
    const deferred = await outbox.flush();
    expect(executor).toHaveBeenCalledTimes(1);
    expect(deferred.deferred).toBe(1);

    clock += BACKOFF_BASE_MS + 1;
    const after = await outbox.flush();
    expect(executor).toHaveBeenCalledTimes(2);
    expect(after.done).toBe(1);
    expect(await outbox.size()).toBe(0);
  });

  it('discards a record the server permanently refused and reports why', async () => {
    await outbox.enqueue<TestMutation>('events', 'cal-1', { kind: 'insert' });
    outbox.registerExecutor<TestMutation>('events', async () => ({
      status: 'drop',
      reason: 'events_calendar_id_check violated',
    }));

    const summary = await outbox.flush();

    expect(summary.dropped).toBe(1);
    expect(summary.dropReasons).toEqual(['events_calendar_id_check violated']);
    expect(await outbox.size()).toBe(0);
  });

  it('treats a throwing executor as retryable rather than losing the mutation', async () => {
    await outbox.enqueue<TestMutation>('events', 'cal-1', { kind: 'insert' });
    outbox.registerExecutor<TestMutation>('events', async () => {
      throw new Error('boom');
    });

    const summary = await outbox.flush();

    expect(summary.retried).toBe(1);
    expect(await outbox.size()).toBe(1);
    const [pending] = await outbox.peek('events', 'cal-1');
    expect(pending?.lastError).toBe('boom');
  });

  it('stops draining a queue at the first failure so ordering survives', async () => {
    await outbox.enqueue<TestMutation>('events', 'cal-1', { kind: 'insert' });
    await outbox.enqueue<TestMutation>('events', 'cal-1', { kind: 'update' });
    await outbox.enqueue<TestMutation>('events', 'cal-1', { kind: 'delete' });

    const seen: string[] = [];
    outbox.registerExecutor<TestMutation>('events', async (record) => {
      seen.push(record.mutation.kind);
      return record.mutation.kind === 'update'
        ? { status: 'retry', reason: 'offline' }
        : { status: 'done' };
    });

    await outbox.flush();

    // 'delete' must not reach the server before 'update' succeeds.
    expect(seen).toEqual(['insert', 'update']);
    expect(
      (await outbox.peek<TestMutation>('events', 'cal-1')).map((r) => r.mutation.kind),
    ).toEqual(['update', 'delete']);
  });

  it('does not let one stalled queue block another', async () => {
    await outbox.enqueue<TestMutation>('events', 'cal-1', { kind: 'stuck' });
    await outbox.enqueue<TestMutation>('todos', 'cal-1', { kind: 'fine' });

    outbox.registerExecutor<TestMutation>('events', async () => ({
      status: 'retry',
      reason: 'offline',
    }));
    outbox.registerExecutor<TestMutation>('todos', async () => done());

    const summary = await outbox.flush();

    expect(summary.retried).toBe(1);
    expect(summary.done).toBe(1);
    expect(await outbox.sizeOf('events')).toBe(1);
    expect(await outbox.sizeOf('todos')).toBe(0);
  });

  it('leaves records untouched when no executor is registered for their domain', async () => {
    await outbox.enqueue<TestMutation>('expenses', 'cal-1', { kind: 'insert' });

    const summary = await outbox.flush();

    expect(summary.deferred).toBe(1);
    expect(await outbox.size()).toBe(1);
  });

  it('collapses overlapping flushes into a single drain', async () => {
    await outbox.enqueue<TestMutation>('events', 'cal-1', { kind: 'insert' });

    let calls = 0;
    outbox.registerExecutor<TestMutation>('events', async () => {
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 5));
      return done();
    });

    // online + visibilitychange + interval can all fire within milliseconds.
    const [a, b, c] = await Promise.all([outbox.flush(), outbox.flush(), outbox.flush()]);

    expect(calls).toBe(1);
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  describe('account scope', () => {
    it('requires a non-empty active scope and rejects calendar mismatches', async () => {
      const scoped = freshOutbox();

      expect(() => scoped.activateScope('', 'cal-1')).toThrow(/ownerUserId/);
      expect(() => scoped.activateScope('user-a', '')).toThrow(/calendarId/);
      await expect(scoped.enqueue('events', 'cal-1', { kind: 'a' })).rejects.toThrow(
        /active outbox scope/i,
      );
      await expect(scoped.peek('events', 'cal-1')).rejects.toThrow(/active outbox scope/i);
      await expect(scoped.replaceQueue('events', 'cal-1', [])).rejects.toThrow(
        /active outbox scope/i,
      );
      await expect(scoped.flush()).rejects.toThrow(/active outbox scope/i);

      scoped.activateScope('user-a', 'cal-1');
      await expect(scoped.enqueue('events', 'cal-2', { kind: 'wrong' })).rejects.toThrow(
        /does not match/i,
      );
      await expect(scoped.peek('events', 'cal-2')).rejects.toThrow(/does not match/i);
      await expect(scoped.replaceQueue('events', 'cal-2', [])).rejects.toThrow(/does not match/i);

      scoped.deactivateScope();
      await expect(scoped.clear()).rejects.toThrow(/active outbox scope/i);
    });

    it('isolates accounts even when they use the same calendar id', async () => {
      const scoped = freshOutbox();
      scoped.activateScope('user-a', 'shared-cal');
      await scoped.enqueue<TestMutation>('events', 'shared-cal', { kind: 'from-a' });

      scoped.activateScope('user-b', 'shared-cal');
      await scoped.enqueue<TestMutation>('events', 'shared-cal', { kind: 'from-b' });
      expect(
        (await scoped.peek<TestMutation>('events', 'shared-cal')).map((r) => r.mutation.kind),
      ).toEqual(['from-b']);

      await scoped.replaceQueue<TestMutation>('events', 'shared-cal', [{ kind: 'replaced-b' }]);
      scoped.activateScope('user-a', 'shared-cal');
      const userARecords = await scoped.peek<TestMutation>('events', 'shared-cal');
      expect(userARecords.map((r) => r.mutation.kind)).toEqual(['from-a']);
      expect(userARecords.every((r) => r.ownerUserId === 'user-a')).toBe(true);

      scoped.activateScope('user-b', 'shared-cal');
      expect(
        (await scoped.peek<TestMutation>('events', 'shared-cal')).map((r) => r.mutation.kind),
      ).toEqual(['replaced-b']);
    });

    it('flushes only the active account and calendar', async () => {
      const scoped = freshOutbox();
      scoped.activateScope('user-a', 'cal-1');
      await scoped.enqueue<TestMutation>('events', 'cal-1', { kind: 'a-cal-1' });
      scoped.activateScope('user-a', 'cal-2');
      await scoped.enqueue<TestMutation>('events', 'cal-2', { kind: 'a-cal-2' });
      scoped.activateScope('user-b', 'cal-1');
      await scoped.enqueue<TestMutation>('events', 'cal-1', { kind: 'b-cal-1' });

      const seen: string[] = [];
      scoped.registerExecutor<TestMutation>('events', async (record) => {
        seen.push(`${record.ownerUserId}:${record.calendarId}:${record.mutation.kind}`);
        return done();
      });

      scoped.activateScope('user-a', 'cal-1');
      const summary = await scoped.flush();
      expect(summary.done).toBe(1);
      expect(seen).toEqual(['user-a:cal-1:a-cal-1']);
      expect(await scoped.size()).toBe(0);

      scoped.activateScope('user-a', 'cal-2');
      expect(await scoped.size()).toBe(1);
      scoped.activateScope('user-b', 'cal-1');
      expect(await scoped.size()).toBe(1);
    });

    it('clears only the active scope and never a signed-out foreign queue', async () => {
      const scoped = freshOutbox();
      scoped.activateScope('user-a', 'shared-cal');
      await scoped.enqueue('events', 'shared-cal', { kind: 'from-a' });
      scoped.activateScope('user-b', 'shared-cal');
      await scoped.enqueue('events', 'shared-cal', { kind: 'from-b' });

      scoped.activateScope('user-a', 'shared-cal');
      await scoped.clear();
      scoped.deactivateScope();
      await expect(scoped.clear()).rejects.toThrow(/active outbox scope/i);

      scoped.activateScope('user-b', 'shared-cal');
      expect(
        (await scoped.peek<TestMutation>('events', 'shared-cal')).map((r) => r.mutation.kind),
      ).toEqual(['from-b']);
    });
  });

  describe('claimLegacy', () => {
    it('claims only unowned records from explicitly allowed calendars', async () => {
      const scoped = freshOutbox();
      await scoped.enqueueLegacy('events', 'allowed', { kind: 'allowed-event' });
      await scoped.enqueueLegacy('todos', 'allowed', { kind: 'allowed-todo' });
      await scoped.enqueueLegacy('events', 'denied', { kind: 'denied-event' });

      expect(await scoped.claimLegacy('user-a', ['allowed'])).toBe(2);
      expect(await scoped.claimLegacy('user-b', ['allowed'])).toBe(0);

      scoped.activateScope('user-a', 'allowed');
      expect(await scoped.size()).toBe(2);
      expect((await scoped.peek('events', 'allowed'))[0]?.ownerUserId).toBe('user-a');
      scoped.deactivateScope();

      expect(await scoped.claimLegacy('user-b', ['denied'])).toBe(1);
      scoped.activateScope('user-b', 'denied');
      expect(await scoped.size()).toBe(1);
    });

    it('never steals an already owned record', async () => {
      const scoped = freshOutbox();
      scoped.activateScope('user-a', 'cal-1');
      await scoped.enqueue('events', 'cal-1', { kind: 'owned' });
      scoped.deactivateScope();

      expect(await scoped.claimLegacy('user-b', ['cal-1'])).toBe(0);
      scoped.activateScope('user-a', 'cal-1');
      expect(await scoped.size()).toBe(1);
      scoped.activateScope('user-b', 'cal-1');
      expect(await scoped.size()).toBe(0);
    });

    it('serializes concurrent claims so one owner receives the whole transaction', async () => {
      const scoped = freshOutbox();
      await scoped.enqueueLegacy('events', 'cal-1', { kind: 'first' });
      await scoped.enqueueLegacy('todos', 'cal-1', { kind: 'second' });

      const counts = await Promise.all([
        scoped.claimLegacy('user-a', ['cal-1']),
        scoped.claimLegacy('user-b', ['cal-1']),
      ]);
      expect(counts.sort()).toEqual([0, 2]);

      const records = await (await scoped.db()).getAll('outbox');
      expect(new Set(records.map((record) => record.ownerUserId)).size).toBe(1);
      expect(records.every((record) => record.ownerUserId !== '')).toBe(true);
    });

    it('allows legacy writes only before activation and validates claim input', async () => {
      const scoped = freshOutbox();
      const legacy = await scoped.enqueue('events', 'cal-1', { kind: 'legacy' }, { legacy: true });
      expect(legacy.ownerUserId).toBe('');
      expect(legacy.legacy).toBe(true);
      await expect(scoped.claimLegacy('', ['cal-1'])).rejects.toThrow(/ownerUserId/);
      expect(await scoped.claimLegacy('user-a', [])).toBe(0);

      scoped.activateScope('user-a', 'cal-1');
      await expect(scoped.enqueueLegacy('events', 'cal-1', { kind: 'late' })).rejects.toThrow(
        /before an outbox scope/i,
      );
    });
  });

  describe('replaceQueue', () => {
    it('swaps a queue atomically and preserves the given order', async () => {
      await outbox.enqueue<TestMutation>('events', 'cal-1', { kind: 'a' });
      await outbox.enqueue<TestMutation>('events', 'cal-1', { kind: 'b' });

      await outbox.replaceQueue<TestMutation>('events', 'cal-1', [
        { kind: 'merged' },
        { kind: 'tail' },
      ]);

      const pending = await outbox.peek<TestMutation>('events', 'cal-1');
      expect(pending.map((r) => r.mutation.kind)).toEqual(['merged', 'tail']);
    });

    it('empties a queue when handed an empty list', async () => {
      await outbox.enqueue<TestMutation>('events', 'cal-1', { kind: 'a' });

      await outbox.replaceQueue('events', 'cal-1', []);

      expect(await outbox.peek('events', 'cal-1')).toHaveLength(0);
    });

    it('does not disturb other queues', async () => {
      await outbox.enqueue<TestMutation>('events', 'cal-1', { kind: 'a' });
      await outbox.enqueue<TestMutation>('todos', 'cal-1', { kind: 'other' });

      await outbox.replaceQueue<TestMutation>('events', 'cal-1', [{ kind: 'replaced' }]);

      expect(
        (await outbox.peek<TestMutation>('todos', 'cal-1')).map((r) => r.mutation.kind),
      ).toEqual(['other']);
    });
  });

  describe('clear', () => {
    it('clears a single domain and leaves the rest', async () => {
      await outbox.enqueue('events', 'cal-1', { kind: 'a' });
      await outbox.enqueue('todos', 'cal-1', { kind: 'b' });

      await outbox.clear('events');

      expect(await outbox.sizeOf('events')).toBe(0);
      expect(await outbox.sizeOf('todos')).toBe(1);
    });

    it('clears everything when no domain is given', async () => {
      await outbox.enqueue('events', 'cal-1', { kind: 'a' });
      await outbox.enqueue('todos', 'cal-1', { kind: 'b' });

      await outbox.clear();

      expect(await outbox.size()).toBe(0);
    });
  });
});
