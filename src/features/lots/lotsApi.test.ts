import { apiPage } from '../../test/apiPage';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { CanceledError, type InternalAxiosRequestConfig } from 'axios';
import { apiClient } from '../../api/client';
import { loginResponse } from '../../test/auth';
import {
  lotResponse,
  lotStyleOption,
  lotEvent,
  lotQcResponse,
  lotBatchResponse,
} from '../../test/lots';
import { setAuthenticatedSession } from '../auth/session';
import {
  getLots,
  getLot,
  createLots,
  cancelLot,
  getLotTimeline,
  getLotStyleOptions,
  parseLotsFailure,
  getLotQc,
  getAvailableLotTrolleys,
  assignLotTrolley,
  unassignLotTrolley,
  updateLot,
} from './lotsApi';

const originalAdapter = apiClient.defaults.adapter;
const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => ({
  config,
  status: 200,
  statusText: '',
  headers: {},
  data: lotResponse as unknown,
}));
const query = { page: 0, size: 10, search: '' };
it('updates one lot using the backend request and full lot response', async () => {
  const updated = { ...lotResponse, quantity: 120, version: 1 };
  respond(updated);
  await expect(
    updateLot(lotResponse.id, { quantity: 120, reason: 'Recount' }),
  ).resolves.toEqual(updated);
  expect(adapter.mock.calls[0][0]).toMatchObject({
    method: 'put',
    url: 'lots/lot-id',
  });
  expect(JSON.parse(adapter.mock.calls[0][0].data)).toEqual({
    quantity: 120,
    reason: 'Recount',
  });
  respond({ ...updated, id: 'another-lot' });
  await expect(
    updateLot(lotResponse.id, { quantity: 120, reason: 'Recount' }),
  ).rejects.toMatchObject({ failure: { kind: 'invalidResponse' } });
  respond({ ...updated, quantity: 100 });
  await expect(
    updateLot(lotResponse.id, { quantity: 120, reason: 'Recount' }),
  ).rejects.toMatchObject({ failure: { kind: 'invalidResponse' } });
});
it('uses the backend default batch count for null and accepts null quantities', async () => {
  const batch = {
    createdCount: 1,
    items: [{ ...lotResponse, quantity: null }],
  };
  respond(batch);
  await expect(
    createLots('style-id', { lotCount: null, quantity: null }),
  ).resolves.toEqual(batch);
  expect(JSON.parse(adapter.mock.calls[0][0].data)).toEqual({
    lotCount: null,
    quantity: null,
  });
  respond({
    createdCount: 1,
    items: [{ ...lotResponse, trolley_id: undefined, trolley_code: undefined }],
  });
  await expect(createLots('style-id', {})).rejects.toMatchObject({
    failure: { kind: 'invalidResponse' },
  });
  respond({ createdCount: 1, items: [lotResponse] });
  await expect(
    createLots('style-id', { quantity: null }),
  ).rejects.toMatchObject({ failure: { kind: 'invalidResponse' } });
  expect(
    parseLotsFailure(
      {
        code: 'VALIDATION_FAILED',
        fieldErrors: { trolleyId: 'Select a trolley' },
      },
      400,
    ),
  ).toMatchObject({ fieldErrors: { trolleyId: 'Select a trolley' } });
});
it('rejects lot responses missing the required trolley fields', async () => {
  respond({ ...lotResponse, trolley_id: undefined, trolley_code: undefined });
  await expect(getLot(lotResponse.id)).rejects.toMatchObject({
    failure: { kind: 'invalidResponse' },
  });
});
it('creates a backend-numbered batch and permits an unspecified quantity', async () => {
  const items = [
    { ...lotResponse, quantity: null },
    { ...lotResponse, id: 'second-lot', lot_number: 'LOT-2', quantity: null },
  ];
  respond({ createdCount: 2, items });
  await expect(createLots('style-id', { lotCount: 2 })).resolves.toEqual({
    createdCount: 2,
    items,
  });
  expect(JSON.parse(adapter.mock.calls[0][0].data)).toEqual({ lotCount: 2 });
  await expect(createLots('style-id', { lotCount: 3 })).rejects.toMatchObject({
    failure: { kind: 'invalidResponse' },
  });
  respond({ createdCount: 2, items: [lotResponse, lotResponse] });
  await expect(createLots('style-id', { lotCount: 2 })).rejects.toMatchObject({
    failure: { kind: 'invalidResponse' },
  });
  respond({
    createdCount: 1,
    items: [{ ...lotResponse, style_id: 'other-style' }],
  });
  await expect(createLots('style-id', {})).rejects.toMatchObject({
    failure: { kind: 'invalidResponse' },
  });
});
it('accepts null lot quantities and completed styles in the owned-style lookup', async () => {
  respond({ ...lotResponse, quantity: null });
  await expect(getLot('lot-id')).resolves.toMatchObject({ quantity: null });
  respond({
    styles: apiPage(
      [{ ...lotStyleOption, status: 'COMPLETED' }],
      undefined,
      20,
    ),
  });
  await expect(getLotStyleOptions()).resolves.toEqual([
    { ...lotStyleOption, status: 'COMPLETED' },
  ]);
  expect(
    parseLotsFailure(
      { code: 'VALIDATION_FAILED', fieldErrors: { lotCount: 'At most 1000' } },
      400,
    ),
  ).toMatchObject({ fieldErrors: { lotCount: 'At most 1000' } });
});
it('loads available trolleys through the lots-authorized endpoint and maps/unmaps a trolley', async () => {
  const trolley = {
    id: 'trolley-id',
    code: 'TR-01',
    active: true,
    status: 'AVAILABLE',
    version: 0,
  };
  respond(apiPage([trolley], undefined, 100));
  await expect(getAvailableLotTrolleys()).resolves.toEqual([trolley]);
  expect(adapter.mock.calls[0][0]).toMatchObject({
    url: 'trolleys/available',
    params: { page: 0, size: 100 },
  });
  respond({
    ...lotResponse,
    trolley_id: trolley.id,
    trolley_code: trolley.code,
  });
  await expect(
    assignLotTrolley('lot-id', { trolleyId: trolley.id }),
  ).resolves.toMatchObject({ trolley_id: trolley.id });
  expect(adapter.mock.calls[1][0]).toMatchObject({
    url: 'lots/lot-id/trolley',
    method: 'put',
  });
  expect(JSON.parse(adapter.mock.calls[1][0].data)).toEqual({
    trolleyId: trolley.id,
  });
  respond(lotResponse);
  await expect(unassignLotTrolley('lot-id')).resolves.toEqual(lotResponse);
  expect(adapter.mock.calls[2][0]).toMatchObject({
    url: 'lots/lot-id/trolley',
    method: 'delete',
  });
  respond({
    ...lotResponse,
    trolley_id: 'different-trolley',
    trolley_code: 'TR-02',
  });
  await expect(
    assignLotTrolley('lot-id', { trolleyId: trolley.id }),
  ).rejects.toMatchObject({ failure: { kind: 'invalidResponse' } });
  await expect(unassignLotTrolley('lot-id')).rejects.toMatchObject({
    failure: { kind: 'invalidResponse' },
  });
  respond(
    { code: 'TROLLEY_OCCUPIED', detail: 'Trolley is already assigned' },
    409,
  );
  await expect(
    assignLotTrolley('lot-id', { trolleyId: trolley.id }),
  ).rejects.toMatchObject({
    failure: { kind: 'conflict', message: 'Trolley is already assigned' },
  });
});
it('fetches a typed QC inspection using the encoded lot ID and abort signal', async () => {
  respond({ ...lotQcResponse, lot_id: 'lot/id' });
  const controller = new AbortController();
  await expect(getLotQc('lot/id', controller.signal)).resolves.toEqual({
    ...lotQcResponse,
    lot_id: 'lot/id',
  });
  expect(adapter.mock.calls[0][0]).toMatchObject({
    url: 'lots/lot%2Fid/qc',
    method: 'get',
    signal: controller.signal,
  });
});
it('returns no QC result only for the backend missing-inspection response', async () => {
  respond(
    { code: 'NOT_FOUND', detail: 'Requested resource was not found' },
    404,
  );
  await expect(getLotQc('lot-id')).resolves.toBeNull();
  respond({ detail: 'QC access denied' }, 403);
  await expect(getLotQc('lot-id')).rejects.toMatchObject({
    failure: { kind: 'access', message: 'QC access denied' },
  });
});
it.each([
  { ...lotQcResponse, lot_id: 'different-lot' },
  { ...lotQcResponse, good_quantity: '198' },
  { ...lotQcResponse, rejected_quantity: -1 },
  { ...lotQcResponse, inspected_quantity: 201 },
  { ...lotQcResponse, outcome: 'INVALID' },
  { ...lotQcResponse, completed_at: 'invalid-date' },
  [],
  null,
])('rejects malformed successful QC responses: %j', async (data) => {
  respond(data);
  await expect(getLotQc('lot-id')).rejects.toMatchObject({
    failure: { kind: 'invalidResponse' },
  });
});
it('accepts nullable QC metadata and preserves cancellation and service failures', async () => {
  const nullable = {
    ...lotQcResponse,
    reason: null,
    operator_id: null,
    completed_at: null,
  };
  respond(nullable);
  await expect(getLotQc('lot-id')).resolves.toEqual(nullable);
  respond({ detail: 'QC service unavailable' }, 503);
  await expect(getLotQc('lot-id')).rejects.toMatchObject({
    failure: { kind: 'service', message: 'QC service unavailable' },
  });
  adapter.mockRejectedValueOnce(new CanceledError());
  await expect(getLotQc('lot-id')).rejects.toBeInstanceOf(CanceledError);
});
function respond(data: unknown, status = 200) {
  adapter.mockImplementation(async (config) => ({
    config,
    status,
    statusText: '',
    headers: {},
    data,
  }));
}
beforeEach(() => {
  adapter.mockReset();
  respond(lotResponse);
  apiClient.defaults.adapter = adapter;
  setAuthenticatedSession({
    user: { id: 'admin', username: 'admin', role: 'CUSTOM', status: 'Active' },
    modules: ['lots'],
    authentication: loginResponse,
  });
});
afterEach(() => {
  apiClient.defaults.adapter = originalAdapter;
});

