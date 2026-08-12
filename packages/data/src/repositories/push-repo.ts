/**
 * Push-Abos (Web Push) anlegen, aktualisieren, deaktivieren und abfragen.
 *
 * `push_subscriptions` hat eine einzige RLS-Policy fuer ALL: `auth.uid() = user_id`
 * (gegen die laufende Datenbank geprueft, 2026-08-12). Die Absicherung ist damit
 * serverseitig erledigt -- `user_id` wird hier trotzdem bei jeder Operation
 * ausdruecklich mitgeschrieben bzw. mitgefiltert, damit dieses Repository nicht
 * von einer Vorgabe der Datenbank abhaengt.
 *
 * Ein Abo wird beim Abmelden deaktiviert, nicht geloescht (`is_active: false`):
 * der `reminder-worker` deaktiviert bei einem 404/410 der Push-API genauso, und
 * eine deaktivierte Zeile bleibt als Spur erhalten statt spurlos zu verschwinden.
 */

import type { RaliaSupabaseClient } from '../client.js';
import type { TablesInsert, TablesUpdate } from '../database.types.js';
import { normalizeRepositoryError } from './repository-error.js';

export interface PushSubscriptionInput {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent: string | null;
}

export interface PushRepo {
  /** Legt das Abo an, oder aktualisiert es, wenn (user_id, endpoint) schon existiert. */
  save(input: PushSubscriptionInput): Promise<void>;
  /** Deaktiviert das Abo. Loescht die Zeile nicht. */
  deactivate(endpoint: string): Promise<void>;
  /** `true`, wenn fuer diesen Endpoint ein aktives Abo dieses Nutzers existiert. */
  hasActive(endpoint: string): Promise<boolean>;
}

function insertRow(
  userId: string,
  input: PushSubscriptionInput,
): TablesInsert<'push_subscriptions'> {
  return {
    user_id: userId,
    endpoint: input.endpoint,
    p256dh: input.p256dh,
    auth: input.auth,
    user_agent: input.userAgent,
    is_active: true,
    updated_at: new Date().toISOString(),
  };
}

function deactivateRow(): TablesUpdate<'push_subscriptions'> {
  return { is_active: false, updated_at: new Date().toISOString() };
}

export function createPushRepo(client: RaliaSupabaseClient, userId: string): PushRepo {
  return {
    async save(input) {
      const operation = 'push_subscriptions.save';
      try {
        const { error } = await client.from('push_subscriptions').upsert(
          insertRow(userId, input),
          {
            /*
             * Nicht `onConflict: 'endpoint'`: der einzige passende Unique-Index
             * heisst `push_subscriptions_user_id_endpoint_key` und liegt auf
             * (user_id, endpoint), nicht auf `endpoint` allein. Gegen die laufende
             * Datenbank geprueft (pg_indexes, 2026-08-12) -- ein falscher Name
             * scheitert erst zur Laufzeit, nicht beim Typecheck.
             */
            onConflict: 'user_id,endpoint',
          },
        );
        if (error !== null) throw error;
      } catch (error) {
        throw normalizeRepositoryError(operation, error);
      }
    },

    async deactivate(endpoint) {
      const operation = 'push_subscriptions.deactivate';
      try {
        const { error } = await client
          .from('push_subscriptions')
          .update(deactivateRow())
          .eq('user_id', userId)
          .eq('endpoint', endpoint);
        if (error !== null) throw error;
      } catch (error) {
        throw normalizeRepositoryError(operation, error);
      }
    },

    async hasActive(endpoint) {
      const operation = 'push_subscriptions.hasActive';
      try {
        const { data, error } = await client
          .from('push_subscriptions')
          .select('is_active')
          .eq('user_id', userId)
          .eq('endpoint', endpoint)
          .maybeSingle();
        if (error !== null) throw error;
        return data?.is_active === true;
      } catch (error) {
        throw normalizeRepositoryError(operation, error);
      }
    },
  };
}
