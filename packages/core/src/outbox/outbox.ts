import { backoffDelayMs } from './backoff.js';
import { forInsert, openRaliaDB, type RaliaDatabase } from './db.js';
import {
  emptyFlushSummary,
  type FlushOutcome,
  type FlushSummary,
  type NewOutboxRecord,
  OUTBOX_DOMAINS,
  type OutboxDomain,
  type OutboxExecutor,
  type OutboxRecord,
} from './types.js';

export interface OutboxOptions {
  /** Injectable clock so tests control backoff without waiting. */
  now?: () => number;
  /** Pre-opened database; when omitted the outbox opens the default one. */
  database?: RaliaDatabase;
  /** Database name override, used by tests for isolation. */
  databaseName?: string;
}

interface ActiveScope {
  ownerUserId: string;
  calendarId: string;
  revision: number;
}

interface FlushRun {
  scope: ActiveScope;
  promise: Promise<FlushSummary>;
}

/**
 * Durable queue of mutations awaiting the server.
 *
 * Ordering guarantee: within one (ownerUserId, domain, calendarId) queue,
 * records flush in enqueue order and a failure stops that queue. This matters
 * because mutations are not independent — an update to a row created offline
 * must never reach the server before the insert that creates it. Different
 * domain queues inside the active account/calendar scope are independent.
 */
export class Outbox {
  private readonly now: () => number;
  private readonly databaseName: string | undefined;
  private database: RaliaDatabase | undefined;
  private opening: Promise<RaliaDatabase> | undefined;
  private readonly executors = new Map<OutboxDomain, OutboxExecutor<never>>();
  private activeScope: ActiveScope | undefined;
  private scopeRevision = 0;
  private flushing: FlushRun | undefined;

  constructor(options: OutboxOptions = {}) {
    this.now = options.now ?? Date.now;
    this.database = options.database;
    this.databaseName = options.databaseName;
  }

  /** Activates exactly one account/calendar pair for normal queue operations. */
  activateScope(ownerUserId: string, calendarId: string): void {
    assertNonEmpty('ownerUserId', ownerUserId);
    assertNonEmpty('calendarId', calendarId);
    this.scopeRevision += 1;
    this.activeScope = { ownerUserId, calendarId, revision: this.scopeRevision };
  }

  /** Drops access to the current scope without deleting any durable records. */
  deactivateScope(): void {
    this.scopeRevision += 1;
    this.activeScope = undefined;
  }

  /** Registers the function that talks to the server for one domain. */
  registerExecutor<TMutation>(domain: OutboxDomain, executor: OutboxExecutor<TMutation>): void {
    this.executors.set(domain, executor as OutboxExecutor<never>);
  }

  async db(): Promise<RaliaDatabase> {
    if (this.database) return this.database;
    // Concurrent callers must share one open() call, or IndexedDB upgrades race.
    this.opening ??= openRaliaDB(this.databaseName).then((db) => {
      this.database = db;
      return db;
    });
    return this.opening;
  }

  /** Appends a mutation to the active account/calendar queue. */
  async enqueue<TMutation>(
    domain: OutboxDomain,
    calendarId: string,
    mutation: TMutation,
    options: { legacy?: boolean; enqueuedAt?: number } = {},
  ): Promise<OutboxRecord<TMutation>> {
    if (options.legacy === true) {
      return this.enqueueLegacy(domain, calendarId, mutation, options);
    }

    const scope = this.requireActiveScope(calendarId);
    return this.insert(domain, calendarId, mutation, scope.ownerUserId, false, options.enqueuedAt);
  }

  /**
   * Appends an unclaimed migration record before authentication is available.
   * Such records are invisible to normal operations until claimLegacy() assigns
   * a non-empty owner.
   */
  async enqueueLegacy<TMutation>(
    domain: OutboxDomain,
    calendarId: string,
    mutation: TMutation,
    options: { enqueuedAt?: number } = {},
  ): Promise<OutboxRecord<TMutation>> {
    assertNonEmpty('calendarId', calendarId);
    if (this.activeScope) {
      throw new Error('Legacy records can only be enqueued before an outbox scope is active');
    }

    return this.insert(domain, calendarId, mutation, '', true, options.enqueuedAt);
  }

  private async insert<TMutation>(
    domain: OutboxDomain,
    calendarId: string,
    mutation: TMutation,
    ownerUserId: string,
    legacy: boolean,
    enqueuedAt?: number,
  ): Promise<OutboxRecord<TMutation>> {
    const db = await this.db();
    const record: NewOutboxRecord<TMutation> = {
      ownerUserId,
      domain,
      calendarId,
      mutation,
      enqueuedAt: enqueuedAt ?? this.now(),
      attempts: 0,
      retryAfter: 0,
      legacy,
      lastError: null,
    };
    const id = await db.add('outbox', forInsert(record));
    return { ...record, id: id as number };
  }

