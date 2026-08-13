import { urlBase64ToUint8Array } from '@ralia/core';
import { useCallback, useState } from 'react';
import { useBoot } from '../boot/BootContext.js';
import { RALIA_SW_PATH } from '../boot/bootstrap.js';
import { useData } from '../data/DataProvider.js';

/**
 * Zustand des Push-Abos dieses Geraets.
 *
 * `unsupported`/`unconfigured`/`denied` sind Sackgassen: die Oberflaeche muss
 * sie erklaeren, nicht nur den Schalter wirkungslos zeigen. `working` sperrt
 * den Schalter, waehrend eine Anfrage laeuft -- sonst koennte ein zweiter
 * Klick eine zweite Registrierung anstossen, waehrend die erste noch
 * unterwegs ist.
 */
export type PushState = 'unsupported' | 'unconfigured' | 'denied' | 'off' | 'on' | 'working';

export interface PushRegistration {
  state: PushState;
  enable(): Promise<void>;
  disable(): Promise<void>;
}

/**
 * Faehigkeits- und Erlaubnispruefung, ohne Service Worker oder Netzwerk.
 *
 * `null` heisst: keiner der drei Gruende trifft zu, die eigentliche
 * Registrierung darf versucht werden.
 */
function detectBlocker(vapidPublicKey: string | null): 'unsupported' | 'unconfigured' | 'denied' | null {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return 'unsupported';
  }
  if (!vapidPublicKey) return 'unconfigured';
  if (Notification.permission === 'denied') return 'denied';
  return null;
}

/**
 * Registriert und meldet ein Web-Push-Abo an oder ab.
 *
 * Der Haken schreibt `notification_settings.pushEnabled` bewusst nicht selbst
 * -- das bleibt Sache des Screens, der die Praeferenz erst nach einem
 * erfolgreichen `enable()`/`disable()` setzt. Sonst zeigte sie „an", waehrend
 * kein Abo existiert -- genau das, was dieser Haken abschafft.
 *
 * Das Repository kommt ueber `useData()` (Aufgabe 3), nicht ueber einen
 * eigenen Supabase-Client: UI-Code greift nie direkt auf Supabase zu, und ein
 * zweiter, hier selbst gebauter Client haette Tests gezwungen, echte
 * Netzwerkaufrufe gegen eine Fantasie-URL abzufangen statt das Repository
 * einfach auszutauschen.
 */
export function usePushRegistration(): PushRegistration {
  const { config } = useBoot();
  const { push: pushRepo } = useData();
  const vapidPublicKey = config.vapidPublicKey;

  const [state, setState] = useState<PushState>(() => detectBlocker(vapidPublicKey) ?? 'off');

  const enable = useCallback(async (): Promise<void> => {
    // Dieselben drei Pruefungen wie bei der Erstberechnung, hier erneut: die
    // Umgebung kann sich zwischen dem Rendern und diesem Klick geaendert
    // haben (z.B. die Erlaubnis wurde ausserhalb der App entzogen).
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      setState('unsupported');
      return;
    }
    if (!vapidPublicKey) {
      setState('unconfigured');
      return;
    }
    if (Notification.permission === 'denied') {
      setState('denied');
      return;
    }

    setState('working');
    try {
      if (Notification.permission === 'default') {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          setState(permission === 'denied' ? 'denied' : 'off');
          return;
        }
      }

      await navigator.serviceWorker.register(RALIA_SW_PATH);
      const registration = await navigator.serviceWorker.ready;

      // Ein vorhandenes Abo wird wiederverwendet statt ein zweites anzulegen
      // -- z.B. wenn ein frueherer Versuch subscribe() schaffte, aber save()
      // nicht.
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          // `Uint8Array` ist generisch ueber ArrayBuffer|SharedArrayBuffer,
          // `BufferSource` verlangt konkret ArrayBuffer -- ein frisch mit
          // `new Uint8Array(length)` gebautes Array ist das immer, TS kann es
          // an dieser Stelle nur nicht herleiten.
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
        }));

      const json = subscription.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) {
        throw new Error('Abo ohne endpoint oder Schluessel');
      }

      await pushRepo.save({
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
        userAgent: navigator.userAgent,
      });
      setState('on');
    } catch {
      // Jeder Fehlerpfad landet hier: abgelehntes subscribe(), ein kaputtes
      // Abo, ein Netzwerkfehler beim Speichern. Der Schalter bleibt bedienbar
      // -- ein zweiter Versuch faengt wieder bei Schritt 1 an.
      setState('off');
    }
  }, [vapidPublicKey, pushRepo]);

  const disable = useCallback(async (): Promise<void> => {
    setState('working');
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        const { endpoint } = subscription.toJSON();
        // Reihenfolge zaehlt: erst die Datenbank-Zeile deaktivieren, dann das
        // Abo im Browser abmelden. Bricht es dazwischen ab, ist eine tote
        // Zeile in der Datenbank besser als ein Abo, das der Server (ueber
        // reminder-worker) weiter zu bedienen versucht.
        if (endpoint) await pushRepo.deactivate(endpoint);
        await subscription.unsubscribe();
      }
      setState('off');
    } catch {
      // Ohne Bestaetigung ist unklar, ob wirklich abgemeldet wurde -- 'on'
      // ist die sicherere Annahme als 'off', denn sie behauptet nicht mehr,
      // als bekannt ist.
      setState('on');
    }
  }, [pushRepo]);

  return { state, enable, disable };
}
