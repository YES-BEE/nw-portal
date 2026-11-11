import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError, CanceledError } from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';
import { apiClient } from '../../api/client';
import { loginResponse, refreshTokenResponse } from '../../test/auth';
import {
  accessRoleOptionsResponse,
  accessRolesResponse,
} from '../../test/accessRoles';
import { setAuthenticatedSession } from '../auth/session';
import { modulesResponse } from '../../test/modules';
import {
  createAccessRole,
  deleteAccessRole,
  getAccessRoleOptions,
  getModules,
  getAccessRolesPage,
  saveAccessRole,
} from './accessRolesApi';

const getAccessRoles = async (signal?: AbortSignal) =>
  (await getAccessRolesPage({ page: 0, size: 10, search: '' }, signal)).items;
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
  it('deletes an encoded role code with no body and returns its inactive status', async () => {
    const deletedRole = { code: 'CUSTOM/OPS', active: false };
    adapter.mockImplementation(async (config) =>
      response(config, 200, deletedRole),
    );
    const controller = new AbortController();
    await expect(
      deleteAccessRole('CUSTOM/OPS', controller.signal),
    ).resolves.toEqual(deletedRole);
    const config = adapter.mock.calls[0][0];
    expect(apiClient.getUri(config).split('?')[0]).toBe(
      'http://backend.test/api/v1/access-roles/CUSTOM%2FOPS',
    );
    expect(config.method).toBe('delete');
    expect(config.data).toBeUndefined();
    expect(config.signal).toBe(controller.signal);
    expect(config.headers.get('Authorization')).toBe(
      'Bearer ' + loginResponse.accessToken,
    );
  });

  it.each([
    [409, 'ROLE_IN_USE', 'conflict', 'none'],
    [409, 'BUILT_IN_ROLE', 'conflict', 'none'],
    [409, 'DATA_CONFLICT', 'conflict', 'none'],
    [404, 'NOT_FOUND', 'notFound', 'reload'],
    [400, 'INVALID_ARGUMENT', 'invalidRequest', 'reload'],
    [403, 'ACCESS_DENIED', 'access', 'none'],
    [503, undefined, 'service', 'retry'],
  ])(
    'preserves DELETE HTTP %s / %s without automatically resubmitting',
    async (status, code, kind, action) => {
      adapter.mockImplementation(async (config) =>
        response(config, status, { code, detail: 'Backend reason' }),
      );
      await expect(deleteAccessRole('CUSTOM_ROLE')).rejects.toMatchObject({
        failure: { status, kind, action, message: 'Backend reason' },
      });
      expect(adapter).toHaveBeenCalledTimes(1);
    },
  );
  it('loads the typed module catalog with bearer authentication and no request body', async () => {
    adapter.mockImplementation(async (config) =>
      response(config, 200, modulesResponse),
    );
    const controller = new AbortController();
    await expect(getModules(controller.signal)).resolves.toEqual(
      modulesResponse,
    );
    const config = adapter.mock.calls[0][0];
    expect(apiClient.getUri(config).split('?')[0]).toBe(
      'http://backend.test/api/v1/modules',
    );
    expect(config.method).toBe('get');
    expect(config.data).toBeUndefined();
    expect(config.signal).toBe(controller.signal);
    expect(config.headers.get('Authorization')).toBe(
      'Bearer ' + loginResponse.accessToken,
    );
  });

  it.each([
    { data: {} },
    { data: [{ key: 'dashboard', name: 'Dashboard' }] },
    { data: [{ ...modulesResponse[0], active: 'true' }] },
    { data: [{ ...modulesResponse[0], key: '' }] },
    { data: [modulesResponse[0], modulesResponse[0]] },
  ])('rejects malformed module responses: %j', async ({ data }) => {
    adapter.mockImplementation(async (config) => response(config, 200, data));
    await expect(getModules()).rejects.toMatchObject({
      failure: { kind: 'invalidResponse', action: 'retry' },
    });
  });

  it.each([403, 503])(
    'preserves module HTTP %s failures without automatically retrying',
    async (status) => {
      adapter.mockImplementation(async (config) =>
        response(config, status, { detail: 'Backend reason' }),
      );
      await expect(getModules()).rejects.toMatchObject({
        failure: {
          status,
          message: 'Backend reason',
          action: status === 403 ? 'none' : 'retry',
        },
      });
      expect(adapter).toHaveBeenCalledTimes(1);
    },
  );
  it('loads code/name options with bearer authentication and an abort signal', async () => {
    adapter.mockImplementation(async (config) =>
      response(config, 200, accessRoleOptionsResponse),
    );
    const controller = new AbortController();
    await expect(getAccessRoleOptions(controller.signal)).resolves.toEqual(
      accessRoleOptionsResponse,
    );
    const config = adapter.mock.calls[0][0];
    expect(apiClient.getUri(config).split('?')[0]).toBe(
      'http://backend.test/api/v1/access-roles/options',
    );
    expect(config.method).toBe('get');
    expect(config.signal).toBe(controller.signal);
    expect(config.data).toBeUndefined();
    expect(config.headers.get('Authorization')).toBe(
      'Bearer ' + loginResponse.accessToken,
    );
  });

  it.each([
    { data: {} },
    { data: [{ code: 'NW' }] },
    { data: [{ code: '', name: 'NW' }] },
    { data: [{ code: 'NW', name: 42 }] },
    { data: [accessRoleOptionsResponse[0], accessRoleOptionsResponse[0]] },
  ])('rejects malformed or duplicate role options: %j', async ({ data }) => {
    adapter.mockImplementation(async (config) => response(config, 200, data));
    await expect(getAccessRoleOptions()).rejects.toMatchObject({
      failure: { kind: 'invalidResponse', action: 'retry' },
    });
  });

  it.each([403, 503])(
    'preserves role options HTTP %s failures without automatic retries',
    async (status) => {
      adapter.mockImplementation(async (config) =>
        response(config, status, { detail: 'Backend reason' }),
      );
      await expect(getAccessRoleOptions()).rejects.toMatchObject({
        failure: {
          status,
          message: 'Backend reason',
          action: status === 403 ? 'none' : 'retry',
        },
      });
      expect(adapter).toHaveBeenCalledTimes(1);
    },
  );
  it.each(['post', 'put'] as const)(
    'normalizes %s validation, access, conflict, and service failures without automatic resubmission',
    async (method) => {
      const cases = [
        {
          status: 400,
          data: {
            code: 'VALIDATION_FAILED',
            fieldErrors: { modules: 'Invalid module selection' },
          },
          kind: 'validation',
        },
        {
          status: 400,
          data: { code: 'INVALID_ARGUMENT', detail: 'Unknown module: other' },
          kind: 'invalidRequest',
        },
        {
          status: 403,
          data: {
            code: 'ACCESS_DENIED',
            detail: 'Missing module access: roles',
          },
          kind: 'access',
        },
        {
          status: 409,
          data: {
            code: 'DATA_CONFLICT',
            detail: 'The operation violates a state constraint',
          },
          kind: 'conflict',
        },
        { status: 500, data: '', kind: 'service' },
        { status: 502, data: '{broken', kind: 'service' },
        { status: 503, data: '<html>proxy failure</html>', kind: 'service' },
        { status: 504, data: { unexpected: true }, kind: 'service' },
      ];
      for (const failure of cases) {
        adapter
          .mockClear()
          .mockImplementation(async (config) =>
            response(config, failure.status, failure.data),
          );
        const body = { modules: [], pcAccess: false, padAccess: true };
        const save =
          method === 'post'
            ? createAccessRole({ ...body, name: 'New role' })
            : saveAccessRole('NW', body);
        await expect(save).rejects.toMatchObject({
          failure: { status: failure.status, kind: failure.kind },
        });
        expect(adapter).toHaveBeenCalledTimes(1);
      }
    },
  );

  it.each(['post', 'put'] as const)(
    'handles %s transport timeouts and cancellations',
    async (method) => {
      const body = { modules: [], pcAccess: false, padAccess: true };
      const save = () =>
        method === 'post'
          ? createAccessRole({ ...body, name: 'New role' })
          : saveAccessRole('NW', body);
      adapter.mockImplementation(async (config) => {
        throw new AxiosError('timeout', 'ECONNABORTED', config);
      });
      await expect(save()).rejects.toMatchObject({
        failure: { kind: 'network', action: 'retry' },
      });
      const cancelled = new CanceledError();
      adapter.mockRejectedValue(cancelled);
      await expect(save()).rejects.toBe(cancelled);
    },
  );
  it('creates a role with its name via POST without a client-generated code', async () => {
    const createdRole = {
      ...accessRolesResponse[0],
      code: 'CUSTOM_backend_generated',
      name: 'Factory Operator',
      description: 'Factory Operator',
      built_in: false,
      modules: ['dashboard'],
      pad_access: false,
    };
    adapter.mockImplementation(async (config) =>
      response(config, 200, createdRole),
    );
    const body = {
      name: 'Factory Operator',
      modules: ['dashboard'],
      pcAccess: true,
      padAccess: false,
    };
    await expect(createAccessRole(body)).resolves.toEqual(createdRole);
    const config = adapter.mock.calls[0][0];
    expect(apiClient.getUri(config).split('?')[0]).toBe(
      'http://backend.test/api/v1/access-roles',
    );
    expect(config.method).toBe('post');
    expect(JSON.parse(config.data)).toEqual(body);
    expect(config.headers.get('Authorization')).toBe(
      `Bearer ${loginResponse.accessToken}`,
    );
  });

  it('preserves create failure reasons without retrying POST automatically', async () => {
    adapter.mockImplementation(async (config) =>
      response(config, 400, { detail: 'Role name is required' }),
    );
    await expect(
      createAccessRole({
        name: '',
        modules: [],
        pcAccess: false,
        padAccess: true,
      }),
    ).rejects.toMatchObject({
      failure: { status: 400, message: 'Role name is required' },
    });
    expect(adapter).toHaveBeenCalledTimes(1);
  });
  it.each([200, 201])(
    'saves only the documented PUT body and accepts HTTP %s',
    async (status) => {
      adapter.mockImplementation(async (config) =>
        response(config, status, accessRolesResponse),
      );
      const body = {
        modules: ['dashboard', 'reports'],
        pcAccess: true,
        padAccess: false,
      };
      await expect(saveAccessRole('CUSTOM/OPS', body)).resolves.toEqual(
        accessRolesResponse,
      );
      const config = adapter.mock.calls[0][0];
      expect(apiClient.getUri(config).split('?')[0]).toBe(
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
    expect(apiClient.getUri(config).split('?')[0]).toBe(
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
