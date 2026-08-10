/**
 * Kalendertermine in einem begrenzten Zeitraum lesen und einzeln veraendern.
 *
 * Das Repository arbeitet nur mit den rohen Zeilen aus `events`. Wiederkehrende
 * Termine bleiben Masterzeilen; eine Expansion in einzelne Vorkommen gehoert in
 * eine spaetere, davon getrennte Schicht.
 *
 * `EventGateway` ist absichtlich fachlich schmal. Insbesondere gibt es keinen
 * allgemeinen Select: jede Leseoperation braucht Kalender, Von- und Bis-Datum.
 * So kann ein Adapter nicht versehentlich den gesamten Eventbestand laden.
 */

import type { RaliaSupabaseClient } from '../client.js';
import type { EventsRow, TablesInsert, TablesUpdate } from '../database.types.js';

type EventsInsert = TablesInsert<'events'>;
type EventsUpdate = TablesUpdate<'events'>;

/** Inklusiver Datumsbereich im PostgreSQL-Format `YYYY-MM-DD`. */
export interface EventDateRange {
  startDate: string;
  endDate: string;
}

/**
 * Alle Insert-Spalten der Datenbank; `calendar_id` kommt aus dem separaten,
 * geprueften Methodenargument und kann dem Payload daher nicht widersprechen.
 */
export type CreateEventInput = Omit<EventsInsert, 'calendar_id'>;

/** Id und Kalender eines bestehenden Termins sind ueber dieses Repository unveraenderlich. */
export type UpdateEventInput = Omit<EventsUpdate, 'id' | 'calendar_id'>;

export interface EventGatewayError {
  code?: string | undefined;
  message?: string | undefined;
  details?: string | undefined;
  hint?: string | undefined;
  status?: number | undefined;
}

interface GatewayResult<T> {
  data: T | null;
  error: EventGatewayError | null;
}

/** Der kleinste Datenbank-Port, den das Event-Repository benoetigt. */
export interface EventGateway {
  /**
   * Liefert rohe Masterzeilen fuer den inklusiven Bereich. Der Adapter muss in
   * derselben Anfrage nach `calendar_id` und Datum filtern. Er darf relevante
   * Serien-Master einbeziehen, expandiert sie aber nicht.
   */
  selectRange(
    calendarId: string,
    startDate: string,
    endDate: string,
  ): Promise<GatewayResult<EventsRow[]>>;
  insert(row: EventsInsert): Promise<GatewayResult<EventsRow>>;
  updateById(
    calendarId: string,
    eventId: string,
    changes: UpdateEventInput,
  ): Promise<GatewayResult<EventsRow>>;
  deleteById(calendarId: string, eventId: string): Promise<GatewayResult<EventsRow>>;
}

export type EventRepoOperation = 'list' | 'create' | 'update' | 'delete';

export type EventRepoErrorKind =
  'invalid-input' | 'not-found' | 'conflict' | 'forbidden' | 'unavailable' | 'unknown';

/** Stabiler Fehler fuer UI- und Service-Schichten, unabhaengig von PostgREST. */
export class EventRepoError extends Error {
  override readonly name = 'EventRepoError';
  readonly operation: EventRepoOperation;
  readonly kind: EventRepoErrorKind;
  readonly databaseCode: string | undefined;

  constructor(
    operation: EventRepoOperation,
    kind: EventRepoErrorKind,
    message: string,
    databaseCode?: string,
    cause?: unknown,
  ) {
    super(message, { cause });
    this.operation = operation;
    this.kind = kind;
    this.databaseCode = databaseCode;
  }
}

export interface EventRepo {
  /** Gibt rohe Event-Masterzeilen zurueck; wiederkehrende Termine werden nicht expandiert. */
  list(calendarId: string, range: EventDateRange): Promise<EventsRow[]>;
  create(calendarId: string, input: CreateEventInput): Promise<EventsRow>;
  update(calendarId: string, eventId: string, changes: UpdateEventInput): Promise<EventsRow>;
  delete(calendarId: string, eventId: string): Promise<void>;
}

const DATABASE_KIND_BY_CODE: Readonly<Record<string, EventRepoErrorKind>> = {
  PGRST116: 'not-found',
  '23505': 'conflict',
  '23503': 'invalid-input',
  '23514': 'invalid-input',
  '22P02': 'invalid-input',
  '22007': 'invalid-input',
  '22008': 'invalid-input',
  '42501': 'forbidden',
  PGRST301: 'forbidden',
  PGRST302: 'forbidden',
  PGRST000: 'unavailable',
  PGRST001: 'unavailable',
  PGRST002: 'unavailable',
};

function errorProperty(error: unknown, property: 'code' | 'message' | 'status'): unknown {
  if (typeof error !== 'object' || error === null) return undefined;
  return (error as Record<string, unknown>)[property];
}

function classifyError(error: unknown): EventRepoErrorKind {
  const code = errorProperty(error, 'code');
  if (typeof code === 'string' && DATABASE_KIND_BY_CODE[code]) {
    return DATABASE_KIND_BY_CODE[code];
  }

  const status = errorProperty(error, 'status');
  if (status === 400 || status === 422) return 'invalid-input';
  if (status === 401 || status === 403) return 'forbidden';
  if (status === 404) return 'not-found';
  if (status === 409) return 'conflict';
  if (typeof status === 'number' && status >= 500) return 'unavailable';

  const message = errorProperty(error, 'message');
  if (typeof message === 'string' && /fetch|network|timeout|connection/i.test(message)) {
    return 'unavailable';
  }
  return 'unknown';
}

