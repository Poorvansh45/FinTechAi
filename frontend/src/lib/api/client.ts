import { env } from '@/config/env';
import { getAccessToken } from '@/lib/auth/token-service';

type ApiClientOptions = RequestInit & {
  auth?: boolean;
  backend?: boolean;
};

export class ApiError<TPayload = unknown> extends Error {
  status: number;
  payload: TPayload | null;

  constructor(message: string, status: number, payload: TPayload | null = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

function resolveUrl(path: string, backend = false): string {
  if (/^https?:\/\//i.test(path)) return path;
  if (backend) return `${env.backendApiUrl}${path.startsWith('/') ? path : `/${path}`}`;
  return path;
}

async function parseJsonSafe(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function buildHeaders(
  headers: HeadersInit | undefined,
  body: BodyInit | null | undefined,
  auth: boolean | undefined,
  forceRefresh = false
): Promise<Headers> {
  const requestHeaders = new Headers(headers);

  if (body && !requestHeaders.has('Content-Type')) {
    requestHeaders.set('Content-Type', 'application/json');
  }

  if (auth) {
    const token = await getAccessToken(forceRefresh);
    if (token) requestHeaders.set('Authorization', `Bearer ${token}`);
  }

  return requestHeaders;
}

async function executeRequest(
  path: string,
  options: ApiClientOptions,
  forceRefresh = false
): Promise<Response> {
  const { auth, backend, headers, body, ...request } = options;

  return fetch(resolveUrl(path, backend), {
    ...request,
    body,
    headers: await buildHeaders(headers, body, auth, forceRefresh),
  });
}

export async function apiFetch<TResponse>(
  path: string,
  options: ApiClientOptions = {}
): Promise<TResponse> {
  let response = await executeRequest(path, options);

  if (options.auth && response.status === 401) {
    response = await executeRequest(path, options, true);
  }

  const payload = await parseJsonSafe(response);
  if (!response.ok) {
    const message =
      typeof payload === 'object' && payload && 'error' in payload
        ? String((payload as { error?: unknown }).error)
        : `Request failed with status ${response.status}`;
    throw new ApiError(message, response.status, payload);
  }

  return payload as TResponse;
}

export const backendApi = {
  get: <TResponse>(path: string, options?: ApiClientOptions) =>
    apiFetch<TResponse>(path, { ...options, method: 'GET', backend: true }),
  post: <TResponse>(path: string, data: unknown, options?: ApiClientOptions) =>
    apiFetch<TResponse>(path, {
      ...options,
      method: 'POST',
      backend: true,
      body: JSON.stringify(data),
    }),
};
