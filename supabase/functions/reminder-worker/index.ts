import { jsonResponse, withCors } from '../_shared/cors.ts';
import { constantTimeEquals, getRuntimeSecret } from '../_shared/runtime.ts';
import { deactivateSubscription, sendPushToStoredSubscription } from '../_shared/push.ts';
import { serviceRequest, serviceRpc } from '../_shared/supabase.ts';

const DEFAULT_BATCH_SIZE = 50;
const MAX_BATCH_SIZE = 100;

type ReminderJob = {
  id: string;
  event_id: string;
  recipient_user_id: string;
  occurrence_date: string;
  event_start_at: string;
  remind_at: string;
  reminder_offset_minutes: number;
  event_name: string;
  location?: string | null;
};

function chunkArray<T>(values: T[], size = 50) {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) chunks.push(values.slice(index, index + size));
  return chunks;
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))];
}

async function fetchRowsByInFilter(pathPrefix: string, values: string[]) {
  const rows: Record<string, unknown>[] = [];
  for (const chunk of chunkArray(values)) {
    if (chunk.length === 0) continue;
    const chunkRows = await serviceRequest(`${pathPrefix}in.(${chunk.map(encodeURIComponent).join(',')})`);
    if (Array.isArray(chunkRows)) rows.push(...chunkRows);
  }
  return rows;
}

function buildSubscriptionsByUser(subscriptions: unknown) {
  const subscriptionsByUser = new Map<string, Array<Record<string, unknown>>>();
  for (const sub of Array.isArray(subscriptions) ? subscriptions : []) {
    const row = sub as Record<string, unknown>;
    const userId = String(row.user_id || '');
    if (!userId) continue;
    if (!subscriptionsByUser.has(userId)) subscriptionsByUser.set(userId, []);
    subscriptionsByUser.get(userId)?.push(row);
  }
  return subscriptionsByUser;
}

function formatReminderBody(job: ReminderJob) {
  const start = new Date(job.event_start_at);
  const datePart = Number.isNaN(start.getTime())
    ? job.occurrence_date
    : new Intl.DateTimeFormat('de-DE', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Europe/Berlin'
      }).format(start);
  return `${datePart}${job.location ? ` • ${job.location}` : ''}`;
}

function buildPayload(job: ReminderJob) {
  return JSON.stringify({
    title: `⏰ Erinnerung: ${job.event_name}`,
    body: formatReminderBody(job),
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: `event-reminder-${job.event_id}-${job.occurrence_date}-${job.reminder_offset_minutes}-${job.recipient_user_id}`,
    data: {
      url: '/',
      eventId: job.event_id,
      reminderJobId: job.id,
      startDate: job.occurrence_date,
      expiresAt: job.event_start_at,
      sentAt: new Date().toISOString(),
      source: 'event-reminder'
    }
  });
}

async function markJobSent(jobId: string) {
  await serviceRpc('mark_event_reminder_job_sent', { p_job_id: jobId });
}

async function markJobFailed(jobId: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error || 'Unknown error');
  await serviceRpc('mark_event_reminder_job_failed', { p_job_id: jobId, p_error: message });
}

async function processEventReminderJobs(batchSize: number) {
  const claimed = await serviceRpc<ReminderJob[]>('claim_due_event_reminder_jobs', {
    p_limit: Math.max(1, Math.min(batchSize || DEFAULT_BATCH_SIZE, MAX_BATCH_SIZE))
  });

  const jobs = Array.isArray(claimed) ? claimed : [];
  if (jobs.length === 0) return { claimedJobs: 0, deliveredJobs: 0, failedJobs: 0, skippedJobs: 0 };

  const recipientIds = uniqueStrings(jobs.map((job) => job.recipient_user_id));
  const subscriptions = await fetchRowsByInFilter(
    '/rest/v1/push_subscriptions?select=user_id,endpoint,p256dh,auth&is_active=eq.true&user_id=',
    recipientIds
  );
  const subscriptionsByUser = buildSubscriptionsByUser(subscriptions);

  let deliveredJobs = 0;
  let failedJobs = 0;
  let skippedJobs = 0;

  for (const job of jobs) {
    const recipientSubs = subscriptionsByUser.get(job.recipient_user_id) || [];
    if (recipientSubs.length === 0) {
      skippedJobs += 1;
      await markJobFailed(job.id, 'No active push subscriptions for recipient');
      continue;
    }

    const payload = buildPayload(job);
    let deliveredToAnySubscription = false;

    for (const sub of recipientSubs) {
      try {
        await sendPushToStoredSubscription(sub, payload);
        deliveredToAnySubscription = true;
      } catch (error) {
        const pushError = error as { statusCode?: number; message?: string };
        const statusCode = pushError.statusCode || 0;
        if (statusCode === 404 || statusCode === 410) {
          await deactivateSubscription(String(sub.endpoint));
        } else {
          console.error('Event reminder push failed', job.id, pushError.message || error);
        }
      }
    }

    if (deliveredToAnySubscription) {
      await markJobSent(job.id);
      deliveredJobs += 1;
    } else {
      await markJobFailed(job.id, 'Push delivery failed for all active subscriptions');
      failedJobs += 1;
    }
  }

  return { claimedJobs: jobs.length, deliveredJobs, failedJobs, skippedJobs };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: withCors() });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, { status: 405 });

  const cronSecret = await getRuntimeSecret('cron_secret');
  const headerSecret = req.headers.get('x-cron-secret');
  const bearerSecret = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  const providedSecret = headerSecret || bearerSecret || null;
  if (!constantTimeEquals(providedSecret, cronSecret)) return jsonResponse({ error: 'Unauthorized' }, { status: 401 });

  try {
    const startedAt = Date.now();
    const url = new URL(req.url);
    const batchSize = Number(url.searchParams.get('batchSize') || DEFAULT_BATCH_SIZE) || DEFAULT_BATCH_SIZE;
    const summary = await processEventReminderJobs(batchSize);
    return jsonResponse({ success: true, durationMs: Date.now() - startedAt, ...summary });
  } catch (error) {
    console.error('reminder-worker error', error);
    return jsonResponse({ error: error instanceof Error ? error.message : 'Reminder worker failed' }, { status: 500 });
  }
});
