import type { EventRepo, EventsRow } from '@ralia/data';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { pinLanguage, renderAppAt } from '../../test-harness.js';

function localTodayIso(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

function eventRow(date: string): EventsRow {
  return {
    id: '33333333-3333-4333-8333-333333333333',
    calendar_id: '11111111-1111-4111-8111-111111111111',
    name: 'Echter Termin',
    location: 'Gemeinsamer Ort',
    start_date: date,
    start_time: '10:00:00',
    end_date: date,
    end_time: '11:00:00',
    notes: null,
    belongs_to: 'user1',
    created_by: '11111111-1111-4111-8111-111111111111',
    created_at: '2026-08-10T10:00:00Z',
    updated_at: '2026-08-10T10:00:00Z',
    recurrence_type: null,
    recurrence_end_date: null,
    parent_event_id: null,
    google_event_id: null,
    recurrence_interval: null,
    reminder_enabled: false,
    reminder_offset_minutes: 1440,
    reminder_offsets: null,
    event_type: 'default',
    is_special_auto: false,
    special_key: null,
    subtitle: null,
    short_description: null,
    extended_data: null,
    category: null,
  };
}

describe('CalendarScreen repository wiring', () => {
  it('loads the visible range and shows persisted events in the day sheet', async () => {
    const today = localTodayIso();
    const list = vi.fn<EventRepo['list']>().mockResolvedValue([eventRow(today)]);
    const events: EventRepo = {
      list,
      create: async () => eventRow(today),
      update: async () => eventRow(today),
      delete: async () => undefined,
    };

    pinLanguage('de');
    renderAppAt('/kalender', { data: { events } });

    const day = await screen.findByRole('button', { name: /1 Termin/ });
    await userEvent.click(day);
    expect(await screen.findByText('Echter Termin')).toBeInTheDocument();
    expect(screen.getByText(/Gemeinsamer Ort/)).toBeInTheDocument();
    expect(list).toHaveBeenCalledWith(
      '11111111-1111-4111-8111-111111111111',
      expect.objectContaining({ startDate: expect.any(String), endDate: expect.any(String) }),
    );
  });

  it('expands recurring masters across the visible month', async () => {
    const today = new Date();
    const monthStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
    const recurring = {
      ...eventRow(monthStart),
      recurrence_type: 'daily',
      recurrence_interval: 1,
      recurrence_end_date: null,
    };
    const events: EventRepo = {
      list: async () => [recurring],
      create: async () => recurring,
      update: async () => recurring,
      delete: async () => undefined,
    };

    pinLanguage('de');
    renderAppAt('/kalender', { data: { events } });

    expect((await screen.findAllByRole('button', { name: /1 Termin/ })).length).toBeGreaterThan(1);
  });
});
