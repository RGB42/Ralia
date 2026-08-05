import { describe, expect, it } from 'vitest';
import { isOfflineSyncError, isPermanentRequestError } from './offline-error.js';

const online = { isOnline: () => true };
const offline = { isOnline: () => false };

describe('isOfflineSyncError', () => {
  it('treats a reported-offline device as offline regardless of the error', () => {
    expect(isOfflineSyncError(new Error('anything at all'), offline)).toBe(true);
  });

  it.each([
    ['Failed to fetch', 'Chrome / Firefox'],
    ['NetworkError when attempting to fetch resource.', 'Safari'],
    ['Load failed', 'Safari / iOS WKWebView'],
    ['Network request failed', 'Android WebView'],
    ['Session check timeout', "Ralia's auth guard"],
    ['fetch failed', 'undici / Node'],
    ['The operation timed out', 'generic timeout'],
  ])('recognises %j (%s)', (message) => {
    expect(isOfflineSyncError(new Error(message), online)).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(isOfflineSyncError(new Error('FAILED TO FETCH'), online)).toBe(true);
  });

  it('does not mistake a rejected request for a transport failure', () => {
    expect(
      isOfflineSyncError(new Error('duplicate key value violates unique constraint'), online),
    ).toBe(false);
    expect(
      isOfflineSyncError(new Error('new row violates row-level security policy'), online),
    ).toBe(false);
  });

  it('accepts strings and plain objects carrying a message', () => {
    expect(isOfflineSyncError('Load failed', online)).toBe(true);
    expect(isOfflineSyncError({ message: 'Failed to fetch' }, online)).toBe(true);
  });

  it('returns false for null and undefined', () => {
    expect(isOfflineSyncError(null, online)).toBe(false);
    expect(isOfflineSyncError(undefined, online)).toBe(false);
  });
});

describe('isPermanentRequestError', () => {
  it.each([400, 401, 403, 404, 409, 422])('treats %i as permanent', (status) => {
    expect(isPermanentRequestError(status)).toBe(true);
  });

  it.each([408, 429, 500, 502, 503, 504])('treats %i as worth retrying', (status) => {
    expect(isPermanentRequestError(status)).toBe(false);
  });

  it('treats a missing status as not permanent', () => {
    expect(isPermanentRequestError(undefined)).toBe(false);
  });
});
