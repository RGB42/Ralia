/*
 * Ralia Service Worker — ausschliesslich fuer Push.
 *
 * Er cached NICHTS. Ein cachender SW ist genau das Problem, gegen das
 * clearLegacyServiceWorker() im Boot geschrieben wurde: der alte SW von
 * Ralia 1.x beantwortete Anfragen aus altem Bestand, und die App sah
 * Geisterdaten. Es gibt hier deshalb bewusst kein `fetch`-Ereignis.
 */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) =>
  event.waitUntil(self.clients.claim()),
);

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch (error) {
    // Ein unlesbarer Payload darf keine leere Benachrichtigung erzeugen.
    return;
  }

  const title = payload.title || 'Ralia';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body || '',
      icon: payload.icon || '/icons/icon-192.png',
      badge: payload.badge || '/icons/icon-192.png',
      // Der tag verhindert, dass dieselbe Erinnerung mehrfach stehen bleibt.
      tag: payload.tag || undefined,
      data: payload.data || {},
      ...(payload.options || {}),
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target =
    (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windows) => {
        // Ein offenes Fenster wird nach vorn geholt, statt ein zweites zu oeffnen.
        for (const client of windows) {
          if ('focus' in client) return client.focus();
        }
        return self.clients.openWindow(target);
      }),
  );
});
