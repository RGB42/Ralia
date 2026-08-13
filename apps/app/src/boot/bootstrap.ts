import {
  DEFAULT_FLUSH_INTERVAL_MS,
  LEGACY_CACHE_PREFIXES,
  Outbox,
  bindLifecycle,
  importLegacyOutbox,
  type KeyValueStorage,
  type LegacyImportResult,
  type Unbind,
} from '@ralia/core';
import {
  AppApi,
  bootstrapConfig,
  loadRuntimeConfig as loadRuntimeConfigFromApi,
  mergeRuntimeConfig,
  resetSupabaseClient,
  type RuntimeConfig,
} from '@ralia/data';

/**
 * Aeuszere Kanten des Boots, alle einsetzbar. Nur so ist die Reihenfolge
 * pruefbar, ohne einen Browser zu fahren.
 */
export interface BootDeps {
  storage?: KeyValueStorage & Pick<Storage, 'setItem'>;
  /** Liefert die Runtime-Konfiguration, ueblicherweise `GET /config`. */
  loadRuntimeConfig?: () => Promise<Partial<RuntimeConfig>>;
  serviceWorker?:
    | { getRegistrations(): Promise<{ scriptURL: string; unregister(): Promise<boolean> }[]> }
    | undefined;
  caches?: { keys(): Promise<string[]>; delete(key: string): Promise<boolean> } | undefined;
  /** Vorgebaute Outbox — Tests isolieren damit die IndexedDB. */
  outbox?: Outbox;
  /** Lebenszyklus binden. In Tests aus, weil es an window haengt. */
  bindLifecycle?: boolean;
  /** Geduld fuer /config. 0 schaltet die Frist ab. */
  configTimeoutMs?: number;
}

/**
 * Ein fehlgeschlagenes /config blockiert den Boot nicht — ein haengendes aber
 * schon, und genau das passiert hinter einem Captive Portal oder an einem
 * stummen Netz: die Anfrage laeuft nicht in einen Fehler, sie antwortet nie.
 * `AppApi` kennt kein eigenes Zeitlimit, deshalb steht die Frist hier.
 */
