/**
 * base64url → Bytes, wie `pushManager.subscribe` den `applicationServerKey`
 * verlangt.
 *
 * `/config` liefert den VAPID-Schluessel als base64url ohne Fuellzeichen. Ein
 * Fehler hier aeussert sich im Browser als `InvalidAccessError` ohne
 * verwertbare Meldung — deshalb wird hier gepruefte Arbeit geleistet und nicht
 * an der Aufrufstelle improvisiert.
 */
export function urlBase64ToUint8Array(base64Url: string): Uint8Array {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1)
    bytes[index] = raw.charCodeAt(index);
  return bytes;
}
