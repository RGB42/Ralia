import 'fake-indexeddb/auto';
import { LEGACY_MIGRATION_META_KEY, Outbox } from '@ralia/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runBoot } from './bootstrap.js';

function memoryStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    key: (i: number) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    snapshot: () => Object.fromEntries(map),
  };
}

let dbCounter = 0;

/** Eine frische IndexedDB je Fall — sonst traegt der Marker in den naechsten. */
function freshOutbox(): Outbox {
  dbCounter += 1;
  return new Outbox({ databaseName: `ralia-boot-test-${dbCounter}` });
}

const okConfig = {
  supabaseUrl: 'https://nyvripddydrzvfuateea.supabase.co',
  supabaseAnonKey: 'sb_publishable_test',
};

/**
 * `serviceWorker` und `caches` ausdruecklich auf undefined: sonst greift der
 * Boot nach den Globals, und jsdom hat weder das eine noch das andere.
 * `bindLifecycle: false` haelt Timer und Listener aus den Tests.
 */
function baseDeps() {
  return {
    serviceWorker: undefined,
    caches: undefined,
    bindLifecycle: false as const,
    outbox: freshOutbox(),
  };
}

beforeEach(() => vi.restoreAllMocks());

describe('runBoot', () => {
  it('uebernimmt den Runtime-Key aus /config', async () => {
    const result = await runBoot({
      ...baseDeps(),
      storage: memoryStorage(),
      loadRuntimeConfig: async () => okConfig,
    });
    expect(result.phase).toBe('ready');
    if (result.phase !== 'ready') return;
    expect(result.config.supabaseAnonKey).toBe('sb_publishable_test');
    expect(result.warnings).toHaveLength(0);
  });

  it('bootet trotz fehlgeschlagenem /config und meldet eine Warnung', async () => {
    const result = await runBoot({
      ...baseDeps(),
      storage: memoryStorage(),
      loadRuntimeConfig: async () => {
        throw new Error('offline');
      },
    });
    expect(result.phase).toBe('ready');
    if (result.phase !== 'ready') return;
    expect(result.warnings.join(' ')).toMatch(/config/i);
    // Der eingebaute Key bleibt in Kraft.
    expect(result.config.supabaseAnonKey).toBeTruthy();
  });

  it('importiert Alt-Queues und loescht die Alt-Keys erst danach', async () => {
    const storage = memoryStorage({
      'ralia:event-queue:abc_def': JSON.stringify([
        { id: 'm1', type: 'insert', payload: { name: 'Yoga' } },
      ]),
      'ralia:event-cache:abc_def': '[]',
      appLanguage: 'de',
    });
    const result = await runBoot({
      ...baseDeps(),
      storage,
      loadRuntimeConfig: async () => okConfig,
    });
    expect(result.phase).toBe('ready');
    if (result.phase !== 'ready') return;
    expect(result.legacy.ran).toBe(true);
    expect(result.legacy.importedRecords).toBe(1);

    const after = storage.snapshot();
    expect(after['ralia:event-queue:abc_def']).toBeUndefined();
    expect(after['ralia:event-cache:abc_def']).toBeUndefined();
    // Fremde Schluessel bleiben unberuehrt — die Sprachwahl insbesondere.
    expect(after.appLanguage).toBe('de');

    // Der Marker liegt in der IndexedDB, nicht in localStorage.
    const db = await result.outbox.db();
    expect(await db.get('meta', LEGACY_MIGRATION_META_KEY)).toBeDefined();
  });

  it('importiert bei einem zweiten Boot nicht erneut', async () => {
    const storage = memoryStorage({
      'ralia:event-queue:abc_def': JSON.stringify([{ id: 'm1', type: 'insert', payload: {} }]),
    });
    // Dieselbe Outbox, also dieselbe IndexedDB und derselbe Marker.
    const outbox = freshOutbox();
    const first = await runBoot({
      ...baseDeps(),
      outbox,
      storage,
      loadRuntimeConfig: async () => okConfig,
    });
    expect(first.phase).toBe('ready');
    if (first.phase !== 'ready') return;
    expect(first.legacy.importedRecords).toBe(1);

    const db = await outbox.db();
    const marker = await db.get('meta', LEGACY_MIGRATION_META_KEY);

    // Ein nachtraeglich auftauchender Alt-Key wird nicht mehr importiert. Er
    // wird aufgeraeumt: importLegacyOutbox wischt bei gesetztem Marker
    // Ueberreste eines abgebrochenen Laufs weg, und genau so sieht er aus.
    storage.setItem('ralia:event-queue:xyz', JSON.stringify([{ id: 'm2', type: 'insert' }]));
    const second = await runBoot({
      ...baseDeps(),
      outbox,
      storage,
      loadRuntimeConfig: async () => okConfig,
    });
    expect(second.phase).toBe('ready');
    if (second.phase !== 'ready') return;
    expect(second.legacy.ran).toBe(false);
    expect(second.legacy.importedRecords).toBe(0);
    expect(await db.get('meta', LEGACY_MIGRATION_META_KEY)).toEqual(marker);
    expect(storage.snapshot()['ralia:event-queue:xyz']).toBeUndefined();
  });

  it('deregistriert den alten Service Worker und loescht dessen Caches', async () => {
    const unregister = vi.fn(async () => true);
    const deleteCache = vi.fn(async () => true);
    await runBoot({
      ...baseDeps(),
      storage: memoryStorage(),
      loadRuntimeConfig: async () => okConfig,
      serviceWorker: { getRegistrations: async () => [{ unregister }] },
      caches: { keys: async () => ['ralia-static-v3', 'fremd-cache'], delete: deleteCache },
    });
    expect(unregister).toHaveBeenCalledOnce();
    expect(deleteCache).toHaveBeenCalledWith('ralia-static-v3');
    expect(deleteCache).not.toHaveBeenCalledWith('fremd-cache');
  });

  it('scheitert nicht, wenn Service Worker und Caches fehlen', async () => {
    const result = await runBoot({
      ...baseDeps(),
      storage: memoryStorage(),
      loadRuntimeConfig: async () => okConfig,
    });
    expect(result.phase).toBe('ready');
    if (result.phase !== 'ready') return;
    expect(result.warnings).toHaveLength(0);
  });

  it('gibt ein haengendes /config nach der Frist auf', async () => {
    const result = await runBoot({
      ...baseDeps(),
      storage: memoryStorage(),
      configTimeoutMs: 20,
      // Antwortet nie — der Fall hinter einem Captive Portal.
      loadRuntimeConfig: () => new Promise(() => {}),
    });
    expect(result.phase).toBe('ready');
    if (result.phase !== 'ready') return;
    expect(result.warnings.join(' ')).toMatch(/ohne Antwort/);
    expect(result.config.supabaseAnonKey).toBeTruthy();
  });

  it('macht aus einem haengenden Service Worker eine Warnung, keinen Abbruch', async () => {
    const result = await runBoot({
      ...baseDeps(),
      storage: memoryStorage(),
      loadRuntimeConfig: async () => okConfig,
      serviceWorker: {
        getRegistrations: async () => {
          throw new Error('haengt');
        },
      },
    });
    expect(result.phase).toBe('ready');
    if (result.phase !== 'ready') return;
    expect(result.warnings.join(' ')).toMatch(/Service Worker/);
  });
});
