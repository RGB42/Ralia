import { describe, expect, it } from 'vitest';
import {
  calendarMembers,
  computeCalendarId,
  displayBelongsTo,
  isPairedCalendarId,
} from './calendar-id.js';

const ALICE = '11111111-1111-1111-1111-111111111111';
const BOB = '22222222-2222-2222-2222-222222222222';

describe('computeCalendarId', () => {
  it('uses the bare user id when solo', () => {
    expect(computeCalendarId(ALICE)).toBe(ALICE);
    expect(computeCalendarId(ALICE, null)).toBe(ALICE);
  });

  it('joins a connected pair with an underscore', () => {
    expect(computeCalendarId(ALICE, BOB)).toBe(`${ALICE}_${BOB}`);
  });

  it('is order-independent, so both devices compute the same id', () => {
    expect(computeCalendarId(ALICE, BOB)).toBe(computeCalendarId(BOB, ALICE));
  });

  it('treats being your own partner as solo', () => {
    expect(computeCalendarId(ALICE, ALICE)).toBe(ALICE);
  });

  it('refuses to build an id without a user', () => {
    expect(() => computeCalendarId('')).toThrow();
  });

  it('keeps every member id findable by substring, as the RLS policies require', () => {
    const id = computeCalendarId(ALICE, BOB);
    // Policies authorise with `position(auth.uid()::text in calendar_id) > 0`.
    expect(id.includes(ALICE)).toBe(true);
    expect(id.includes(BOB)).toBe(true);
  });
});

describe('isPairedCalendarId', () => {
  it('distinguishes solo from paired', () => {
    expect(isPairedCalendarId(ALICE)).toBe(false);
    expect(isPairedCalendarId(`${ALICE}_${BOB}`)).toBe(true);
  });
});

describe('calendarMembers', () => {
  it('lists the ids in a calendar', () => {
    expect(calendarMembers(`${ALICE}_${BOB}`)).toEqual([ALICE, BOB]);
    expect(calendarMembers(ALICE)).toEqual([ALICE]);
  });
});

describe('displayBelongsTo', () => {
  it('leaves rows the viewer created untouched', () => {
    expect(displayBelongsTo('user1', ALICE, ALICE)).toBe('user1');
    expect(displayBelongsTo('user2', ALICE, ALICE)).toBe('user2');
  });

  it('mirrors rows the partner created', () => {
    // Bob stored "mine" as user1; Alice must see it as the partner's.
    expect(displayBelongsTo('user1', BOB, ALICE)).toBe('user2');
    expect(displayBelongsTo('user2', BOB, ALICE)).toBe('user1');
  });

  it('never mirrors shared rows', () => {
    expect(displayBelongsTo('both', BOB, ALICE)).toBe('both');
    expect(displayBelongsTo('both', ALICE, ALICE)).toBe('both');
  });

  it('treats a missing belongs_to as shared', () => {
    expect(displayBelongsTo(null, BOB, ALICE)).toBe('both');
  });

  it('does not mirror when the creator is unknown', () => {
    // Legacy rows can lack created_by; guessing would flip colours at random.
    expect(displayBelongsTo('user1', null, ALICE)).toBe('user1');
  });
});
