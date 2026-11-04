import { ACCESS_STORAGE_KEY, loadAccessData } from '../access/accessData';
import type { AccessUser, ModuleKey } from '../access/accessData';

export const SESSION_STORAGE_KEY = 'nw-track-session-v1';
const sessionChangeEvent = 'nw-track-session-change';
let revoked = false;

// Reference credentials are for browser-only demo authentication.
export const demoAccounts = [
  { userId: 'user-1', username: 'nw.admin', password: 'NW@2026demo' },
  { userId: 'user-2', username: 'it.admin', password: 'IT@2026demo' },
  { userId: 'user-3', username: 'top.manager', password: 'Top@2026demo' },
  {
    userId: 'user-4',
    username: 'production.manager',
    password: 'Prod@2026demo',
  },
  { userId: 'user-5', username: 'supervisor', password: 'Super@2026demo' },
  {
    userId: 'user-6',
    username: 'process.manager',
    password: 'Process@2026demo',
  },
  {
    userId: 'user-7',
    username: 'style.configurator',
    password: 'Style@2026demo',
  },
] as const;

export const modulePaths = {
  dashboard: '/dashboard',
  reports: '/reports',
  users: '/users',
  roles: '/roles',
  process: '/configurations/processes',
  storage: '/configurations/storages',
  tags: '/configurations/tags',
  styles: '/styles',
  newstyle: '/new-style',
} as const satisfies Partial<Record<ModuleKey, string>>;

export interface AuthSession {
  user: AccessUser;
  modules: ModuleKey[];
}
export type SignInError =
  'invalidCredentials' | 'recordsUnavailable' | 'sessionUnavailable';

export function notifySessionChange() {
  window.dispatchEvent(new Event(sessionChangeEvent));
}

export function signIn(username: string, password: string): SignInError | null {
  const { records, unavailable } = loadAccessData();
  if (unavailable) return 'recordsUnavailable';
  const user = records.users.find(
    (record) =>
      record.username.toLowerCase() === username.trim().toLowerCase() &&
      record.status === 'Active',
  );
  const account = demoAccounts.find((record) => record.userId === user?.id);
  if (!user || !account || account.password !== password)
    return 'invalidCredentials';
  try {
    sessionStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({ userId: user.id }),
    );
    revoked = false;
    notifySessionChange();
    return null;
  } catch {
    return 'sessionUnavailable';
  }
}

export function signOut() {
  revoked = true;
  try {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    /* In-memory revocation still blocks access. */
  }
  notifySessionChange();
}

export function readSession(): AuthSession | null {
  if (revoked) return null;
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const saved: unknown = JSON.parse(raw);
    if (
      !saved ||
      typeof saved !== 'object' ||
      !('userId' in saved) ||
      typeof saved.userId !== 'string'
    )
      return null;
    const { records, unavailable } = loadAccessData();
    if (unavailable) return null;
    const user = records.users.find(
      (record) => record.id === saved.userId && record.status === 'Active',
    );
    if (!user || !demoAccounts.some((account) => account.userId === user.id))
      return null;
    const role = records.roles.find((record) => record.name === user.role);
    return role ? { user, modules: role.modules } : null;
  } catch {
    return null;
  }
}

export function getModuleForPath(pathname: string): ModuleKey | null {
  if (pathname === '/configurations' || pathname === '/configurations/')
    return 'process';
  for (const [key, path] of Object.entries(modulePaths)) {
    if (pathname === path || pathname.startsWith(path + '/'))
      return key as ModuleKey;
  }
  return null;
}

export function getLandingPath(session: AuthSession) {
  return (
    Object.entries(modulePaths).find(([key]) =>
      session.modules.includes(key as ModuleKey),
    )?.[1] ?? '/workspace'
  );
}

export function getLoginDestination(session: AuthSession, attempted: unknown) {
  if (
    typeof attempted === 'string' &&
    attempted.startsWith('/') &&
    !attempted.startsWith('//')
  ) {
    const module = getModuleForPath(attempted.split(/[?#]/)[0]);
    if (module && session.modules.includes(module)) return attempted;
  }
  return getLandingPath(session);
}

export function getSessionSnapshot() {
  try {
    return JSON.stringify([
      revoked,
      sessionStorage.getItem(SESSION_STORAGE_KEY),
      localStorage.getItem(ACCESS_STORAGE_KEY),
    ]);
  } catch {
    return '';
  }
}

export function subscribeSession(listener: () => void) {
  window.addEventListener(sessionChangeEvent, listener);
  window.addEventListener('storage', listener);
  window.addEventListener('focus', listener);
  return () => {
    window.removeEventListener(sessionChangeEvent, listener);
    window.removeEventListener('storage', listener);
    window.removeEventListener('focus', listener);
  };
}
