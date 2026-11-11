import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError, CanceledError } from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';
import { apiClient } from '../../api/client';
import { loginResponse, refreshTokenResponse } from '../../test/auth';
import { processResponse, processesResponse } from '../../test/processes';
import { setAuthenticatedSession } from '../auth/session';
import {
  createProcess,
  getProcessTagOptions,
  getProcesses,
  parseProcessesFailure,
} from './processesApi';
import type { CreateProcessRequest } from './types';

const createBody: CreateProcessRequest = {
  name: 'QC Washing',
  description: 'Final inspection',
  stationNumber: '03',
  nfcMode: 'PROCESS',
  quality: true,
  nfcUid: 'NFC-WASH',
  devices: [],
  deviceCount: 0,
};

const originalAdapter = apiClient.defaults.adapter;
const response = (
  config: InternalAxiosRequestConfig,
  status = 200,
  data: unknown = processesResponse,
) => ({ config, status, data, statusText: '', headers: {} });
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
    modules: ['process'],
    authentication: loginResponse,
    refreshToken: refreshTokenResponse.refreshToken,
    refreshTokenExpiresAt: refreshTokenResponse.expiresAt,
  });
});
afterEach(() => {
  apiClient.defaults.adapter = originalAdapter;
  vi.unstubAllEnvs();
});

