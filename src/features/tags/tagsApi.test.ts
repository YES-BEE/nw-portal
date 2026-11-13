import { apiPage } from '../../test/apiPage';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError, CanceledError } from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';
import { apiClient } from '../../api/client';
import { loginResponse, refreshTokenResponse } from '../../test/auth';
import { createTagResponse, tagsResponse } from '../../test/tags';
import { setAuthenticatedSession } from '../auth/session';
import {
  createTag,
  deleteTag,
  getTag,
  getTagsPage,
  updateTag,
  parseTagsFailure,
} from './tagsApi';

const getTags = async (signal?: AbortSignal) =>
  (await getTagsPage({ page: 0, size: 10, search: '' }, signal)).items;
const originalAdapter = apiClient.defaults.adapter;
const response = (
  config: InternalAxiosRequestConfig,
  status = 200,
  data: unknown = apiPage(tagsResponse, config?.params, 10),
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
    modules: ['tags'],
    authentication: loginResponse,
    refreshToken: refreshTokenResponse.refreshToken,
    refreshTokenExpiresAt: refreshTokenResponse.expiresAt,
  });
});
afterEach(() => {
  apiClient.defaults.adapter = originalAdapter;
  vi.unstubAllEnvs();
});

describe('tags API', () => {
  it.each(['list', 'create'] as const)(
    'rejects incomplete %s tag records',
    async (operation) => {
      const incomplete = { ...createTagResponse, version: undefined };
      adapter.mockImplementation(async (config) =>
        response(
          config,
          200,
          operation === 'list'
            ? apiPage([incomplete], config.params, 10)
            : incomplete,
        ),
      );
      const pending =
        operation === 'list'
          ? getTags()
          : createTag({ name: 'Tag', uid: '1234' });
      await expect(pending).rejects.toMatchObject({
        failure: { kind: 'invalidResponse' },
      });
    },
  );

  it('deletes by encoded ID with no body and returns the full deleted record', async () => {
    const deleted = {
      ...createTagResponse,
      id: 'tag/with space',
      status: 'DELETED',
      assigned: false,
      version: 1,
    };
    adapter.mockImplementation(async (config) =>
      response(config, 200, deleted),
    );
    const controller = new AbortController();
    await expect(deleteTag(deleted.id, controller.signal)).resolves.toEqual(
      deleted,
    );
    const config = adapter.mock.calls[0][0];
    expect(apiClient.getUri(config).split('?')[0]).toBe(
      'http://backend.test/api/v1/nfc-tags/tag%2Fwith%20space',
    );
    expect(config.method).toBe('delete');
    expect(config.data).toBeUndefined();
    expect(config.signal).toBe(controller.signal);
    expect(config.headers.get('Authorization')).toBe(
      'Bearer ' + loginResponse.accessToken,
    );
  });

  it.each([
    [409, 'NFC_STILL_ASSIGNED', 'conflict', 'none'],
    [404, 'NOT_FOUND', 'notFound', 'reload'],
    [400, 'INVALID_ARGUMENT', 'invalidRequest', 'reload'],
    [403, 'ACCESS_DENIED', 'access', 'none'],
    [503, undefined, 'service', 'retry'],
  ])(
    'normalizes DELETE HTTP %s / %s without resubmitting',
    async (status, code, kind, action) => {
      adapter.mockImplementation(async (config) =>
        response(config, status, { code, detail: 'Backend reason' }),
      );
      await expect(deleteTag(createTagResponse.id)).rejects.toMatchObject({
        failure: { status, code, kind, action, message: 'Backend reason' },
      });
      expect(adapter).toHaveBeenCalledTimes(1);
    },
  );

  it('rejects a success response which has not deleted the tag', async () => {
    adapter.mockImplementation(async (config) =>
      response(config, 200, createTagResponse),
    );
    await expect(deleteTag(createTagResponse.id)).rejects.toMatchObject({
      failure: { kind: 'invalidResponse' },
    });
  });
  it('updates a tag using PUT and returns its full typed record', async () => {
    const updated = {
      ...createTagResponse,
      id: 'tag/with space',
      name: 'Tag 1',
      uid: 'ABC123',
      version: 1,
    };
    adapter.mockImplementation(async (config) =>
      response(config, 200, updated),
    );
    const controller = new AbortController();
    await expect(
      updateTag(
        updated.id,
        { name: 'Tag 1', uid: 'ABC123' },
        controller.signal,
      ),
    ).resolves.toEqual(updated);
    const config = adapter.mock.calls[0][0];
    expect(apiClient.getUri(config).split('?')[0]).toBe(
      'http://backend.test/api/v1/nfc-tags/tag%2Fwith%20space',
    );
    expect(config.method).toBe('put');
    expect(JSON.parse(config.data)).toEqual({ name: 'Tag 1', uid: 'ABC123' });
    expect(config.signal).toBe(controller.signal);
    expect(config.headers.get('Authorization')).toBe(
      'Bearer ' + loginResponse.accessToken,
    );
  });

  it.each([
    [400, 'INVALID_ARGUMENT', 'invalidRequest', 'none'],
    [404, 'NOT_FOUND', 'notFound', 'reload'],
    [409, 'DATA_CONFLICT', 'conflict', 'none'],
    [403, 'ACCESS_DENIED', 'access', 'none'],
    [503, undefined, 'service', 'retry'],
  ])(
    'handles update HTTP %s / %s without automatically resubmitting',
    async (status, code, kind, action) => {
      adapter.mockImplementation(async (config) =>
        response(config, status, { code, detail: 'Backend reason' }),
      );
      await expect(
        updateTag(createTagResponse.id, { name: 'Tag 1', uid: 'ABC123' }),
      ).rejects.toMatchObject({
        failure: { status, kind, action, message: 'Backend reason' },
      });
      expect(adapter).toHaveBeenCalledTimes(1);
    },
  );

  it('maps PUT validation errors to name and uid', async () => {
    adapter.mockImplementation(async (config) =>
      response(config, 400, {
        code: 'VALIDATION_FAILED',
        fieldErrors: { name: 'Invalid name', uid: 'Invalid UID' },
      }),
    );
    await expect(
      updateTag(createTagResponse.id, { name: '', uid: '' }),
    ).rejects.toMatchObject({
      failure: {
        kind: 'validation',
        fieldErrors: { name: 'Invalid name', uid: 'Invalid UID' },
      },
    });
  });
  it('fetches full tag details by encoded ID with bearer authentication and no body', async () => {
    const detail = { ...createTagResponse, id: 'id/with space' };
    adapter.mockImplementation(async (config) => response(config, 200, detail));
    const controller = new AbortController();
    await expect(getTag(detail.id, controller.signal)).resolves.toEqual(detail);
    const config = adapter.mock.calls[0][0];
    expect(apiClient.getUri(config).split('?')[0]).toBe(
      'http://backend.test/api/v1/nfc-tags/id%2Fwith%20space',
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
    { data: { ...createTagResponse, id: 'wrong-tag' } },
    { data: { ...createTagResponse, machine_id: 42 } },
    { data: { ...createTagResponse, process_id: undefined } },
    { data: { ...createTagResponse, version: '0' } },
  ])(
    'rejects malformed detail responses or mismatched identities: %j',
    async ({ data }) => {
      adapter.mockImplementation(async (config) => response(config, 200, data));
      await expect(getTag(createTagResponse.id)).rejects.toMatchObject({
        failure: { kind: 'invalidResponse' },
      });
    },
  );

  it.each([
    [404, 'NOT_FOUND', 'notFound', 'reload'],
    [409, 'NOT_FOUND', 'notFound', 'reload'],
    [400, 'INVALID_ARGUMENT', 'invalidRequest', 'reload'],
    [403, 'ACCESS_DENIED', 'access', 'none'],
    [503, undefined, 'service', 'retry'],
  ])(
    'handles detail HTTP %s / %s without automatic retries',
    async (status, code, kind, action) => {
      adapter.mockImplementation(async (config) =>
        response(config, status, { code, detail: 'Backend reason' }),
      );
      await expect(getTag(createTagResponse.id)).rejects.toMatchObject({
        failure: { status, code, kind, action, message: 'Backend reason' },
      });
      expect(adapter).toHaveBeenCalledTimes(1);
    },
  );
  it('creates a tag using the canonical backend fields and bearer authentication', async () => {
    adapter.mockImplementation(async (config) =>
      response(config, 200, createTagResponse),
    );
    const controller = new AbortController();
    await expect(
      createTag({ name: 'Factory tag', uid: '04:AA:BB' }, controller.signal),
    ).resolves.toEqual(createTagResponse);
    const config = adapter.mock.calls[0][0];
    expect(apiClient.getUri(config).split('?')[0]).toBe(
      'http://backend.test/api/v1/nfc-tags',
    );
    expect(config.method).toBe('post');
    expect(JSON.parse(config.data)).toEqual({
      name: 'Factory tag',
      uid: '04:AA:BB',
    });
    expect(config.signal).toBe(controller.signal);
    expect(config.headers.get('Authorization')).toBe(
      'Bearer ' + loginResponse.accessToken,
    );
  });

  it.each([
    [400, 'INVALID_ARGUMENT', 'invalidRequest', 'none'],
    [409, 'DATA_CONFLICT', 'conflict', 'none'],
    [403, 'ACCESS_DENIED', 'access', 'none'],
    [406, undefined, 'representation', 'none'],
    [503, undefined, 'service', 'retry'],
  ])(
    'normalizes POST HTTP %s without automatic resubmission',
    async (status, code, kind, action) => {
      adapter.mockImplementation(async (config) =>
        response(config, status, { code, detail: 'Backend reason' }),
      );
      await expect(
        createTag({ name: 'Factory tag', uid: 'UID' }),
      ).rejects.toMatchObject({
        failure: { status, kind, action, message: 'Backend reason' },
      });
      expect(adapter).toHaveBeenCalledTimes(1);
    },
  );

  it('maps only safe, recognized validation fields for tag creation', () => {
    expect(
      parseTagsFailure(
        {
          code: 'VALIDATION_FAILED',
          fieldErrors: {
            name: 'must not be blank',
            uid: '<html>Diagnostics</html>',
            extra: 'ignored',
          },
        },
        400,
        'create',
      ),
    ).toMatchObject({
      kind: 'validation',
      action: 'none',
      fieldErrors: { name: 'must not be blank' },
    });
    expect(
      parseTagsFailure(
        { code: 'VALIDATION_FAILED', fieldErrors: [] },
        400,
        'create',
      ).kind,
    ).toBe('invalidRequest');
  });
  it('requests active tags using bearer authentication without a body', async () => {
    const controller = new AbortController();
    expect(await getTags(controller.signal)).toEqual(tagsResponse);
    const config = adapter.mock.calls[0][0];
    expect(apiClient.getUri(config).split('?')[0]).toBe(
      'http://backend.test/api/v1/nfc-tags',
    );
    expect(config.method).toBe('get');
    expect(config.data).toBeUndefined();
    expect(config.params).toEqual({
      status: 'ACTIVE',
      page: 0,
      size: 10,
      search: '',
    });
    expect(config.signal).toBe(controller.signal);
    expect(config.headers.get('Authorization')).toBe(
      'Bearer ' + loginResponse.accessToken,
    );
    expect(config.headers.get('Accept')).toBe(
      'application/json, application/problem+json',
    );
  });

  it('renews an expired token once and repeats the same GET', async () => {
    adapter
      .mockImplementationOnce(async (config) => response(config, 401, ''))
      .mockImplementationOnce(async (config) =>
        response(config, 200, {
          ...loginResponse,
          accessToken: 'renewed-tags-token',
        }),
      );
    expect(await getTags()).toEqual(tagsResponse);
    expect(adapter.mock.calls.map(([config]) => config.url)).toEqual([
      'nfc-tags',
      'auth/refresh',
      'nfc-tags',
    ]);
    expect(adapter.mock.calls[2][0].headers.get('Authorization')).toBe(
      'Bearer renewed-tags-token',
    );
  });

  it.each([400, 403, 404, 406, 409, 500, 502, 503, 504])(
    'preserves HTTP %s failure details without automatic retries',
    async (status) => {
      adapter.mockImplementation(async (config) =>
        response(config, status, {
          code: 'BACKEND_CODE',
          detail: 'Backend reason',
        }),
      );
      await expect(getTags()).rejects.toMatchObject({
        failure: { status, code: 'BACKEND_CODE', message: 'Backend reason' },
      });
      expect(adapter).toHaveBeenCalledTimes(1);
    },
  );

  it('normalizes rejected Axios responses', async () => {
    adapter.mockImplementation(async (config) => {
      throw new AxiosError(
        'Request failed',
        'ERR_BAD_RESPONSE',
        config,
        undefined,
        response(config, 403, {
          code: 'ACCESS_DENIED',
          detail: 'Missing module access: tags',
        }),
      );
    });
    await expect(getTags()).rejects.toMatchObject({
      failure: {
        kind: 'access',
        action: 'none',
        message: 'Missing module access: tags',
      },
    });
  });

  it.each(['ERR_NETWORK', 'ECONNABORTED'])(
    'normalizes connection failures: %s',
    async (code) => {
      adapter.mockImplementation(async (config) => {
        throw new AxiosError('Diagnostics', code, config);
      });
      await expect(getTags()).rejects.toMatchObject({
        failure: { kind: 'network', action: 'retry' },
      });
    },
  );

  it('propagates cancellation', async () => {
    const error = new CanceledError();
    adapter.mockRejectedValue(error);
    await expect(getTags()).rejects.toBe(error);
  });

  it('recognizes authentication, role changes, and representation failures', () => {
    expect(parseTagsFailure('', 401)).toMatchObject({
      kind: 'authentication',
      action: 'signIn',
    });
    expect(parseTagsFailure('', 406)).toMatchObject({
      kind: 'representation',
      action: 'none',
    });
    const body = {
      type: 'about:blank',
      title: 'Forbidden',
      status: 403,
      code: 'ACCESS_DENIED',
      detail: 'Role changed; log in again',
    };
    expect(parseTagsFailure(body, 403)).toMatchObject({
      kind: 'roleChanged',
      action: 'signIn',
    });
    expect(parseTagsFailure({ ...body, status: 401 }, 403)).toMatchObject({
      kind: 'access',
      action: 'none',
    });
    expect(parseTagsFailure('<html>Diagnostics</html>', 503)).toMatchObject({
      kind: 'service',
      action: 'retry',
      message: undefined,
    });
  });
});
