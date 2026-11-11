import type { LoginInput, ModuleKey, Role } from '@school-erp/shared';
import { loginSchema } from '@school-erp/shared';
import {
  clearSession,
  getMemorySession,
  loadSession,
  persistSession,
  type MobileSession,
  type SessionUser,
} from '../auth/session';
import { ApiError } from './errors';
import { queryClient } from './query';

export function apiBase(): string {
  const raw = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000/api';
  return raw.replace(/\/$/, '');
}

type LoginResponse = {
  accessToken: string | null;
  refreshToken?: string;
  user: SessionUser & Record<string, unknown>;
  campusId: string;
  organizationId: string;
  role: Role;
  enabledModules?: ModuleKey[];
};

type RequestOptions = {
  method?: string;
  json?: unknown;
  auth?: boolean;
  skipRefresh?: boolean;
};

function messageFromBody(data: unknown, status: number): string {
  if (typeof data === 'object' && data && 'message' in data) {
    const message = (data as { message: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
    if (Array.isArray(message)) {
      const text = message.filter((item) => typeof item === 'string').join(', ');
      if (text) return text;
    }
  }
  if (status === 0) return `Can't reach the school server at ${apiBase()}.`;
  return `Request failed (${status})`;
}

function decodeExp(token: string): number | null {
  const part = token.split('.')[1];
  if (!part) return null;
  try {
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const json = globalThis.atob(padded);
    const claims = JSON.parse(json) as { exp?: number };
    return typeof claims.exp === 'number' ? claims.exp * 1000 : null;
  } catch {
    return null;
  }
}

function isAccessTokenStale(token: string, skewMs = 30_000): boolean {
  const expiresAt = decodeExp(token);
  if (!expiresAt) return true;
  return Date.now() >= expiresAt - skewMs;
}

function toSession(data: LoginResponse): MobileSession {
  if (!data.accessToken || !data.refreshToken) {
    throw new ApiError('Sign-in did not return a session token.', 500, data);
  }
  return {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    user: {
      id: data.user.id,
      email: data.user.email,
      name: data.user.name,
    },
    campusId: data.campusId,
    organizationId: data.organizationId,
    role: data.role,
    enabledModules: data.enabledModules ?? [],
  };
}

async function rawFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers();
  headers.set('X-Client', 'mobile');
  headers.set('Accept', 'application/json');
  if (options.json !== undefined) headers.set('Content-Type', 'application/json');
  if (options.auth !== false) {
    const token = getMemorySession()?.accessToken;
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  let response: Response;
  try {
    response = await fetch(`${apiBase()}${path.startsWith('/') ? path : `/${path}`}`, {
      method: options.method ?? (options.json !== undefined ? 'POST' : 'GET'),
      headers,
      body: options.json !== undefined ? JSON.stringify(options.json) : undefined,
      signal: controller.signal,
    });
  } catch (error) {
    const aborted = error instanceof Error && error.name === 'AbortError';
    throw new ApiError(
      aborted
        ? `The school server at ${apiBase()} did not respond.`
        : `Can't reach the school server at ${apiBase()}. Check that the API is running and this device can reach it.`,
      0,
      null,
      true,
    );
  } finally {
    clearTimeout(timer);
  }

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
    throw new ApiError(messageFromBody(data, response.status), response.status, data);
  }
  return data as T;
}

let refreshInFlight: Promise<boolean> | null = null;

async function refreshAccess(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    const refreshToken = getMemorySession()?.refreshToken;
    if (!refreshToken) return false;
    try {
      const data = await rawFetch<LoginResponse>('/auth/refresh', {
        method: 'POST',
        auth: false,
        json: { refreshToken },
      });
      if (!data.accessToken || !data.refreshToken) return false;
      await persistSession(toSession(data));
      return true;
    } catch {
      return false;
    }
  })().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

async function dropSession(): Promise<void> {
  await clearSession();
  queryClient.clear();
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (options.auth !== false && !options.skipRefresh) {
    const token = getMemorySession()?.accessToken;
    if (token && isAccessTokenStale(token)) {
      const refreshed = await refreshAccess();
      if (!refreshed) {
        await dropSession();
        throw new ApiError('Your session expired. Sign in again.', 401, null);
      }
    }
  }

  try {
    return await rawFetch<T>(path, options);
  } catch (error) {
    if (
      options.auth !== false &&
      !options.skipRefresh &&
      error instanceof ApiError &&
      error.status === 401
    ) {
      const refreshed = await refreshAccess();
      if (refreshed) return rawFetch<T>(path, { ...options, skipRefresh: true });
      await dropSession();
      throw new ApiError('Your session expired. Sign in again.', 401, error.body);
    }
    throw error;
  }
}

export async function login(input: LoginInput): Promise<MobileSession> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? 'Check the email and password';
    throw new ApiError(message, 400, parsed.error.flatten());
  }
  const data = await rawFetch<LoginResponse>('/auth/login', {
    method: 'POST',
    auth: false,
    json: parsed.data,
  });
  const session = toSession(data);
  await persistSession(session);
  return session;
}

export async function logout(): Promise<void> {
  const refreshToken = getMemorySession()?.refreshToken;
  try {
    if (refreshToken) {
      await rawFetch('/auth/logout', {
        method: 'POST',
        auth: false,
        json: { refreshToken },
      });
    }
  } catch {
    // Local sign-out still proceeds if the server is unreachable.
  }
  await dropSession();
}

export async function restoreSession(): Promise<MobileSession | null> {
  const existing = await loadSession();
  if (!existing) return null;
  if (!isAccessTokenStale(existing.accessToken, 0)) return existing;
  const refreshed = await refreshAccess();
  if (!refreshed) {
    await dropSession();
    return null;
  }
  return getMemorySession();
}
