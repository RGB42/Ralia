import { describe, expect, it, vi } from 'vitest';
import type { EventsRow } from '../database.types.js';
import {
  EventRepoError,
  createEventRepo,
  normalizeEventRepoError,
  type CreateEventInput,
  type EventGateway,
} from './event-repo.js';

const CALENDAR_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const EVENT_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const EVENT: EventsRow = {
  id: EVENT_ID,
  calendar_id: CALENDAR_ID,
  name: 'Abendessen',
  subtitle: 'Zu zweit',
  short_description: 'Tisch ist reserviert',
  location: 'Bistro am Park',
  notes: 'Fensterplatz',
  start_date: '2026-08-14',
  start_time: '18:30:00',
  end_date: '2026-08-14',
  end_time: '20:00:00',
  belongs_to: 'both',
  created_by: '11111111-1111-4111-8111-111111111111',
  created_at: '2026-08-10T08:00:00Z',
  updated_at: '2026-08-10T08:00:00Z',
  recurrence_type: 'weekly',
  recurrence_interval: 2,
  recurrence_end_date: '2026-12-31',
  parent_event_id: null,
  google_event_id: 'google-42',
  reminder_enabled: true,
  reminder_offset_minutes: 60,
  reminder_offsets: [60, 1440],
  event_type: 'default',
  is_special_auto: false,
  special_key: null,
  category: 'date',
  extended_data: { source: 'test' },
};

const CREATE_INPUT: CreateEventInput = {
  id: EVENT.id,
  name: EVENT.name,
  subtitle: EVENT.subtitle,
  short_description: EVENT.short_description,
  location: EVENT.location,
  notes: EVENT.notes,
  start_date: EVENT.start_date,
  start_time: EVENT.start_time,
  end_date: EVENT.end_date,
  end_time: EVENT.end_time,
  belongs_to: EVENT.belongs_to,
  created_by: EVENT.created_by,
  created_at: EVENT.created_at,
  updated_at: EVENT.updated_at,
  recurrence_type: EVENT.recurrence_type,
  recurrence_interval: EVENT.recurrence_interval,
  recurrence_end_date: EVENT.recurrence_end_date,
  parent_event_id: EVENT.parent_event_id,
  google_event_id: EVENT.google_event_id,
  reminder_enabled: EVENT.reminder_enabled,
  reminder_offset_minutes: EVENT.reminder_offset_minutes,
  reminder_offsets: EVENT.reminder_offsets,
  event_type: EVENT.event_type,
  is_special_auto: EVENT.is_special_auto,
  special_key: EVENT.special_key,
  category: EVENT.category,
  extended_data: EVENT.extended_data,
};

function gateway(overrides: Partial<EventGateway> = {}): EventGateway {
  return {
    selectRange: vi.fn().mockResolvedValue({ data: [EVENT], error: null }),
    insert: vi.fn().mockResolvedValue({ data: EVENT, error: null }),
    updateById: vi.fn().mockResolvedValue({ data: EVENT, error: null }),
    deleteById: vi.fn().mockResolvedValue({ data: EVENT, error: null }),
    ...overrides,
  };
}