export const CONFIG_TIMEOUT_MS = 6000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  if (ms <= 0) return promise;
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} nach ${ms} ms ohne Antwort`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}

export interface BootResult {
  phase: 'ready';
  config: RuntimeConfig;
  warnings: string[];
  outbox: Outbox;
  legacy: LegacyImportResult;
  unbind: Unbind | null;
}

export type BootState = { phase: 'pending' } | BootResult | { phase: 'failed'; error: Error };

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Der eigene Service Worker. Nur fuer Push, ohne Cache.
 *
 * Eindeutig benannt, nicht "sw.js": Ralia 1.x registrierte am selben Origin
 * exakt `navigator.serviceWorker.register('/sw.js')` (Ralia_Opus/public/
 * index.html). Mit dem Namen "sw.js" haette die Ausnahme unten (die den
 * eigenen SW von der Abmeldung verschont) den cachenden Alt-SW dauerhaft
 * mitverschont, sobald er einmal auf einem Geraet registriert war -- genau
 * der Ausfall, gegen den clearLegacyServiceWorker() ueberhaupt geschrieben
 * wurde. Ein Name, den kein Vorgaenger je benutzt hat, kann damit nicht
 * kollidieren.
 */
export const RALIA_SW_PATH = 'ralia-push-sw.js';

/**
 * Raeumt den Service Worker der Vorgaengerversion ab.
 *
 * Ralia 1.x lief am gleichen Origin und hat dort einen SW mit eigenen Caches
 * registriert. Bleibt er stehen, beantwortet er Anfragen aus altem Bestand und
 * die neue App sieht Geisterdaten. Jeder Fehler hier wird zur Warnung, nicht
 * zum Abbruch — ein haengender alter SW darf den Start nicht verhindern. Der
 * eigene SW unter RALIA_SW_PATH ist von der Abmeldung ausgenommen, sonst waere
 * Push nach jedem Reload tot.
 */
async function clearLegacyServiceWorker(deps: BootDeps, warnings: string[]): Promise<void> {
  const nativeServiceWorker = globalThis.navigator?.serviceWorker;
  const serviceWorker =
    'serviceWorker' in deps
      ? deps.serviceWorker
      : nativeServiceWorker && {
          // Die echte ServiceWorkerRegistration hat kein scriptURL direkt —
          // das sitzt auf active/waiting/installing. Ohne diese Abbildung
          // liefe die Ausnahme oben im echten Browser nie an.
          getRegistrations: async () =>
            (await nativeServiceWorker.getRegistrations()).map((registration) => ({
              scriptURL:
                registration.active?.scriptURL ??
                registration.waiting?.scriptURL ??
                registration.installing?.scriptURL ??
                '',
              unregister: () => registration.unregister(),
            })),
        };
  const cacheStorage = 'caches' in deps ? deps.caches : globalThis.caches;

  try {
    if (serviceWorker) {
      for (const registration of await serviceWorker.getRegistrations()) {
        // Der eigene SW bleibt stehen. Ohne diese Ausnahme meldet der Boot ihn
        // bei jedem Start ab, und Push waere nach jedem Reload tot.
        // Kein optionales Verketten (`?.`) noetig: das Interface oben
        // schreibt `scriptURL: string` vor, und der Adapter fuer den nativen
        // Zweig liefert notfalls '' -- nie etwas Nullisches.
        if (registration.scriptURL.endsWith(`/${RALIA_SW_PATH}`)) continue;
        await registration.unregister();
      }
    }
  } catch (error) {
    warnings.push(`Alter Service Worker liesz sich nicht abmelden: ${message(error)}`);
  }

  try {
    if (cacheStorage) {
      for (const key of await cacheStorage.keys()) {
        // Nur eigene Caches. Ein fremder Cache am selben Origin gehoert uns nicht.
        const ours =
          key.startsWith('ralia-') || LEGACY_CACHE_PREFIXES.some((p) => key.startsWith(p));
        if (ours) await cacheStorage.delete(key);
      }
    }
  } catch (error) {
    warnings.push(`Alte Caches liessen sich nicht loeschen: ${message(error)}`);
  }
}

async function resolveConfig(deps: BootDeps, warnings: string[]): Promise<RuntimeConfig> {
  const base = bootstrapConfig();
  const load =
    deps.loadRuntimeConfig ??
    (async () => {
      const api = new AppApi({ supabaseUrl: base.supabaseUrl, anonKey: base.supabaseAnonKey });
      const result = await loadRuntimeConfigFromApi(api, base);
      if (!result.ok) throw new Error(result.error ?? 'unbekannter Fehler');
      return result.config;
    });

  try {
    const loaded = await withTimeout(load(), deps.configTimeoutMs ?? CONFIG_TIMEOUT_MS, '/config');
    const config = mergeRuntimeConfig(base, loaded);
    // Der naechste getSupabaseClient() soll den Runtime-Key nutzen, nicht den
    // eingebauten. Der Cache haengt an url+key, also muss er hier fallen.
    resetSupabaseClient();
    return config;
  } catch (error) {
    warnings.push(`/config nicht erreichbar, eingebauter Schluessel bleibt: ${message(error)}`);
    return base;
  }
}

/**
 * Startet die App. Die Reihenfolge ist zwingend:
 *
 *   1. alten Service Worker und dessen Caches abraeumen
 *   2. /config lesen, Fehlschlag ist eine Warnung
 *   3. Alt-Queues uebernehmen — importLegacyOutbox loescht die Alt-Keys
 *      erst nach committetem Import
 *   4. Outbox an den Lebenszyklus binden und einmal spuelen
 *
 * Schritt 4 wird nicht abgewartet: ohne Verbindung haengt der Start sonst.
 */
export async function runBoot(deps: BootDeps = {}): Promise<BootState> {
  const warnings: string[] = [];
  try {
    const storage = deps.storage ?? globalThis.localStorage;
    await clearLegacyServiceWorker(deps, warnings);
    const config = await resolveConfig(deps, warnings);

    const outbox = deps.outbox ?? new Outbox();

    let legacy: LegacyImportResult = {
      ran: false,
      importedRecords: 0,
      importedQueues: 0,
      removedKeys: 0,
      malformedKeys: [],
    };
    try {
      legacy = await importLegacyOutbox(outbox, storage);
      if (legacy.malformedKeys.length > 0) {
        warnings.push(
          `${legacy.malformedKeys.length} unlesbare Alt-Queues wurden zur Pruefung behalten.`,
        );
      }
    } catch (error) {
      warnings.push(`Alt-Daten liessen sich nicht uebernehmen: ${message(error)}`);
    }

    let unbind: Unbind | null = null;
    if (deps.bindLifecycle !== false) {
      try {
        const flush = () => void outbox.flush().catch(() => undefined);
        unbind = bindLifecycle({
          onOnline: flush,
          onVisible: flush,
          onInterval: flush,
          intervalMs: DEFAULT_FLUSH_INTERVAL_MS,
        });
        // Absichtlich ohne await: ein erster Spuelversuch ohne Netz wuerde den
        // Start blockieren.
        void outbox.flush().catch(() => undefined);
      } catch (error) {
        warnings.push(`Hintergrund-Abgleich nicht aktiv: ${message(error)}`);
      }
    }

    return { phase: 'ready', config, warnings, outbox, legacy, unbind };
  } catch (error) {
    return {
      phase: 'failed',
      error: error instanceof Error ? error : new Error(message(error)),
    };
  }
}
