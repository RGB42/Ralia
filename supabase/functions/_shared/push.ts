import webpush from 'npm:web-push@3.6.7';

import { getRuntimeSecret } from './runtime.ts';
import { serviceRequest } from './supabase.ts';

let vapidInitialized = false;

function parsePayload(payload: string) {
    try {
        return JSON.parse(payload) as Record<string, unknown>;
    } catch (_error) {
        return null;
    }
}

function clampTtl(seconds: number) {
    return Math.max(60, Math.min(7 * 24 * 60 * 60, Math.floor(seconds)));
}

function getReminderTtlSeconds(expiresAt: string) {
    const expiresAtMs = expiresAt ? Date.parse(expiresAt) : Number.NaN;
    const secondsUntilExpiry = Number.isFinite(expiresAtMs)
        ? (expiresAtMs - Date.now()) / 1000
        : 0;

    return clampTtl(Math.max(30 * 60, secondsUntilExpiry));
}

function computeSendOptions(payload: string) {
    const parsed = parsePayload(payload);
    const source = String(parsed?.data && typeof parsed.data === 'object' ? (parsed.data as Record<string, unknown>).source || '' : '');
    const tag = typeof parsed?.tag === 'string' ? parsed.tag : '';
    const expiresAt = String(parsed?.data && typeof parsed.data === 'object' ? (parsed.data as Record<string, unknown>).expiresAt || '' : '');
    const ttlSeconds = source.includes('reminder')
        ? getReminderTtlSeconds(expiresAt)
        : 60 * 60;

    return {
        TTL: ttlSeconds,
        urgency: source.includes('reminder') ? 'high' : 'normal',
        topic: tag ? tag.slice(0, 32) : undefined
    };
}

async function ensureVapid() {
    if (vapidInitialized) return true;

    const publicKey = await getRuntimeSecret('vapid_public_key');
    const privateKey = await getRuntimeSecret('vapid_private_key');
    const subject = (await getRuntimeSecret('vapid_subject')) || 'mailto:admin@example.com';

    if (!publicKey || !privateKey) {
        return false;
    }

    webpush.setVapidDetails(subject, publicKey, privateKey);
    vapidInitialized = true;
    return true;
}

export function summarizePushSubscription(row: Record<string, unknown>) {
    let endpointHost: string | null = null;

    try {
        endpointHost = row?.endpoint ? new URL(String(row.endpoint)).host : null;
    } catch (_error) {
        endpointHost = null;
    }

    return {
        created_at: row.created_at || null,
        updated_at: row.updated_at || null,
        is_active: row.is_active !== false,
        endpoint_host: endpointHost,
        user_agent: row.user_agent || null
    };
}

export async function getPushSubscriptionsForUser(userId: string, withKeys = false) {
    const select = withKeys
        ? 'endpoint,p256dh,auth,user_agent,is_active,created_at,updated_at,user_id'
        : 'endpoint,user_agent,is_active,created_at,updated_at';

    return serviceRequest(
        `/rest/v1/push_subscriptions?select=${select}&user_id=eq.${userId}&is_active=eq.true&order=updated_at.desc`
    );
}

export async function deactivateSubscription(endpoint: string) {
    await serviceRequest(`/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}`, {
        method: 'PATCH',
        body: {
            is_active: false,
            updated_at: new Date().toISOString()
        }
    });
}

export async function sendPushToStoredSubscription(subscriptionRow: Record<string, unknown>, payload: string) {
    const hasConfig = await ensureVapid();
    if (!hasConfig) {
        throw new Error('Web push not configured');
    }

    return webpush.sendNotification(
        {
            endpoint: String(subscriptionRow.endpoint),
            keys: {
                p256dh: String(subscriptionRow.p256dh),
                auth: String(subscriptionRow.auth)
            }
        },
        payload,
        computeSendOptions(payload)
    );
}

export async function sendPushTestToUser(userId: string, options: { endpoint?: string } = {}) {
    const endpointFilter = typeof options.endpoint === 'string' ? options.endpoint.trim() : '';
    const subscriptions = (await getPushSubscriptionsForUser(userId, true)) || [];
    const filtered = endpointFilter
        ? subscriptions.filter((item: Record<string, unknown>) => item.endpoint === endpointFilter)
        : subscriptions;

    if (!Array.isArray(filtered) || filtered.length === 0) {
        return {
            success: false,
            status: 404,
            payload: {
                error: endpointFilter
                    ? 'No active push subscription found for the selected current device'
                    : 'No active push subscriptions found for this user'
            }
        };
    }

    const payload = JSON.stringify({
        title: 'Ralia push test',
        body: 'If you can see this notification, server-side push delivery is working for this user.',
        tag: `push-test-${Date.now()}`,
        options: {
            requireInteraction: true,
            renotify: true,
            silent: false
        },
        data: {
            url: '/',
            source: endpointFilter ? 'push-test-current-device' : 'push-test-admin',
            sentAt: new Date().toISOString(),
            userId
        }
    });

    let delivered = 0;
    const failures: Array<Record<string, unknown>> = [];

    for (const subscription of filtered) {
        try {
            await sendPushToStoredSubscription(subscription, payload);
            delivered += 1;
        } catch (error) {
            const pushError = error as { statusCode?: number; message?: string };
            const statusCode = pushError.statusCode || 0;

            failures.push({
                endpoint_host: summarizePushSubscription(subscription).endpoint_host,
                statusCode,
                message: pushError.message || 'Unknown push error'
            });

            if (statusCode === 404 || statusCode === 410) {
                await deactivateSubscription(String(subscription.endpoint));
            }
        }
    }

    return {
        success: delivered > 0,
        status: 200,
        payload: {
            success: delivered > 0,
            delivered,
            failures,
            subscriptions: filtered.map((item: Record<string, unknown>) => summarizePushSubscription(item)),
            targetedCurrentDevice: Boolean(endpointFilter)
        }
    };
}
