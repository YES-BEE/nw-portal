import { beforeEach, expect, it, vi } from 'vitest';
import { CanceledError } from 'axios';
import { apiClient } from '../../api/client';
import { dashboardLot } from '../../test/dashboard';
import { getLotHistory, parseReportsFailure } from './reportsApi';

const query = { page: 0, size: 10, search: '' };
const lot = dashboardLot;
beforeEach(() => vi.restoreAllMocks());
it('accepts empty history pages without treating them as failures', async () => {
  const page = { items: [], page: 0, size: 10, totalElements: 0 };
  vi.spyOn(apiClient, 'get').mockResolvedValue({ status: 200, data: page });
  expect(await getLotHistory({ ...query, lotId: 'lot-id' })).toEqual(page);
});
it('types JSONB history details and forwards the lot ID, search and page', async () => {
  const event = {
    id: 'event-id',
    location_type: 'TROLLEY',
    location_id: null,
    actor_id: null,
    occurred_at: lot.created_at,
    detail: { type: 'jsonb', value: '{"reason":"Moved"}' },
  };
  const params = { page: 2, size: 25, search: 'Moved', lotId: 'lot-id' };
  const get = vi.spyOn(apiClient, 'get').mockResolvedValue({
    status: 200,
    data: { items: [event], page: 2, size: 25, totalElements: 51 },
  });
  expect((await getLotHistory(params)).items).toEqual([event]);
  expect(get).toHaveBeenCalledWith(
    'reports/lot-history',
    expect.objectContaining({ params }),
  );
  get.mockResolvedValue({
    status: 200,
    data: {
      items: [{ ...event, detail: undefined }],
      page: 2,
      size: 25,
      totalElements: 51,
    },
  });
  await expect(getLotHistory(params)).rejects.toMatchObject({
    failure: { kind: 'invalidResponse' },
  });
});
it.each([
  [401, 'authentication', 'signIn'],
  [403, 'access', 'none'],
  [404, 'notFound', 'none'],
  [400, 'invalidRequest', 'none'],
  [503, 'service', 'retry'],
])('handles backend status %s', async (status, kind, action) => {
  vi.spyOn(apiClient, 'get').mockResolvedValue({
    status,
    data: { detail: 'Backend explanation' },
  });
  await expect(
    getLotHistory({ ...query, lotId: 'lot-id' }),
  ).rejects.toMatchObject({
    failure: { kind, action, message: 'Backend explanation' },
  });
});
it('handles revoked roles, non-JSON errors, network failures and cancellation', async () => {
  expect(
    parseReportsFailure(
      { code: 'ACCESS_DENIED', detail: 'Role changed; log in again' },
      403,
    ).action,
  ).toBe('signIn');
  expect(
    parseReportsFailure('<html>error</html>', 502).message,
  ).toBeUndefined();
  const get = vi
    .spyOn(apiClient, 'get')
    .mockRejectedValue(new Error('offline'));
  await expect(
    getLotHistory({ ...query, lotId: 'lot-id' }),
  ).rejects.toMatchObject({ failure: { kind: 'network' } });
  get.mockRejectedValue(new CanceledError());
  await expect(
    getLotHistory({ ...query, lotId: 'lot-id' }),
  ).rejects.toBeInstanceOf(CanceledError);
});
