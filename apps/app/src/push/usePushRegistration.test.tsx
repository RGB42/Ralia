import { urlBase64ToUint8Array } from '@ralia/core';
import { bootstrapConfig, type PushRepo } from '@ralia/data';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BootContext } from '../boot/BootContext.js';
import { RALIA_SW_PATH } from '../boot/bootstrap.js';
import { DataContext } from '../data/DataProvider.js';
import { dataDouble, outboxDouble } from '../test-harness.js';
import { usePushRegistration } from './usePushRegistration.js';

/**
 * Ein gueltiger, kurzer base64url-Schluessel. Die Dekodierung selbst ist in
 * packages/core/src/push/vapid.test.ts geprueft -- hier zaehlt nur, dass
 * `enable()` ihn unveraendert an `urlBase64ToUint8Array` durchreicht.
 */
const FAKE_VAPID_KEY = 'UmFsaWE';

interface FakeSubscription {
  toJSON: () => { endpoint?: string; keys?: { p256dh: string; auth: string } };
  unsubscribe: ReturnType<typeof vi.fn>;
}

function fakeSubscription(endpoint = 'https://push.example/abc'): FakeSubscription {
  return {
    toJSON: () => ({ endpoint, keys: { p256dh: 'p256dh-value', auth: 'auth-value' } }),
    unsubscribe: vi.fn(async () => true),
  };
}

interface FakeRegistration {
  pushManager: {
    getSubscription: () => Promise<FakeSubscription | null>;
    subscribe: (options: unknown) => Promise<FakeSubscription>;
  };
}

function defaultRegistration(): FakeRegistration {
  return {
    pushManager: {
      getSubscription: vi.fn(async () => null),
      subscribe: vi.fn(async () => fakeSubscription()),
    },
  };
}

/**
 * Stubbt `navigator.serviceWorker`. jsdom kennt die Service-Worker-API nicht,
 * deshalb ist das ein neues Property, kein Ueberschreiben -- `configurable:
 * true` macht es in `afterEach` wieder loeschbar. Muster aus
 * `apps/app/src/boot/bootstrap.test.ts` (dort fuer denselben Zweck benutzt).
 */
function stubServiceWorker(
  registration: FakeRegistration = defaultRegistration(),
  register: ReturnType<typeof vi.fn> = vi.fn(async () => undefined),
): void {
  Object.defineProperty(globalThis.navigator, 'serviceWorker', {
    configurable: true,
    value: { register, ready: Promise.resolve(registration) },
  });
}

function stubPushManagerGlobal(): void {
  Object.defineProperty(globalThis, 'PushManager', { configurable: true, value: class {} });
}

function stubNotification(
  permission: NotificationPermission,
  requestPermission: ReturnType<typeof vi.fn> = vi.fn(async () => permission),
): void {
  Object.defineProperty(globalThis, 'Notification', {
    configurable: true,
    value: { permission, requestPermission },
  });
}

function wrapper(vapidPublicKey: string | null, pushRepo: PushRepo) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <BootContext.Provider
        value={{ config: { ...bootstrapConfig(), vapidPublicKey }, outbox: outboxDouble() }}
      >
        <DataContext.Provider value={dataDouble({ push: pushRepo })}>{children}</DataContext.Provider>
      </BootContext.Provider>
    );
  };
}

function renderPush(vapidPublicKey: string | null = FAKE_VAPID_KEY, overrides: Partial<PushRepo> = {}) {
  const repo: PushRepo = {
    save: vi.fn(async () => undefined),
    deactivate: vi.fn(async () => undefined),
    hasActive: vi.fn(async () => false),
    ...overrides,
  };
  const rendered = renderHook(() => usePushRegistration(), { wrapper: wrapper(vapidPublicKey, repo) });
  return { ...rendered, repo };
}

beforeEach(() => vi.restoreAllMocks());
afterEach(() => {
  Reflect.deleteProperty(globalThis.navigator, 'serviceWorker');
  Reflect.deleteProperty(globalThis, 'PushManager');
  Reflect.deleteProperty(globalThis, 'Notification');
});

