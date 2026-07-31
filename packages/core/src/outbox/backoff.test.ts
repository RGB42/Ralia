import { describe, expect, it } from 'vitest';
import { BACKOFF_CEILING_MS, backoffDelayMs } from './backoff.js';

describe('backoffDelayMs', () => {
  it('does not delay a record that has never failed', () => {
    expect(backoffDelayMs(0)).toBe(0);
    expect(backoffDelayMs(-1)).toBe(0);
  });

  it('doubles the delay per failed attempt', () => {
    expect(backoffDelayMs(1)).toBe(1_000);
    expect(backoffDelayMs(2)).toBe(2_000);
    expect(backoffDelayMs(3)).toBe(4_000);
    expect(backoffDelayMs(4)).toBe(8_000);
  });

  it('caps the delay so a long outage still retries regularly', () => {
    expect(backoffDelayMs(20)).toBe(BACKOFF_CEILING_MS);
    // A device offline for days must not end up with an hours-long delay.
    expect(backoffDelayMs(10_000)).toBe(BACKOFF_CEILING_MS);
  });

  it('never returns a non-finite delay', () => {
    for (const attempts of [1, 5, 31, 64, 1_000, 10_000]) {
      expect(Number.isFinite(backoffDelayMs(attempts))).toBe(true);
    }
  });
});
