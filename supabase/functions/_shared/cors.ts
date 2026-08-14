export const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret, x-signature',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS'
};

export function withCors(headers: HeadersInit = {}) {
    const result = new Headers(headers);
    Object.entries(corsHeaders).forEach(([key, value]) => {
        result.set(key, value);
    });
    return result;
}

export function jsonResponse(body: unknown, init: ResponseInit = {}) {
    const headers = withCors(init.headers);
    headers.set('Content-Type', 'application/json; charset=utf-8');
    return new Response(JSON.stringify(body), {
        ...init,
        headers
    });
}

export function textResponse(body: string, init: ResponseInit = {}) {
    const headers = withCors(init.headers);
    return new Response(body, {
        ...init,
        headers
    });
}
