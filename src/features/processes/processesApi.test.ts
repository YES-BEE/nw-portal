import { apiPage } from '../../test/apiPage';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError, CanceledError } from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';
import { apiClient } from '../../api/client';
import { loginResponse, refreshTokenResponse } from '../../test/auth';
import { processResponse, processesResponse } from '../../test/processes';
import { setAuthenticatedSession } from '../auth/session';
import {
  createProcess,
  deleteProcess,
  getProcess,
  getProcessTags,
  getProcessesPage,
  parseProcessesFailure,
  updateProcess,
} from './processesApi';
import type { CreateProcessRequest } from './types';

const getProcesses = async (signal?: AbortSignal) =>
  (await getProcessesPage({ page: 0, size: 10, search: '' }, signal)).items;
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
  data: unknown = apiPage(processesResponse, config?.params, 10),
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
  it('deletes by encoded ID with no body and returns the full inactive process', async () => {
    const deleted = {
      ...processResponse,
      id: 'process/with space',
      active: false,
      nfcUid: null,
      nfc_uid: null,
      version: 1,
    };
    adapter.mockImplementation(async (config) =>
      response(config, 200, deleted),
    );
    const controller = new AbortController();
    await expect(deleteProcess(deleted.id, controller.signal)).resolves.toEqual(
      deleted,
    );
    const config = adapter.mock.calls[0][0];
    expect(apiClient.getUri(config).split('?')[0]).toBe(
      'http://backend.test/api/v1/processes/process%2Fwith%20space',
    );
    expect(config.method).toBe('delete');
    expect(config.data).toBeUndefined();
    expect(config.signal).toBe(controller.signal);
    expect(config.headers.get('Authorization')).toBe(
      'Bearer ' + loginResponse.accessToken,
    );
  });

  it.each([
    [400, 'INVALID_ARGUMENT', 'invalidRequest', 'none'],
    [404, 'NOT_FOUND', 'notFound', 'reload'],
    [409, 'NOT_FOUND', 'notFound', 'reload'],
    [409, 'DATA_CONFLICT', 'conflict', 'none'],
    [403, 'ACCESS_DENIED', 'access', 'none'],
    [503, undefined, 'service', 'retry'],
  ])(
    'handles DELETE HTTP %s / %s without automatically resubmitting',
    async (status, code, kind, action) => {
      adapter.mockImplementation(async (config) =>
        response(config, status, { code, detail: 'Backend reason' }),
      );
      await expect(deleteProcess(processResponse.id)).rejects.toMatchObject({
        failure: { status, code, kind, action, message: 'Backend reason' },
      });
      expect(adapter).toHaveBeenCalledTimes(1);
    },
  );

  it('rejects a delete response which has not deactivated the process', async () => {
    adapter.mockImplementation(async (config) =>
      response(config, 200, processResponse),
    );
    await expect(deleteProcess(processResponse.id)).rejects.toMatchObject({
      failure: { kind: 'invalidResponse' },
    });
  });
  it('updates an encoded process ID with the typed body and returns the full response', async () => {
    const updated = {
      ...processResponse,
      id: 'process/with space',
      quality: true,
      version: 1,
    };
    adapter.mockImplementation(async (config) =>
      response(config, 200, updated),
    );
    const body = { ...createBody, targetDurationSeconds: 120 };
    const controller = new AbortController();
    await expect(
      updateProcess(updated.id, body, controller.signal),
    ).resolves.toEqual(updated);
    const config = adapter.mock.calls[0][0];
    expect(apiClient.getUri(config).split('?')[0]).toBe(
      'http://backend.test/api/v1/processes/process%2Fwith%20space',
    );
    expect(config.method).toBe('put');
    expect(JSON.parse(config.data)).toEqual(body);
    expect(config.signal).toBe(controller.signal);
    expect(config.headers.get('Authorization')).toBe(
      'Bearer ' + loginResponse.accessToken,
    );
  });

  it.each([
    [400, 'INVALID_ARGUMENT', 'invalidRequest', 'none'],
    [404, 'NOT_FOUND', 'notFound', 'reload'],
    [409, 'PROCESS_IN_USE', 'conflict', 'none'],
    [409, 'NFC_ALREADY_ASSIGNED', 'conflict', 'none'],
    [403, 'ACCESS_DENIED', 'access', 'none'],
    [503, undefined, 'service', 'retry'],
  ])(
    'normalizes update HTTP %s / %s without automatically resubmitting',
    async (status, code, kind, action) => {
      adapter.mockImplementation(async (config) =>
        response(config, status, { code, detail: 'Backend reason' }),
      );
      await expect(
        updateProcess(processResponse.id, {
          ...createBody,
          targetDurationSeconds: null,
        }),
      ).rejects.toMatchObject({
        failure: { status, code, kind, action, message: 'Backend reason' },
      });
      expect(adapter).toHaveBeenCalledTimes(1);
    },
  );

  it('maps validation fields for PUT and rejects mismatched success responses', async () => {
    adapter.mockImplementationOnce(async (config) =>
      response(config, 400, {
        code: 'VALIDATION_FAILED',
        fieldErrors: { 'devices[0].name': 'Invalid device name' },
      }),
    );
    await expect(
      updateProcess(processResponse.id, {
        ...createBody,
        targetDurationSeconds: null,
      }),
    ).rejects.toMatchObject({
      failure: {
        kind: 'validation',
        fieldErrors: { 'devices[0].name': 'Invalid device name' },
      },
    });
    adapter.mockImplementation(async (config) =>
      response(config, 200, { ...processResponse, id: 'wrong-process' }),
    );
    await expect(
      updateProcess(processResponse.id, {
        ...createBody,
        targetDurationSeconds: null,
      }),
    ).rejects.toMatchObject({ failure: { kind: 'invalidResponse' } });
  });
  it('fetches a process by encoded ID with bearer authentication and returns ProcessResponse', async () => {
    const detail = { ...processResponse, id: 'id/with space' };
    adapter.mockImplementation(async (config) => response(config, 200, detail));
    const controller = new AbortController();
    await expect(getProcess(detail.id, controller.signal)).resolves.toEqual(
      detail,
    );
    const config = adapter.mock.calls[0][0];
    expect(apiClient.getUri(config).split('?')[0]).toBe(
      'http://backend.test/api/v1/processes/id%2Fwith%20space',
    );
    expect(config.method).toBe('get');
    expect(config.data).toBeUndefined();
    expect(config.signal).toBe(controller.signal);
    expect(config.headers.get('Authorization')).toBe(
      'Bearer ' + loginResponse.accessToken,
    );
  });

  it.each([
    [404, 'NOT_FOUND', 'notFound', 'none'],
    [409, 'NOT_FOUND', 'notFound', 'none'],
    [400, 'INVALID_ARGUMENT', 'invalidRequest', 'none'],
    [403, 'ACCESS_DENIED', 'access', 'none'],
    [503, undefined, 'service', 'retry'],
  ])(
    'handles process detail HTTP %s / %s',
    async (status, code, kind, action) => {
      adapter.mockImplementation(async (config) =>
        response(config, status, { code, detail: 'Backend reason' }),
      );
      await expect(getProcess(processResponse.id)).rejects.toMatchObject({
        failure: { status, code, kind, action, message: 'Backend reason' },
      });
      expect(adapter).toHaveBeenCalledTimes(1);
    },
  );

  it('rejects detail responses for a different process', async () => {
    adapter.mockImplementation(async (config) =>
      response(config, 200, { ...processResponse, id: 'wrong-process' }),
    );
    await expect(getProcess(processResponse.id)).rejects.toMatchObject({
      failure: { kind: 'invalidResponse', action: 'retry' },
    });
  });
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
    expect(apiClient.getUri(config).split('?')[0]).toBe(
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

  it('loads tag names and assignment states from the process-accessible lookup endpoint', async () => {
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
      response(config, 200, {
        tags: apiPage(tags, config?.params, 20),
        processes: apiPage([], config?.params, 20),
      }),
    );
    await expect(getProcessTags()).resolves.toEqual(tags);
    const config = adapter.mock.calls[0][0];
    expect(apiClient.getUri(config).split('?')[0]).toBe(
      'http://backend.test/api/v1/ui/lookups',
    );
    expect(config.method).toBe('get');
    expect(config.data).toBeUndefined();
  });
  it('requests a process page with bearer authentication and no body', async () => {
    const controller = new AbortController();
    await expect(getProcesses(controller.signal)).resolves.toEqual(
      processesResponse,
    );
    const config = adapter.mock.calls[0][0];
    expect(apiClient.getUri(config).split('?')[0]).toBe(
      'http://backend.test/api/v1/processes',
    );
    expect(config.method).toBe('get');
    expect(config.data).toBeUndefined();
    expect(config.params).toEqual({ page: 0, size: 10, search: '' });
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
    adapter.mockImplementation(async (config) =>
      response(config, 200, apiPage(data, config?.params, 10)),
    );
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
    {
      data: apiPage([{ ...processResponse, device_count: '1' }], undefined, 10),
    },
    { data: apiPage([{ ...processResponse, active: 'true' }], undefined, 10) },
    {
      data: apiPage(
        [{ ...processResponse, nfc_mode: 'INVALID' }],
        undefined,
        10,
      ),
    },
    {
      data: apiPage(
        [
          {
            ...processesResponse[1],
            devices: [{ ...processesResponse[1].devices[0], processId: 12 }],
          },
        ],
        undefined,
        10,
      ),
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
