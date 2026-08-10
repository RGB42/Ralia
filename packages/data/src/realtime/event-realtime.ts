import { postgresChangesFilter, type RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import type { RaliaSupabaseClient } from '../client.js';
import type { EventsRow, RecurringEventExceptionsRow } from '../database.types.js';

export type EventRealtimeTable = 'events' | 'recurring_event_exceptions';
export type EventRealtimeOperation = 'INSERT' | 'UPDATE' | 'DELETE';

/** Signals that calendar reads are stale without applying a payload as local state. */
export interface EventRealtimeInvalidation {
  readonly calendarId: string;
  readonly table: EventRealtimeTable;
  readonly operation: EventRealtimeOperation;
}

export type EventRealtimeUnsubscribeStatus = Awaited<
  ReturnType<RaliaSupabaseClient['removeChannel']>
>;

export interface EventRealtimeSubscription {
  /** Idempotently stops delivery and removes this subscription's Supabase channel. */
  unsubscribe(): Promise<EventRealtimeUnsubscribeStatus>;
}

type EventRealtimeRow = EventsRow | RecurringEventExceptionsRow;

function payloadMatchesCalendar(
  payload: RealtimePostgresChangesPayload<EventRealtimeRow>,
  calendarId: string,
): boolean {
  const record = payload.eventType === 'DELETE' ? payload.old : payload.new;
  return record.calendar_id === undefined || record.calendar_id === calendarId;
}

/**
 * Subscribes one listener to event changes for exactly one calendar.
 *
 * Each invocation owns its channel. Payload rows deliberately stay internal:
 * consumers invalidate and reload their scoped reads instead of mutating data
 * from a Realtime payload.
 */
export function subscribeToEventRealtime(
  client: RaliaSupabaseClient,
  calendarId: string,
  onInvalidation: (invalidation: EventRealtimeInvalidation) => void,
): EventRealtimeSubscription {
  if (calendarId.trim().length === 0) {
    throw new Error('subscribeToEventRealtime requires a calendar id');
  }

  const filter = postgresChangesFilter().eq('calendar_id', calendarId).build();
  const channel = client.channel(`ralia-event-realtime:${crypto.randomUUID()}`);
  let active = true;

  const emit = (
    table: EventRealtimeTable,
    payload: RealtimePostgresChangesPayload<EventRealtimeRow>,
  ): void => {
    if (!active || !payloadMatchesCalendar(payload, calendarId)) return;
    onInvalidation({ calendarId, table, operation: payload.eventType });
  };

  channel
    .on<EventsRow>(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'events', filter },
      (payload) => emit('events', payload),
    )
    .on<RecurringEventExceptionsRow>(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'recurring_event_exceptions',
        filter,
      },
      (payload) => emit('recurring_event_exceptions', payload),
    )
    .subscribe();

  let unsubscribePromise: Promise<EventRealtimeUnsubscribeStatus> | undefined;

  return {
    unsubscribe() {
      active = false;
      unsubscribePromise ??= client.removeChannel(channel);
      return unsubscribePromise;
    },
  };
}
