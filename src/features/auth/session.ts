import { moduleKeys } from '../access/accessData';
import type { AccessUser, ModuleKey } from '../access/accessData';
import { orderedNavigationItems } from '../../app/navigation';
import { isLoginResponse, login, LoginError } from './loginApi';
import type { LoginErrorCode } from './loginApi';
import type { LoginClientType, LoginResponse, LoginUiError } from './types';
import { clearDemoStorage } from './browserStorage';
import { apiClient, setAccessTokenProvider } from '../../api/client';
import {
  exchangeRefreshToken,
  isRefreshTokenResponse,
  issueRefreshToken,
} from './refreshTokenApi';
import { CanceledError } from 'axios';
import type { RefreshTokenResponse } from './types';
import type { MeResponse } from './types';
import { getMe, isMeResponse } from './meApi';
import { getStartupStatus, setStartupStatus } from './startupState';

export const SESSION_STORAGE_KEY = 'nw-track-session-v2';
const sessionChangeEvent = 'nw-track-session-change';
let currentSession: AuthSession | null = null;
let expiryTimer: ReturnType<typeof setTimeout> | undefined;
let authAttempt = 0;
let logoutRequest: Promise<void> | null = null;
let startupRequest: Promise<void> | null = null;
let startupRun = 0;
let startupController: AbortController | null = null;
let retrySession: AuthSession | null = null;
let authSessionVersion = 0;
let accessRefresh: { version: number; request: Promise<string | null> } | null =
  null;

setAccessTokenProvider(
  (allowRefresh) => {
    if (!currentSession?.authentication) return null;
    if (
      currentSession.expiresAt !== undefined &&
      currentSession.expiresAt <= Date.now()
    ) {
      return allowRefresh ? refreshAccessToken() : null;
    }
    return currentSession.authentication.accessToken;
  },
  async (authorization, version) => {
    if (version !== authSessionVersion || !currentSession?.authentication)
      return null;
    if (authorization !== `Bearer ${currentSession.authentication.accessToken}`)
      return currentSession.authentication.accessToken;
    return refreshAccessToken();
  },
  () => authSessionVersion,
);

export interface AuthSession {
  user: AccessUser;
  modules: ModuleKey[];
  authentication?: LoginResponse;
  expiresAt?: number;
  refreshToken?: string;
  refreshTokenExpiresAt?: string;
  profile?: MeResponse;
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
  signOut();
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
    const expiresAt = Date.now() + authentication.expiresIn * 1000;
    return await completeStartup(createSession(authentication, expiresAt));
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
  refresh?: RefreshTokenResponse,
  profile?: MeResponse,
): AuthSession {
  return {
    user: {
      id: profile?.id ?? authentication.username,
      username: profile?.username ?? authentication.username,
      role: profile?.role ?? '',
      status: 'Active',
    },
    modules: [
      ...new Set(profile?.modules.map((module) => module.key) ?? []),
    ].filter((key): key is ModuleKey => moduleKeys.includes(key as ModuleKey)),
    authentication,
    profile,
    expiresAt,
    ...(refresh && {
      refreshToken: refresh.refreshToken,
      refreshTokenExpiresAt: refresh.expiresAt,
    }),
  };
}

// Restore only the backend response and original expiry, never local role mappings.
export function initializeSession(): Promise<void> {
  if (startupRequest) return startupRequest;
  const request = restoreSession();
  startupRequest = request;
  void request.then(() => {
    if (startupRequest === request) startupRequest = null;
  });
  return request;
}

async function restoreSession() {
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
      !Number.isSafeInteger(record.expiresAt)
    ) {
      throw new Error('Invalid or expired session');
    }
    const savedRefresh = {
      refreshToken: record.refreshToken,
      expiresAt: record.refreshTokenExpiresAt,
    };
    const session = createSession(
      record.authentication,
      record.expiresAt,
      isRefreshTokenResponse(savedRefresh) ? savedRefresh : undefined,
      isMeResponse(record.profile) && record.profile.enabled
        ? record.profile
        : undefined,
    );
    if (session.expiresAt! <= Date.now() && !hasRefreshToken(session))
      throw new Error('Expired session');
    await completeStartup(session);
  } catch {
    signOut();
  }
}

function cancelStartup() {
  startupRun++;
  startupController?.abort();
  startupController = null;
  retrySession = null;
  setStartupStatus('ready');
}

export async function retryStartup(): Promise<void> {
  if (getStartupStatus() === 'error' && retrySession)
    await completeStartup(retrySession);
}

