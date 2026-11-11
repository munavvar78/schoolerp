import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { restoreSession } from '../api/client';
import { subscribeSession, type MobileSession } from './session';

type AuthContextValue = {
  ready: boolean;
  session: MobileSession | null;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<MobileSession | null>(null);

  useEffect(() => {
    let cancelled = false;
    restoreSession()
      .then((next) => {
        if (!cancelled) setSession(next);
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => subscribeSession(setSession), []);

  const value = useMemo(() => ({ ready, session }), [ready, session]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within AuthProvider');
  return value;
}
