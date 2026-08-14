import { serviceRpc } from './supabase.ts';

const secretCache = new Map<string, Promise<string | null>>();

export async function getRuntimeSecret(name: string) {
    if (!secretCache.has(name)) {
        secretCache.set(
            name,
            (async () => {
                const result = await serviceRpc<string | null>('get_runtime_secret', { secret_name: name });
                return typeof result === 'string' && result.length > 0 ? result : null;
            })()
        );
    }

    return secretCache.get(name) as Promise<string | null>;
}

export async function getAdminEmailSet() {
    const raw = (await getRuntimeSecret('admin_emails')) || '';
    return new Set(
        raw
            .split(',')
            .map((value) => value.trim().toLowerCase())
            .filter(Boolean)
    );
}

export async function getAppBaseUrl(req: Request) {
    const origin = req.headers.get('origin');
    if (origin) return origin.replace(/\/$/, '');

    const referer = req.headers.get('referer');
    if (referer) {
        try {
            return new URL(referer).origin;
        } catch (_error) {
            // fall through to secret
        }
    }

    return (await getRuntimeSecret('app_base_url')) || 'http://localhost:3000';
}

export function constantTimeEquals(left: string | null, right: string | null) {
    if (!left || !right) return false;
    if (left.length !== right.length) return false;

    let mismatch = 0;
    for (let index = 0; index < left.length; index += 1) {
        mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
    }

    return mismatch === 0;
}

export function mapSubscriptionToPlan(subscriptionStatus: string | null | undefined) {
    const activeStatuses = new Set(['active', 'on_trial']);
    return activeStatuses.has(subscriptionStatus || '') ? 'pro' : 'free';
}

export function getProExpiresAtIso(subscription: { renews_at?: string | null } | null | undefined) {
    const renewsAt = subscription?.renews_at;
    if (!renewsAt) return null;
    return new Date(renewsAt).toISOString();
}
