import type { LoginInput, RegisterOrganizationInput } from '@school-erp/shared';
import {
  clearSession,
  getAccessToken,
  redirectToLogin,
  saveSession,
  type SessionPayload,
} from './session';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

type ApiFetchOptions = RequestInit & {
  auth?: boolean;
  json?: unknown;
  /** Skip 401 → login redirect (used by refresh itself). */
  skipAuthRedirect?: boolean;
};

export async function apiFetch<T = unknown>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const { auth = true, json, headers, skipAuthRedirect = false, ...rest } = options;
  const finalHeaders = new Headers(headers);

  if (json !== undefined) {
    finalHeaders.set('Content-Type', 'application/json');
  }

  if (auth) {
    const token = getAccessToken();
    if (token) {
      finalHeaders.set('Authorization', `Bearer ${token}`);
    }
  }

  const response = await fetch(`${API_URL}${path.startsWith('/') ? path : `/${path}`}`, {
    ...rest,
    credentials: rest.credentials ?? 'include',
    headers: finalHeaders,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });

  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    const message =
      typeof data === 'object' &&
      data &&
      'message' in data &&
      (typeof (data as { message: unknown }).message === 'string' ||
        Array.isArray((data as { message: unknown }).message))
        ? Array.isArray((data as { message: unknown }).message)
          ? (data as { message: string[] }).message.join(', ')
          : String((data as { message: string }).message)
        : `Request failed (${response.status})`;

    if (
      auth &&
      !skipAuthRedirect &&
      (response.status === 401 || /invalid access token|missing access token/i.test(message))
    ) {
      redirectToLogin('session_expired');
    }

    throw new ApiError(message, response.status, data);
  }

  return data as T;
}

export async function login(input: LoginInput): Promise<SessionPayload> {
  const data = await apiFetch<SessionPayload>('/auth/login', {
    method: 'POST',
    auth: false,
    json: input,
  });
  saveSession(data);
  return data;
}

export async function register(input: RegisterOrganizationInput): Promise<SessionPayload> {
  const data = await apiFetch<SessionPayload>('/auth/register', {
    method: 'POST',
    auth: false,
    json: input,
  });
  saveSession(data);
  return data;
}

export async function refreshSession(): Promise<SessionPayload> {
  const data = await apiFetch<SessionPayload | { accessToken: null }>('/auth/refresh', {
    method: 'POST',
    auth: false,
    skipAuthRedirect: true,
    json: {},
  });
  if (!data || !('accessToken' in data) || !data.accessToken) {
    redirectToLogin('session_expired');
    throw new ApiError('Refresh failed', 401, data);
  }
  const session = data as SessionPayload;
  saveSession(session);
  return session;
}

export async function logout(): Promise<void> {
  try {
    await apiFetch('/auth/logout', { method: 'POST', auth: false, skipAuthRedirect: true });
  } catch {
    // clear local session regardless of API result
  }
  clearSession();
}
