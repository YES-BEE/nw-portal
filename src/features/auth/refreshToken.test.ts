import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { InternalAxiosRequestConfig } from 'axios';
import { apiClient } from '../../api/client';
import {
  loginResponse,
  refreshTokenResponse,
  meResponse,
} from '../../test/auth';
import {
  initializeSession,
  readSession,
  SESSION_STORAGE_KEY,
  setAuthenticatedSession,
  signIn,
  signOut,
} from './session';

const originalAdapter = apiClient.defaults.adapter;
const response = (
  config: InternalAxiosRequestConfig,
  data: unknown,
  status = 200,
) => ({ config, status, statusText: '', headers: {}, data });
const adapter = vi.fn(async (config: InternalAxiosRequestConfig) =>
  response(
    config,
    config.url === 'auth/me'
      ? meResponse
      : config.url === 'auth/login'
        ? loginResponse
        : refreshTokenResponse,
  ),
);
function saveSession() {
  const expiresAt = Date.now() + 600_000;
  sessionStorage.setItem(
    SESSION_STORAGE_KEY,
    JSON.stringify({
      authentication: loginResponse,
      expiresAt,
      refreshToken: 'old-refresh-token',
      refreshTokenExpiresAt: refreshTokenResponse.expiresAt,
    }),
  );
  return expiresAt;
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  signOut();
  vi.stubEnv('VITE_API_BASE_URL', 'http://backend.test');
  vi.stubEnv('VITE_API_VERSION', 'v3');
  adapter
    .mockReset()
    .mockImplementation(async (config) =>
      response(
        config,
        config.url === 'auth/me'
          ? meResponse
          : config.url === 'auth/login'
            ? loginResponse
            : refreshTokenResponse,
      ),
    );
  apiClient.defaults.adapter = adapter;
});
afterEach(() => {
  apiClient.defaults.adapter = originalAdapter;
  vi.unstubAllEnvs();
});

describe('refresh token issuance and storage', () => {
  it('issues a refresh token after login with the newly returned Bearer token and stores its exact expiry', async () => {
    expect(await signIn('admin', 'password')).toBeNull();
    expect(adapter.mock.calls.map(([config]) => config.url)).toEqual([
      'auth/login',
      'auth/refresh-tokens',
      'auth/me',
    ]);
    expect(adapter.mock.calls[0][0].headers.get('Authorization')).toBeNull();
    const config = adapter.mock.calls[1][0];
    expect(config.method).toBe('post');
    expect(apiClient.getUri(config)).toBe(
      'http://backend.test/api/v3/auth/refresh-tokens',
    );
    expect(config.headers.get('Authorization')).toBe(
      'Bearer test-access-token',
    );
    expect(config.data).toBeUndefined();
    const saved = JSON.parse(sessionStorage.getItem(SESSION_STORAGE_KEY)!);
    expect(saved.refreshToken).toBe(refreshTokenResponse.refreshToken);
    expect(saved.refreshTokenExpiresAt).toBe(refreshTokenResponse.expiresAt);
    expect(readSession()?.refreshToken).toBe(refreshTokenResponse.refreshToken);
    signOut();
    expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });
  it('calls the endpoint once on authenticated startup and preserves the access-token expiry', async () => {
    const expiresAt = saveSession();
    const first = initializeSession();
    expect(initializeSession()).toBe(first);
    await first;
    expect(adapter).toHaveBeenCalledTimes(2);
    expect(adapter.mock.calls[0][0].url).toBe('auth/refresh-tokens');
    expect(adapter.mock.calls[0][0].headers.get('Authorization')).toBe(
      'Bearer test-access-token',
    );
    expect(readSession()).toMatchObject({
      expiresAt,
      refreshToken: refreshTokenResponse.refreshToken,
      refreshTokenExpiresAt: refreshTokenResponse.expiresAt,
    });
    expect(
      JSON.parse(sessionStorage.getItem(SESSION_STORAGE_KEY)!).refreshToken,
    ).toBe(refreshTokenResponse.refreshToken);
  });
  it('does not request a refresh token on anonymous startup', async () => {
    await initializeSession();
    expect(adapter).not.toHaveBeenCalled();
  });
  it.each([
    {},
    { refreshToken: '', expiresAt: refreshTokenResponse.expiresAt },
    { refreshToken: 'token', expiresAt: 'not-a-date' },
    { refreshToken: 'token', expiresAt: '2000-01-01T00:00:00Z' },
  ])('does not store an invalid refresh-token response: %j', async (data) => {
    adapter.mockImplementation(async (config) =>
      response(config, config.url === 'auth/login' ? loginResponse : data),
    );
    expect(await signIn('admin', 'password')).toBe('invalidResponse');
    expect(readSession()).toBeNull();
    expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
    await apiClient.get('users');
    expect(
      adapter.mock.calls
        .find(([config]) => config.url === 'users')![0]
        .headers.get('Authorization'),
    ).toBeNull();
  });
  it('returns a backend refresh-token failure without storing a partial session', async () => {
    adapter.mockImplementation(async (config) =>
      config.url === 'auth/me'
        ? response(config, meResponse)
        : config.url === 'auth/login'
          ? response(config, loginResponse)
          : response(config, { detail: 'Refresh token denied' }, 403),
    );
    expect(await signIn('admin', 'password')).toMatchObject({
      message: 'Refresh token denied',
      status: 403,
    });
    expect(readSession()).toBeNull();
    expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });
  it('does not restore a session when logout happens while refresh-token issuance is pending', async () => {
    let resolve!: (value: ReturnType<typeof response>) => void;
    adapter.mockImplementation(async (config) =>
      config.url === 'auth/me'
        ? response(config, meResponse)
        : config.url === 'auth/login'
          ? response(config, loginResponse)
          : new Promise((done) => {
              resolve = done;
            }),
    );
    const pending = signIn('admin', 'password');
    await vi.waitFor(() => expect(adapter).toHaveBeenCalledTimes(3));
    signOut();
    resolve(response(adapter.mock.calls[1][0], refreshTokenResponse));
    await pending;
    expect(readSession()).toBeNull();
    expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });
  it('does not overwrite a newer session with a pending startup response', async () => {
    saveSession();
    let resolve!: (value: ReturnType<typeof response>) => void;
    adapter.mockImplementation((config) =>
      config.url === 'auth/me'
        ? Promise.resolve(response(config, meResponse))
        : new Promise((done) => {
            resolve = done;
          }),
    );
    const pending = initializeSession();
    await vi.waitFor(() => expect(adapter).toHaveBeenCalledTimes(2));
    setAuthenticatedSession({
      ...readSession()!,
      authentication: { ...loginResponse, accessToken: 'new-access-token' },
      refreshToken: 'new-refresh-token',
    });
    resolve(response(adapter.mock.calls[0][0], refreshTokenResponse));
    await pending;
    expect(readSession()?.refreshToken).toBe('new-refresh-token');
  });
  it('clears saved tokens if startup issuance fails', async () => {
    saveSession();
    adapter.mockRejectedValue(new Error('Network error'));
    await initializeSession();
    expect(readSession()).toBeNull();
    expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });
});
