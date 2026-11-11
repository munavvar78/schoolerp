import { describe, expect, it } from 'vitest';
import { getAccessTokenExpiresAt, isAccessTokenExpired, msUntilExpiryWarning } from './token';

function fakeJwt(expSec: number) {
  const header = btoa(JSON.stringify({ alg: 'none', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({ exp: expSec, sub: 'u1' }));
  return `${header}.${payload}.sig`;
}

describe('token helpers', () => {
  it('reads exp from jwt payload', () => {
    const exp = Math.floor(Date.now() / 1000) + 600;
    expect(getAccessTokenExpiresAt(fakeJwt(exp))).toBe(exp * 1000);
  });

  it('detects expired tokens', () => {
    const exp = Math.floor(Date.now() / 1000) - 10;
    expect(isAccessTokenExpired(fakeJwt(exp))).toBe(true);
  });

  it('computes warning window 2 minutes before expiry', () => {
    const exp = Math.floor(Date.now() / 1000) + 5 * 60;
    const ms = msUntilExpiryWarning(fakeJwt(exp), 2 * 60 * 1000);
    expect(ms).not.toBeNull();
    expect(ms!).toBeGreaterThan(2.5 * 60 * 1000);
    expect(ms!).toBeLessThan(3.5 * 60 * 1000);
  });
});
