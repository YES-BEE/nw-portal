import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CanceledError } from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';
import { apiClient } from '../../api/client';
import {
  loginResponse,
  meResponse,
  refreshTokenResponse,
} from '../../test/auth';
import { postChangePassword } from './changePasswordApi';
import {
  changeSessionPassword,
  completePasswordChange,
  getLandingPath,
  initializeSession,
  readSession,
  refreshAccessToken,
  SESSION_STORAGE_KEY,
  setAuthenticatedSession,
  signOut,
} from './session';

const originalAdapter = apiClient.defaults.adapter;
const changedProfile = { ...meResponse, must_change_password: false };
const newRefresh = {
  ...refreshTokenResponse,
  refreshToken: 'new-password-refresh-token',
};
const body = {
  currentPassword: ' initial password ',
  newPassword: ' new password ',
};
const response = (
  config: InternalAxiosRequestConfig,
  data: unknown,
  status = 200,
) => ({ config, data, status, statusText: '', headers: {} });
const normal = async (config: InternalAxiosRequestConfig) =>
  response(
    config,
    config.url === 'auth/change-password'
      ? { changed: true }
      : config.url === 'auth/refresh-tokens'
        ? newRefresh
        : config.url === 'auth/refresh'
          ? loginResponse
          : changedProfile,
  );
const adapter = vi.fn(normal);

beforeEach(() => {
  vi.stubEnv('VITE_API_BASE_URL', 'http://backend.test');
  vi.stubEnv('VITE_API_VERSION', 'v2');
  adapter.mockReset().mockImplementation(normal);
  apiClient.defaults.adapter = adapter;
  setAuthenticatedSession({
    user: {
      id: meResponse.id,
      username: 'admin',
      role: 'NW',
      status: 'Active',
    },
    modules: ['reports'],
    authentication: loginResponse,
    expiresAt: Date.now() + 600_000,
    profile: { ...meResponse, must_change_password: true },
    refreshToken: 'revoked-after-password-change',
    refreshTokenExpiresAt: refreshTokenResponse.expiresAt,
  });
});
afterEach(() => {
  apiClient.defaults.adapter = originalAdapter;
  vi.unstubAllEnvs();
});

