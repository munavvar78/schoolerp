/** Client-side JWT helpers (no signature verify — expiry UX only). */

export type AccessTokenClaims = {
  exp?: number;
  sub?: string;
  org?: string;
  campusId?: string;
  role?: string;
};

export function decodeAccessToken(token: string): AccessTokenClaims | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2 || !parts[1]) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const json = atob(padded);
    return JSON.parse(json) as AccessTokenClaims;
  } catch {
    return null;
  }
}

export function getAccessTokenExpiresAt(token: string): number | null {
  const claims = decodeAccessToken(token);
  if (!claims?.exp) return null;
  return claims.exp * 1000;
}

export function isAccessTokenExpired(token: string, skewMs = 0): boolean {
  const expiresAt = getAccessTokenExpiresAt(token);
  if (!expiresAt) return true;
  return Date.now() >= expiresAt - skewMs;
}

/** Milliseconds until we should warn (2 minutes before expiry). Negative if already past. */
export function msUntilExpiryWarning(token: string, warnBeforeMs = 2 * 60 * 1000): number | null {
  const expiresAt = getAccessTokenExpiresAt(token);
  if (!expiresAt) return null;
  return expiresAt - warnBeforeMs - Date.now();
}
