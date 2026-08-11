export interface PrivacyApiOptions {
  supabaseUrl: string;
  anonKey: string;
  getAccessToken(): Promise<string | null>;
  fetchImpl?: typeof fetch;
  functionName?: string;
}

export interface PrivacyExportRequest {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
  expiresAt: string;
  createdAt: string;
}

export interface PrivacyExportRequests {
  incoming: PrivacyExportRequest[];
  outgoing: PrivacyExportRequest[];
}

export interface PrivacyApiClient {
  personalExport(): Promise<Response>;
  sharedExport(requestId: string): Promise<Response>;
  requestSharedExport(): Promise<{ id: string; expiresAt: string; pushDelivered: boolean }>;
  listSharedExportRequests(): Promise<PrivacyExportRequests>;
  resolveSharedExportRequest(
    requestId: string,
    resolution: 'approve' | 'reject',
  ): Promise<{ id: string; status: 'approved' | 'rejected' }>;
  deleteAccount(): Promise<{ success: true }>;
}

export class PrivacyApiError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
  ) {
    super(code);
  }
}

export class PrivacyApi implements PrivacyApiClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: PrivacyApiOptions) {
    const functionName = options.functionName ?? 'privacy-api';
    this.baseUrl = `${options.supabaseUrl.replace(/\/+$/, '')}/functions/v1/${functionName}`;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  private async request(path: string, init: RequestInit = {}): Promise<Response> {
    const accessToken = await this.options.getAccessToken();
    if (!accessToken) throw new PrivacyApiError('unauthorized', 401);

    const headers = new Headers(init.headers);
    headers.set('apikey', this.options.anonKey);
    headers.set('authorization', `Bearer ${accessToken}`);
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, { ...init, headers });
    if (response.ok) return response;

    let code = 'request_failed';
    try {
      const body = (await response.json()) as { error?: unknown };
      if (typeof body.error === 'string') code = body.error;
    } catch {
      // A malformed error response is not actionable to callers.
    }
    throw new PrivacyApiError(code, response.status);
  }

  private async json<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await this.request(path, init);
    return (await response.json()) as T;
  }

  personalExport(): Promise<Response> {
    return this.request('/personal-export');
  }

  sharedExport(requestId: string): Promise<Response> {
    return this.request(`/shared-export-requests/${encodeURIComponent(requestId)}/download`);
  }

  requestSharedExport(): Promise<{ id: string; expiresAt: string; pushDelivered: boolean }> {
    return this.json('/shared-export-requests', { method: 'POST' });
  }

  listSharedExportRequests(): Promise<PrivacyExportRequests> {
    return this.json('/shared-export-requests');
  }

  resolveSharedExportRequest(
    requestId: string,
    resolution: 'approve' | 'reject',
  ): Promise<{ id: string; status: 'approved' | 'rejected' }> {
    return this.json(`/shared-export-requests/${encodeURIComponent(requestId)}/${resolution}`, {
      method: 'POST',
    });
  }

  deleteAccount(): Promise<{ success: true }> {
    return this.json('/account/delete', { method: 'POST' });
  }
}

export function createPrivacyApi(options: PrivacyApiOptions): PrivacyApi {
  return new PrivacyApi(options);
}
