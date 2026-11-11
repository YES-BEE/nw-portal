import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError, CanceledError } from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';
import { apiClient } from '../../api/client';
import { loginResponse, refreshTokenResponse } from '../../test/auth';
import { userResponse, usersResponse } from '../../test/users';
import { readSession, setAuthenticatedSession } from '../auth/session';
import { createUser, deleteUser, getUser, getUsers } from './usersApi';

const originalAdapter = apiClient.defaults.adapter;
const response = (
  config: InternalAxiosRequestConfig,
  status = 200,
  data: unknown = usersResponse,
) => ({ config, status, data, statusText: '', headers: {} });
const adapter = vi.fn(async (config: InternalAxiosRequestConfig) =>
  response(config),
);

beforeEach(() => {
  vi.stubEnv('VITE_API_BASE_URL', 'http://backend.test');
  vi.stubEnv('VITE_API_VERSION', 'v2');
  adapter.mockReset().mockImplementation(async (config) => response(config));
  apiClient.defaults.adapter = adapter;
  setAuthenticatedSession({
    user: { id: 'admin', username: 'admin', role: 'NW', status: 'Active' },
    modules: ['users'],
    authentication: loginResponse,
    refreshToken: refreshTokenResponse.refreshToken,
    refreshTokenExpiresAt: refreshTokenResponse.expiresAt,
  });
});
afterEach(() => {
  apiClient.defaults.adapter = originalAdapter;
  vi.unstubAllEnvs();
});

