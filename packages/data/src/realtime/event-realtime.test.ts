import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import type { RaliaSupabaseClient } from '../client.js';
import {
  subscribeToEventRealtime,
  type EventRealtimeInvalidation,
  type EventRealtimeOperation,
  type EventRealtimeTable,
} from './event-realtime.js';

const CALENDAR_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER_CALENDAR_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

interface Binding {
  filter: {
    event: string;
    schema: string;
    table: string;
    filter: string;
  };
  callback: (payload: RealtimePostgresChangesPayload<{ calendar_id: string }>) => void;
}

function harness(removeStatus = 'ok') {
  const bindings: Binding[] = [];
  const channel = {
    on: vi.fn(),
    subscribe: vi.fn(),
  };
  channel.on.mockImplementation((_type, filter, callback) => {
    bindings.push({ filter, callback });
    return channel;
  });
  channel.subscribe.mockReturnValue(channel);

  const client = {
    channel: vi.fn().mockReturnValue(channel),
    removeChannel: vi.fn().mockResolvedValue(removeStatus),
  } as unknown as RaliaSupabaseClient;

  function emit(
    table: EventRealtimeTable,
    operation: EventRealtimeOperation,
    calendarId = CALENDAR_ID,
  ): void {
    const binding = bindings.find((candidate) => candidate.filter.table === table);
    if (binding === undefined) throw new Error(`Missing test binding for ${table}`);

    const record = { calendar_id: calendarId };
    const payloadBase = {
      schema: 'public',
      table,
      commit_timestamp: '2026-08-10T12:00:00Z',
      errors: [],
    };

    if (operation === 'INSERT') {
      binding.callback({ ...payloadBase, eventType: 'INSERT', new: record, old: {} });
    } else if (operation === 'UPDATE') {
      binding.callback({ ...payloadBase, eventType: 'UPDATE', new: record, old: record });
    } else {
      binding.callback({ ...payloadBase, eventType: 'DELETE', new: {}, old: record });
    }
  }

  return { bindings, channel, client, emit };
}

describe('subscribeToEventRealtime', () => {
  it('subscribes both event tables on one channel with the same exact calendar filter', () => {
    const { bindings, channel, client } = harness();

    subscribeToEventRealtime(client, CALENDAR_ID, vi.fn());

    expect(client.channel).toHaveBeenCalledOnce();
    expect(client.channel).toHaveBeenCalledWith(expect.stringMatching(/^ralia-event-realtime:/));
    expect(bindings.map(({ filter }) => filter)).toEqual([
      {
        event: '*',
        schema: 'public',
        table: 'events',
        filter: `calendar_id=eq.${CALENDAR_ID}`,
      },
      {
        event: '*',
        schema: 'public',
        table: 'recurring_event_exceptions',
        filter: `calendar_id=eq.${CALENDAR_ID}`,
      },
    ]);
    expect(channel.subscribe).toHaveBeenCalledOnce();
  });

  it('reports INSERT, UPDATE and DELETE as typed invalidations without row payloads', () => {
    const { client, emit } = harness();
    const invalidations: EventRealtimeInvalidation[] = [];
    subscribeToEventRealtime(client, CALENDAR_ID, (invalidation) => {
      invalidations.push(invalidation);
    });

    for (const table of ['events', 'recurring_event_exceptions'] as const) {
      emit(table, 'INSERT');
      emit(table, 'UPDATE');
      emit(table, 'DELETE');
    }

    expect(invalidations).toEqual([
      { calendarId: CALENDAR_ID, table: 'events', operation: 'INSERT' },
      { calendarId: CALENDAR_ID, table: 'events', operation: 'UPDATE' },
      { calendarId: CALENDAR_ID, table: 'events', operation: 'DELETE' },
      {
        calendarId: CALENDAR_ID,
        table: 'recurring_event_exceptions',
        operation: 'INSERT',
      },
      {
        calendarId: CALENDAR_ID,
        table: 'recurring_event_exceptions',
        operation: 'UPDATE',
      },
      {
        calendarId: CALENDAR_ID,
        table: 'recurring_event_exceptions',
        operation: 'DELETE',
      },
    ]);
  });

  it('ignores a defensive payload mismatch instead of invalidating another calendar', () => {
    const { client, emit } = harness();
    const onInvalidation = vi.fn();
    subscribeToEventRealtime(client, CALENDAR_ID, onInvalidation);

    emit('events', 'UPDATE', OTHER_CALENDAR_ID);
    emit('recurring_event_exceptions', 'DELETE', OTHER_CALENDAR_ID);

    expect(onInvalidation).not.toHaveBeenCalled();
  });

  it('quotes filter delimiters instead of widening a malformed calendar scope', () => {
    const { bindings, client } = harness();

    subscribeToEventRealtime(client, 'calendar,other', vi.fn());

    expect(
      bindings.every(({ filter }) => filter.filter === 'calendar_id=eq."calendar,other"'),
    ).toBe(true);
  });

  it('rejects an empty calendar before creating a channel', () => {
    const { client } = harness();

    expect(() => subscribeToEventRealtime(client, '   ', vi.fn())).toThrow(
      'subscribeToEventRealtime requires a calendar id',
    );
    expect(client.channel).not.toHaveBeenCalled();
  });

  it('unsubscribes idempotently and stops delivery as soon as cleanup starts', async () => {
    const { channel, client, emit } = harness();
    const onInvalidation = vi.fn();
    const subscription = subscribeToEventRealtime(client, CALENDAR_ID, onInvalidation);
    emit('events', 'INSERT');

    const firstCleanup = subscription.unsubscribe();
    const secondCleanup = subscription.unsubscribe();
    emit('events', 'UPDATE');

    expect(firstCleanup).toBe(secondCleanup);
    await expect(firstCleanup).resolves.toBe('ok');
    expect(client.removeChannel).toHaveBeenCalledOnce();
    expect(client.removeChannel).toHaveBeenCalledWith(channel);
    expect(onInvalidation).toHaveBeenCalledOnce();
  });

  it('uses an independent channel per subscription instead of shared singleton state', async () => {
    const { client } = harness();

    const first = subscribeToEventRealtime(client, CALENDAR_ID, vi.fn());
    const second = subscribeToEventRealtime(client, CALENDAR_ID, vi.fn());

    const firstName = vi.mocked(client.channel).mock.calls[0]?.[0];
    const secondName = vi.mocked(client.channel).mock.calls[1]?.[0];
    expect(firstName).toBeTypeOf('string');
    expect(secondName).toBeTypeOf('string');
    expect(firstName).not.toBe(secondName);

    await Promise.all([first.unsubscribe(), second.unsubscribe()]);
    expect(client.removeChannel).toHaveBeenCalledTimes(2);
  });
});