describe('list', () => {
  it('liest ausschliesslich mit Kalender und vollstaendigem Datumsbereich', async () => {
    const gw = gateway();

    const events = await createEventRepo(gw).list(CALENDAR_ID, {
      startDate: '2026-08-01',
      endDate: '2026-08-31',
    });

    expect(gw.selectRange).toHaveBeenCalledWith(CALENDAR_ID, '2026-08-01', '2026-08-31');
    expect(events).toEqual([EVENT]);
  });

  it('liefert bei einer leeren erfolgreichen Antwort eine leere Liste', async () => {
    const gw = gateway({
      selectRange: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    await expect(
      createEventRepo(gw).list(CALENDAR_ID, {
        startDate: '2026-08-01',
        endDate: '2026-08-31',
      }),
    ).resolves.toEqual([]);
  });

  it.each([
    ['', '2026-08-01', '2026-08-31'],
    [CALENDAR_ID, '', '2026-08-31'],
    [CALENDAR_ID, '2026-02-30', '2026-08-31'],
    [CALENDAR_ID, '2026-09-01', '2026-08-31'],
  ])(
    'fragt bei unvollstaendigem oder ungueltigem Scope niemals ab',
    async (calendarId, startDate, endDate) => {
      const gw = gateway();

      await expect(
        createEventRepo(gw).list(calendarId, { startDate, endDate }),
      ).rejects.toMatchObject({
        name: 'EventRepoError',
        operation: 'list',
        kind: 'invalid-input',
        databaseCode: 'INVALID_ARGUMENT',
      });
      expect(gw.selectRange).not.toHaveBeenCalled();
    },
  );

  it('normalisiert einen Gateway-Fehler', async () => {
    const gw = gateway({
      selectRange: vi.fn().mockResolvedValue({
        data: null,
        error: { code: '42501', message: 'permission denied' },
      }),
    });

    await expect(
      createEventRepo(gw).list(CALENDAR_ID, {
        startDate: '2026-08-01',
        endDate: '2026-08-31',
      }),
    ).rejects.toMatchObject({
      name: 'EventRepoError',
      operation: 'list',
      kind: 'forbidden',
      databaseCode: '42501',
      message: 'permission denied',
    });
  });

  it('normalisiert auch einen geworfenen Transportfehler', async () => {
    const gw = gateway({
      selectRange: vi.fn().mockRejectedValue(new TypeError('Failed to fetch')),
    });

    await expect(
      createEventRepo(gw).list(CALENDAR_ID, {
        startDate: '2026-08-01',
        endDate: '2026-08-31',
      }),
    ).rejects.toMatchObject({ operation: 'list', kind: 'unavailable' });
  });
});

describe('create', () => {
  it('schreibt alle Eventfelder mit dem geprueften Kalender', async () => {
    const gw = gateway();

    const created = await createEventRepo(gw).create(CALENDAR_ID, CREATE_INPUT);

    expect(gw.insert).toHaveBeenCalledWith({ ...CREATE_INPUT, calendar_id: CALENDAR_ID });
    expect(created).toEqual(EVENT);
  });

  it('laesst einen untypisiert eingeschleusten Kalender nicht gewinnen', async () => {
    const gw = gateway();
    const input = { ...CREATE_INPUT, calendar_id: 'fremder-kalender' } as CreateEventInput;

    await createEventRepo(gw).create(CALENDAR_ID, input);

    expect(gw.insert).toHaveBeenCalledWith(expect.objectContaining({ calendar_id: CALENDAR_ID }));
  });

  it('weist eine leere Erfolgsantwort als inkonsistent aus', async () => {
    const gw = gateway({ insert: vi.fn().mockResolvedValue({ data: null, error: null }) });

    await expect(createEventRepo(gw).create(CALENDAR_ID, CREATE_INPUT)).rejects.toMatchObject({
      operation: 'create',
      kind: 'unknown',
      databaseCode: 'EMPTY_RESPONSE',
    });
  });

  it('normalisiert Constraint-Fehler als ungueltige Eingabe', async () => {
    const gw = gateway({
      insert: vi.fn().mockResolvedValue({
        data: null,
        error: { code: '23514', message: 'events_belongs_to_check' },
      }),
    });

    await expect(createEventRepo(gw).create(CALENDAR_ID, CREATE_INPUT)).rejects.toMatchObject({
      operation: 'create',
      kind: 'invalid-input',
      databaseCode: '23514',
    });
  });
});

describe('update', () => {
  it('aktualisiert eine Zeile nur innerhalb ihres Kalenders', async () => {
    const gw = gateway();
    const changes = {
      name: 'Neuer Name',
      reminder_enabled: false,
      reminder_offsets: [30],
      extended_data: { source: 'edited' },
    };

    const updated = await createEventRepo(gw).update(CALENDAR_ID, EVENT_ID, changes);

    expect(gw.updateById).toHaveBeenCalledWith(CALENDAR_ID, EVENT_ID, changes);
    expect(updated).toEqual(EVENT);
  });

  it('entfernt Id und Kalender auch aus untypisierten Payloads', async () => {
    const gw = gateway();
    const changes = {
      id: 'anderer-event',
      calendar_id: 'fremder-kalender',
      name: 'Sicheres Update',
    } as unknown as Parameters<ReturnType<typeof createEventRepo>['update']>[2];

    await createEventRepo(gw).update(CALENDAR_ID, EVENT_ID, changes);

    expect(gw.updateById).toHaveBeenCalledWith(CALENDAR_ID, EVENT_ID, { name: 'Sicheres Update' });
  });

  it('fragt bei einem leeren Update nicht an', async () => {
    const gw = gateway();

    await expect(createEventRepo(gw).update(CALENDAR_ID, EVENT_ID, {})).rejects.toMatchObject({
      operation: 'update',
      kind: 'invalid-input',
    });
    expect(gw.updateById).not.toHaveBeenCalled();
  });

  it('normalisiert eine nicht sichtbare Zeile als nicht gefunden', async () => {
    const gw = gateway({
      updateById: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    await expect(
      createEventRepo(gw).update(CALENDAR_ID, EVENT_ID, { name: 'Nicht sichtbar' }),
    ).rejects.toMatchObject({
      operation: 'update',
      kind: 'not-found',
      databaseCode: 'PGRST116',
    });
  });
});

describe('delete', () => {
  it('loescht ausschliesslich per Kalender und Event-Id', async () => {
    const gw = gateway();

    await createEventRepo(gw).delete(CALENDAR_ID, EVENT_ID);

    expect(gw.deleteById).toHaveBeenCalledWith(CALENDAR_ID, EVENT_ID);
  });

  it('fragt ohne Kalender oder Event-Id nicht an', async () => {
    const gw = gateway();

    await expect(createEventRepo(gw).delete('', EVENT_ID)).rejects.toBeInstanceOf(EventRepoError);
    await expect(createEventRepo(gw).delete(CALENDAR_ID, '')).rejects.toBeInstanceOf(
      EventRepoError,
    );
    expect(gw.deleteById).not.toHaveBeenCalled();
  });

  it('meldet eine nicht sichtbare Zeile als nicht gefunden', async () => {
    const gw = gateway({
      deleteById: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    await expect(createEventRepo(gw).delete(CALENDAR_ID, EVENT_ID)).rejects.toMatchObject({
      operation: 'delete',
      kind: 'not-found',
    });
  });
});

describe('normalizeEventRepoError', () => {
  it('ordnet Konflikte und HTTP-Ausfaelle stabil zu', () => {
    expect(normalizeEventRepoError('create', { code: '23505' })).toMatchObject({
      kind: 'conflict',
      databaseCode: '23505',
    });
    expect(normalizeEventRepoError('list', { status: 503, message: 'Service down' })).toMatchObject(
      {
        kind: 'unavailable',
        operation: 'list',
      },
    );
  });

  it('behaelt einen bereits normalisierten Fehler bei', () => {
    const error = new EventRepoError('delete', 'not-found', 'fehlt');
    expect(normalizeEventRepoError('delete', error)).toBe(error);
  });
});
