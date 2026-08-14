import { describe, expect, it } from 'vitest';
import { urlBase64ToUint8Array } from './vapid.js';

describe('urlBase64ToUint8Array', () => {
  it('dekodiert eine einfache Zeichenkette', () => {
    // 'Ralia' als base64 ist 'UmFsaWE='; base64url laesst das Fuellzeichen weg.
    expect([...urlBase64ToUint8Array('UmFsaWE')]).toEqual([
      82, 97, 108, 105, 97,
    ]);
  });

  it('setzt fehlende Fuellzeichen wieder ein', () => {
    expect(urlBase64ToUint8Array('UmFsaWE').byteLength).toBe(5);
    expect(urlBase64ToUint8Array('UmFsaQ').byteLength).toBe(4);
  });

  /** base64url ersetzt '+' durch '-' und '/' durch '_'. */
  it('uebersetzt die base64url-Sonderzeichen zurueck', () => {
    expect([...urlBase64ToUint8Array('-_8')]).toEqual([251, 255]);
  });

  /**
   * Ein echter VAPID-Schluessel ist ein unkomprimierter P-256-Punkt: 65 Byte,
   * beginnend mit 0x04. Trifft das nicht zu, lehnt der Browser das Abo mit
   * einem InvalidAccessError ab, den niemand versteht.
   */
  it('liefert fuer einen echten VAPID-Schluessel 65 Byte, beginnend mit 0x04', () => {
    const key = 'BADFWCUOj39xD1' + 'A'.repeat(73); // 87 Zeichen, wie /config sie liefert
    const bytes = urlBase64ToUint8Array(key);

    expect(bytes.byteLength).toBe(65);
    expect(bytes[0]).toBe(4);
  });

  it('wirft bei einer unbrauchbaren Zeichenkette', () => {
    expect(() => urlBase64ToUint8Array('!!!nicht base64!!!')).toThrow();
  });
});
