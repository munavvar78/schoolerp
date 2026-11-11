import type { ModuleKey, Role } from '@school-erp/shared';
import { deleteItem, getItem, setItem } from './storage';

export type SessionUser = {
  id: string;
  email: string;
  name: string;
};

export type MobileSession = {
  accessToken: string;
  refreshToken: string;
  user: SessionUser;
  campusId: string;
  organizationId: string;
  role: Role;
  enabledModules: ModuleKey[];
};

const ACCESS_KEY = 'erp.access';
const REFRESH_KEY = 'erp.refresh';
const PROFILE_KEY = 'erp.profile';

type Profile = Omit<MobileSession, 'accessToken' | 'refreshToken'>;

let memory: MobileSession | null = null;
const listeners = new Set<(session: MobileSession | null) => void>();

function emit() {
  for (const listener of listeners) listener(memory);
}

export function getMemorySession(): MobileSession | null {
  return memory;
}

export function subscribeSession(listener: (session: MobileSession | null) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function loadSession(): Promise<MobileSession | null> {
  const [accessToken, refreshToken, profileRaw] = await Promise.all([
    getItem(ACCESS_KEY),
    getItem(REFRESH_KEY),
    getItem(PROFILE_KEY),
  ]);
  if (!accessToken || !refreshToken || !profileRaw) {
    memory = null;
    return null;
  }
  try {
    const profile = JSON.parse(profileRaw) as Profile;
    memory = { ...profile, accessToken, refreshToken };
    return memory;
  } catch {
    memory = null;
    return null;
  }
}

export async function persistSession(session: MobileSession): Promise<void> {
  memory = session;
  const profile: Profile = {
    user: session.user,
    campusId: session.campusId,
    organizationId: session.organizationId,
    role: session.role,
    enabledModules: session.enabledModules,
  };
  await Promise.all([
    setItem(ACCESS_KEY, session.accessToken),
    setItem(REFRESH_KEY, session.refreshToken),
    setItem(PROFILE_KEY, JSON.stringify(profile)),
  ]);
  emit();
}

export async function clearSession(): Promise<void> {
  memory = null;
  await Promise.all([
    deleteItem(ACCESS_KEY),
    deleteItem(REFRESH_KEY),
    deleteItem(PROFILE_KEY),
  ]);
  emit();
}
