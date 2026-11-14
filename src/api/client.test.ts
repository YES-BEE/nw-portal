import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { InternalAxiosRequestConfig } from 'axios';
import { apiClient } from './client';
import { loginResponse, refreshTokenResponse } from '../test/auth';
import {
  logout,
  readSession,
  SESSION_STORAGE_KEY,
  setAuthenticatedSession,
  signOut,
} from '../features/auth/session';

const originalAdapter = apiClient.defaults.adapter;
const response = (config: InternalAxiosRequestConfig) => ({
  status: 204,
  statusText: 'No Content',
  data: null,
  headers: {},
  config,
});
const adapter = vi.fn(async (config: InternalAxiosRequestConfig) =>
  response(config),
);
function authenticate(token = 'test-access-token') {
  setAuthenticatedSession({
    user: { id: 'admin', username: 'admin', role: 'NW', status: 'Active' },
    modules: ['reports'],
    authentication: { ...loginResponse, accessToken: token },
    expiresAt: Date.now() + 900_000,
    refreshToken: refreshTokenResponse.refreshToken,
    refreshTokenExpiresAt: refreshTokenResponse.expiresAt,
  });
}

beforeEach(() => {
  vi.stubEnv('VITE_API_BASE_URL', 'http://backend.test/');
  vi.stubEnv('VITE_API_VERSION', 'v2');
  adapter.mockReset().mockImplementation(async (config) => response(config));
  apiClient.defaults.adapter = adapter;
  sessionStorage.clear();
  signOut();
});
afterEach(() => {
  apiClient.defaults.adapter = originalAdapter;
  delete apiClient.defaults.headers.common.Authorization;
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe('common API bearer interceptor', () => {
  it('uses the configured base URL and API version for backend endpoints', async () => {
    authenticate();
    await apiClient.get('/users');
    const config = adapter.mock.calls[0][0];
    expect(apiClient.getUri(config)).toBe('http://backend.test/api/v2/users');
    expect(config.headers.get('Authorization')).toBe(
      'Bearer test-access-token',
    );
    expect(config.headers.get('Accept')).toBe(
      'application/json, application/problem+json',
    );
  });
  it('reads the current token for each request instead of keeping an old default', async () => {
    authenticate('first-token');
    await apiClient.get('users');
    authenticate('second-token');
    await apiClient.get('roles');
    signOut();
    await apiClient.get('tags');
    expect(
      adapter.mock.calls.map(([config]) => config.headers.get('Authorization')),
    ).toEqual(['Bearer first-token', 'Bearer second-token', null]);
  });
  it.each([
    'auth/login',
    '/auth/login',
    'auth/refresh',
    'http://backend.test/api/v2/auth/login?channel=PC',
  ])(
    'does not attach a stale Bearer token to login or refresh: %s',
    async (url) => {
      authenticate();
      apiClient.defaults.headers.common.Authorization = 'Bearer stale-token';
      await apiClient.post(url, {
        username: 'admin',
        password: 'password',
        clientType: 'PC',
      });
      expect(adapter.mock.calls[0][0].headers.get('Authorization')).toBeNull();
    },
  );
  it.each([
    'http://other.test/api/v2/users',
    'http://backend.test/api/v20/users',
  ])('does not send backend credentials outside its API: %s', async (url) => {
    authenticate();
    await apiClient.get(url);
    expect(adapter.mock.calls[0][0].headers.get('Authorization')).toBeNull();
  });
  it('does not attach credentials when both tokens have expired', async () => {
    vi.useFakeTimers();
    authenticate();
    setAuthenticatedSession({
      ...readSession()!,
      refreshTokenExpiresAt: '2000-01-01T00:00:00Z',
    });
    vi.advanceTimersByTime(900_000);
    await apiClient.get('users');
    expect(adapter.mock.calls[0][0].headers.get('Authorization')).toBeNull();
  });
  it('uses the current origin when no API base URL is configured', async () => {
    authenticate();
    vi.stubEnv('VITE_API_BASE_URL', '');
    await apiClient.get('users');
    const config = adapter.mock.calls[0][0];
    expect(apiClient.getUri(config)).toBe('http://localhost:3000/api/v2/users');
    expect(config.headers.get('Authorization')).toBe(
      'Bearer test-access-token',
    );
  });
  it('rejects an invalid configured API URL before sending credentials', async () => {
    authenticate();
    vi.stubEnv('VITE_API_BASE_URL', 'not a URL');
    await expect(apiClient.get('users')).rejects.toThrow();
    expect(adapter).not.toHaveBeenCalled();
  });
});

describe('server logout', () => {
  it('posts logout with the Bearer token, then clears browser storage and session state', async () => {
    authenticate();
    await logout();
    const config = adapter.mock.calls[0][0];
    expect(config.method).toBe('post');
    expect(apiClient.getUri(config)).toBe(
      'http://backend.test/api/v2/auth/logout',
    );
    expect(config.headers.get('Authorization')).toBe(
      'Bearer test-access-token',
    );
    expect(config.timeout).toBe(10_000);
    expect(JSON.parse(config.data)).toEqual({
      refreshToken: refreshTokenResponse.refreshToken,
    });
    expect(readSession()).toBeNull();
    expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });
  it('clears local credentials even when server logout fails', async () => {
    authenticate();
    adapter.mockRejectedValue(new Error('Network error'));
    await expect(logout()).rejects.toThrow('Network error');
    expect(readSession()).toBeNull();
    expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });
  it('deduplicates pending logout and preserves a newer login session', async () => {
    authenticate();
    let resolve!: (value: ReturnType<typeof response>) => void;
    adapter.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const first = logout();
    expect(logout()).toBe(first);
    await vi.waitFor(() => expect(adapter).toHaveBeenCalledTimes(1));
    authenticate('new-token');
    resolve(response(adapter.mock.calls[0][0]));
    await first;
    expect(readSession()?.authentication?.accessToken).toBe('new-token');
  });
  it('does not call logout for local session cleanup', () => {
    authenticate();
    signOut();
    expect(adapter).not.toHaveBeenCalled();
  });
});
