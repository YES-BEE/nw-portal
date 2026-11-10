import { moduleKeys } from '../access/accessData';
import type { AccessUser, ModuleKey } from '../access/accessData';
import { orderedNavigationItems } from '../../app/navigation';
import { isLoginResponse, login, LoginError } from './loginApi';
import type { LoginErrorCode } from './loginApi';
import type { LoginClientType, LoginResponse, LoginUiError } from './types';
import { clearDemoStorage } from './browserStorage';

export const SESSION_STORAGE_KEY = 'nw-track-session-v2';
const sessionChangeEvent = 'nw-track-session-change';
let currentSession: AuthSession | null = null;
let expiryTimer: ReturnType<typeof setTimeout> | undefined;
let authAttempt = 0;

export interface AuthSession {
  user: AccessUser;
  modules: ModuleKey[];
  authentication?: LoginResponse;
  expiresAt?: number;
}
export type SignInError = LoginErrorCode | LoginUiError;

function notifySessionChange() {
  window.dispatchEvent(new Event(sessionChangeEvent));
}

export async function signIn(
  username: string,
  password: string,
  signal?: AbortSignal,
): Promise<SignInError | null> {
  const attempt = ++authAttempt;
  try {
    const clientType = import.meta.env.VITE_AUTH_CLIENT_TYPE?.trim() || 'PC';
    const authentication = await login(
      {
        username: username.trim(),
        password,
        // The backend validates the configured channel and returns fieldErrors.
        clientType: clientType as LoginClientType,
      },
      signal,
    );
    if (signal?.aborted || attempt !== authAttempt) return null;
    setAuthenticatedSession(
      createSession(
        authentication,
        Date.now() + authentication.expiresIn * 1000,
      ),
    );
    return null;
  } catch (error) {
    if (signal?.aborted || attempt !== authAttempt) return null;
    signOut();
    return error instanceof LoginError
      ? error.failure
      : {
          kind: 'network',
          message: error instanceof Error ? error.message : '',
        };
  }
}

function createSession(
  authentication: LoginResponse,
  expiresAt: number,
): AuthSession {
  return {
    user: {
      // Login provides a canonical username but no user ID.
      id: authentication.username,
      username: authentication.username,
      role: authentication.roles.join(', '),
      status: 'Active',
    },
    modules: [
      ...new Set(authentication.modules.map((module) => module.key)),
    ].filter((key): key is ModuleKey => moduleKeys.includes(key as ModuleKey)),
    authentication,
    expiresAt,
  };
}

// Restore only the backend response and original expiry, never local role mappings.
export function initializeSession() {
  clearDemoStorage();
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return;
    const saved: unknown = JSON.parse(raw);
    if (!saved || typeof saved !== 'object') throw new Error('Invalid session');
    const record = saved as Record<string, unknown>;
    if (
      !isLoginResponse(record.authentication) ||
      typeof record.expiresAt !== 'number' ||
      !Number.isSafeInteger(record.expiresAt) ||
      record.expiresAt <= Date.now()
    ) {
      throw new Error('Invalid or expired session');
    }
    setAuthenticatedSession(
      createSession(record.authentication, record.expiresAt),
    );
  } catch {
    signOut();
  }
}

// Persist the backend token and metadata, without passwords or local access records.
export function setAuthenticatedSession(session: AuthSession | null) {
  if (
    session &&
    (!session.user.id ||
      !session.user.username ||
      session.user.status !== 'Active' ||
      !Array.isArray(session.modules) ||
      !session.modules.every((key) => moduleKeys.includes(key)))
  ) {
    throw new Error('Invalid authenticated session');
  }
  if (session?.authentication && session.expiresAt !== undefined) {
    try {
      sessionStorage.setItem(
        SESSION_STORAGE_KEY,
        JSON.stringify({
          authentication: session.authentication,
          expiresAt: session.expiresAt,
        }),
      );
    } catch {
      throw new LoginError('sessionUnavailable');
    }
  } else {
    try {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {
      // In-memory logout must still complete if browser storage is blocked.
    }
  }
  authAttempt++;
  clearTimeout(expiryTimer);
  currentSession = session ? structuredClone(session) : null;
  if (session?.expiresAt !== undefined) scheduleExpiry();
  notifySessionChange();
}

function scheduleExpiry() {
  if (currentSession?.expiresAt === undefined) return;
  const remaining = currentSession.expiresAt - Date.now();
  if (remaining <= 0) {
    signOut();
    return;
  }
  expiryTimer = setTimeout(scheduleExpiry, Math.min(remaining, 2_147_483_647));
}

export function signOut() {
  setAuthenticatedSession(null);
}

export function readSession(): AuthSession | null {
  if (
    currentSession?.expiresAt !== undefined &&
    currentSession.expiresAt <= Date.now()
  )
    return null;
  return currentSession ? structuredClone(currentSession) : null;
}

export function getModuleForPath(pathname: string): ModuleKey | null {
  if (pathname === '/configurations' || pathname === '/configurations/')
    return 'process';
  for (const { permission, path } of orderedNavigationItems) {
    if (pathname === path || pathname.startsWith(path + '/')) return permission;
  }
  return null;
}

export function getLandingPath(session: AuthSession) {
  return (
    orderedNavigationItems.find((item) =>
      session.modules.includes(item.permission),
    )?.path ?? '/workspace'
  );
}

export function getSessionSnapshot() {
  return JSON.stringify(readSession());
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
