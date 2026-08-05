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
  });

  it('stores an enqueued mutation and hands back a keyed record', async () => {
    const record = await outbox.enqueue<TestMutation>('events', 'cal-1', { kind: 'insert' });

    expect(record.id).toBeGreaterThan(0);
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
    await outbox.enqueue('events', 'cal-2', { kind: 'e2' });
    await outbox.enqueue('todos', 'cal-1', { kind: 't1' });

    expect(await outbox.peek('events', 'cal-1')).toHaveLength(1);
    expect(await outbox.peek('events', 'cal-2')).toHaveLength(1);
    expect(await outbox.peek('todos', 'cal-1')).toHaveLength(1);
    expect(await outbox.sizeOf('events')).toBe(2);
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
      await outbox.enqueue<TestMutation>('events', 'cal-2', { kind: 'other' });

      await outbox.replaceQueue<TestMutation>('events', 'cal-1', [{ kind: 'replaced' }]);

      expect(
        (await outbox.peek<TestMutation>('events', 'cal-2')).map((r) => r.mutation.kind),
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
