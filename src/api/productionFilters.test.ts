import { beforeEach, expect, it, vi } from 'vitest';
import { apiClient } from './client';
import {
  getDashboardFilterOptions,
  getDashboardLots,
} from '../features/dashboard/dashboardApi';
import { getReportFilterOptions } from '../features/reports/reportsApi';
import { dashboardLot } from '../test/dashboard';
import type {
  FilterOptionType,
  ProductionLotsQuery,
} from './productionFilters';

beforeEach(() => vi.restoreAllMocks());
const query: ProductionLotsQuery = {
  page: 0,
  size: 100,
  search: 'Wash',
  styleIds: ['style-id'],
  stationId: 'station-id',
  routeScope: 'CURRENT',
};
const cases = [
  {
    kind: 'lots',
    item: {
      id: 'lot-id',
      lot_number: 'LOT-SHIRT101-001',
      style_id: 'style-id',
      style_number: 'SHIRT / 101',
    },
  },
  { kind: 'styles', item: { id: 'style-id', style_number: 'SHIRT / 101' } },
  { kind: 'stations', item: { id: 'station-id', code: 'S1' } },
  { kind: 'processes', item: { id: 'process-id', name: 'Wash' } },
] as const;
it.each(['dashboard', 'reports'] as const)(
  'loads all four %s option contracts with scoped backend filters',
  async (scope) => {
    const get = vi.spyOn(apiClient, 'post');
    const load =
      scope === 'dashboard'
        ? getDashboardFilterOptions
        : getReportFilterOptions;
    const signal = new AbortController().signal;
    for (const { kind, item } of cases) {
      get.mockResolvedValue({
        status: 200,
        data: { items: [item], page: 0, size: 100, totalElements: 1 },
      });
      expect((await load(kind, query, signal)).items).toEqual([item]);
      expect(get).toHaveBeenLastCalledWith(
        `${scope}/filter-options/${kind}`,
        query,
        expect.objectContaining({ signal }),
      );
    }
  },
);
it('validates the extra ANY-route option fields and accepts empty option pages', async () => {
  const get = vi.spyOn(apiClient, 'post').mockResolvedValue({
    status: 200,
    data: {
      items: [{ id: 's1', code: 'S1', name: 'Washing' }],
      page: 0,
      size: 100,
      totalElements: 1,
    },
  });
  expect(
    (
      await getDashboardFilterOptions('stations', {
        ...query,
        routeScope: 'ANY',
      })
    ).items[0].name,
  ).toBe('Washing');
  get.mockResolvedValue({
    status: 200,
    data: {
      items: [{ id: 'p1', code: 'P1', name: 'Wash' }],
      page: 0,
      size: 100,
      totalElements: 1,
    },
  });
  expect(
    (await getReportFilterOptions('processes', { ...query, routeScope: 'ANY' }))
      .items[0].code,
  ).toBe('P1');
  get.mockResolvedValue({
    status: 200,
    data: { items: [], page: 0, size: 100, totalElements: 0 },
  });
  expect((await getReportFilterOptions('lots', query)).items).toEqual([]);
});
it.each([
  ['lots', { id: 'x', lot_number: 'LOT-X' }],
  ['styles', { id: 'x', style_number: null }],
  ['stations', { id: 'x', code: 'S1' }],
  ['processes', { id: 'x', name: 'Wash' }],
] as const)('rejects malformed ANY-route %s options', async (kind, item) => {
  vi.spyOn(apiClient, 'post').mockResolvedValue({
    status: 200,
    data: { items: [item], page: 0, size: 100, totalElements: 1 },
  });
  await expect(
    getReportFilterOptions(kind as FilterOptionType, {
      ...query,
      routeScope: 'ANY',
    }),
  ).rejects.toMatchObject({ failure: { kind: 'invalidResponse' } });
});
it('passes all table filters without changing response values or deriving statuses', async () => {
  const params = {
    ...query,
    lotIds: [dashboardLot.id],
    stationId: dashboardLot.current_station_id!,
    processId: dashboardLot.current_process_id!,
    status: dashboardLot.status,
    routeScope: 'ANY' as const,
  };
  const page = { items: [dashboardLot], page: 0, size: 100, totalElements: 1 };
  const get = vi
    .spyOn(apiClient, 'post')
    .mockResolvedValue({ status: 200, data: page });
  expect(await getDashboardLots(params)).toEqual(page);
  expect(get).toHaveBeenLastCalledWith(
    'dashboard/lots',
    params,
    expect.anything(),
  );
  get.mockResolvedValue({
    status: 200,
    data: {
      ...page,
      items: [{ ...dashboardLot, current_station_id: undefined }],
    },
  });
  await expect(getDashboardLots(params)).rejects.toMatchObject({
    failure: { kind: 'invalidResponse' },
  });
});
it.each(['dashboard', 'reports'] as const)(
  'handles %s option access failures',
  async (scope) => {
    vi.spyOn(apiClient, 'post').mockResolvedValue({
      status: 403,
      data: { detail: 'Missing module access' },
    });
    const load =
      scope === 'dashboard'
        ? getDashboardFilterOptions
        : getReportFilterOptions;
    await expect(load('lots', query)).rejects.toMatchObject({
      failure: {
        kind: 'access',
        message: 'Missing module access',
        action: 'none',
      },
    });
  },
);