async function completeStartup(
  session: AuthSession,
): Promise<SignInError | null> {
  startupController?.abort();
  const controller = new AbortController();
  startupController = controller;
  const run = ++startupRun;
  retrySession = session;
  setStartupStatus('loading');
  try {
    if (session.expiresAt! <= Date.now() && !hasRefreshToken(session))
      throw new LoginError('invalidResponse');
    applySession(session, true);
    if (session.expiresAt! <= Date.now()) await refreshAccessToken();
    if (run !== startupRun) return null;
    const [refresh, profile] = await Promise.all([
      issueRefreshToken(controller.signal),
      getMe(controller.signal),
    ]);
    if (run !== startupRun) return null;
    if (!currentSession) throw new CanceledError();
    applySession(
      createSession(
        currentSession.authentication!,
        currentSession.expiresAt!,
        refresh,
        profile,
      ),
      false,
    );
    retrySession = null;
    setStartupStatus('ready');
    return null;
  } catch (error) {
    if (run !== startupRun) return null;
    retrySession = currentSession ?? session;
    controller.abort();
    clearSession();
    setStartupStatus('error');
    return error instanceof LoginError
      ? error.failure
      : {
          kind: 'network',
          message: error instanceof Error ? error.message : '',
        };
  } finally {
    if (startupController === controller) startupController = null;
  }
}

// Persist the backend token and metadata, without passwords or local access records.
export function setAuthenticatedSession(session: AuthSession | null) {
  cancelStartup();
  applySession(session, true);
}

function applySession(session: AuthSession | null, replaceIdentity: boolean) {
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
          refreshToken: session.refreshToken,
          refreshTokenExpiresAt: session.refreshTokenExpiresAt,
          profile: session.profile,
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
  if (replaceIdentity) authSessionVersion++;
  clearTimeout(expiryTimer);
  currentSession = session ? structuredClone(session) : null;
  if (session?.expiresAt !== undefined) scheduleExpiry();
  notifySessionChange();
}

function scheduleExpiry() {
  if (currentSession?.expiresAt === undefined) return;
  const remaining = currentSession.expiresAt - Date.now();
  if (remaining <= 0) {
    if (!hasRefreshToken(currentSession)) clearSession();
    else
      void refreshAccessToken().catch(() => {
        /* Renewal clears the failed session. */
      });
    return;
  }
  expiryTimer = setTimeout(scheduleExpiry, Math.min(remaining, 2_147_483_647));
}

export function signOut() {
  setAuthenticatedSession(null);
}

function clearSession() {
  applySession(null, true);
}

// Explicit user logout calls the server; expiry and failed-login cleanup stay local.
export function logout(): Promise<void> {
  if (logoutRequest) return logoutRequest;
  cancelStartup();
  const attempt = ++authAttempt;
  authSessionVersion++;
  clearTimeout(expiryTimer);
  const refreshToken = currentSession?.refreshToken ?? null;
  logoutRequest = apiClient
    .post('auth/logout', { refreshToken }, { timeout: 10_000 })
    .then(() => undefined)
    .finally(() => {
      logoutRequest = null;
      if (attempt === authAttempt) signOut();
    });
  return logoutRequest;
}

export function readSession(): AuthSession | null {
  if (
    currentSession?.expiresAt !== undefined &&
    currentSession.expiresAt <= Date.now() &&
    !hasRefreshToken(currentSession)
  )
    return null;
  return currentSession ? structuredClone(currentSession) : null;
}

function hasRefreshToken(session: AuthSession | null): boolean {
  return (
    !!session?.refreshToken?.trim() &&
    typeof session.refreshTokenExpiresAt === 'string' &&
    Date.parse(session.refreshTokenExpiresAt) > Date.now()
  );
}

export function refreshAccessToken(): Promise<string | null> {
  const version = authSessionVersion;
  if (accessRefresh?.version === version) return accessRefresh.request;
  const session = currentSession;
  if (!session?.authentication || !hasRefreshToken(session)) {
    clearSession();
    return Promise.reject(new CanceledError());
  }
  const request = exchangeRefreshToken({ refreshToken: session.refreshToken! })
    .then((authentication) => {
      if (version !== authSessionVersion || !currentSession)
        throw new CanceledError();
      applySession(
        createSession(
          authentication,
          Date.now() + authentication.expiresIn * 1000,
          {
            refreshToken: session.refreshToken!,
            expiresAt: session.refreshTokenExpiresAt!,
          },
          currentSession.profile,
        ),
        false,
      );
      return authentication.accessToken;
    })
    .catch((error: unknown) => {
      if (version === authSessionVersion) clearSession();
      throw error;
    })
    .finally(() => {
      if (accessRefresh?.request === request) accessRefresh = null;
    });
  accessRefresh = { version, request };
  return request;
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
