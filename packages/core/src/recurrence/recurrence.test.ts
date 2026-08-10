import { describe, expect, it } from 'vitest';
import {
  expandRecurringEvent,
  expandRecurringEvents,
  type RecurrenceOccurrence,
  type RecurrenceType,
  type RecurringEventException,
  type RecurringEventMaster,
  type RecurringEventOverride,
} from './index.js';

interface TestEvent extends RecurringEventMaster {
  calendar_id: string;
  title: string;
  location: string | null;
}

const RANGE_2026 = { startDate: '2026-01-01', endDate: '2026-12-31' };

function event(overrides: Partial<TestEvent> = {}): TestEvent {
  return {
    id: 'event-1',
    calendar_id: 'calendar-1',
    title: 'Series',
    location: null,
    start_date: '2026-01-01',
    end_date: '2026-01-01',
    recurrence_type: 'daily',
    recurrence_interval: 1,
    recurrence_end_date: null,
    ...overrides,
  };
}

function exception(
  overrides: Partial<RecurringEventException<TestEvent>> = {},
): RecurringEventException<TestEvent> {
  return {
    id: 'exception-1',
    master_event_id: 'event-1',
    original_occurrence_date: '2026-01-01',
    is_deleted: false,
    override_event_data: null,
    ...overrides,
  };
}

function originalDates(occurrences: RecurrenceOccurrence<TestEvent>[]): string[] {
  return occurrences.map((occurrence) => occurrence.originalOccurrenceDate);
}

