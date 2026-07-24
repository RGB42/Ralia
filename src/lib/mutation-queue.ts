/**
 * Generic offline mutation queue shared by the calendar and todo features.
 *
 * Deliberately FIXES a real bug found in the legacy web app's events.js flush
 * loop (confirmed via code research): it had no per-mutation isolation, so a
 * single permanently-failing mutation (RLS denial, stale row, bad payload)
 * would throw out of the whole flush and wedge every later mutation behind it
 * forever — no retry cap, no way to clear it, and it could leave a "Saving…"
 * button stuck. todo-notes.js's queue got this right (per-item try/catch,
 * drop-with-toast on permanent errors, keep-and-stop on transient ones); this
 * module generalizes that correct version for every feature to reuse.
 */
import { isOfflineSyncError } from './network';
import { readLocalJson, writeLocalJson, type QueuedMutation } from './storage';
import { supabase } from './supabase';
import { toast } from '@/store/toast-store';

export interface FlushHandlers {
  /** Called after a successful insert whose row got a real DB id — rebase any dependents. */
  onRebase?: (tempId: string, realId: string) => void;
  /** Called once after the whole flush attempt (success or partial) so the UI can re-render. */
  onSettled?: () => void;
}

async function execute(m: QueuedMutation): Promise<{ tempId?: string; realId?: string } | void> {
  if (m.op === 'insert') {
    const values = { ...m.values };
    delete (values as Record<string, unknown>).id;
    const { data, error } = await supabase.from(m.table).insert(values).select('id').single();
    if (error) {
      if (error.code === '23505') return; // already applied — treat as success
      throw error;
    }
    if (m.tempId && data?.id) return { tempId: m.tempId, realId: data.id as string };
    return;
  }
  if (m.op === 'update') {
    const { error } = await supabase.from(m.table).update(m.values).eq('id', m.targetId);
    if (error) throw error;
    return;
  }
  if (m.op === 'delete') {
    const { error } = await supabase.from(m.table).delete().eq('id', m.targetId);
    if (error) throw error;
  }
}

/** Drains a queue FIFO. Stops (keeps remaining items) on a transient/offline error; drops-and-continues on a permanent one. */
export async function flushQueue(queueKey: string | null, handlers: FlushHandlers = {}): Promise<void> {
  if (!queueKey) return;
  let queue = await readLocalJson<QueuedMutation[]>(queueKey, []);
  if (queue.length === 0) return;

  let changed = false;
  while (queue.length > 0) {
    const [next, ...rest] = queue;
    try {
      const result = await execute(next);
      if (result?.tempId && result.realId) {
        handlers.onRebase?.(result.tempId, result.realId);
      }
      queue = rest;
      changed = true;
    } catch (error) {
      if (isOfflineSyncError(error)) {
        break; // connectivity issue — leave the queue intact, retry later
      }
      // Permanent rejection (RLS, validation, stale row) — drop it, don't wedge the queue.
      console.error('[mutation-queue] dropping rejected mutation', next, error);
      toast.error('Eine Änderung konnte nicht gespeichert werden.');
      queue = rest;
      changed = true;
    }
  }

  if (changed) {
    await writeLocalJson(queueKey, queue);
    handlers.onSettled?.();
  }
}

export async function enqueue(queueKey: string | null, mutation: Omit<QueuedMutation, 'id' | 'queuedAt'>): Promise<void> {
  if (!queueKey) return;
  const queue = await readLocalJson<QueuedMutation[]>(queueKey, []);
  queue.push({ ...mutation, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, queuedAt: new Date().toISOString() });
  await writeLocalJson(queueKey, queue);
}

/** Rewrites any still-queued mutation that referenced a temp id, once it's been rebased to a real one. */
export async function rebaseQueuedReferences(queueKey: string | null, tempId: string, realId: string): Promise<void> {
  if (!queueKey) return;
  const queue = await readLocalJson<QueuedMutation[]>(queueKey, []);
  let changed = false;
  const next = queue.map((m) => {
    let updated = m;
    if (updated.targetId === tempId) {
      updated = { ...updated, targetId: realId };
      changed = true;
    }
    if (updated.tempId === tempId) {
      updated = { ...updated, tempId: realId };
      changed = true;
    }
    return updated;
  });
  if (changed) await writeLocalJson(queueKey, next);
}