describe('usePushRegistration', () => {
  it('meldet unsupported, wenn der Browser keinen Push kann', () => {
    // Kein Stub gesetzt: jsdom kennt weder serviceWorker noch PushManager.
    const { result } = renderPush();
    expect(result.current.state).toBe('unsupported');
  });

  it('meldet unconfigured, wenn /config keinen VAPID-Schluessel geliefert hat', () => {
    stubServiceWorker();
    stubPushManagerGlobal();
    stubNotification('granted');
    const { result } = renderPush(null);
    expect(result.current.state).toBe('unconfigured');
  });

  it('meldet denied, wenn die Erlaubnis abgelehnt wurde', () => {
    stubServiceWorker();
    stubPushManagerGlobal();
    stubNotification('denied');
    const { result } = renderPush();
    expect(result.current.state).toBe('denied');
  });

  it('registriert den Service Worker und legt das Abo an', async () => {
    const registerMock = vi.fn(async () => undefined);
    const subscribeMock = vi.fn(async () => fakeSubscription('https://push.example/new'));
    stubServiceWorker(
      { pushManager: { getSubscription: vi.fn(async () => null), subscribe: subscribeMock } },
      registerMock,
    );
    stubPushManagerGlobal();
    // 'default': enable() muss selbst um Erlaubnis fragen, bevor es weitermacht.
    stubNotification('default', vi.fn(async () => 'granted'));

    const { result, repo } = renderPush(FAKE_VAPID_KEY);

    await act(async () => {
      await result.current.enable();
    });

    expect(registerMock).toHaveBeenCalledWith(RALIA_SW_PATH);
    expect(subscribeMock).toHaveBeenCalledWith({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(FAKE_VAPID_KEY),
    });
    expect(repo.save).toHaveBeenCalledWith({
      endpoint: 'https://push.example/new',
      p256dh: 'p256dh-value',
      auth: 'auth-value',
      userAgent: navigator.userAgent,
    });
    expect(result.current.state).toBe('on');
  });

  it('fragt die Erlaubnis nicht erneut, wenn sie schon erteilt ist', async () => {
    const requestPermissionMock = vi.fn(async (): Promise<NotificationPermission> => 'granted');
    stubServiceWorker();
    stubPushManagerGlobal();
    stubNotification('granted', requestPermissionMock);

    const { result } = renderPush(FAKE_VAPID_KEY);

    await act(async () => {
      await result.current.enable();
    });

    expect(requestPermissionMock).not.toHaveBeenCalled();
    expect(result.current.state).toBe('on');
  });

  it('meldet das Abo beim Ausschalten ab und deaktiviert die Zeile', async () => {
    const order: string[] = [];
    const subscription = fakeSubscription('https://push.example/old');
    subscription.unsubscribe = vi.fn(async () => {
      order.push('unsubscribe');
      return true;
    });
    stubServiceWorker({
      pushManager: { getSubscription: vi.fn(async () => subscription), subscribe: vi.fn() },
    });
    stubPushManagerGlobal();

    const deactivate = vi.fn(async () => {
      order.push('deactivate');
    });
    const { result } = renderPush(FAKE_VAPID_KEY, { deactivate });

    await act(async () => {
      await result.current.disable();
    });

    expect(deactivate).toHaveBeenCalledWith('https://push.example/old');
    expect(subscription.unsubscribe).toHaveBeenCalled();
    // Reihenfolge zaehlt: erst die Datenbank-Zeile deaktivieren, dann das Abo
    // im Browser abmelden -- siehe Kommentar in usePushRegistration.ts.
    expect(order).toEqual(['deactivate', 'unsubscribe']);
    expect(result.current.state).toBe('off');
  });

  it('bleibt bedienbar, wenn unsubscribe() nach erfolgreichem deactivate() wirft', async () => {
    // Ein anderer Pfad als "subscribe() selbst wirft" oben: hier gelingt
    // deactivate() (die Datenbank-Zeile ist bereits inaktiv), aber das
    // Browser-Abo laesst sich nicht abmelden. Kein throw darf disable()
    // trotzdem verlassen.
    const subscription = fakeSubscription('https://push.example/stuck');
    subscription.unsubscribe = vi.fn(async () => {
      throw new Error('unsubscribe fehlgeschlagen');
    });
    stubServiceWorker({
      pushManager: { getSubscription: vi.fn(async () => subscription), subscribe: vi.fn() },
    });
    stubPushManagerGlobal();

    const deactivate = vi.fn(async () => undefined);
    const { result } = renderPush(FAKE_VAPID_KEY, { deactivate });

    await act(async () => {
      await result.current.disable();
    });

    expect(deactivate).toHaveBeenCalledWith('https://push.example/stuck');
    expect(subscription.unsubscribe).toHaveBeenCalled();
    expect(result.current.state).toBe('on');
  });

  it('bleibt bedienbar, wenn subscribe wirft', async () => {
    const subscribeMock = vi.fn(async () => {
      throw new Error('AbortError');
    });
    stubServiceWorker({
      pushManager: { getSubscription: vi.fn(async () => null), subscribe: subscribeMock },
    });
    stubPushManagerGlobal();
    stubNotification('granted');

    const { result, repo } = renderPush(FAKE_VAPID_KEY);

    await act(async () => {
      await result.current.enable();
    });

    expect(result.current.state).toBe('off');
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('legt bei einem fehlgeschlagenen save() kein zweites Abo an, sondern verwendet beim naechsten Versuch das vorhandene', async () => {
    // Ein anderer Pfad als "subscribe() selbst wirft" oben: hier gelingt
    // subscribe() im Browser, aber das Speichern in der Datenbank schlaegt
    // fehl. Ein zweiter enable()-Versuch darf kein zweites Browser-Abo
    // anlegen -- getSubscription() liefert ab jetzt das erste zurueck, genau
    // wie ein echter Browser es taete.
    const subscription = fakeSubscription('https://push.example/retry');
    let subscribed = false;
    const getSubscriptionMock = vi.fn(async () => (subscribed ? subscription : null));
    const subscribeMock = vi.fn(async () => {
      subscribed = true;
      return subscription;
    });
    stubServiceWorker({
      pushManager: { getSubscription: getSubscriptionMock, subscribe: subscribeMock },
    });
    stubPushManagerGlobal();
    stubNotification('granted');

    let saveShouldFail = true;
    const save = vi.fn(async () => {
      if (saveShouldFail) throw new Error('Netzwerkfehler');
    });
    const { result } = renderPush(FAKE_VAPID_KEY, { save });

    await act(async () => {
      await result.current.enable();
    });
    expect(result.current.state).toBe('off');
    expect(subscribeMock).toHaveBeenCalledTimes(1);

    saveShouldFail = false;
    await act(async () => {
      await result.current.enable();
    });

    // Immer noch nur ein Abo: das zweite enable() hat das vorhandene ueber
    // getSubscription() wiederverwendet statt subscribe() erneut aufzurufen.
    expect(subscribeMock).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledTimes(2);
    expect(result.current.state).toBe('on');
  });
});
