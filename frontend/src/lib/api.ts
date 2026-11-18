import axios, { type AxiosRequestConfig } from 'axios';
import { useAuth, type SessionUser } from './auth';

const TIMEOUT_MS = 30_000;

export const http = axios.create({ baseURL: '/api', withCredentials: true, timeout: TIMEOUT_MS });

/** The one error shape pages handle, whatever went wrong underneath. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly code: string | null,
    readonly details: unknown = null,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const FALLBACK: Record<number, string> = {
  400: 'That request was not valid.',
  401: 'Your session has ended. Sign in again.',
  403: 'You do not have permission to do that.',
  404: 'That record no longer exists.',
  409: 'That change conflicts with the current state.',
  413: 'That file is too large.',
  429: 'Too many requests. Wait a moment and try again.',
  500: 'The server hit an unexpected error.',
  503: 'The service is unavailable right now.',
};

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (axios.isAxiosError(error)) {
    const status = error.response?.status ?? null;
    const body = error.response?.data as { message?: string; code?: string; details?: unknown } | undefined;
    if (status === null) {
      const timedOut = error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT';
      return new ApiError(
        timedOut ? 'The request timed out.' : 'Cannot reach the server. Check your connection.',
        null,
        error.code ?? null,
      );
    }
    return new ApiError(
      body?.message ?? FALLBACK[status] ?? 'Something went wrong.',
      status,
      body?.code ?? null,
      body?.details ?? null,
    );
  }
  return new ApiError(error instanceof Error ? error.message : 'Something went wrong.', null, null);
}

http.interceptors.request.use((config) => {
  const token = useAuth.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/**
 * One refresh at a time. A dashboard fires several requests together; without
 * this an expired token becomes several refresh calls racing to rotate the
 * same cookie, and all but one invalidate each other.
 */
let refreshing: Promise<string> | null = null;

export function refreshSession(): Promise<string> {
  refreshing ??= axios
    .post<{ data: { accessToken: string; user: SessionUser } }>('/api/auth/refresh', {}, { withCredentials: true, timeout: TIMEOUT_MS })
    .then(({ data }) => {
      useAuth.getState().setSession(data.data.accessToken, data.data.user);
      return data.data.accessToken;
    })
    .catch((error) => {
      useAuth.getState().clear();
      throw error;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

const AUTH_PATHS = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout'];

http.interceptors.response.use(undefined, async (error) => {
  const original = error.config as (AxiosRequestConfig & { _retried?: boolean }) | undefined;
  const isAuthCall = AUTH_PATHS.some((path) => original?.url?.includes(path));
  if (error.response?.status === 401 && original && !original._retried && !isAuthCall) {
    original._retried = true;
    try {
      const token = await refreshSession();
      original.headers = { ...original.headers, Authorization: `Bearer ${token}` };
      return http(original);
    } catch (refreshError) {
      throw toApiError(refreshError);
    }
  }
  throw toApiError(error);
});

/** Every endpoint answers `{ success, data }`; these return `data`. */
async function send<T>(config: AxiosRequestConfig): Promise<T> {
  const response = await http.request<{ data: T }>(config);
  return response.data.data;
}

export const api = {
  get: <T>(url: string, params?: object) => send<T>({ method: 'get', url, params }),
  post: <T>(url: string, data?: unknown) => send<T>({ method: 'post', url, data }),
  put: <T>(url: string, data?: unknown) => send<T>({ method: 'put', url, data }),
  patch: <T>(url: string, data?: unknown) => send<T>({ method: 'patch', url, data }),
  delete: <T = null>(url: string) => send<T>({ method: 'delete', url }),
  /** For list endpoints that return `{ items, meta }` beside `data`. */
  raw: <T>(config: AxiosRequestConfig) => http.request<T>(config).then((r) => r.data),
};

export const errorMessage = (error: unknown) => toApiError(error).message;
