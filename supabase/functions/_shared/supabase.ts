const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const RETRYABLE_STATUS = new Set([500, 502, 503, 504]);

function ensureSupabaseConfig() {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error('Missing Supabase function environment configuration');
    }
}

async function parseResponse(response: Response) {
    const text = await response.text();
    if (!text) return null;

    try {
        return JSON.parse(text);
    } catch (_error) {
        return text;
    }
}

export async function serviceRequest(
    pathname: string,
    {
        method = 'GET',
        body,
        headers = {},
        prefer = 'return=representation'
    }: {
        method?: string;
        body?: unknown;
        headers?: Record<string, string>;
        prefer?: string;
    } = {}
) {
    ensureSupabaseConfig();

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
            const finalHeaders: Record<string, string> = {
                apikey: SUPABASE_SERVICE_ROLE_KEY,
                Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                Prefer: prefer,
                ...headers
            };

            const hasJsonBody = typeof body !== 'undefined';
            if (hasJsonBody && !finalHeaders['Content-Type']) {
                finalHeaders['Content-Type'] = 'application/json';
            }

            const response = await fetch(`${SUPABASE_URL}${pathname}`, {
                method,
                headers: finalHeaders,
                body: hasJsonBody ? JSON.stringify(body) : undefined
            });

            const payload = await parseResponse(response);
            if (!response.ok) {
                if (RETRYABLE_STATUS.has(response.status) && attempt < 3) {
                    await new Promise((resolve) => setTimeout(resolve, 300 * attempt));
                    continue;
                }
                throw new Error(`Supabase request failed (${response.status}): ${typeof payload === 'string' ? payload : JSON.stringify(payload)}`);
            }

            return payload;
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            if (attempt < 3) {
                await new Promise((resolve) => setTimeout(resolve, 300 * attempt));
                continue;
            }
        }
    }

    throw lastError || new Error('Supabase request failed');
}

export async function serviceRpc<T = unknown>(name: string, args: Record<string, unknown> = {}) {
    return serviceRequest(`/rest/v1/rpc/${name}`, {
        method: 'POST',
        body: args
    }) as Promise<T>;
}

export async function getAuthUser(req: Request) {
    ensureSupabaseConfig();

    const authHeader = req.headers.get('Authorization') || '';
    if (!authHeader.startsWith('Bearer ')) {
        return null;
    }

    try {
        const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
            headers: {
                apikey: SUPABASE_SERVICE_ROLE_KEY,
                Authorization: authHeader
            }
        });

        if (!response.ok) {
            return null;
        }

        return await response.json();
    } catch (_error) {
        return null;
    }
}

export function getServiceRoleKey() {
    ensureSupabaseConfig();
    return SUPABASE_SERVICE_ROLE_KEY;
}

export function getSupabaseUrl() {
    ensureSupabaseConfig();
    return SUPABASE_URL;
}