/** Vereinheitlicht zurueckgegebene Gateway-Fehler und geworfene Transportfehler. */
export function normalizeEventRepoError(
  operation: EventRepoOperation,
  error: unknown,
): EventRepoError {
  if (error instanceof EventRepoError) return error;

  const codeValue = errorProperty(error, 'code');
  const databaseCode =
    typeof codeValue === 'string' && codeValue.length > 0 ? codeValue : undefined;
  const messageValue = errorProperty(error, 'message');
  const message =
    typeof messageValue === 'string' && messageValue.trim().length > 0
      ? messageValue
      : (databaseCode ?? `Event ${operation} failed.`);

  return new EventRepoError(operation, classifyError(error), message, databaseCode, error);
}

function invalidInput(operation: EventRepoOperation, message: string): never {
  throw new EventRepoError(operation, 'invalid-input', message, 'INVALID_ARGUMENT');
}

function requireIdentifier(value: string, label: string, operation: EventRepoOperation): void {
  if (value.trim().length === 0) invalidInput(operation, `${label} darf nicht leer sein.`);
}

function isIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match === null) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;

  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= (daysInMonth[month - 1] ?? 0);
}

function validateRange(range: EventDateRange): void {
  if (!isIsoDate(range.startDate) || !isIsoDate(range.endDate)) {
    invalidInput('list', 'Der Event-Zeitraum muss gueltige ISO-Daten enthalten.');
  }
  if (range.startDate > range.endDate) {
    invalidInput('list', 'Das Startdatum des Event-Zeitraums liegt nach dem Enddatum.');
  }
}

async function callGateway<T>(
  operation: EventRepoOperation,
  call: () => Promise<GatewayResult<T>>,
): Promise<T | null> {
  try {
    const { data, error } = await call();
    if (error !== null) throw normalizeEventRepoError(operation, error);
    return data;
  } catch (error) {
    throw normalizeEventRepoError(operation, error);
  }
}

function missingMutationRow(operation: 'update' | 'delete'): never {
  throw new EventRepoError(
    operation,
    'not-found',
    'Der Event wurde nicht gefunden oder ist in diesem Kalender nicht zugaenglich.',
    'PGRST116',
  );
}

export function createEventRepo(gateway: EventGateway): EventRepo {
  return {
    async list(calendarId, range) {
      requireIdentifier(calendarId, 'calendarId', 'list');
      validateRange(range);

      const events = await callGateway('list', () =>
        gateway.selectRange(calendarId, range.startDate, range.endDate),
      );
      return events ?? [];
    },

    async create(calendarId, input) {
      requireIdentifier(calendarId, 'calendarId', 'create');
      // Das gepruefte Methodenargument gewinnt auch gegen untypisierte Aufrufer.
      const row: EventsInsert = { ...input, calendar_id: calendarId };
      const event = await callGateway('create', () => gateway.insert(row));
      if (event === null) {
        throw new EventRepoError(
          'create',
          'unknown',
          'Der Event wurde angelegt, aber das Gateway gab keine Zeile zurueck.',
          'EMPTY_RESPONSE',
        );
      }
      return event;
    },

    async update(calendarId, eventId, input) {
      requireIdentifier(calendarId, 'calendarId', 'update');
      requireIdentifier(eventId, 'eventId', 'update');

      // Auch JavaScript-Aufrufer duerfen Id oder Kalender nicht im Payload verschieben.
      const changes: EventsUpdate = { ...input };
      delete changes.id;
      delete changes.calendar_id;
      if (Object.keys(changes).length === 0) {
        invalidInput('update', 'Das Event-Update enthaelt keine Aenderungen.');
      }

      const event = await callGateway('update', () =>
        gateway.updateById(calendarId, eventId, changes),
      );
      if (event === null) missingMutationRow('update');
      return event;
    },

    async delete(calendarId, eventId) {
      requireIdentifier(calendarId, 'calendarId', 'delete');
      requireIdentifier(eventId, 'eventId', 'delete');

      const event = await callGateway('delete', () => gateway.deleteById(calendarId, eventId));
      if (event === null) missingMutationRow('delete');
    },
  };
}

/** Binds the pure repository contract to calendar-scoped PostgREST queries. */
export function createSupabaseEventRepo(client: RaliaSupabaseClient): EventRepo {
  return createEventRepo({
    async selectRange(calendarId, startDate, endDate) {
      const overlap = `and(start_date.lte.${endDate},end_date.gte.${startDate})`;
      const recurring = `and(recurrence_type.not.is.null,start_date.lte.${endDate},or(recurrence_end_date.is.null,recurrence_end_date.gte.${startDate}))`;
      const { data, error } = await client
        .from('events')
        .select('*')
        .eq('calendar_id', calendarId)
        .or(`${overlap},${recurring}`)
        .order('start_date')
        .order('start_time');
      return { data, error };
    },

    async insert(row) {
      const { data, error } = await client.from('events').insert(row).select('*').single();
      return { data, error };
    },

    async updateById(calendarId, eventId, changes) {
      const { data, error } = await client
        .from('events')
        .update(changes)
        .eq('calendar_id', calendarId)
        .eq('id', eventId)
        .select('*')
        .maybeSingle();
      return { data, error };
    },

    async deleteById(calendarId, eventId) {
      const { data, error } = await client
        .from('events')
        .delete()
        .eq('calendar_id', calendarId)
        .eq('id', eventId)
        .select('*')
        .maybeSingle();
      return { data, error };
    },
  });
}