  /** Pending records of one queue, in flush order. */
  async peek<TMutation>(
    domain: OutboxDomain,
    calendarId: string,
  ): Promise<OutboxRecord<TMutation>[]> {
    const scope = this.requireActiveScope(calendarId);
    const db = await this.db();
    const rows = await db.getAllFromIndex(
      'outbox',
      'by-owner-domain-calendar',
      queueRange(scope.ownerUserId, domain, calendarId),
    );
    this.assertScopeActive(scope);
    return rows as OutboxRecord<TMutation>[];
  }

  /**
   * Atomically replaces the pending records of one queue.
   *
   * This is how domain packages apply their coalescing rules: read with
   * `peek`, fold the incoming mutation into the pending list with a pure
   * function, write the result back here. Doing it in one transaction keeps a
   * concurrent flush from observing a half-rewritten queue.
   */
  async replaceQueue<TMutation>(
    domain: OutboxDomain,
    calendarId: string,
    mutations: readonly TMutation[],
  ): Promise<OutboxRecord<TMutation>[]> {
    const scope = this.requireActiveScope(calendarId);
    const db = await this.db();
    const tx = db.transaction('outbox', 'readwrite');
    const index = tx.store.index('by-owner-domain-calendar');
    const range = queueRange(scope.ownerUserId, domain, calendarId);

    const existing = await index.getAll(range);
    for (const row of existing) {
      await tx.store.delete(row.id);
    }

    // Preserve relative ordering by reusing the oldest enqueue time as the base.
    const base = existing.length > 0 ? Math.min(...existing.map((r) => r.enqueuedAt)) : this.now();
    const written: OutboxRecord<TMutation>[] = [];
    for (const [offset, mutation] of mutations.entries()) {
      const record: NewOutboxRecord<TMutation> = {
        ownerUserId: scope.ownerUserId,
        domain,
        calendarId,
        mutation,
        enqueuedAt: base + offset,
        attempts: 0,
        retryAfter: 0,
        legacy: false,
        lastError: null,
      };
      const id = await tx.store.add(forInsert(record));
      written.push({ ...record, id: id as number });
    }

    await tx.done;
    this.assertScopeActive(scope);
    return written;
  }

  /** Total pending records in the active account/calendar scope. */
  async size(): Promise<number> {
    const scope = this.requireActiveScope();
    const db = await this.db();
    const tx = db.transaction('outbox');
    const index = tx.store.index('by-owner-domain-calendar');
    const counts = await Promise.all(
      OUTBOX_DOMAINS.map((domain) =>
        index.count(queueRange(scope.ownerUserId, domain, scope.calendarId)),
      ),
    );
    await tx.done;
    this.assertScopeActive(scope);
    return counts.reduce((total, count) => total + count, 0);
  }

  /** Pending record count for one domain in the active scope. */
  async sizeOf(domain: OutboxDomain): Promise<number> {
    const scope = this.requireActiveScope();
    const db = await this.db();
    const count = await db.countFromIndex(
      'outbox',
      'by-owner-domain-calendar',
      queueRange(scope.ownerUserId, domain, scope.calendarId),
    );
    this.assertScopeActive(scope);
    return count;
  }

  /** Deletes only records belonging to the active account/calendar scope. */
  async clear(domain?: OutboxDomain): Promise<void> {
    const scope = this.requireActiveScope();
    const db = await this.db();
    const tx = db.transaction('outbox', 'readwrite');
    const index = tx.store.index('by-owner-domain-calendar');
    const domains = domain ? [domain] : OUTBOX_DOMAINS;
    for (const scopedDomain of domains) {
      const rows = await index.getAll(
        queueRange(scope.ownerUserId, scopedDomain, scope.calendarId),
      );
      for (const row of rows) {
        await tx.store.delete(row.id);
      }
    }
    await tx.done;
  }

  /** Removes every durable mutation ever attributed to one account. */
  async purgeOwner(ownerUserId: string): Promise<void> {
    assertNonEmpty('ownerUserId', ownerUserId);
    if (this.activeScope?.ownerUserId === ownerUserId) this.deactivateScope();

    const db = await this.db();
    const tx = db.transaction('outbox', 'readwrite');
    const rows = await tx.store.index('by-owner').getAll(ownerUserId);
    for (const row of rows) await tx.store.delete(row.id);
    await tx.done;
  }

  /**
   * Atomically assigns unclaimed records from explicitly allowed calendars.
   * Existing owners and records from every other calendar remain untouched.
   */
  async claimLegacy(ownerUserId: string, allowedCalendarIds: readonly string[]): Promise<number> {
    assertNonEmpty('ownerUserId', ownerUserId);
    const calendars = [...new Set(allowedCalendarIds)];
    for (const calendarId of calendars) assertNonEmpty('allowedCalendarIds entry', calendarId);
    if (calendars.length === 0) return 0;

    const db = await this.db();
    const tx = db.transaction('outbox', 'readwrite');
    const index = tx.store.index('by-owner-domain-calendar');
    let claimed = 0;

    for (const calendarId of calendars) {
      for (const domain of OUTBOX_DOMAINS) {
        const rows = await index.getAll(queueRange('', domain, calendarId));
        for (const row of rows) {
          await tx.store.put({ ...row, ownerUserId });
          claimed += 1;
        }
      }
    }

    await tx.done;
    return claimed;
  }

