import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError, CanceledError } from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';
import { apiClient } from '../../api/client';
import { loginResponse, refreshTokenResponse } from '../../test/auth';
import { setAuthenticatedSession } from '../auth/session';
import { getAccessRoles, saveAccessRole } from './accessRolesApi';

const originalAdapter = apiClient.defaults.adapter;
const response = (
  config: InternalAxiosRequestConfig,
  status = 200,
  data: unknown = [],
) => ({
  config,
  status,
  data,
  statusText: '',
  headers: {},
});
const adapter = vi.fn(async (config: InternalAxiosRequestConfig) =>
  response(config),
);

beforeEach(() => {
  vi.stubEnv('VITE_API_BASE_URL', 'http://backend.test');
  vi.stubEnv('VITE_API_VERSION', 'v1');
  adapter.mockReset().mockImplementation(async (config) => response(config));
  apiClient.defaults.adapter = adapter;
  setAuthenticatedSession({
    user: { id: 'admin', username: 'admin', role: 'NW', status: 'Active' },
    modules: ['roles'],
    authentication: loginResponse,
    refreshToken: refreshTokenResponse.refreshToken,
    refreshTokenExpiresAt: refreshTokenResponse.expiresAt,
  });
});

afterEach(() => {
  apiClient.defaults.adapter = originalAdapter;
  vi.unstubAllEnvs();
});

describe('access roles API transport', () => {
  it.each([200, 201, 204])(
    'saves only the documented PUT body and accepts HTTP %s',
    async (status) => {
      adapter.mockImplementation(async (config) =>
        response(config, status, status === 204 ? null : { code: 'CUSTOM' }),
      );
      const body = {
        modules: ['dashboard', 'reports'],
        pcAccess: true,
        padAccess: false,
      };
      await expect(saveAccessRole('CUSTOM/OPS', body)).resolves.toBeUndefined();
      const config = adapter.mock.calls[0][0];
      expect(apiClient.getUri(config)).toBe(
        'http://backend.test/api/v1/access-roles/CUSTOM%2FOPS',
      );
      expect(config.method).toBe('put');
      expect(JSON.parse(config.data)).toEqual(body);
      expect(config.headers.get('Authorization')).toBe(
        `Bearer ${loginResponse.accessToken}`,
      );
    },
  );

  it('preserves PUT backend failure reasons without automatically retrying', async () => {
    adapter.mockImplementation(async (config) =>
      response(config, 409, { detail: 'Role cannot be updated' }),
    );
    await expect(
      saveAccessRole('NW', { modules: [], pcAccess: true, padAccess: true }),
    ).rejects.toMatchObject({
      failure: { status: 409, message: 'Role cannot be updated' },
    });
    expect(adapter).toHaveBeenCalledTimes(1);
  });

  it('renews an expired token before repeating the same PUT body once', async () => {
    adapter
      .mockImplementationOnce(async (config) => response(config, 401))
      .mockImplementationOnce(async (config) =>
        response(config, 200, {
          ...loginResponse,
          accessToken: 'renewed-token',
        }),
      );
    const body = { modules: [], pcAccess: false, padAccess: true };
    await saveAccessRole('NW', body);
    expect(adapter.mock.calls.map(([config]) => config.url)).toEqual([
      'access-roles/NW',
      'auth/refresh',
      'access-roles/NW',
    ]);
    expect(JSON.parse(adapter.mock.calls[2][0].data)).toEqual(body);
    expect(adapter.mock.calls[2][0].headers.get('Authorization')).toBe(
      'Bearer renewed-token',
    );
  });
  it('uses the configured endpoint, bearer token and supported Accept types with no body', async () => {
    expect(await getAccessRoles()).toEqual([]);
    const config = adapter.mock.calls[0][0];
    expect(apiClient.getUri(config)).toBe(
      'http://backend.test/api/v1/access-roles',
    );
    expect(config.method).toBe('get');
    expect(config.data).toBeUndefined();
    expect(config.headers.get('Authorization')).toBe(
      `Bearer ${loginResponse.accessToken}`,
    );
    expect(config.headers.get('Accept')).toBe(
      'application/json, application/problem+json',
    );
  });

  it('refreshes once and repeats an unauthorized request successfully', async () => {
    adapter
      .mockImplementationOnce(async (config) => response(config, 401))
      .mockImplementationOnce(async (config) =>
        response(config, 200, {
          ...loginResponse,
          accessToken: 'renewed-token',
        }),
      );
    expect(await getAccessRoles()).toEqual([]);
    expect(adapter.mock.calls.map(([config]) => config.url)).toEqual([
      'access-roles',
      'auth/refresh',
      'access-roles',
    ]);
    expect(JSON.parse(adapter.mock.calls[1][0].data)).toEqual({
      refreshToken: refreshTokenResponse.refreshToken,
    });
    expect(adapter.mock.calls[2][0].headers.get('Authorization')).toBe(
      'Bearer renewed-token',
    );
  });

  it('requests sign-in after a repeated 401 without another refresh loop', async () => {
    adapter.mockImplementation(async (config) =>
      config.url === 'auth/refresh'
        ? response(config, 200, loginResponse)
        : response(config, 401, ''),
    );
    await expect(getAccessRoles()).rejects.toMatchObject({
      failure: { kind: 'authentication', action: 'signIn', status: 401 },
    });
    expect(adapter.mock.calls.map(([config]) => config.url)).toEqual([
      'access-roles',
      'auth/refresh',
      'access-roles',
    ]);
  });

  it('normalizes rejected Axios HTTP responses using their actual status', async () => {
    adapter.mockImplementation(async (config) => {
      throw new AxiosError(
        'Request failed',
        'ERR_BAD_RESPONSE',
        config,
        undefined,
        response(config, 403, { detail: 'Missing permission: ROLES' }),
      );
    });
    await expect(getAccessRoles()).rejects.toMatchObject({
      failure: {
        kind: 'access',
        message: 'Missing permission: ROLES',
        status: 403,
      },
    });
  });

  it.each(['ERR_NETWORK', 'ECONNABORTED'])(
    'handles connectivity/timeout errors without a response: %s',
    async (code) => {
      adapter.mockImplementation(async (config) => {
        throw new AxiosError('Transport diagnostic', code, config);
      });
      await expect(getAccessRoles()).rejects.toMatchObject({
        failure: { kind: 'network', action: 'retry' },
      });
      expect(adapter).toHaveBeenCalledTimes(1);
    },
  );

  it('does not automatically retry an unavailable service', async () => {
    adapter.mockImplementation(async (config) =>
      response(config, 503, '<html>Unavailable</html>'),
    );
    await expect(getAccessRoles()).rejects.toMatchObject({
      failure: { kind: 'service', action: 'retry', status: 503 },
    });
    expect(adapter).toHaveBeenCalledTimes(1);
  });

  it('preserves cancellation when leaving the page', async () => {
    const error = new CanceledError();
    adapter.mockRejectedValue(error);
    await expect(getAccessRoles()).rejects.toBe(error);
  });
});