describe('processes API', () => {
  it('creates a process with the typed canonical body and returns the full process response', async () => {
    const created = { ...processResponse, name: 'QC Washing', quality: true };
    adapter.mockImplementation(async (config) =>
      response(config, 200, created),
    );
    const controller = new AbortController();
    await expect(createProcess(createBody, controller.signal)).resolves.toEqual(
      created,
    );
    const config = adapter.mock.calls[0][0];
    expect(apiClient.getUri(config)).toBe(
      'http://backend.test/api/v1/processes',
    );
    expect(config.method).toBe('post');
    expect(JSON.parse(config.data)).toEqual(createBody);
    expect(config.signal).toBe(controller.signal);
    expect(config.headers.get('Authorization')).toBe(
      'Bearer ' + loginResponse.accessToken,
    );
  });

  it.each([
    [400, 'INVALID_ARGUMENT', 'invalidRequest', 'none'],
    [404, 'NOT_FOUND', 'invalidRequest', 'none'],
    [409, 'NFC_ALREADY_ASSIGNED', 'conflict', 'none'],
    [403, 'ACCESS_DENIED', 'access', 'none'],
    [503, undefined, 'service', 'retry'],
  ])(
    'handles create HTTP %s / %s without automatically resubmitting',
    async (status, code, kind, action) => {
      adapter.mockImplementation(async (config) =>
        response(config, status, { code, detail: 'Backend reason' }),
      );
      await expect(createProcess(createBody)).rejects.toMatchObject({
        failure: { status, code, kind, action, message: 'Backend reason' },
      });
      expect(adapter).toHaveBeenCalledTimes(1);
    },
  );

  it('maps safe nested device validation messages', () => {
    expect(
      parseProcessesFailure(
        {
          code: 'VALIDATION_FAILED',
          fieldErrors: {
            'devices[0].name': 'must not be blank',
            nfcMode: 'Invalid mode',
            unexpected: 'Ignored',
            name: '<html>Diagnostics</html>',
          },
        },
        400,
        'create',
      ),
    ).toMatchObject({
      kind: 'validation',
      fieldErrors: {
        'devices[0].name': 'must not be blank',
        nfcMode: 'Invalid mode',
      },
    });
  });

  it('loads unassigned active tag choices from the process-accessible lookup endpoint', async () => {
    const tags = [
      {
        id: 'tag1',
        name: 'Ready tag',
        uid: 'UID1',
        status: 'ACTIVE',
        assigned: false,
      },
      {
        id: 'tag2',
        name: 'Used tag',
        uid: 'UID2',
        status: 'ACTIVE',
        assigned: true,
      },
    ];
    adapter.mockImplementation(async (config) =>
      response(config, 200, { tags, processes: [] }),
    );
    await expect(getProcessTagOptions()).resolves.toEqual([tags[0]]);
    const config = adapter.mock.calls[0][0];
    expect(apiClient.getUri(config)).toBe(
      'http://backend.test/api/v1/ui/lookups',
    );
    expect(config.method).toBe('get');
    expect(config.data).toBeUndefined();
  });
  it('requests all processes with bearer authentication, no body, and no filters', async () => {
    const controller = new AbortController();
    await expect(getProcesses(controller.signal)).resolves.toEqual(
      processesResponse,
    );
    const config = adapter.mock.calls[0][0];
    expect(apiClient.getUri(config)).toBe(
      'http://backend.test/api/v1/processes',
    );
    expect(config.method).toBe('get');
    expect(config.data).toBeUndefined();
    expect(config.params).toBeUndefined();
    expect(config.signal).toBe(controller.signal);
    expect(config.headers.get('Authorization')).toBe(
      'Bearer ' + loginResponse.accessToken,
    );
    expect(config.headers.get('Accept')).toBe(
      'application/json, application/problem+json',
    );
  });

  it('renews an expired token once before repeating the same GET', async () => {
    adapter
      .mockImplementationOnce(async (config) => response(config, 401, ''))
      .mockImplementationOnce(async (config) =>
        response(config, 200, {
          ...loginResponse,
          accessToken: 'renewed-process-token',
        }),
      );
    await expect(getProcesses()).resolves.toEqual(processesResponse);
    expect(adapter.mock.calls.map(([config]) => config.url)).toEqual([
      'processes',
      'auth/refresh',
      'processes',
    ]);
    expect(adapter.mock.calls[2][0].headers.get('Authorization')).toBe(
      'Bearer renewed-process-token',
    );
  });

  it('accepts nullable descriptions, durations, and unassigned NFC UIDs', async () => {
    const data = [
      {
        ...processResponse,
        description: null,
        target_duration_seconds: null,
        nfcUid: null,
        nfc_uid: null,
      },
    ];
    adapter.mockImplementation(async (config) => response(config, 200, data));
    await expect(getProcesses()).resolves.toEqual(data);
  });

  it.each([400, 403, 404, 406, 409, 500, 502, 503, 504])(
    'preserves HTTP %s error details without automatically retrying',
    async (status) => {
      adapter.mockImplementation(async (config) =>
        response(config, status, {
          code: 'BACKEND_CODE',
          detail: 'Backend reason',
        }),
      );
      await expect(getProcesses()).rejects.toMatchObject({
        failure: { status, code: 'BACKEND_CODE', message: 'Backend reason' },
      });
      expect(adapter).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    { data: [{ ...processResponse, device_count: '1' }] },
    { data: [{ ...processResponse, active: 'true' }] },
    { data: [{ ...processResponse, nfc_mode: 'INVALID' }] },
    {
      data: [
        {
          ...processesResponse[1],
          devices: [{ ...processesResponse[1].devices[0], processId: 12 }],
        },
      ],
    },
  ])(
    'rejects invalid fields in the full process response: %j',
    async ({ data }) => {
      adapter.mockImplementation(async (config) => response(config, 200, data));
      await expect(getProcesses()).rejects.toMatchObject({
        failure: { kind: 'invalidResponse', action: 'retry' },
      });
    },
  );

  it('normalizes rejected Axios responses', async () => {
    adapter.mockImplementation(async (config) => {
      throw new AxiosError(
        'Request failed',
        'ERR_BAD_RESPONSE',
        config,
        undefined,
        response(config, 403, { detail: 'Missing module access: process' }),
      );
    });
    await expect(getProcesses()).rejects.toMatchObject({
      failure: {
        kind: 'access',
        action: 'none',
        message: 'Missing module access: process',
      },
    });
  });

  it.each(['ERR_NETWORK', 'ECONNABORTED'])(
    'normalizes connectivity failures: %s',
    async (code) => {
      adapter.mockImplementation(async (config) => {
        throw new AxiosError('Diagnostics', code, config);
      });
      await expect(getProcesses()).rejects.toMatchObject({
        failure: { kind: 'network', action: 'retry' },
      });
    },
  );

  it('propagates cancellation', async () => {
    const cancelled = new CanceledError();
    adapter.mockRejectedValue(cancelled);
    await expect(getProcesses()).rejects.toBe(cancelled);
  });

  it('recognizes role changes and uses safe fallbacks for HTML failures', () => {
    const body = {
      type: 'about:blank',
      title: 'Forbidden',
      status: 403,
      code: 'ACCESS_DENIED',
      detail: 'Role changed; log in again',
    };
    expect(parseProcessesFailure(body, 403)).toMatchObject({
      kind: 'roleChanged',
      action: 'signIn',
    });
    expect(parseProcessesFailure({ ...body, status: 401 }, 403)).toMatchObject({
      kind: 'access',
      action: 'none',
    });
    expect(
      parseProcessesFailure('<html>Diagnostics</html>', 503),
    ).toMatchObject({ kind: 'service', action: 'retry', message: undefined });
  });
});
