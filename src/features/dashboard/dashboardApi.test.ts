import { beforeEach, expect, it, vi } from 'vitest';
import { CanceledError } from 'axios';
import { apiClient } from '../../api/client';
import {
  dashboardResponse,
  dashboardLot,
  emptyDashboard,
} from '../../test/dashboard';
import {
  getDashboard,
  getDashboardLots,
  getDashboardLot,
  parseDashboardFailure,
} from './dashboardApi';
beforeEach(() => vi.restoreAllMocks());
it('loads the dashboard read-only lot detail endpoint and validates the new fields', async () => {
  const get = vi
    .spyOn(apiClient, 'get')
    .mockResolvedValue({ status: 200, data: dashboardLot });
  expect(await getDashboardLot(dashboardLot.id)).toEqual(dashboardLot);
  expect(get).toHaveBeenCalledWith(
    'dashboard/lots/lot-id',
    expect.objectContaining({ signal: undefined }),
  );
  get.mockResolvedValue({
    status: 200,
    data: { ...dashboardLot, id: 'outside' },
  });
  await expect(getDashboardLot(dashboardLot.id)).rejects.toMatchObject({
    failure: { kind: 'invalidResponse' },
  });
  get.mockResolvedValue({
    status: 200,
    data: { ...dashboardLot, location_label: undefined },
  });
  await expect(getDashboardLot(dashboardLot.id)).rejects.toMatchObject({
    failure: { kind: 'invalidResponse' },
  });
  get.mockResolvedValue({
    status: 403,
    data: { detail: 'Lot outside your access' },
  });
  await expect(getDashboardLot(dashboardLot.id)).rejects.toMatchObject({
    failure: { kind: 'access', message: 'Lot outside your access' },
  });
});
it.each([
  { ...dashboardResponse, snapshotAt: undefined },
  { ...dashboardResponse, refreshIntervalSeconds: 0 },
  { ...dashboardResponse, metrics: undefined },
  {
    ...dashboardResponse,
    metrics: { ...dashboardResponse.metrics, completedSharePercent: 101 },
  },
  {
    ...dashboardResponse,
    stations: {
      ...dashboardResponse.stations,
      items: [{ ...dashboardResponse.stations.items[0], share_percent: -1 }],
    },
  },
])('rejects invalid new dashboard contracts: %j', async (data) => {
  vi.spyOn(apiClient, 'get').mockResolvedValue({ status: 200, data });
  await expect(getDashboard()).rejects.toMatchObject({
    failure: { kind: 'invalidResponse' },
  });
});
it('loads backend summary counts and validates empty summaries', async () => {
  const get = vi
    .spyOn(apiClient, 'get')
    .mockResolvedValue({ status: 200, data: dashboardResponse });
  expect(await getDashboard()).toMatchObject({
    lots: dashboardResponse.lots,
    availableTrolleys: 5,
    stations: expect.any(Array),
  });
  expect(get).toHaveBeenCalledWith(
    'dashboard',
    expect.objectContaining({ params: { page: 0, size: 100 } }),
  );
  get.mockResolvedValue({ status: 200, data: emptyDashboard });
  expect(await getDashboard()).toEqual({ ...emptyDashboard, stations: [] });
});
it('collects all station pages so the WIP chart is not limited to the first page', async () => {
  const stations = Array.from({ length: 101 }, (_, index) => ({
    id: `s-${index}`,
    code: String(index),
    name: 'Station',
    wip: index,
    share_percent: Number(((index / 5050) * 100).toFixed(2)),
  }));
  const get = vi
    .spyOn(apiClient, 'get')
    .mockResolvedValueOnce({
      status: 200,
      data: {
        ...dashboardResponse,
        stations: {
          items: stations.slice(0, 100),
          page: 0,
          size: 100,
          totalElements: 101,
        },
      },
    })
    .mockResolvedValueOnce({
      status: 200,
      data: {
        ...dashboardResponse,
        stations: {
          items: stations.slice(100),
          page: 1,
          size: 100,
          totalElements: 101,
        },
      },
    });
  expect((await getDashboard()).stations).toEqual(stations);
  expect(get).toHaveBeenLastCalledWith(
    'dashboard',
    expect.objectContaining({ params: { page: 1, size: 100 } }),
  );
});
it.each([
  { ...dashboardResponse, lots: [{ status: 'READY', count: '1' }] },
  { ...dashboardResponse, styles: [{ status: 'DRAFT', count: -1 }] },
  {
    ...dashboardResponse,
    lots: [
      { status: 'READY', count: 1 },
      { status: 'READY', count: 2 },
    ],
  },
  {
    ...dashboardResponse,
    stations: [{ id: 's', code: '01', name: 'Station', wip: -1 }],
  },
  { ...dashboardResponse, availableTrolleys: null },
  {},
  [],
])('rejects malformed summary responses: %j', async (data) => {
  vi.spyOn(apiClient, 'get').mockResolvedValue({ status: 200, data });
  await expect(getDashboard()).rejects.toMatchObject({
    failure: { kind: 'invalidResponse' },
  });
});
it('sends server paging, search and optional status and validates live lot fields', async () => {
  const query = { page: 2, size: 25, search: 'Washing' };
  const page = { items: [dashboardLot], page: 2, size: 25, totalElements: 51 };
  const get = vi
    .spyOn(apiClient, 'get')
    .mockResolvedValue({ status: 200, data: page });
  expect(await getDashboardLots(query, undefined, 'IN_PROCESS')).toEqual(page);
  expect(get).toHaveBeenCalledWith(
    'dashboard/lots',
    expect.objectContaining({ params: { ...query, status: 'IN_PROCESS' } }),
  );
  await expect(
    getDashboardLots(query, undefined, 'COMPLETED'),
  ).rejects.toMatchObject({ failure: { kind: 'invalidResponse' } });
  get.mockResolvedValue({ status: 200, data: [] });
  expect((await getDashboardLots(query)).totalElements).toBe(0);
  expect(get).toHaveBeenLastCalledWith(
    'dashboard/lots',
    expect.objectContaining({ params: query }),
  );
  get.mockResolvedValue({
    status: 200,
    data: [{ ...dashboardLot, current_process: 123 }],
  });
  await expect(getDashboardLots(query)).rejects.toMatchObject({
    failure: { kind: 'invalidResponse' },
  });
});
it.each([
  [401, 'authentication', 'signIn'],
  [403, 'access', 'none'],
  [404, 'notFound', 'retry'],
  [400, 'invalidRequest', 'none'],
  [503, 'service', 'retry'],
])('preserves backend errors for %s', async (status, kind, action) => {
  vi.spyOn(apiClient, 'get').mockResolvedValue({
    status,
    data: { detail: 'Backend explanation' },
  });
  await expect(getDashboard()).rejects.toMatchObject({
    failure: { kind, action, message: 'Backend explanation' },
  });
});
it('handles role changes, network failures, and cancellation', async () => {
  expect(
    parseDashboardFailure(
      { code: 'ACCESS_DENIED', detail: 'Role changed; log in again' },
      403,
    ),
  ).toMatchObject({ kind: 'roleChanged', action: 'signIn' });
  const get = vi
    .spyOn(apiClient, 'get')
    .mockRejectedValue(new Error('Offline'));
  await expect(getDashboard()).rejects.toMatchObject({
    failure: { kind: 'network', action: 'retry' },
  });
  const cancelled = new CanceledError();
  get.mockRejectedValue(cancelled);
  await expect(getDashboard()).rejects.toBe(cancelled);
});
it('accepts lots whose garment quantities are not yet specified', async () => {
  vi.spyOn(apiClient, 'get').mockResolvedValue({
    status: 200,
    data: [{ ...dashboardLot, quantity: null }],
  });
  await expect(
    getDashboardLots({ page: 0, size: 10, search: '' }),
  ).resolves.toMatchObject({ items: [{ quantity: null }] });
});
