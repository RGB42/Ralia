/**
 * Outbox — the offline mutation queue.
 *
 * Scope boundary: this module owns *transport and persistence* only. It knows
 * how to store a mutation durably, when to retry it, and how to tell a
 * temporary id apart from a real one. It deliberately knows nothing about what
 * an event or a todo is — the domain packages supply an executor and their own
 * coalescing rules, which keeps those rules pure and testable without a
 * database.
 */

/** One queue per domain per calendar, mirroring Ralia 1.x. */
export const OUTBOX_DOMAINS = ['events', 'todos', 'expenses', 'weekplan'] as const;

export type OutboxDomain = (typeof OUTBOX_DOMAINS)[number];

export function isOutboxDomain(value: unknown): value is OutboxDomain {
  return typeof value === 'string' && (OUTBOX_DOMAINS as readonly string[]).includes(value);
}

export interface OutboxRecord<TMutation = unknown> {
  /** IndexedDB auto-increment key. Assigned on write. */
  id: number;
  domain: OutboxDomain;
  /** Queues are scoped per calendar, exactly as in Ralia 1.x. */
  calendarId: string;
  mutation: TMutation;
  /** Wall clock ms at first enqueue. Drives FIFO ordering within a queue. */
  enqueuedAt: number;
  /** Failed flush attempts so far. Drives the backoff. */
  attempts: number;
  /** Wall clock ms; the record is skipped while `now < retryAfter`. */
  retryAfter: number;
  /** True when imported from the pre-2.0 localStorage queues. */
  legacy: boolean;
  /** Last retryable failure, kept for diagnostics. */
  lastError: string | null;
}

/** A record that has not been written yet, so it has no key. */
export type NewOutboxRecord<TMutation = unknown> = Omit<OutboxRecord<TMutation>, 'id'>;

/**
 * What the domain executor decided about a record.
 *
 * - `done`   — the server accepted it. Remove from the queue. If the mutation
 *              created a row, `rebase` carries the temp→real id mapping so the
 *              rest of the app can swap the optimistic id out.
 * - `retry`  — transport failure. Keep the record, apply backoff.
 * - `drop`   — the server refused it and always will (4xx). Remove the record
 *              and roll the optimistic state back.
 */
export type FlushOutcome =
  | { status: 'done'; rebase?: IdRebase }
  | { status: 'retry'; reason: string }
  | { status: 'drop'; reason: string };

export interface IdRebase {
  tempId: string;
  realId: string;
}

export type OutboxExecutor<TMutation = unknown> = (
  record: OutboxRecord<TMutation>,
) => Promise<FlushOutcome>;

export interface FlushSummary {
  /** Records the server accepted. */
  done: number;
  /** Records kept for a later attempt. */
  retried: number;
  /** Records discarded because the server refused them. */
  dropped: number;
  /** Records skipped because their backoff had not elapsed. */
  deferred: number;
  /** Temp→real id mappings produced during this flush, in flush order. */
  rebases: IdRebase[];
  /** Reasons for dropped records, so the caller can surface them. */
  dropReasons: string[];
}

export function emptyFlushSummary(): FlushSummary {
  return { done: 0, retried: 0, dropped: 0, deferred: 0, rebases: [], dropReasons: [] };
}
