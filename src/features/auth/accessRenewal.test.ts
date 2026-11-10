import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError, isCancel } from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';
import { apiClient } from '../../api/client';
import { loginResponse, refreshTokenResponse } from '../../test/auth';
import {
  initializeSession,
  logout,
  readSession,
  refreshAccessToken,
  SESSION_STORAGE_KEY,
  setAuthenticatedSession,
  signOut,
} from './session';

const renewed = {
  ...loginResponse,
  accessToken: 'renewed-access-token',
  roles: ['Updated role'],
  modules: [{ key: 'users', name: 'Updated Users', built_in: true }],
};
const originalAdapter = apiClient.defaults.adapter;
const response = (
  config: InternalAxiosRequestConfig,
  data: unknown,
  status = 200,
) => ({ config, data, status, statusText: '', headers: {} });
const adapter = vi.fn(async (config: InternalAxiosRequestConfig) =>
  response(
    config,
    config.url === 'auth/refresh'
      ? renewed
      : config.url === 'auth/refresh-tokens'
        ? refreshTokenResponse
        : [],
  ),
);
function authenticate(expiresAt = Date.now() + 20_000) {
  setAuthenticatedSession({
    user: { id: 'admin', username: 'admin', role: 'NW', status: 'Active' },
    modules: ['reports'],
    authentication: loginResponse,
    expiresAt,
    refreshToken: refreshTokenResponse.refreshToken,
    refreshTokenExpiresAt: refreshTokenResponse.expiresAt,
  });
}
function unauthorized(config: InternalAxiosRequestConfig): never {
  throw new AxiosError(
    'Unauthorized',
    AxiosError.ERR_BAD_REQUEST,
    config,
    undefined,
    response(config, { detail: 'Expired access token' }, 401),
  );
}

