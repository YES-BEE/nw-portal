import { apiPage } from '../../test/apiPage';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CanceledError } from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';
import { apiClient } from '../../api/client';
import { loginResponse } from '../../test/auth';
import { setAuthenticatedSession } from '../auth/session';
import {
  createTrolley,
  getTrolley,
  getTrolleys,
  setTrolleyStatus,
  updateTrolley,
} from './trolleysApi';

const trolley = {
  id: 'trolley-id',
  code: 'TR-01',
  status: 'AVAILABLE',
  active: true,
  version: 0,
};
const originalAdapter = apiClient.defaults.adapter;
const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => ({
  config,
  status: 200,
  statusText: '',
  headers: {},
  data: trolley as unknown,
}));
beforeEach(() => {
  adapter.mockReset().mockImplementation(async (config) => ({
    config,
    status: 200,
    statusText: '',
    headers: {},
    data: trolley,
  }));
  apiClient.defaults.adapter = adapter;
  setAuthenticatedSession({
    user: { id: 'admin', username: 'admin', role: 'NW', status: 'Active' },
    modules: ['trolleys'],
    authentication: loginResponse,
  });
});
afterEach(() => {
  apiClient.defaults.adapter = originalAdapter;
});

describe('backend trolley API', () => {
  it('uses backend pagination and search and validates the page response', async () => {
    const page = { items: [trolley], page: 2, size: 25, totalElements: 51 };
    adapter.mockImplementation(async (config) => ({
      config,
      status: 200,
      statusText: '',
      headers: {},
      data: page,
    }));
    await expect(
      getTrolleys({ page: 2, size: 25, search: 'TR' }),
    ).resolves.toEqual(page);
    expect(adapter.mock.calls[0][0]).toMatchObject({
      url: 'trolleys',
      params: { page: 2, size: 25, search: 'TR' },
    });
  });
  it('sends code-only create and update bodies and an encoded identifier with authentication', async () => {
    await createTrolley({ code: ' TR-01 ' });
    expect(adapter.mock.calls[0][0].method).toBe('post');
    expect(JSON.parse(adapter.mock.calls[0][0].data)).toEqual({
      code: 'TR-01',
    });
    expect(adapter.mock.calls[0][0].headers.get('Authorization')).toBe(
      `Bearer ${loginResponse.accessToken}`,
    );
    adapter.mockImplementation(async (config) => ({
      config,
      status: 200,
      statusText: '',
      headers: {},
      data: { ...trolley, id: 'id/with space' },
    }));
    await updateTrolley('id/with space', { code: ' TR-01 ' });
    expect(adapter.mock.calls[1][0]).toMatchObject({
      method: 'put',
      url: 'trolleys/id%2Fwith%20space',
    });
    expect(JSON.parse(adapter.mock.calls[1][0].data)).toEqual({
      code: 'TR-01',
    });
  });
  it('deactivates with PATCH status rather than an unsupported DELETE', async () => {
    adapter.mockImplementation(async (config) => ({
      config,
      status: 200,
      statusText: '',
      headers: {},
      data: { ...trolley, active: false },
    }));
    const controller = new AbortController();
    await expect(
      setTrolleyStatus(trolley.id, { active: false }, controller.signal),
    ).resolves.toMatchObject({ active: false });
    expect(adapter.mock.calls[0][0]).toMatchObject({
      method: 'patch',
      url: `trolleys/${trolley.id}/status`,
      signal: controller.signal,
    });
    expect(JSON.parse(adapter.mock.calls[0][0].data)).toEqual({
      active: false,
    });
  });
  it.each([
    [400, 'VALIDATION_FAILED', 'validation', 'none'],
    [401, 'AUTHENTICATION_FAILED', 'authentication', 'signIn'],
    [403, 'ACCESS_DENIED', 'access', 'none'],
    [404, 'NOT_FOUND', 'notFound', 'reload'],
    [409, 'DATA_CONFLICT', 'conflict', 'none'],
    [503, undefined, 'service', 'retry'],
  ])(
    'preserves backend HTTP %s errors without retrying the mutation',
    async (status, code, kind, action) => {
      if (status === 401)
        setAuthenticatedSession({
          user: {
            id: 'admin',
            username: 'admin',
            role: 'NW',
            status: 'Active',
          },
          modules: ['trolleys'],
        });
      adapter.mockImplementation(async (config) => ({
        config,
        status,
        statusText: '',
        headers: {},
        data: {
          code,
          detail: 'Backend reason',
          fieldErrors: { code: 'Code is required' },
        },
      }));
      await expect(createTrolley({ code: 'TR-01' })).rejects.toMatchObject({
        failure: { kind, action, message: 'Backend reason' },
      });
      expect(adapter).toHaveBeenCalledTimes(1);
    },
  );
  it('recognizes role changes and extracts field validation errors', async () => {
    adapter.mockImplementation(async (config) => ({
      config,
      status: 403,
      statusText: '',
      headers: {},
      data: { code: 'ACCESS_DENIED', detail: 'Role changed; log in again' },
    }));
    await expect(getTrolley(trolley.id)).rejects.toMatchObject({
      failure: { kind: 'roleChanged', action: 'signIn' },
    });
    adapter.mockImplementation(async (config) => ({
      config,
      status: 400,
      statusText: '',
      headers: {},
      data: {
        code: 'VALIDATION_FAILED',
        fieldErrors: { code: 'Code is required' },
      },
    }));
    await expect(createTrolley({ code: '' })).rejects.toMatchObject({
      failure: { codeError: 'Code is required' },
    });
  });
  it.each([{}, { ...trolley, active: 'true' }, { ...trolley, id: 'other' }])(
    'rejects malformed or mismatched trolley records: %j',
    async (data) => {
      adapter.mockImplementation(async (config) => ({
        config,
        status: 200,
        statusText: '',
        headers: {},
        data,
      }));
      await expect(getTrolley(trolley.id)).rejects.toMatchObject({
        failure: { kind: 'invalidResponse' },
      });
    },
  );
  it('treats a successful empty page as an empty page', async () => {
    adapter.mockImplementation(async (config) => ({
      config,
      status: 200,
      statusText: '',
      headers: {},
      data: apiPage([], config?.params, 10),
    }));
    await expect(
      getTrolleys({ page: 0, size: 10, search: '' }),
    ).resolves.toEqual({ items: [], page: 0, size: 10, totalElements: 0 });
  });
  it.each([
    [trolley],
    { items: [{}], page: 0, size: 10, totalElements: 1 },
    { items: [trolley, trolley], page: 0, size: 10, totalElements: 2 },
    { items: [], page: 0, size: 10, totalElements: -1 },
  ])('rejects invalid list pages: %j', async (data) => {
    adapter.mockImplementation(async (config) => ({
      config,
      status: 200,
      statusText: '',
      headers: {},
      data,
    }));
    await expect(
      getTrolleys({ page: 0, size: 10, search: '' }),
    ).rejects.toMatchObject({ failure: { kind: 'invalidResponse' } });
  });
  it('does not accept a status change unless the returned active flag matches', async () => {
    await expect(
      setTrolleyStatus(trolley.id, { active: false }),
    ).rejects.toMatchObject({ failure: { kind: 'invalidResponse' } });
  });
  it('handles connectivity failures and propagates cancellation', async () => {
    adapter.mockRejectedValueOnce(new Error('Network Error'));
    await expect(getTrolley(trolley.id)).rejects.toMatchObject({
      failure: { kind: 'network', action: 'retry' },
    });
    adapter.mockRejectedValueOnce(new CanceledError());
    await expect(getTrolley(trolley.id)).rejects.toBeInstanceOf(CanceledError);
  });
});
