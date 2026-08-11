import webpush from 'npm:web-push@3.6.7';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const REQUEST_TTL_MS = 48 * 60 * 60 * 1000;
const MAX_EXPORT_ROWS = 10_000;
const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const CALENDAR_TABLES = [
  {
    key: 'events',
    select:
      'id,name,location,start_date,start_time,end_date,end_time,notes,belongs_to,created_by,created_at,updated_at,recurrence_type,recurrence_end_date,parent_event_id,recurrence_interval,reminder_enabled,reminder_offset_minutes,reminder_offsets,event_type,is_special_auto,special_key,subtitle,short_description,category',
  },
  {
    key: 'recurring_event_exceptions',
    select:
      'id,master_event_id,original_occurrence_date,created_by,is_deleted,override_event_data,created_at,updated_at',
  },
  { key: 'notes_todo_groups', select: 'id,created_by,name,created_at' },
  {
    key: 'notes_todos',
    select:
      'id,created_by,group_name,item_type,title,content,is_done,sort_order,created_at,updated_at,quantity,unit,category,assigned_to,workflow_status,completed_at',
  },
  {
    key: 'recurring_tasks',
    select:
      'id,created_by,group_name,title,description,cadence,recurrence_interval,target_mode,target_value,starts_on,active,sort_order,created_at,updated_at,assigned_to,workflow_status',
  },
  {
    key: 'recurring_task_logs',
    select: 'id,task_id,created_by,log_date,amount,note,created_at',
  },
  {
    key: 'week_plans',
    select:
      'id,created_by,week_start,day_of_week,entry_type,title,notes,sort_order,created_at,updated_at,assigned_to,is_done,completed_at',
  },
  {
    key: 'expense_categories',
    select: 'id,name,color,monthly_limit,sort_order,created_by,created_at,updated_at',
  },
  {
    key: 'expense_budgets',
    select: 'id,month_start,amount,created_by,created_at,updated_at',
  },
  {
    key: 'expense_settlements',
    select: 'id,from_user_id,to_user_id,amount,settled_at,notes,created_by,created_at',
  },
  {
    key: 'shared_expenses',
    select: 'id,title,amount,paid_by,category,paid_at,notes,split_type,created_at,updated_at',
  },
] as const;

class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
  }
}

type Profile = {
  id: string;
  name: string | null;
  email: string | null;
  timezone: string | null;
  anniversary_date: string | null;
  partner_id: string | null;
  created_at: string | null;
};

type ExportRequest = {
  id: string;
  requester_user_id: string;
  partner_user_id: string;
  calendar_id: string;
  status: 'pending' | 'approved' | 'rejected';
  expires_at: string;
  created_at: string;
  resolved_at: string | null;
};

function serviceHeaders(extra: HeadersInit = {}): Headers {
  const headers = new Headers(extra);
  headers.set('apikey', SERVICE_ROLE_KEY);
  headers.set('Authorization', `Bearer ${SERVICE_ROLE_KEY}`);
  return headers;
}

async function serviceRequest(path: string, init: RequestInit = {}): Promise<unknown> {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new HttpError(500, 'service_unavailable');
  const headers = serviceHeaders(init.headers);
  if (init.body !== undefined && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }
  const response = await fetch(`${SUPABASE_URL}${path}`, { ...init, headers });
  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }
  if (!response.ok) throw new HttpError(response.status, 'service_request_failed');
  return payload;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

function exportResponse(body: unknown, filename: string): Response {
  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}

function routePath(req: Request): string {
  const parts = new URL(req.url).pathname.split('/').filter(Boolean);
  const index = parts.lastIndexOf('privacy-api');
  return `/${(index === -1 ? parts : parts.slice(index + 1)).join('/')}`;
}

async function requireUser(req: Request): Promise<{ id: string }> {
  const authorization = req.headers.get('authorization') ?? '';
  if (!authorization.startsWith('Bearer ')) throw new HttpError(401, 'unauthorized');
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SERVICE_ROLE_KEY, Authorization: authorization },
  });
  if (!response.ok) throw new HttpError(401, 'unauthorized');
  const user = (await response.json()) as { id?: unknown };
  if (typeof user.id !== 'string' || !UUID.test(user.id)) throw new HttpError(401, 'unauthorized');
  return { id: user.id };
}