beforeEach(() => {
  vi.stubEnv('VITE_API_BASE_URL', 'http://backend.test');
  vi.stubEnv('VITE_API_VERSION', 'v1');
  localStorage.clear();
  sessionStorage.clear();
  signOut();
  adapter
    .mockReset()
    .mockImplementation(async (config) =>
      response(
        config,
        config.url === 'auth/refresh'
          ? renewed
          : config.url === 'auth/refresh-tokens'
            ? refreshTokenResponse
            : [],
      ),
    );
  apiClient.defaults.adapter = adapter;
});
afterEach(() => {
  apiClient.defaults.adapter = originalAdapter;
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe('expired access-token renewal', () => {
  it('renews at expiry with the stored refresh token and updates identity, permissions and browser storage', async () => {
    vi.useFakeTimers();
    authenticate();
    await vi.advanceTimersByTimeAsync(20_000);
    expect(adapter).toHaveBeenCalledTimes(1);
    const config = adapter.mock.calls[0][0];
    expect(apiClient.getUri(config)).toBe(
      'http://backend.test/api/v1/auth/refresh',
    );
    expect(config.method).toBe('post');
    expect(JSON.parse(config.data)).toEqual({
      refreshToken: refreshTokenResponse.refreshToken,
    });
    expect(config.headers.get('Authorization')).toBeNull();
    expect(readSession()).toMatchObject({
      authentication: renewed,
      modules: ['users'],
      user: { role: 'Updated role' },
      expiresAt: Date.now() + 900_000,
      refreshToken: refreshTokenResponse.refreshToken,
      refreshTokenExpiresAt: refreshTokenResponse.expiresAt,
    });
    expect(
      JSON.parse(sessionStorage.getItem(SESSION_STORAGE_KEY)!).authentication,
    ).toEqual(renewed);
  });
  it('waits for one renewal before sending concurrent requests after a suspended timer', async () => {
    vi.useFakeTimers();
    authenticate();
    vi.setSystemTime(Date.now() + 20_001);
    await Promise.all([
      apiClient.get('users'),
      apiClient.get('roles'),
      apiClient.get('tags'),
    ]);
    expect(
      adapter.mock.calls.filter(([config]) => config.url === 'auth/refresh'),
    ).toHaveLength(1);
    for (const [config] of adapter.mock.calls.filter(
      ([config]) => config.url !== 'auth/refresh',
    )) {
      expect(config.headers.get('Authorization')).toBe(
        'Bearer renewed-access-token',
      );
    }
  });
  it('renews an expired access token during startup instead of discarding a valid refresh token', async () => {
    sessionStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({
        authentication: loginResponse,
        expiresAt: Date.now() - 1000,
        refreshToken: refreshTokenResponse.refreshToken,
        refreshTokenExpiresAt: refreshTokenResponse.expiresAt,
      }),
    );
    await initializeSession();
    expect(adapter.mock.calls.map(([config]) => config.url)).toEqual([
      'auth/refresh',
      'auth/refresh-tokens',
    ]);
    expect(adapter.mock.calls[1][0].headers.get('Authorization')).toBe(
      'Bearer renewed-access-token',
    );
    expect(readSession()?.authentication).toEqual(renewed);
  });
  it('logs out without calling refresh when the refresh token is expired', async () => {
    vi.useFakeTimers();
    authenticate();
    setAuthenticatedSession({
      ...readSession()!,
      refreshTokenExpiresAt: '2000-01-01T00:00:00Z',
    });
    await vi.advanceTimersByTimeAsync(20_000);
    expect(adapter).not.toHaveBeenCalled();
    expect(readSession()).toBeNull();
    expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });
  it.each([401, 403, 500])(
    'clears the session on refresh HTTP %s without sending the waiting protected request',
    async (status) => {
      vi.useFakeTimers();
      authenticate();
      vi.setSystemTime(Date.now() + 20_001);
      adapter.mockImplementation(async (config) =>
        response(config, { detail: 'Backend refresh failure' }, status),
      );
      await expect(apiClient.get('users')).rejects.toMatchObject({
        failure: { message: 'Backend refresh failure', status },
      });
      expect(adapter).toHaveBeenCalledTimes(1);
      expect(adapter.mock.calls[0][0].url).toBe('auth/refresh');
      expect(readSession()).toBeNull();
      expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
    },
  );
  it('rejects malformed refresh success responses and clears stored credentials', async () => {
    authenticate();
    adapter.mockImplementation(async (config) =>
      response(config, { accessToken: 'incomplete' }),
    );
    await expect(refreshAccessToken()).rejects.toMatchObject({
      failure: 'invalidResponse',
    });
    expect(readSession()).toBeNull();
    expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });
  it('does not recreate a logged-out session from a late renewal response', async () => {
    authenticate();
    let resolve!: (value: ReturnType<typeof response>) => void;
    adapter.mockImplementation((config) =>
      config.url === 'auth/refresh'
        ? new Promise((done) => {
            resolve = done;
          })
        : Promise.resolve(response(config, null)),
    );
    const pending = refreshAccessToken();
    const caught = pending.catch((error: unknown) => error);
    await vi.waitFor(() => expect(adapter).toHaveBeenCalledTimes(1));
    await logout();
    resolve(response(adapter.mock.calls[0][0], renewed));
    expect(isCancel(await caught)).toBe(true);
    expect(readSession()).toBeNull();
    expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });
  it('does not overwrite a newer login or replay an old request as another user', async () => {
    authenticate();
    let resolve!: (value: ReturnType<typeof response>) => void;
    adapter.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const pending = refreshAccessToken();
    const caught = pending.catch((error: unknown) => error);
    await vi.waitFor(() => expect(adapter).toHaveBeenCalledTimes(1));
    setAuthenticatedSession({
      ...readSession()!,
      user: { ...readSession()!.user, id: 'other', username: 'other' },
      authentication: {
        ...loginResponse,
        username: 'other',
        accessToken: 'other-token',
      },
    });
    resolve(response(adapter.mock.calls[0][0], renewed));
    expect(isCancel(await caught)).toBe(true);
    expect(readSession()?.authentication?.accessToken).toBe('other-token');
  });
});

describe('401 response retries', () => {
  it('renews once for concurrent 401s and retries with the updated Bearer token', async () => {
    authenticate();
    adapter.mockImplementation(async (config) => {
      if (config.url === 'auth/refresh') return response(config, renewed);
      if (config.headers.get('Authorization') === 'Bearer test-access-token')
        return unauthorized(config);
      return response(config, []);
    });
    await Promise.all([apiClient.get('users'), apiClient.get('roles')]);
    expect(
      adapter.mock.calls.filter(([config]) => config.url === 'auth/refresh'),
    ).toHaveLength(1);
    expect(
      adapter.mock.calls.filter(([config]) => config.url === 'users'),
    ).toHaveLength(2);
    expect(
      adapter.mock.calls.filter(([config]) => config.url === 'roles'),
    ).toHaveLength(2);
  });
  it('also retries a 401 when a caller accepts all HTTP status codes', async () => {
    authenticate();
    adapter.mockImplementation(async (config) =>
      config.url === 'auth/refresh'
        ? response(config, renewed)
        : response(
            config,
            [],
            config.headers.get('Authorization') === 'Bearer test-access-token'
              ? 401
              : 200,
          ),
    );
    const result = await apiClient.get('users', { validateStatus: () => true });
    expect(result.status).toBe(200);
    expect(adapter).toHaveBeenCalledTimes(3);
  });
  it('does not retry a failed protected request more than once', async () => {
    authenticate();
    adapter.mockImplementation(async (config) =>
      config.url === 'auth/refresh'
        ? response(config, renewed)
        : unauthorized(config),
    );
    await expect(apiClient.get('users')).rejects.toMatchObject({
      response: { status: 401 },
    });
    expect(adapter).toHaveBeenCalledTimes(3);
  });
  it('does not replay an old 401 request under a newer login', async () => {
    authenticate();
    let reject!: (reason: unknown) => void;
    adapter.mockImplementation(
      () =>
        new Promise((_resolve, fail) => {
          reject = fail;
        }),
    );
    const pending = apiClient.get('users');
    const caught = pending.catch((error: unknown) => error);
    await vi.waitFor(() => expect(adapter).toHaveBeenCalledTimes(1));
    setAuthenticatedSession({
      ...readSession()!,
      user: { ...readSession()!.user, username: 'other' },
      authentication: {
        ...loginResponse,
        username: 'other',
        accessToken: 'other-token',
      },
    });
    const config = adapter.mock.calls[0][0];
    reject(
      new AxiosError(
        'Unauthorized',
        AxiosError.ERR_BAD_REQUEST,
        config,
        undefined,
        response(config, {}, 401),
      ),
    );
    expect(await caught).toMatchObject({ response: { status: 401 } });
    expect(adapter).toHaveBeenCalledTimes(1);
    expect(readSession()?.authentication?.accessToken).toBe('other-token');
  });

  it.each(['auth/login', 'auth/refresh', 'auth/logout'])(
    'never recursively renews or retries %s',
    async (url) => {
      authenticate();
      adapter.mockImplementation(async (config) => unauthorized(config));
      await expect(
        apiClient.post(url, {
          refreshToken: refreshTokenResponse.refreshToken,
        }),
      ).rejects.toMatchObject({ response: { status: 401 } });
      expect(adapter).toHaveBeenCalledTimes(1);
    },
  );
});