describe('users API', () => {
  it('deletes the encoded user ID with a bearer token and no request body', async () => {
    vi.stubEnv('VITE_API_VERSION', 'v1');
    adapter.mockImplementation(async (config) =>
      response(config, 200, { ...userResponse, enabled: false }),
    );
    const controller = new AbortController();
    await expect(
      deleteUser('id/with space', controller.signal),
    ).resolves.toBeUndefined();
    const config = adapter.mock.calls[0][0];
    expect(apiClient.getUri(config)).toBe(
      'http://backend.test/api/v1/users/id%2Fwith%20space',
    );
    expect(config.method).toBe('delete');
    expect(config.data).toBeUndefined();
    expect(config.signal).toBe(controller.signal);
    expect(config.headers.get('Authorization')).toBe(
      `Bearer ${loginResponse.accessToken}`,
    );
  });

  it.each([
    [400, 'INVALID_ARGUMENT', 'invalidRequest', 'reload'],
    [404, 'NOT_FOUND', 'notFound', 'reload'],
    [409, 'DATA_CONFLICT', 'conflict', 'reload'],
    [403, 'ACCESS_DENIED', 'access', 'none'],
    [406, undefined, 'representation', 'none'],
    [503, undefined, 'service', 'retry'],
  ])(
    'normalizes DELETE HTTP %s without automatically retrying',
    async (status, code, kind, action) => {
      adapter.mockImplementation(async (config) =>
        response(config, status, { code, detail: 'Backend reason' }),
      );
      await expect(deleteUser(userResponse.id)).rejects.toMatchObject({
        failure: { status, kind, action, message: 'Backend reason' },
      });
      expect(adapter).toHaveBeenCalledTimes(1);
    },
  );

  it.each([200, 201, 204])(
    'creates users through the authenticated POST endpoint with HTTP %s',
    async (status) => {
      adapter.mockImplementation(async (config) =>
        response(config, status, status === 204 ? null : userResponse),
      );
      const body = {
        username: 'new.manager',
        displayName: 'Process Manager',
        initialPassword: ' secret ',
        role: 'PROCESS_MANAGER',
        processAssignments: [],
      };
      await expect(createUser(body)).resolves.toBeUndefined();
      const config = adapter.mock.calls[0][0];
      expect(apiClient.getUri(config)).toBe('http://backend.test/api/v2/users');
      expect(config.method).toBe('post');
      expect(JSON.parse(config.data)).toEqual(body);
      expect(config.headers.get('Authorization')).toBe(
        `Bearer ${loginResponse.accessToken}`,
      );
    },
  );

  it('renews a rejected access token once before repeating the same create body', async () => {
    adapter
      .mockImplementationOnce(async (config) => response(config, 401, ''))
      .mockImplementationOnce(async (config) =>
        response(config, 200, {
          ...loginResponse,
          accessToken: 'renewed-create-token',
        }),
      );
    const body = {
      username: 'operator',
      displayName: 'Operator',
      initialPassword: ' secret ',
      role: 'NW',
      processAssignments: [],
    };
    await createUser(body);
    expect(adapter.mock.calls.map(([config]) => config.url)).toEqual([
      'users',
      'auth/refresh',
      'users',
    ]);
    expect(JSON.parse(adapter.mock.calls[2][0].data)).toEqual(body);
    expect(adapter.mock.calls[2][0].headers.get('Authorization')).toBe(
      'Bearer renewed-create-token',
    );
  });
  it('requests a specific user by UUID with the shared bearer token and no body', async () => {
    adapter.mockImplementation(async (config) =>
      response(config, 200, userResponse),
    );
    expect(await getUser(userResponse.id)).toEqual(userResponse);
    const config = adapter.mock.calls[0][0];
    expect(apiClient.getUri(config)).toBe(
      `http://backend.test/api/v2/users/${userResponse.id}`,
    );
    expect(config.method).toBe('get');
    expect(config.data).toBeUndefined();
    expect(config.headers.get('Authorization')).toBe(
      `Bearer ${loginResponse.accessToken}`,
    );
  });

  it('renews a token once while fetching a user detail record', async () => {
    adapter
      .mockImplementation(async (config) => response(config, 200, userResponse))
      .mockImplementationOnce(async (config) => response(config, 401, ''))
      .mockImplementationOnce(async (config) =>
        response(config, 200, {
          ...loginResponse,
          accessToken: 'renewed-detail-token',
        }),
      );
    expect(await getUser(userResponse.id)).toEqual(userResponse);
    expect(adapter.mock.calls.map(([config]) => config.url)).toEqual([
      `users/${userResponse.id}`,
      'auth/refresh',
      `users/${userResponse.id}`,
    ]);
    expect(adapter.mock.calls[2][0].headers.get('Authorization')).toBe(
      'Bearer renewed-detail-token',
    );
  });

  it('preserves the backend not-found reason and offers list reload for a missing UUID', async () => {
    adapter.mockImplementation(async (config) =>
      response(config, 404, {
        type: 'about:blank',
        status: 404,
        title: 'Not found',
        detail: 'Requested resource was not found',
        code: 'NOT_FOUND',
      }),
    );
    await expect(getUser(userResponse.id)).rejects.toMatchObject({
      failure: {
        kind: 'notFound',
        status: 404,
        code: 'NOT_FOUND',
        message: 'Requested resource was not found',
        action: 'reload',
      },
    });
    expect(adapter).toHaveBeenCalledTimes(1);
  });

  it('preserves a malformed UUID rejection from the backend', async () => {
    adapter.mockImplementation(async (config) =>
      response(config, 400, { detail: 'Invalid UUID string' }),
    );
    await expect(getUser('not-a-uuid')).rejects.toMatchObject({
      failure: {
        kind: 'invalidRequest',
        status: 400,
        message: 'Invalid UUID string',
        action: 'reload',
      },
    });
  });

  it('rejects a response for a different user instead of prefilling it', async () => {
    adapter.mockImplementation(async (config) =>
      response(config, 200, { ...userResponse, id: 'another-user-id' }),
    );
    await expect(getUser(userResponse.id)).rejects.toMatchObject({
      failure: { kind: 'invalidResponse', action: 'retry' },
    });
  });
  it('uses the configured version, bearer token, and JSON headers without a GET body', async () => {
    expect(await getUsers()).toEqual(usersResponse);
    const config = adapter.mock.calls[0][0];
    expect(apiClient.getUri(config)).toBe('http://backend.test/api/v2/users');
    expect(config.method).toBe('get');
    expect(config.data).toBeUndefined();
    expect(config.headers.get('Authorization')).toBe(
      `Bearer ${loginResponse.accessToken}`,
    );
    expect(config.headers.get('Accept')).toBe(
      'application/json, application/problem+json',
    );
  });

  it('renews an access token once and retries the user list', async () => {
    adapter
      .mockImplementationOnce(async (config) => response(config, 401, ''))
      .mockImplementationOnce(async (config) =>
        response(config, 200, {
          ...loginResponse,
          accessToken: 'renewed-token',
        }),
      );
    expect(await getUsers()).toEqual(usersResponse);
    expect(adapter.mock.calls.map(([config]) => config.url)).toEqual([
      'users',
      'auth/refresh',
      'users',
    ]);
    expect(JSON.parse(adapter.mock.calls[1][0].data)).toEqual({
      refreshToken: refreshTokenResponse.refreshToken,
    });
    expect(adapter.mock.calls[2][0].headers.get('Authorization')).toBe(
      'Bearer renewed-token',
    );
  });

  it('does not loop if the retried list is still unauthorized', async () => {
    adapter.mockImplementation(async (config) =>
      config.url === 'auth/refresh'
        ? response(config, 200, loginResponse)
        : response(config, 401, ''),
    );
    await expect(getUsers()).rejects.toMatchObject({
      failure: { kind: 'authentication', action: 'signIn', status: 401 },
    });
    expect(adapter.mock.calls.map(([config]) => config.url)).toEqual([
      'users',
      'auth/refresh',
      'users',
    ]);
  });

  it('ends a session that cannot refresh instead of repeatedly retrying', async () => {
    const {
      refreshToken: _refresh,
      refreshTokenExpiresAt: _expiry,
      ...session
    } = readSession()!;
    void _refresh;
    void _expiry;
    setAuthenticatedSession(session);
    adapter.mockImplementation(async (config) => response(config, 401, ''));
    await expect(getUsers()).rejects.toBeInstanceOf(CanceledError);
    expect(readSession()).toBeNull();
    expect(adapter).toHaveBeenCalledTimes(1);
  });

  it('preserves backend messages for rejected Axios responses', async () => {
    adapter.mockImplementation(async (config) => {
      throw new AxiosError(
        'Request failed',
        'ERR_BAD_RESPONSE',
        config,
        undefined,
        response(config, 403, {
          code: 'ACCESS_DENIED',
          detail: 'Missing module access: users',
        }),
      );
    });
    await expect(getUsers()).rejects.toMatchObject({
      failure: {
        status: 403,
        message: 'Missing module access: users',
        action: 'none',
      },
    });
  });

  it.each(['ERR_NETWORK', 'ECONNABORTED'])(
    'normalizes no-response errors without exposing diagnostics: %s',
    async (code) => {
      adapter.mockImplementation(async (config) => {
        throw new AxiosError('Diagnostic text', code, config);
      });
      await expect(getUsers()).rejects.toMatchObject({
        failure: { kind: 'network', action: 'retry' },
      });
      expect(adapter).toHaveBeenCalledTimes(1);
    },
  );

  it.each([400, 403, 404, 406, 409, 500, 502, 503, 504])(
    'handles HTTP %s without automatically retrying',
    async (status) => {
      adapter.mockImplementation(async (config) =>
        response(config, status, { detail: 'Backend reason' }),
      );
      await expect(getUsers()).rejects.toMatchObject({
        failure: { status, message: 'Backend reason' },
      });
      expect(adapter).toHaveBeenCalledTimes(1);
    },
  );

  it('propagates cancellation without reporting a connectivity failure', async () => {
    const error = new CanceledError();
    adapter.mockRejectedValue(error);
    await expect(getUsers()).rejects.toBe(error);
  });
});