function calendarId(left: string, right: string): string {
  return [left, right].sort().join('_');
}

async function profileFor(userId: string): Promise<Profile> {
  const rows = await serviceRequest(
    `/rest/v1/profiles?select=id,name,email,timezone,anniversary_date,partner_id,created_at&id=eq.${userId}&limit=1`,
  );
  if (!Array.isArray(rows) || rows.length !== 1) throw new HttpError(404, 'profile_not_found');
  return rows[0] as Profile;
}

async function requestFor(id: string): Promise<ExportRequest> {
  if (!UUID.test(id)) throw new HttpError(404, 'request_not_found');
  const rows = await serviceRequest(
    `/rest/v1/data_export_requests?select=id,requester_user_id,partner_user_id,calendar_id,status,expires_at,created_at,resolved_at&id=eq.${id}&limit=1`,
  );
  if (!Array.isArray(rows) || rows.length !== 1) throw new HttpError(404, 'request_not_found');
  return rows[0] as ExportRequest;
}

function requestIsExpired(request: ExportRequest): boolean {
  return Number.isNaN(Date.parse(request.expires_at)) || Date.parse(request.expires_at) <= Date.now();
}

async function runtimeSecret(name: string): Promise<string | null> {
  const value = await serviceRequest('/rest/v1/rpc/get_runtime_secret', {
    method: 'POST',
    body: JSON.stringify({ secret_name: name }),
  });
  return typeof value === 'string' && value.length > 0 ? value : null;
}

