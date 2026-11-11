import type { ModuleKey, Role } from '@school-erp/shared';
import { getAccessTokenExpiresAt, isAccessTokenExpired } from './token';

export const ACCESS_TOKEN_KEY = 'erp_access';
export const SESSION_KEY = 'erp_session';

export type AuthUser = {
  id: string;
  email: string;
  name: string;
};

export type SessionPayload = {
  accessToken: string;
  user: AuthUser;
  campusId: string;
  organizationId: string;
  role: Role;
  enabledModules?: ModuleKey[];
  /** Epoch ms when access token expires (denormalized for UX). */
  expiresAt?: number;
};

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getSession(): SessionPayload | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    const session = JSON.parse(raw) as SessionPayload;
    if (!session.expiresAt && session.accessToken) {
      session.expiresAt = getAccessTokenExpiresAt(session.accessToken) ?? undefined;
    }
    return session;
  } catch {
    return null;
  }
}

export function saveSession(session: SessionPayload): void {
  const expiresAt =
    session.expiresAt ?? getAccessTokenExpiresAt(session.accessToken) ?? undefined;
  const next = { ...session, expiresAt };
  localStorage.setItem(ACCESS_TOKEN_KEY, next.accessToken);
  localStorage.setItem(SESSION_KEY, JSON.stringify(next));
}

export function clearSession(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(SESSION_KEY);
}

export function isLoggedIn(): boolean {
  const token = getAccessToken();
  const session = getSession();
  if (!token || !session) return false;
  return !isAccessTokenExpired(token);
}

export function redirectToLogin(reason?: string): void {
  if (typeof window === 'undefined') return;
  clearSession();
  const url = reason ? `/login?reason=${encodeURIComponent(reason)}` : '/login';
  if (window.location.pathname.startsWith('/login')) return;
  window.location.replace(url);
}
