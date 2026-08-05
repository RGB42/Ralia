/**
 * Einladungscodes.
 *
 * Der Code ist das, was ein Partner dem anderen vorliest. Alphabet und Länge
 * sind deshalb wortgleich aus `generateInviteCode()` in
 * `Ralia_Opus/public/js/state.js` übernommen — sechs Zeichen aus A–Z und 0–9.
 * Wer heute „R7K2QM" auf dem Zettel hat, liest morgen dasselbe.
 *
 * Zwei Dinge sind anders als in Ralia 1.x, beide ohne Folgen für die Form:
 *
 *   1. Der Zufall kommt aus `crypto.getRandomValues` statt aus `Math.random`.
 *      Ein Code, mit dem sich jemand in einen fremden Kalender verbindet, ist
 *      ein Zugangsmittel; `Math.random` ist vorhersagbar.
 *   2. Eine Codekollision wird wiederholt. In Ralia 1.x fällt das Anlegen des
 *      Profils bei einer Unique-Verletzung still durch, und der Nutzer steht
 *      ohne Profil da.
 *
 * Bekannte Schwäche, bewusst *nicht* behoben: das Alphabet enthält O und 0
 * sowie I und 1, die beim Vorlesen verwechselbar sind. Sie herauszunehmen wäre
 * eine Verbesserung für neue Codes, aber `connect_partner` vergleicht die
 * Zeichen unverändert — alte Codes mit O oder 1 müssen weiter treffen. Das
 * gehört in einen eigenen Zug mit einer Zeichenfaltung auf der Vergleichsseite,
 * nicht in eine stille Änderung hier.
 */

export const INVITE_CODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
export const INVITE_CODE_LENGTH = 6;

/** So viele Codes werden bei Kollision versucht, dann ist Schluss. */
const MAX_CODE_ATTEMPTS = 5;

/**
 * Ein Zeichen ohne Modulo-Verzerrung.
 *
 * `byte % 36` wäre schief: 256 ist kein Vielfaches von 36, die ersten vier
 * Zeichen des Alphabets kämen häufiger. Werte oberhalb der letzten vollen
 * Runde werden deshalb verworfen und neu gezogen.
 */
function randomIndex(bound: number): number {
  const limit = Math.floor(256 / bound) * bound;
  const buffer = new Uint8Array(1);
  for (;;) {
    crypto.getRandomValues(buffer);
    const value = buffer[0] as number;
    if (value < limit) return value % bound;
  }
}

export function generateInviteCode(): string {
  let code = '';
  for (let i = 0; i < INVITE_CODE_LENGTH; i += 1) {
    code += INVITE_CODE_ALPHABET.charAt(randomIndex(INVITE_CODE_ALPHABET.length));
  }
  return code;
}

/**
 * Bringt eine Eingabe in die Form, in der `connect_partner` vergleicht.
 *
 * Die RPC macht `upper(invite_code) = upper(trim(p_invite_code))`. Groß und
 * getrimmt reicht also. Zusätzlich fallen Zeichen weg, die nicht zum Alphabet
 * gehören: wer sich einen Code diktieren lässt, schreibt gern „R7K-2QM" oder
 * setzt eine Lücke in die Mitte, und daran soll das Verbinden nicht scheitern.
 */
export function normalizeInviteCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Postgres 23505 — die Unique-Verletzung, auf die ein neuer Code die Antwort ist. */
export function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const candidate = error as { code?: unknown; message?: unknown };
  if (candidate.code === '23505') return true;
  return typeof candidate.message === 'string' && candidate.message.includes('duplicate key value');
}

export interface NewProfileFields {
  id: string;
  name: string | null;
  email: string | null;
  timezone: string | null;
}

/** Nur der Teil des Supabase-Builders, den das Anlegen braucht. */
export type ProfileInsert = (row: NewProfileFields & { invite_code: string }) => Promise<{
  error: { code?: string | undefined; message?: string | undefined } | null;
}>;

function messageOf(error: { code?: string | undefined; message?: string | undefined }): string {
  return error.message ?? error.code ?? 'unbekannter Fehler';
}

/**
 * Legt das Profil an und weicht einer Codekollision aus.
 *
 * Ein Insert, nicht zwei Rundreisen: den Code vorher per RPC zu holen würde ein
 * Fenster öffnen, in dem die Verbindung abbricht und ein Profil ohne Code
 * zurückbleibt.
 *
 * Wiederholt wird ausschließlich bei der Unique-Verletzung. Ein RLS-Verstoß
 * oder ein Netzfehler wird durch einen anderen Code nicht besser und geht sofort
 * weiter nach oben.
 */
export async function createProfileWithInviteCode(
  insert: ProfileInsert,
  fields: NewProfileFields,
): Promise<string> {
  let lastCode = '';

  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt += 1) {
    lastCode = generateInviteCode();
    const { error } = await insert({ ...fields, invite_code: lastCode });

    if (!error) return lastCode;
    if (!isUniqueViolation(error)) throw new Error(messageOf(error));
  }

  throw new Error(
    `Kein freier Einladungscode nach ${MAX_CODE_ATTEMPTS} Versuchen — zuletzt ${lastCode}.`,
  );
}
