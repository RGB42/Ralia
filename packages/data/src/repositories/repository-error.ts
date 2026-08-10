export type RepositoryErrorCode =
  | 'invalid_input'
  | 'conflict'
  | 'not_found'
  | 'forbidden'
  | 'unavailable'
  | 'invalid_response'
  | 'unknown';

export interface RepositoryGatewayError {
  code?: string | undefined;
  message?: string | undefined;
  details?: string | undefined;
  hint?: string | undefined;
  status?: number | undefined;
}

export interface GatewayResult<T> {
  data: T | null;
  error: RepositoryGatewayError | null;
}

export class RepositoryError extends Error {
  readonly code: RepositoryErrorCode;
  readonly operation: string;
  readonly backendCode: string | undefined;

  constructor(
    code: RepositoryErrorCode,
    operation: string,
    options: { cause?: unknown; backendCode?: string; message?: string } = {},
  ) {
    super(
      options.message ?? `${operation} failed (${code})`,
      options.cause === undefined ? undefined : { cause: options.cause },
    );
    this.name = 'RepositoryError';
    this.code = code;
    this.operation = operation;
    this.backendCode = options.backendCode;
  }
}

function errorField(error: unknown, key: string): unknown {
  if (typeof error !== 'object' || error === null) return undefined;
  return (error as Record<string, unknown>)[key];
}

function errorCode(error: unknown): string | undefined {
  const code = errorField(error, 'code');
  return typeof code === 'string' ? code : undefined;
}

function errorStatus(error: unknown): number | undefined {
  const status = errorField(error, 'status');
  return typeof status === 'number' ? status : undefined;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  const message = errorField(error, 'message');
  return typeof message === 'string' ? message : '';
}

/** Maps transport and PostgREST errors to categories that callers can handle reliably. */
export function normalizeRepositoryError(operation: string, error: unknown): RepositoryError {
  if (error instanceof RepositoryError) return error;

  const backendCode = errorCode(error);
  const status = errorStatus(error);
  const message = errorMessage(error);
  let code: RepositoryErrorCode = 'unknown';

  if (
    backendCode === '23502' ||
    backendCode === '23514' ||
    backendCode === '22P02' ||
    backendCode === '22001'
  ) {
    code = 'invalid_input';
  } else if (backendCode === '23505' || backendCode === '23503' || status === 409) {
    code = 'conflict';
  } else if (backendCode === 'PGRST116' || status === 404) {
    code = 'not_found';
  } else if (
    backendCode === '42501' ||
    backendCode === 'PGRST301' ||
    status === 401 ||
    status === 403
  ) {
    code = 'forbidden';
  } else if (
    error instanceof TypeError ||
    backendCode?.startsWith('PGRST00') === true ||
    (status !== undefined && status >= 500) ||
    /failed to fetch|network|timeout/i.test(message)
  ) {
    code = 'unavailable';
  }

  return new RepositoryError(code, operation, {
    cause: error,
    ...(backendCode === undefined ? {} : { backendCode }),
  });
}

export function invalidInput(operation: string, field: string, reason: string): RepositoryError {
  return new RepositoryError('invalid_input', operation, {
    message: `${operation}: ${field} ${reason}`,
  });
}

export async function requireGatewayData<T>(
  operation: string,
  request: () => Promise<GatewayResult<T>>,
  missingCode: RepositoryErrorCode = 'invalid_response',
): Promise<T> {
  try {
    const { data, error } = await request();
    if (error !== null) throw normalizeRepositoryError(operation, error);
    if (data === null) throw new RepositoryError(missingCode, operation);
    return data;
  } catch (error) {
    throw normalizeRepositoryError(operation, error);
  }
}

export function requiredText(
  value: unknown,
  operation: string,
  field: string,
  maxLength?: number,
): string {
  if (typeof value !== 'string') throw invalidInput(operation, field, 'must be a string');
  const normalized = value.trim();
  if (normalized.length === 0) throw invalidInput(operation, field, 'must not be empty');
  if (maxLength !== undefined && normalized.length > maxLength) {
    throw invalidInput(operation, field, `must not exceed ${maxLength} characters`);
  }
  return normalized;
}