async function notifyPartner(partnerId: string, requesterName: string | null): Promise<boolean> {
  try {
    const subscriptions = await serviceRequest(
      `/rest/v1/push_subscriptions?select=endpoint,p256dh,auth&user_id=eq.${partnerId}&is_active=eq.true`,
    );
    if (!Array.isArray(subscriptions) || subscriptions.length === 0) return false;

    const [publicKey, privateKey, subject] = await Promise.all([
      runtimeSecret('vapid_public_key'),
      runtimeSecret('vapid_private_key'),
      runtimeSecret('vapid_subject'),
    ]);
    if (!publicKey || !privateKey) return false;

    webpush.setVapidDetails(subject ?? 'mailto:admin@example.com', publicKey, privateKey);
    const payload = JSON.stringify({
      title: 'Ralia: Freigabe fuer Datenexport',
      body: `${requesterName || 'Dein Partner'} bittet um den Export gemeinsamer Inhalte.`,
      tag: `shared-data-export-${Date.now()}`,
      data: { url: '/profil', source: 'shared-data-export' },
    });

    let delivered = false;
    for (const row of subscriptions) {
      const subscription = row as { endpoint?: unknown; p256dh?: unknown; auth?: unknown };
      if (
        typeof subscription.endpoint !== 'string' ||
        typeof subscription.p256dh !== 'string' ||
        typeof subscription.auth !== 'string'
      ) {
        continue;
      }
      try {
        await webpush.sendNotification(
          { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
          payload,
          { TTL: 48 * 60 * 60, urgency: 'normal' },
        );
        delivered = true;
      } catch {
        // The request remains visible in the app even when this device has no usable push subscription.
      }
    }
    return delivered;
  } catch {
    return false;
  }
}

async function rowsForCalendar(table: string, select: string, id: string): Promise<Record<string, unknown>[]> {
  const rows = await serviceRequest(
    `/rest/v1/${table}?select=${select}&calendar_id=eq.${encodeURIComponent(id)}&order=created_at.asc&limit=${MAX_EXPORT_ROWS}`,
  );
  if (!Array.isArray(rows)) throw new HttpError(500, 'export_failed');
  if (rows.length === MAX_EXPORT_ROWS) throw new HttpError(413, 'export_too_large');
  return rows as Record<string, unknown>[];
}

async function expenseSplits(expenseIds: string[]): Promise<Record<string, unknown>[]> {
  const results: Record<string, unknown>[] = [];
  for (let offset = 0; offset < expenseIds.length; offset += 100) {
    const ids = expenseIds.slice(offset, offset + 100);
    if (ids.length === 0) continue;
    const rows = await serviceRequest(
      `/rest/v1/expense_splits?select=id,expense_id,user_id,amount,created_at&expense_id=in.(${ids.join(',')})&limit=${MAX_EXPORT_ROWS}`,
    );
    if (!Array.isArray(rows)) throw new HttpError(500, 'export_failed');
    results.push(...(rows as Record<string, unknown>[]));
  }
  return results;
}

function replaceMemberIds(
  row: Record<string, unknown>,
  requesterId: string,
  partnerId: string | null,
): Record<string, unknown> {
  const output = { ...row };
  for (const key of ['created_by', 'paid_by', 'user_id', 'from_user_id', 'to_user_id', 'assigned_to']) {
    const value = output[key];
    if (value === requesterId) output[key] = 'requester';
    else if (partnerId !== null && value === partnerId) output[key] = 'partner';
  }
  return output;
}

async function exportRecords(
  calendar: string,
  requesterId: string,
  partnerId: string | null,
): Promise<Record<string, Record<string, unknown>[]>> {
  const entries = await Promise.all(
    CALENDAR_TABLES.map(async ({ key, select }) => [key, await rowsForCalendar(key, select, calendar)] as const),
  );
  const records = Object.fromEntries(entries) as Record<string, Record<string, unknown>[]>;
  const expenses = records.shared_expenses ?? [];
  const ids = expenses.map((expense) => expense.id).filter((id): id is string => typeof id === 'string');
  records.expense_splits = await expenseSplits(ids);

  for (const [key, rows] of Object.entries(records)) {
    records[key] = rows.map((row) => replaceMemberIds(row, requesterId, partnerId));
  }
  return records;
}

async function personalExport(userId: string): Promise<Response> {
  const [profile, preferences] = await Promise.all([
    profileFor(userId),
    serviceRequest(
      `/rest/v1/app_preferences?select=locale,week_start,solo_mode,notification_settings,created_at,updated_at&user_id=eq.${userId}&limit=1`,
    ),
  ]);
  const records = await exportRecords(userId, userId, null);
  return exportResponse(
    {
      format: 'ralia-personal-export/v1',
      generatedAt: new Date().toISOString(),
      profile: {
        id: profile.id,
        name: profile.name,
        email: profile.email,
        timezone: profile.timezone,
        anniversaryDate: profile.anniversary_date,
        createdAt: profile.created_at,
      },
      preferences: Array.isArray(preferences) ? preferences[0] ?? null : null,
      records,
    },
    'ralia-personal-data.json',
  );
}

async function sharedExport(userId: string, requestId: string): Promise<Response> {
  const request = await requestFor(requestId);
  if (request.requester_user_id !== userId) throw new HttpError(403, 'request_not_allowed');
  if (request.status !== 'approved' || requestIsExpired(request)) {
    throw new HttpError(409, 'request_not_approved');
  }
  const profile = await profileFor(userId);
  if (profile.partner_id !== request.partner_user_id || request.calendar_id !== calendarId(userId, profile.partner_id)) {
    throw new HttpError(409, 'request_no_longer_valid');
  }
  const records = await exportRecords(request.calendar_id, userId, request.partner_user_id);
  return exportResponse(
    {
      format: 'ralia-shared-export/v1',
      generatedAt: new Date().toISOString(),
      consentedAt: request.resolved_at,
      records,
    },
    'ralia-shared-data.json',
  );
}

async function createSharedExportRequest(userId: string): Promise<Response> {
  const profile = await profileFor(userId);
  if (!profile.partner_id) throw new HttpError(409, 'partner_required');
  const expiresAt = new Date(Date.now() + REQUEST_TTL_MS).toISOString();
  const calendar = calendarId(userId, profile.partner_id);
  await serviceRequest(
    `/rest/v1/data_export_requests?requester_user_id=eq.${userId}&partner_user_id=eq.${profile.partner_id}&calendar_id=eq.${calendar}&status=eq.pending&expires_at=lt.${encodeURIComponent(new Date().toISOString())}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ status: 'rejected', resolved_at: new Date().toISOString() }),
    },
  );
  const result = await serviceRequest('/rest/v1/data_export_requests', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      requester_user_id: userId,
      partner_user_id: profile.partner_id,
      calendar_id: calendar,
      expires_at: expiresAt,
    }),
  });
  if (!Array.isArray(result) || result.length !== 1) throw new HttpError(500, 'request_create_failed');
  const delivered = await notifyPartner(profile.partner_id, profile.name);
  return jsonResponse({ id: (result[0] as ExportRequest).id, expiresAt, pushDelivered: delivered }, 201);
}

async function listSharedExportRequests(userId: string): Promise<Response> {
  const rows = await serviceRequest(
    `/rest/v1/data_export_requests?select=id,requester_user_id,partner_user_id,status,expires_at,created_at&or=(requester_user_id.eq.${userId},partner_user_id.eq.${userId})&order=created_at.desc&limit=50`,
  );
  if (!Array.isArray(rows)) throw new HttpError(500, 'request_list_failed');
  const requests = (rows as ExportRequest[]).map((request) =>
    requestIsExpired(request) && request.status !== 'rejected'
      ? { ...request, status: 'rejected' as const }
      : request,
  );
  return jsonResponse({
    incoming: requests
      .filter((request) => request.partner_user_id === userId)
      .map((request) => ({ id: request.id, status: request.status, expiresAt: request.expires_at, createdAt: request.created_at })),
    outgoing: requests
      .filter((request) => request.requester_user_id === userId)
      .map((request) => ({ id: request.id, status: request.status, expiresAt: request.expires_at, createdAt: request.created_at })),
  });
}

async function resolveSharedExportRequest(
  userId: string,
  requestId: string,
  status: 'approved' | 'rejected',
): Promise<Response> {
  const request = await requestFor(requestId);
  if (request.partner_user_id !== userId || request.status !== 'pending' || requestIsExpired(request)) {
    throw new HttpError(409, 'request_not_actionable');
  }
  const profile = await profileFor(userId);
  if (profile.partner_id !== request.requester_user_id) throw new HttpError(409, 'request_no_longer_valid');
  await serviceRequest(`/rest/v1/data_export_requests?id=eq.${request.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status, resolved_at: new Date().toISOString() }),
  });
  return jsonResponse({ id: request.id, status });
}