it('pages and searches lots and style-specific lots on the server', async () => {
  const page = { items: [lotResponse], page: 2, size: 25, totalElements: 51 };
  respond(page);
  await expect(getLots({ page: 2, size: 25, search: 'LOT' })).resolves.toEqual(
    page,
  );
  expect(adapter.mock.calls[0][0]).toMatchObject({
    url: 'lots',
    params: { page: 2, size: 25, search: 'LOT' },
  });
  await getLots(
    { page: 2, size: 25, search: 'LOT' },
    undefined,
    lotResponse.style_id,
  );
  expect(adapter.mock.calls[1][0].url).toBe('styles/style-id/lots');
  respond(apiPage([], query));
  await expect(getLots(query)).resolves.toMatchObject({
    items: [],
    totalElements: 0,
  });
});
it('sends backend create and cancellation commands and authenticated encoded detail URLs', async () => {
  respond(lotBatchResponse);
  await createLots('style-id', { lotCount: 1, quantity: 200 });
  expect(adapter.mock.calls[0][0]).toMatchObject({
    url: 'styles/style-id/lots',
    method: 'post',
  });
  expect(JSON.parse(adapter.mock.calls[0][0].data)).toEqual({
    lotCount: 1,
    quantity: 200,
  });
  expect(adapter.mock.calls[0][0].headers.get('Authorization')).toBe(
    `Bearer ${loginResponse.accessToken}`,
  );
  respond({ ...lotResponse, status: 'CANCELLED' });
  await cancelLot(lotResponse.id, { reason: 'Order cancelled' });
  expect(adapter.mock.calls[1][0]).toMatchObject({
    url: 'lots/lot-id/cancel',
    method: 'post',
  });
  expect(JSON.parse(adapter.mock.calls[1][0].data)).toEqual({
    reason: 'Order cancelled',
  });
  respond({ ...lotResponse, id: 'id/with space' });
  await getLot('id/with space');
  expect(adapter.mock.calls[2][0].url).toBe('lots/id%2Fwith%20space');
});
it('rejects malformed or mismatched successful responses', async () => {
  respond({ ...lotResponse, quantity: '200' });
  await expect(getLot('lot-id')).rejects.toMatchObject({
    failure: { kind: 'invalidResponse' },
  });
  respond(lotResponse);
  await expect(getLot('another-id')).rejects.toMatchObject({
    failure: { kind: 'invalidResponse' },
  });
  await expect(cancelLot('lot-id', { reason: 'Cancel' })).rejects.toMatchObject(
    { failure: { kind: 'invalidResponse' } },
  );
  await expect(
    createLots('other-style', { lotCount: 1, quantity: 1 }),
  ).rejects.toMatchObject({ failure: { kind: 'invalidResponse' } });
});
it('loads released style options from lookups without requiring style management access', async () => {
  respond({
    styles: { items: [lotStyleOption], page: 0, size: 10, totalElements: 1 },
  });
  await expect(getLotStyleOptions()).resolves.toEqual([lotStyleOption]);
  expect(adapter.mock.calls[0][0].url).toBe('ui/lookups');
  respond({
    styles: apiPage([{ ...lotStyleOption, status: 'DRAFT' }], undefined, 20),
  });
  await expect(getLotStyleOptions()).rejects.toMatchObject({
    failure: { kind: 'invalidResponse' },
  });
});
it('accepts timeline projections without IDs, including identical events, and forwards paging/search', async () => {
  const page = { items: [lotEvent, lotEvent], ...query, totalElements: 2 };
  respond(page);
  await expect(getLotTimeline('lot-id', query)).resolves.toMatchObject({
    items: [lotEvent, lotEvent],
    totalElements: 2,
  });
  expect(adapter.mock.calls[0][0]).toMatchObject({
    url: 'lots/lot-id/timeline',
    params: query,
  });
  respond({ ...page, items: [{ ...lotEvent, occurred_at: 'bad-date' }] });
  await expect(getLotTimeline('lot-id', query)).rejects.toMatchObject({
    failure: { kind: 'invalidResponse' },
  });
});
it.each([
  [403, 'ACCESS_DENIED', 'access', 'none'],
  [404, 'NOT_FOUND', 'notFound', 'reload'],
  [409, 'STYLE_NOT_RELEASED', 'conflict', 'none'],
  [409, 'COMPLETED_LOT_IMMUTABLE', 'conflict', 'none'],
  [409, 'DATA_CONFLICT', 'conflict', 'none'],
  [500, 'INTERNAL_ERROR', 'service', 'retry'],
])(
  'preserves the backend message for %s %s',
  async (status, code, kind, action) => {
    respond({ code, detail: 'Backend explanation' }, status as number);
    await expect(getLot('lot-id')).rejects.toMatchObject({
      failure: { kind, action, code, message: 'Backend explanation' },
    });
  },
);
it('maps validation fields and role changes, and preserves request cancellation', async () => {
  expect(
    parseLotsFailure({ code: 'UNAUTHORIZED', detail: 'Sign in again' }, 401),
  ).toMatchObject({
    kind: 'authentication',
    action: 'signIn',
    message: 'Sign in again',
  });
  expect(
    parseLotsFailure(
      {
        code: 'VALIDATION_FAILED',
        fieldErrors: { quantity: 'Must be positive', reason: 'Required' },
      },
      400,
    ),
  ).toMatchObject({
    kind: 'validation',
    fieldErrors: { quantity: 'Must be positive', reason: 'Required' },
  });
  expect(
    parseLotsFailure(
      { code: 'ACCESS_DENIED', detail: 'Role changed; log in again' },
      403,
    ),
  ).toMatchObject({ kind: 'roleChanged', action: 'signIn' });
  adapter.mockRejectedValueOnce(new Error('Offline'));
  await expect(getLot('lot-id')).rejects.toMatchObject({
    failure: { kind: 'network' },
  });
  adapter.mockRejectedValueOnce(new CanceledError());
  await expect(getLot('lot-id')).rejects.toBeInstanceOf(CanceledError);
});