  /**
   * Attempts to drain the active account/calendar scope.
   *
   * Concurrent calls for that scope share one run. A scope switch waits for an
   * older run to stop before starting another, preventing duplicate sends while
   * authentication is changing.
   */
  async flush(): Promise<FlushSummary> {
    const scope = this.requireActiveScope();

    while (this.flushing) {
      const running = this.flushing;
      if (sameScopeRevision(running.scope, scope)) return running.promise;
      try {
        await running.promise;
      } catch {
        // The failed run belongs to an older scope; the current one still gets
        // its own attempt if it remained active.
      }
      this.assertScopeActive(scope);
    }

    const promise = this.runFlush(scope);
    this.flushing = { scope, promise };
    try {
      return await promise;
    } finally {
      if (this.flushing?.promise === promise) this.flushing = undefined;
    }
  }

  private async runFlush(scope: ActiveScope): Promise<FlushSummary> {
    const summary = emptyFlushSummary();
    const db = await this.db();
    const tx = db.transaction('outbox');
    const index = tx.store.index('by-owner-domain-calendar');
    const queues = await Promise.all(
      OUTBOX_DOMAINS.map((domain) =>
        index.getAll(queueRange(scope.ownerUserId, domain, scope.calendarId)),
      ),
    );
    await tx.done;

    for (const records of queues) {
      if (!this.isScopeActive(scope)) {
        summary.deferred += records.length;
        continue;
      }
      await this.drainQueue(records, summary, scope);
    }

    return summary;
  }

  private async drainQueue(
    records: OutboxRecord[],
    summary: FlushSummary,
    scope: ActiveScope,
  ): Promise<void> {
    for (const [index, record] of records.entries()) {
      if (!this.isScopeActive(scope)) {
        summary.deferred += records.length - index;
        return;
      }

      const executor = this.executors.get(record.domain);
      if (!executor) {
        // No executor registered yet — the owning sub-project is not loaded.
        // Leave the record untouched; it is durable and will flush later.
        summary.deferred += 1;
        continue;
      }

      if (record.retryAfter > this.now()) {
        summary.deferred += 1;
        // Head-of-line blocking is intentional: later records in this queue may
        // depend on this one, so stop draining it and move to the next queue.
        return;
      }

      const outcome = await this.execute(executor, record);

      if (outcome.status === 'done') {
        await this.remove(record.id);
        summary.done += 1;
        if (outcome.rebase) summary.rebases.push(outcome.rebase);
        continue;
      }

      if (outcome.status === 'drop') {
        await this.remove(record.id);
        summary.dropped += 1;
        summary.dropReasons.push(outcome.reason);
        continue;
      }

      await this.scheduleRetry(record, outcome.reason);
      summary.retried += 1;
      return; // Stop this queue; preserve ordering.
    }
  }

  private async execute(
    executor: OutboxExecutor<never>,
    record: OutboxRecord,
  ): Promise<FlushOutcome> {
    try {
      return await executor(record as OutboxRecord<never>);
    } catch (error) {
      // An executor that throws instead of returning is treated as retryable.
      // Losing a user's mutation to a programming slip is the worse failure.
      return { status: 'retry', reason: describeError(error) };
    }
  }

  private async remove(id: number): Promise<void> {
    const db = await this.db();
    await db.delete('outbox', id);
  }

  private async scheduleRetry(record: OutboxRecord, reason: string): Promise<void> {
    const db = await this.db();
    const attempts = record.attempts + 1;
    const next: OutboxRecord = {
      ...record,
      attempts,
      retryAfter: this.now() + backoffDelayMs(attempts),
      lastError: reason,
    };
    await db.put('outbox', next);
  }

  private requireActiveScope(calendarId?: string): ActiveScope {
    const scope = this.activeScope;
    if (!scope) throw new Error('No active outbox scope');
    if (calendarId !== undefined && calendarId !== scope.calendarId) {
      throw new Error('The requested calendar does not match the active outbox scope');
    }
    return scope;
  }

  private assertScopeActive(scope: ActiveScope): void {
    if (!this.isScopeActive(scope)) throw new Error('The active outbox scope changed');
  }

  private isScopeActive(scope: ActiveScope): boolean {
    return this.activeScope !== undefined && sameScopeRevision(this.activeScope, scope);
  }
}

function queueRange(ownerUserId: string, domain: OutboxDomain, calendarId: string): IDBKeyRange {
  return IDBKeyRange.bound(
    [ownerUserId, domain, calendarId, -Infinity],
    [ownerUserId, domain, calendarId, Infinity],
  );
}

function sameScopeRevision(left: ActiveScope, right: ActiveScope): boolean {
  return (
    left.revision === right.revision &&
    left.ownerUserId === right.ownerUserId &&
    left.calendarId === right.calendarId
  );
}

function assertNonEmpty(name: string, value: string): void {
  if (value.length === 0) throw new Error(`${name} must not be empty`);
}

function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
