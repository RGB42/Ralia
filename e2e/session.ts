import type { BrowserContext } from '@playwright/test';

/**
 * Eine angemeldete Sitzung im Browser einrichten, ohne ein echtes Konto.
 *
 * Ab SP1 liegt jede Route hinter `RequireAuth`, die Smoke-Tests brauchen also
 * eine Identität. Sich dafür wirklich anzumelden wäre falsch: das schriebe in die
 * Produktionsdatenbank und machte jeden Testlauf von einem Postfach abhängig.
 *
 * Der Weg hier benutzt genau die zwei Dinge, die die App beim Start liest:
 *
 *   `sb-<ref>-auth-token`  damit `getSession()` eine Sitzung findet. Mit einem
 *                          Ablauf weit in der Zukunft, sonst versucht `auth-js`
 *                          eine Erneuerung über das Netz.
 *   `ralia:identity`       den Abzug, aus dem Profil und Partner kommen, wenn das
 *                          Netz nicht antwortet.
 *
 * Damit läuft der Test durch denselben Pfad wie ein Nutzer ohne Empfang — die
 * Regel „nur eine echte Abmeldung meldet ab" wird hier also mitgeprüft, nicht
 * umgangen.
 */

const PROJECT_REF = 'nyvripddydrzvfuateea';
const USER_ID = '11111111-1111-4111-8111-111111111111';

/** Weit in der Zukunft, damit auth-js keine Erneuerung anstößt. */
const FAR_FUTURE_S = 4_000_000_000;

function base64url(value: string): string {
  return Buffer.from(value, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Ein formgültiges, unsigniertes JWT.
 *
 * Warum nicht einfach `'test-access-token'`: `auth-js` dekodiert das
 * Zugriffstoken, um die Restlaufzeit zu bestimmen. An einer Zeichenkette, die
 * kein JWT ist, scheitert das, und die Bibliothek hält die Sitzung für
 * erneuerungsbedürftig — sie läuft dann in eine Erneuerung mit Wiederholungen
 * gegen ein Netz, das dieser Test abgeschnitten hat, und der Start bleibt
 * hängen. Zwei Stunden gekostet, deshalb steht es hier.
 *
 * Signiert wird nicht. Der Client prüft die Signatur nicht, und der Server sieht
 * das Token nie — jeder Netzweg ist abgeschnitten.
 */
function fakeJwt(userId: string, email: string, expiresAt: number): string {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64url(
    JSON.stringify({
      sub: userId,
      email,
      role: 'authenticated',
      aud: 'authenticated',
      iss: `https://${PROJECT_REF}.supabase.co/auth/v1`,
      iat: 1_775_038_099,
      exp: expiresAt,
    }),
  );
  return `${header}.${payload}.e2e-not-a-real-signature`;
}

export interface SeedOptions {
  /** Verbundener Partner. Ohne ihn ist der Kalender solo. */
  partnerId?: string;
  anniversary?: string | null;
}

export async function seedSignedIn(
  context: BrowserContext,
  options: SeedOptions = {},
): Promise<void> {
  const partnerId = options.partnerId ?? null;

  const profile = {
    id: USER_ID,
    name: 'Lena',
    email: 'lena@example.com',
    invite_code: 'R7K2QM',
    partner_id: partnerId,
    timezone: 'Europe/Berlin',
    anniversary_date: options.anniversary ?? null,
    plan_tier: 'free',
    plan_status: 'inactive',
    ls_customer_id: null,
    ls_subscription_id: null,
    pro_expires_at: null,
    created_at: '2026-01-01T00:00:00Z',
  };

  const partner =
    partnerId === null ? null : { ...profile, id: partnerId, name: 'Jonas', partner_id: USER_ID };
  const calendarId = partnerId === null ? USER_ID : [USER_ID, partnerId].sort().join('_');

  const accessToken = fakeJwt(USER_ID, profile.email, FAR_FUTURE_S);

  await context.addInitScript(
    ([ref, expires, prof, part, calId, token]: [
      string,
      number,
      unknown,
      unknown,
      string,
      string,
    ]) => {
      localStorage.setItem(
        `sb-${ref}-auth-token`,
        JSON.stringify({
          access_token: token,
          refresh_token: 'e2e-refresh-token',
          token_type: 'bearer',
          expires_in: 3600,
          expires_at: expires,
          user: {
            id: (prof as { id: string }).id,
            email: (prof as { email: string }).email,
            aud: 'authenticated',
            role: 'authenticated',
            app_metadata: {},
            user_metadata: { name: (prof as { name: string }).name },
            created_at: '2026-01-01T00:00:00Z',
          },
        }),
      );

      localStorage.setItem(
        'ralia:identity',
        JSON.stringify({
          version: 1,
          userId: (prof as { id: string }).id,
          name: (prof as { name: string }).name,
          email: (prof as { email: string }).email,
          calendarId: calId,
          profile: prof,
          partner: part,
          savedAt: '2026-08-05T09:00:00.000Z',
        }),
      );
    },
    [PROJECT_REF, FAR_FUTURE_S, profile, partner, calendarId, accessToken] as [
      string,
      number,
      unknown,
      unknown,
      string,
      string,
    ],
  );
}

/**
 * Jeden Netzweg zum Backend abschneiden.
 *
 * `app-api` deckt `/config`; `auth/v1` und `rest/v1` kommen dazu, weil die
 * Anmeldung ab SP1 beides anspricht. Ein Test, der versehentlich das echte
 * Projekt trifft, wäre kein Test mehr, sondern ein Eingriff.
 */
export async function blockBackend(context: BrowserContext): Promise<void> {
  await context.route('**/functions/v1/app-api/**', (route) => route.abort());
  await context.route('**/auth/v1/**', (route) => route.abort());
  await context.route('**/rest/v1/**', (route) => route.abort());
}