async function deleteAccount(userId: string): Promise<Response> {
  const status = await serviceRequest('/rest/v1/rpc/account_deletion_status', {
    method: 'POST',
    body: JSON.stringify({ p_user_id: userId }),
  });
  if (status !== 'ready') return jsonResponse({ error: status }, 409);

  const response = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
    method: 'DELETE',
    headers: serviceHeaders(),
  });
  if (!response.ok) throw new HttpError(409, 'account_delete_failed');
  return jsonResponse({ success: true });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  try {
    const user = await requireUser(req);
    const path = routePath(req);

    if (req.method === 'GET' && path === '/personal-export') return personalExport(user.id);
    if (req.method === 'POST' && path === '/shared-export-requests') {
      return createSharedExportRequest(user.id);
    }
    if (req.method === 'GET' && path === '/shared-export-requests') {
      return listSharedExportRequests(user.id);
    }
    if (req.method === 'GET' && path.match(/^\/shared-export-requests\/[^/]+\/download$/)) {
      return sharedExport(user.id, path.split('/')[2] ?? '');
    }
    const resolve = path.match(/^\/shared-export-requests\/([^/]+)\/(approve|reject)$/);
    if (req.method === 'POST' && resolve) {
      return resolveSharedExportRequest(user.id, resolve[1], resolve[2] === 'approve' ? 'approved' : 'rejected');
    }
    if (req.method === 'POST' && path === '/account/delete') return deleteAccount(user.id);

    return jsonResponse({ error: 'not_found' }, 404);
  } catch (error) {
    if (error instanceof HttpError) return jsonResponse({ error: error.code }, error.status);
    console.error('privacy-api error', error instanceof Error ? error.message : 'unknown');
    return jsonResponse({ error: 'internal_error' }, 500);
  }
});
