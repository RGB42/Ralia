import '@testing-library/jest-dom/vitest';

// jsdom implements neither matchMedia nor ResizeObserver, and the app shell
// depends on both (theme resolution + responsive layout). Provide the minimum
// surface the components actually use.
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
}

if (!('ResizeObserver' in globalThis)) {
  globalThis.ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  } as unknown as typeof ResizeObserver;
}

// In dieser Umgebung ist `localStorage` ein leeres Objekt: Prototyp ist
// Object.prototype, keine Storage-Methoden, keine eigenen Schlüssel. Ohne
// diesen Polyfill scheitern 120 der 363 Tests an `localStorage.clear is not
// a function` — Theme, i18n, Boot-Sequenz und alles, was darauf aufbaut.
//
// Geprüft wird auf die Fähigkeit, nicht auf die Existenz: `'localStorage' in
// globalThis` ist hier wahr und würde den Polyfill überspringen.
//
// Die Web-Storage-Semantik ist bewusst nachgebildet, nicht vereinfacht:
// getItem gibt für fehlende Schlüssel `null` (nicht `undefined`), und Werte
// werden zu Zeichenketten gezwungen. Auf beides verlässt sich der Code.
// `AbortController` kommt hier von jsdom, `Request` von Node (undici). undici
// prüft `signal instanceof AbortSignal` gegen SEINE Klasse, und jsdoms Signal
// ist eine andere — verschiedene Realms. react-router baut bei jeder
// Navigation ein Request-Objekt, deshalb scheitert sonst jeder Routenwechsel
// im Test mit „RequestInit: Expected signal to be an instance of AbortSignal",
// während ein Direktaufruf derselben Route funktioniert.
//
// Isoliert nachweisbar:
//   new Request('http://x/', { signal: new jsdomWindow.AbortController().signal })  → wirft
//   new Request('http://x/', { signal: new AbortController().signal })              → ok
//
// Der Aufrufer bekommt sein Signal weiterhin zurück (`request.signal` bleibt
// das übergebene), nur undici sieht es nicht mehr. Für Tests ist das richtig:
// sie prüfen Navigation, nicht deren Abbruch.
{
  const NativeRequest = globalThis.Request;
  function PatchedRequest(this: unknown, input: RequestInfo | URL, init?: RequestInit): Request {
    try {
      return new NativeRequest(input, init);
    } catch (error) {
      if (!init || !('signal' in init)) throw error;
      const { signal, ...withoutSignal } = init;
      const request = new NativeRequest(input, withoutSignal);
      Object.defineProperty(request, 'signal', { value: signal, configurable: true });
      return request;
    }
  }
  PatchedRequest.prototype = NativeRequest.prototype;
  globalThis.Request = PatchedRequest as unknown as typeof globalThis.Request;
}

if (typeof globalThis.localStorage?.setItem !== 'function') {
  const store = new Map<string, string>();
  const storage: Storage = {
    get length(): number {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key: string) => store.get(String(key)) ?? null,
    key: (index: number) => [...store.keys()][index] ?? null,
    removeItem: (key: string) => void store.delete(String(key)),
    setItem: (key: string, value: string) => void store.set(String(key), String(value)),
  };
  Object.defineProperty(globalThis, 'localStorage', {
    value: storage,
    configurable: true,
    writable: true,
  });
}