describe('expandRecurringEvent', () => {
  describe('daily and weekly rules', () => {
    it('expands a daily interval and treats both range boundaries as inclusive', () => {
      const occurrences = expandRecurringEvent(
        event({
          start_date: '2026-03-01',
          end_date: '2026-03-01',
          recurrence_interval: 2,
        }),
        { startDate: '2026-03-03', endDate: '2026-03-07' },
      );

      expect(originalDates(occurrences)).toEqual(['2026-03-03', '2026-03-05', '2026-03-07']);
    });

    it('expands weekly rules in multiples of seven days', () => {
      const occurrences = expandRecurringEvent(
        event({ recurrence_type: 'weekly', recurrence_interval: 2 }),
        { startDate: '2026-01-01', endDate: '2026-02-01' },
      );

      expect(originalDates(occurrences)).toEqual(['2026-01-01', '2026-01-15', '2026-01-29']);
    });

    it('preserves a multi-day duration and includes occurrences overlapping the range', () => {
      const occurrences = expandRecurringEvent(
        event({
          start_date: '2026-03-01',
          end_date: '2026-03-03',
          recurrence_interval: 2,
        }),
        { startDate: '2026-03-04', endDate: '2026-03-05' },
      );

      expect(occurrences.map(({ start_date, end_date }) => [start_date, end_date])).toEqual([
        ['2026-03-03', '2026-03-05'],
        ['2026-03-05', '2026-03-07'],
      ]);
    });

    it('does not shift date-only values at a daylight-saving boundary', () => {
      const occurrences = expandRecurringEvent(
        event({ start_date: '2026-03-28', end_date: '2026-03-28' }),
        { startDate: '2026-03-28', endDate: '2026-03-31' },
      );

      expect(originalDates(occurrences)).toEqual([
        '2026-03-28',
        '2026-03-29',
        '2026-03-30',
        '2026-03-31',
      ]);
    });

    it('jumps directly into a range far after the master without an occurrence cap', () => {
      const occurrences = expandRecurringEvent(
        event({
          start_date: '1900-01-01',
          end_date: '1900-01-01',
          recurrence_interval: 3,
        }),
        { startDate: '2099-12-29', endDate: '2100-01-04' },
      );

      expect(originalDates(occurrences)).toEqual(['2099-12-30', '2100-01-02']);
    });
  });

  describe('monthly rules', () => {
    it('clamps the 31st to each month end without permanently drifting', () => {
      const occurrences = expandRecurringEvent(
        event({
          start_date: '2023-01-31',
          end_date: '2023-01-31',
          recurrence_type: 'monthly',
        }),
        { startDate: '2023-01-01', endDate: '2023-05-31' },
      );

      expect(originalDates(occurrences)).toEqual([
        '2023-01-31',
        '2023-02-28',
        '2023-03-31',
        '2023-04-30',
        '2023-05-31',
      ]);
    });

    it('uses February 29 at a leap-year month end', () => {
      const occurrences = expandRecurringEvent(
        event({
          start_date: '2024-01-31',
          end_date: '2024-01-31',
          recurrence_type: 'monthly',
        }),
        { startDate: '2024-01-31', endDate: '2024-03-31' },
      );

      expect(originalDates(occurrences)).toEqual(['2024-01-31', '2024-02-29', '2024-03-31']);
    });

    it('applies monthly intervals across year boundaries', () => {
      const occurrences = expandRecurringEvent(
        event({
          start_date: '2023-12-31',
          end_date: '2023-12-31',
          recurrence_type: 'monthly',
          recurrence_interval: 2,
        }),
        { startDate: '2023-12-01', endDate: '2024-04-30' },
      );

      expect(originalDates(occurrences)).toEqual(['2023-12-31', '2024-02-29', '2024-04-30']);
    });

    it('preserves duration when a monthly occurrence is clamped', () => {
      const occurrences = expandRecurringEvent(
        event({
          start_date: '2023-01-31',
          end_date: '2023-02-02',
          recurrence_type: 'monthly',
        }),
        { startDate: '2023-02-01', endDate: '2023-03-31' },
      );

      expect(occurrences.map(({ start_date, end_date }) => [start_date, end_date])).toEqual([
        ['2023-01-31', '2023-02-02'],
        ['2023-02-28', '2023-03-02'],
        ['2023-03-31', '2023-04-02'],
      ]);
    });
  });

  describe('yearly rules', () => {
    it('clamps February 29 and restores it in the next leap year', () => {
      const occurrences = expandRecurringEvent(
        event({
          start_date: '2024-02-29',
          end_date: '2024-02-29',
          recurrence_type: 'yearly',
        }),
        { startDate: '2024-01-01', endDate: '2028-12-31' },
      );

      expect(originalDates(occurrences)).toEqual([
        '2024-02-29',
        '2025-02-28',
        '2026-02-28',
        '2027-02-28',
        '2028-02-29',
      ]);
    });

    it('treats a century as a leap year only when divisible by 400', () => {
      const occurrences = expandRecurringEvent(
        event({
          start_date: '2096-02-29',
          end_date: '2096-02-29',
          recurrence_type: 'yearly',
          recurrence_interval: 4,
        }),
        { startDate: '2096-01-01', endDate: '2104-12-31' },
      );

      expect(originalDates(occurrences)).toEqual(['2096-02-29', '2100-02-28', '2104-02-29']);
    });
  });

  describe('recurrence end', () => {
    it('includes an occurrence exactly on recurrence_end_date', () => {
      const occurrences = expandRecurringEvent(
        event({ recurrence_interval: 2, recurrence_end_date: '2026-01-05' }),
        { startDate: '2026-01-01', endDate: '2026-01-10' },
      );

      expect(originalDates(occurrences)).toEqual(['2026-01-01', '2026-01-03', '2026-01-05']);
    });

    it('returns no occurrences when recurrence_end_date precedes the master', () => {
      expect(
        expandRecurringEvent(event({ recurrence_end_date: '2025-12-31' }), {
          startDate: '2025-01-01',
          endDate: '2026-12-31',
        }),
      ).toEqual([]);
    });

    it('includes the tail of the final multi-day occurrence after recurrence_end_date', () => {
      const occurrences = expandRecurringEvent(
        event({ end_date: '2026-01-03', recurrence_end_date: '2026-01-01' }),
        { startDate: '2026-01-03', endDate: '2026-01-03' },
      );

      expect(originalDates(occurrences)).toEqual(['2026-01-01']);
    });
  });

  describe('exceptions', () => {
    it('omits a deleted occurrence while continuing the rule', () => {
      const occurrences = expandRecurringEvent(
        event({ recurrence_end_date: '2026-01-04' }),
        RANGE_2026,
        [exception({ original_occurrence_date: '2026-01-02', is_deleted: true })],
      );

      expect(originalDates(occurrences)).toEqual(['2026-01-01', '2026-01-03', '2026-01-04']);
    });

    it('applies override data only to its exact original occurrence date', () => {
      const occurrences = expandRecurringEvent(
        event({ recurrence_type: 'weekly', recurrence_end_date: '2026-01-22' }),
        RANGE_2026,
        [
          exception({
            original_occurrence_date: '2026-01-08',
            override_event_data: { title: 'Changed', location: 'Room 2' },
          }),
          exception({
            id: 'not-an-occurrence',
            original_occurrence_date: '2026-01-10',
            override_event_data: { title: 'Must not apply' },
          }),
          exception({
            id: 'other-master',
            master_event_id: 'event-2',
            original_occurrence_date: '2026-01-15',
            override_event_data: { title: 'Wrong master' },
          }),
        ],
      );

      const changed = occurrences.find(
        (occurrence) => occurrence.originalOccurrenceDate === '2026-01-08',
      );
      expect(changed).toMatchObject({
        title: 'Changed',
        location: 'Room 2',
        occurrenceDate: '2026-01-08',
        originalOccurrenceDate: '2026-01-08',
        isExceptionOverride: true,
        exceptionId: 'exception-1',
      });
      expect(occurrences.filter((occurrence) => occurrence.title === 'Series')).toHaveLength(3);
    });

    it('keeps the original date as the exception key when an override moves an occurrence', () => {
      const occurrences = expandRecurringEvent(
        event({ recurrence_type: 'weekly', recurrence_end_date: '2026-01-15' }),
        { startDate: '2026-02-01', endDate: '2026-02-03' },
        [
          exception({
            original_occurrence_date: '2026-01-08',
            override_event_data: {
              start_date: '2026-02-02',
              end_date: '2026-02-02',
              title: 'Moved',
            },
          }),
        ],
      );

      expect(occurrences).toHaveLength(1);
      expect(occurrences[0]).toMatchObject({
        start_date: '2026-02-02',
        occurrenceDate: '2026-02-02',
        originalOccurrenceDate: '2026-01-08',
        title: 'Moved',
      });
    });

    it('finds a future original occurrence that an override moved back into the range', () => {
      const occurrences = expandRecurringEvent(
        event({ recurrence_type: 'weekly', recurrence_end_date: '2026-03-05' }),
        { startDate: '2026-02-02', endDate: '2026-02-02' },
        [
          exception({
            original_occurrence_date: '2026-03-05',
            override_event_data: {
              start_date: '2026-02-02',
              end_date: '2026-02-02',
            },
          }),
        ],
      );

      expect(originalDates(occurrences)).toEqual(['2026-03-05']);
    });

    it('removes an overridden occurrence that was moved out of the range', () => {
      const occurrences = expandRecurringEvent(
        event({ recurrence_type: 'weekly', recurrence_end_date: '2026-01-08' }),
        { startDate: '2026-01-08', endDate: '2026-01-08' },
        [
          exception({
            original_occurrence_date: '2026-01-08',
            override_event_data: {
              start_date: '2026-02-01',
              end_date: '2026-02-01',
            },
          }),
        ],
      );

      expect(occurrences).toEqual([]);
    });

    it('does not let override data replace the master identity or recurrence rule', () => {
      const unsafeOverride = {
        id: 'different-event',
        recurrence_type: 'yearly',
        recurrence_interval: 99,
        recurrence_end_date: '2099-01-01',
        title: 'Allowed field',
      } as unknown as RecurringEventOverride<TestEvent>;

      const [occurrence] = expandRecurringEvent(event(), RANGE_2026, [
        exception({ override_event_data: unsafeOverride }),
      ]);

      expect(occurrence).toMatchObject({
        id: 'event-1',
        recurrence_type: 'daily',
        recurrence_interval: 1,
        recurrence_end_date: null,
        title: 'Allowed field',
      });
    });

    it('uses the last duplicate exception deterministically', () => {
      const [occurrence] = expandRecurringEvent(
        event({ recurrence_end_date: '2026-01-01' }),
        RANGE_2026,
        [
          exception({ id: 'old', override_event_data: { title: 'Old' } }),
          exception({ id: 'new', override_event_data: { title: 'New' } }),
        ],
      );

      expect(occurrence).toMatchObject({ title: 'New', exceptionId: 'new' });
    });

    it('treats an exception without override data as a normal occurrence', () => {
      const [occurrence] = expandRecurringEvent(
        event({ recurrence_end_date: '2026-01-01' }),
        RANGE_2026,
        [exception()],
      );

      expect(occurrence).toMatchObject({
        isExceptionOverride: false,
        exceptionId: null,
      });
    });
  });

  describe('purity and validation', () => {
    it('does not mutate the master, exception, or override objects', () => {
      const master = Object.freeze(
        event({ recurrence_end_date: '2026-01-02', location: 'Original' }),
      );
      const override = Object.freeze({ title: 'Changed' });
      const recurringException = Object.freeze(exception({ override_event_data: override }));

      const occurrences = expandRecurringEvent(master, RANGE_2026, [recurringException]);

      expect(master).toMatchObject({ start_date: '2026-01-01', title: 'Series' });
      expect(recurringException.override_event_data).toBe(override);
      expect(occurrences[0]).not.toBe(master);
      expect(occurrences[0]?.title).toBe('Changed');
    });

    it.each([
      ['master start_date', event({ start_date: '2026-02-30' }), RANGE_2026],
      ['range startDate', event(), { startDate: '01.01.2026', endDate: '2026-01-02' }],
      ['range order', event(), { startDate: '2026-01-02', endDate: '2026-01-01' }],
    ])('rejects an invalid %s', (_label, master, range) => {
      expect(() => expandRecurringEvent(master, range)).toThrow(RangeError);
    });

    it.each([0, -1, 1.5, Number.POSITIVE_INFINITY])(
      'rejects recurrence_interval %s',
      (recurrenceInterval) => {
        expect(() =>
          expandRecurringEvent(event({ recurrence_interval: recurrenceInterval }), RANGE_2026),
        ).toThrow(RangeError);
      },
    );

    it('defaults a null recurrence_interval to one', () => {
      const occurrences = expandRecurringEvent(
        event({ recurrence_interval: null, recurrence_end_date: '2026-01-03' }),
        RANGE_2026,
      );

      expect(originalDates(occurrences)).toEqual(['2026-01-01', '2026-01-02', '2026-01-03']);
    });

    it('rejects an event whose end precedes its start', () => {
      expect(() => expandRecurringEvent(event({ end_date: '2025-12-31' }), RANGE_2026)).toThrow(
        RangeError,
      );
    });

    it('rejects an unsupported recurrence type at runtime', () => {
      expect(() =>
        expandRecurringEvent(event({ recurrence_type: 'hourly' as RecurrenceType }), RANGE_2026),
      ).toThrow(RangeError);
    });

    it('rejects malformed exception and override dates', () => {
      expect(() =>
        expandRecurringEvent(event(), RANGE_2026, [
          exception({
            original_occurrence_date: '2026-1-2',
            override_event_data: { title: 'Invalid key' },
          }),
        ]),
      ).toThrow(RangeError);

      expect(() =>
        expandRecurringEvent(event(), RANGE_2026, [
          exception({
            override_event_data: {
              start_date: '2026-01-02',
              end_date: '2026-01-01',
            },
          }),
        ]),
      ).toThrow(RangeError);
    });
  });
});

describe('expandRecurringEvents', () => {
  it('routes exceptions by master and sorts all occurrences chronologically', () => {
    const masters = [
      event({
        id: 'event-b',
        start_date: '2026-01-02',
        end_date: '2026-01-02',
        recurrence_end_date: '2026-01-03',
        title: 'B',
      }),
      event({
        id: 'event-a',
        start_date: '2026-01-01',
        end_date: '2026-01-01',
        recurrence_interval: 2,
        recurrence_end_date: '2026-01-03',
        title: 'A',
      }),
    ];
    const exceptions: RecurringEventException<TestEvent>[] = [
      exception({
        master_event_id: 'event-b',
        original_occurrence_date: '2026-01-02',
        is_deleted: true,
      }),
    ];

    const occurrences = expandRecurringEvents(
      masters,
      { startDate: '2026-01-01', endDate: '2026-01-03' },
      exceptions,
    );

    expect(occurrences.map(({ id, start_date }) => `${id}:${start_date}`)).toEqual([
      'event-a:2026-01-01',
      'event-a:2026-01-03',
      'event-b:2026-01-03',
    ]);
  });

  it('returns an empty list for no masters', () => {
    expect(expandRecurringEvents([], RANGE_2026)).toEqual([]);
  });
});
