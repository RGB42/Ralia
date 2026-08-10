import { describe, expect, it, vi } from 'vitest';
import { createRecurringSeriesRepo, type RecurringSeriesGateway } from './recurring-series-repo.js';

const event = {
  id: '11111111-1111-4111-8111-111111111111',
  calendar_id: 'calendar',
  name: 'Weekly',
  start_date: '2026-08-10',
  end_date: '2026-08-10',
};

describe('createRecurringSeriesRepo', () => {
  it('sends a scoped split and validates the response', async () => {
    const splitFuture = vi.fn<RecurringSeriesGateway['splitFuture']>().mockResolvedValue({
      data: { oldMaster: event, newMaster: { ...event, id: 'new' }, deletedFuture: false },
      error: null,
    });
    const repo = createRecurringSeriesRepo({ splitFuture });
    const result = await repo.splitFuture({
      masterEventId: event.id,
      originalOccurrenceDate: '2026-08-17',
      changes: { name: 'Changed' },
      deleteFuture: false,
    });
    expect(result.newMaster?.id).toBe('new');
    expect(splitFuture).toHaveBeenCalledWith(
      expect.objectContaining({
        p_master_event_id: event.id,
        p_original_occurrence_date: '2026-08-17',
        p_delete_future: false,
      }),
    );
  });

  it('rejects invalid dates before calling the gateway', async () => {
    const splitFuture = vi.fn<RecurringSeriesGateway['splitFuture']>();
    const repo = createRecurringSeriesRepo({ splitFuture });
    await expect(
      repo.splitFuture({
        masterEventId: event.id,
        originalOccurrenceDate: 'invalid',
        changes: {},
        deleteFuture: true,
      }),
    ).rejects.toMatchObject({ code: 'invalid_input' });
    expect(splitFuture).not.toHaveBeenCalled();
  });

  it('rejects malformed RPC responses', async () => {
    const repo = createRecurringSeriesRepo({
      splitFuture: async () => ({ data: { ok: true }, error: null }),
    });
    await expect(
      repo.splitFuture({
        masterEventId: event.id,
        originalOccurrenceDate: '2026-08-17',
        changes: {},
        deleteFuture: true,
      }),
    ).rejects.toMatchObject({ code: 'invalid_response' });
  });
});