describe('password change and session completion', () => {
  it('preserves the completion gate if browser storage fails after the backend has changed the password', async () => {
    const write = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('Storage unavailable');
      });
    await expect(changeSessionPassword(body)).rejects.toBeInstanceOf(Error);
    expect(readSession()?.passwordChangePending).toBe(true);
    expect(readSession()?.refreshToken).toBeUndefined();
    expect(getLandingPath(readSession()!)).toBe('/change-password');
    write.mockRestore();
    await completePasswordChange();
    expect(readSession()?.profile?.must_change_password).toBe(false);
    expect(
      adapter.mock.calls.filter(
        ([config]) => config.url === 'auth/change-password',
      ),
    ).toHaveLength(1);
  });

  it('retains the pending completion phase during access-token renewal', async () => {
    setAuthenticatedSession({
      ...readSession()!,
      profile: { ...meResponse, must_change_password: false },
    });
    adapter.mockImplementation(async (config) =>
      config.url === 'auth/me' ? response(config, {}, 503) : normal(config),
    );
    await changeSessionPassword(body);
    await expect(completePasswordChange()).rejects.toBeInstanceOf(Error);
    await refreshAccessToken();
    expect(readSession()?.passwordChangePending).toBe(true);
    expect(getLandingPath(readSession()!)).toBe('/change-password');
  });
  it('posts exact password characters, replaces the revoked refresh token, and updates /me in session storage', async () => {
    expect(getLandingPath(readSession()!)).toBe('/change-password');
    await changeSessionPassword(body);
    expect(readSession()?.passwordChangePending).toBe(true);
    expect(readSession()?.refreshToken).toBeUndefined();
    await completePasswordChange();
    expect(adapter.mock.calls.map(([config]) => config.url)).toEqual([
      'auth/change-password',
      'auth/refresh-tokens',
      'auth/me',
    ]);
    const config = adapter.mock.calls[0][0];
    expect(apiClient.getUri(config)).toBe(
      'http://backend.test/api/v2/auth/change-password',
    );
    expect(JSON.parse(config.data)).toEqual(body);
    expect(config.headers.get('Authorization')).toBe(
      `Bearer ${loginResponse.accessToken}`,
    );
    expect(readSession()).toMatchObject({
      refreshToken: newRefresh.refreshToken,
      refreshTokenExpiresAt: newRefresh.expiresAt,
      profile: changedProfile,
    });
    expect(readSession()?.passwordChangePending).toBeUndefined();
    expect(getLandingPath(readSession()!)).toBe('/reports');
    const saved = sessionStorage.getItem(SESSION_STORAGE_KEY)!;
    expect(JSON.parse(saved)).toMatchObject({
      refreshToken: newRefresh.refreshToken,
      profile: changedProfile,
    });
    expect(saved).not.toContain(body.currentPassword);
    expect(saved).not.toContain(body.newPassword);
  });

  it('shows an incorrect-current-password 401 without renewing or replaying the mutation', async () => {
    adapter.mockImplementation(async (config) =>
      response(
        config,
        {
          type: 'about:blank',
          title: 'Authentication failed',
          status: 401,
          code: 'AUTHENTICATION_FAILED',
          detail: 'Current password is incorrect',
        },
        401,
      ),
    );
    await expect(changeSessionPassword(body)).rejects.toMatchObject({
      failure: {
        kind: 'credentials',
        message: 'Current password is incorrect',
      },
    });
    expect(adapter).toHaveBeenCalledTimes(1);
    expect(readSession()?.refreshToken).toBe('revoked-after-password-change');
    expect(readSession()?.passwordChangePending).toBeUndefined();
  });

  it('still renews an expired bearer token once when the 401 is not a credential failure', async () => {
    adapter.mockImplementationOnce(async (config) => response(config, '', 401));
    await expect(postChangePassword(body)).resolves.toEqual({ changed: true });
    expect(adapter.mock.calls.map(([config]) => config.url)).toEqual([
      'auth/change-password',
      'auth/refresh',
      'auth/change-password',
    ]);
    expect(JSON.parse(adapter.mock.calls[2][0].data)).toEqual(body);
  });

  it.each([{ changed: false }, { changed: 'true' }, {}, true])(
    'does not advance an unconfirmed password change: %j',
    async (data) => {
      adapter.mockImplementation(async (config) => response(config, data));
      await expect(changeSessionPassword(body)).rejects.toBeInstanceOf(Error);
      expect(adapter).toHaveBeenCalledTimes(1);
      expect(readSession()?.profile?.must_change_password).toBe(true);
      expect(readSession()?.passwordChangePending).toBeUndefined();
    },
  );

  it('extracts safe backend validation messages for both password fields', async () => {
    adapter.mockImplementation(async (config) =>
      response(
        config,
        {
          code: 'VALIDATION_FAILED',
          detail: 'Request validation failed',
          fieldErrors: {
            currentPassword: 'Current is required',
            newPassword: 'New is required',
            unknown: 'ignore',
          },
        },
        400,
      ),
    );
    await expect(changeSessionPassword(body)).rejects.toMatchObject({
      failure: {
        kind: 'validation',
        fieldErrors: {
          currentPassword: 'Current is required',
          newPassword: 'New is required',
        },
      },
    });
    expect(adapter).toHaveBeenCalledTimes(1);
  });

  it('retries refresh-token issuance after failure without posting passwords again', async () => {
    let failed = false;
    adapter.mockImplementation(async (config) => {
      if (config.url === 'auth/refresh-tokens' && !failed) {
        failed = true;
        return response(
          config,
          { detail: 'Session service temporarily unavailable' },
          503,
        );
      }
      return normal(config);
    });
    await changeSessionPassword(body);
    await expect(completePasswordChange()).rejects.toBeInstanceOf(Error);
    expect(readSession()?.passwordChangePending).toBe(true);
    expect(getLandingPath(readSession()!)).toBe('/change-password');
    await completePasswordChange();
    expect(
      adapter.mock.calls.filter(
        ([config]) => config.url === 'auth/change-password',
      ),
    ).toHaveLength(1);
    expect(readSession()?.refreshToken).toBe(newRefresh.refreshToken);
  });

  it('keeps a newly issued refresh token when profile reload fails and retries only /me', async () => {
    let failed = false;
    adapter.mockImplementation(async (config) => {
      if (config.url === 'auth/me' && !failed) {
        failed = true;
        return response(config, { detail: 'Profile unavailable' }, 503);
      }
      return normal(config);
    });
    await changeSessionPassword(body);
    await expect(completePasswordChange()).rejects.toBeInstanceOf(Error);
    expect(readSession()?.refreshToken).toBe(newRefresh.refreshToken);
    expect(readSession()?.passwordChangePending).toBe(true);
    await completePasswordChange();
    expect(
      adapter.mock.calls.filter(
        ([config]) => config.url === 'auth/refresh-tokens',
      ),
    ).toHaveLength(1);
    expect(
      adapter.mock.calls.filter(
        ([config]) => config.url === 'auth/change-password',
      ),
    ).toHaveLength(1);
    expect(
      adapter.mock.calls.filter(([config]) => config.url === 'auth/me'),
    ).toHaveLength(2);
  });

  it('does not unlock the workspace if /me still requires a password change', async () => {
    adapter.mockImplementation(async (config) =>
      config.url === 'auth/me'
        ? response(config, { ...meResponse, must_change_password: true })
        : normal(config),
    );
    await changeSessionPassword(body);
    await expect(completePasswordChange()).rejects.toBeInstanceOf(Error);
    expect(getLandingPath(readSession()!)).toBe('/change-password');
  });

  it('recovers the pending phase on reload without persisting or resending passwords', async () => {
    await changeSessionPassword(body);
    const saved = sessionStorage.getItem(SESSION_STORAGE_KEY)!;
    signOut();
    sessionStorage.setItem(SESSION_STORAGE_KEY, saved);
    await initializeSession();
    expect(readSession()?.profile?.must_change_password).toBe(false);
    expect(readSession()?.refreshToken).toBe(newRefresh.refreshToken);
    expect(
      adapter.mock.calls.filter(
        ([config]) => config.url === 'auth/change-password',
      ),
    ).toHaveLength(1);
  });

  it('ignores a password response received after logout', async () => {
    let resolve!: (value: ReturnType<typeof response>) => void;
    adapter.mockImplementation(
      (config) =>
        new Promise((done) => {
          resolve = (value) => done({ ...value, config });
        }),
    );
    const changing = changeSessionPassword(body);
    const assertion = expect(changing).rejects.toBeInstanceOf(CanceledError);
    await vi.waitFor(() => expect(adapter).toHaveBeenCalledTimes(1));
    signOut();
    resolve(response(adapter.mock.calls[0][0], { changed: true }));
    await assertion;
    expect(readSession()).toBeNull();
  });

  it('ignores a new refresh token received after another login replaced the session', async () => {
    await changeSessionPassword(body);
    let resolve!: (value: ReturnType<typeof response>) => void;
    adapter.mockImplementation(
      (config) =>
        new Promise((done) => {
          resolve = (value) => done({ ...value, config });
        }),
    );
    const completing = completePasswordChange();
    const assertion = expect(completing).rejects.toBeInstanceOf(CanceledError);
    await vi.waitFor(() => expect(adapter).toHaveBeenCalledTimes(2));
    setAuthenticatedSession({
      ...readSession()!,
      passwordChangePending: undefined,
      refreshToken: 'different-login-token',
    });
    resolve(response(adapter.mock.calls[1][0], newRefresh));
    await assertion;
    expect(readSession()?.refreshToken).toBe('different-login-token');
  });
});
