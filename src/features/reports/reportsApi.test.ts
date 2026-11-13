import { beforeEach, expect, it, vi } from 'vitest';
import { CanceledError } from 'axios';
import { apiClient } from '../../api/client';
import { dashboardLot } from '../../test/dashboard';
import {
  getLotProgress,
  getStyleProgress,
  parseReportsFailure,
} from './reportsApi';
import { styleProgress } from '../../test/reports';

const query = { page: 0, size: 10, search: '' };
const lot = dashboardLot;
beforeEach(() => vi.restoreAllMocks());
it('loads style progress with backend paging and search, preserving the server average', async () => {
  const params = { page: 1, size: 25, search: 'STYLE' };
  const get = vi
    .spyOn(apiClient, 'get')
    .mockResolvedValue({
      status: 200,
      data: { items: [styleProgress], page: 1, size: 25, totalElements: 26 },
    });
  const signal = new AbortController().signal;
  expect((await getStyleProgress(params, signal)).items).toEqual([
    styleProgress,
  ]);
  expect(get).toHaveBeenCalledExactlyOnceWith(
    'reports/style-progress',
    expect.objectContaining({ params, signal }),
  );
});
it('accepts styles with no lots and empty style pages', async () => {
  const emptyStyle = {
    ...styleProgress,
    status: 'DRAFT',
    released_at: null,
    lot_count: 0,
    completed_lots: 0,
    progress_percent: 0,
  };
  const get = vi
    .spyOn(apiClient, 'get')
    .mockResolvedValue({
      status: 200,
      data: { items: [emptyStyle], page: 0, size: 10, totalElements: 1 },
    });
  expect((await getStyleProgress(query)).items).toEqual([emptyStyle]);
  get.mockResolvedValue({
    status: 200,
    data: { items: [], page: 0, size: 10, totalElements: 0 },
  });
  expect((await getStyleProgress(query)).items).toEqual([]);
});
it.each([
  { ...styleProgress, progress_percent: 101 },
  { ...styleProgress, completed_lots: 4 },
  { ...styleProgress, lot_count: -1 },
  { ...styleProgress, released_at: 'invalid' },
  { ...styleProgress, status: 'UNKNOWN' },
  { ...styleProgress, lot_count: 0, completed_lots: 0 },
])('rejects malformed style progress contracts', async (item) => {
  vi.spyOn(apiClient, 'get').mockResolvedValue({
    status: 200,
    data: { items: [item], page: 0, size: 10, totalElements: 1 },
  });
  await expect(getStyleProgress(query)).rejects.toMatchObject({
    failure: { kind: 'invalidResponse' },
  });
});
it('preserves backend access failures for style reports', async () => {
  vi.spyOn(apiClient, 'get').mockResolvedValue({
    status: 403,
    data: { detail: 'Missing module access: reports' },
  });
  await expect(getStyleProgress(query)).rejects.toMatchObject({
    failure: {
      kind: 'access',
      action: 'none',
      message: 'Missing module access: reports',
    },
  });
});
it('accepts empty progress pages without treating them as failures', async () => {
  const page = { items: [], page: 0, size: 10, totalElements: 0 };
  vi.spyOn(apiClient, 'get').mockResolvedValue({ status: 200, data: page });
  expect(await getLotProgress(query)).toEqual(page);
});
it('reads the shared lot progress projection and forwards page/search without an ID', async () => {
  const params = { page: 2, size: 25, search: 'Washing' };
  const get = vi.spyOn(apiClient, 'get').mockResolvedValue({
    status: 200,
    data: { items: [lot], page: 2, size: 25, totalElements: 51 },
  });
  expect((await getLotProgress(params)).items).toEqual([lot]);
  expect(get).toHaveBeenCalledWith(
    'reports/lot-progress',
    expect.objectContaining({ params }),
  );
});
it.each([
  { ...lot, progress_percent: 101 },
  { ...lot, completed_processes: 4 },
  { ...lot, total_processes: undefined },
  { ...lot, current_process_status: 10 },
])('rejects invalid progress contracts', async (item) => {
  vi.spyOn(apiClient, 'get').mockResolvedValue({
    status: 200,
    data: { items: [item], page: 0, size: 10, totalElements: 1 },
  });
  await expect(getLotProgress(query)).rejects.toMatchObject({
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
  await expect(getLotProgress(query)).rejects.toMatchObject({
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
  await expect(getLotProgress(query)).rejects.toMatchObject({
    failure: { kind: 'network' },
  });
  get.mockRejectedValue(new CanceledError());
  await expect(getLotProgress(query)).rejects.toBeInstanceOf(CanceledError);
});
