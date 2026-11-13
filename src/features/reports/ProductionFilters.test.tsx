import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { apiClient } from '../../api/client';
import type { ProductionLotsQuery } from '../../api/productionFilters';
import { renderWithProviders } from '../../test/render';
import { dashboardLot } from '../../test/dashboard';
import { ReportsPage } from './ReportsPage';

beforeEach(() => vi.restoreAllMocks());
const options = {
  styles: [
    { id: 's1', style_number: 'STYLE-01' },
    { id: 's2', style_number: 'STYLE-02' },
  ],
  lots: [
    {
      id: 'lot-id',
      lot_number: 'LOT-STYLE01-001',
      style_id: 's1',
      style_number: 'STYLE-01',
    },
  ],
  stations: [{ id: 'station-03', code: '03', name: 'Washing' }],
  processes: [{ id: 'process-id', name: 'Wash', code: 'P1' }],
};
function setup() {
  const get = vi
    .spyOn(apiClient, 'get')
    .mockImplementation(async (url, config) => {
      const query = config?.params as ProductionLotsQuery;
      const kind = String(url).split('/').at(-1) as keyof typeof options;
      return {
        status: 200,
        data: {
          items:
            url === 'reports/lot-progress'
              ? [dashboardLot]
              : options[kind] || [],
          page: query.page,
          size: query.size,
          totalElements:
            url === 'reports/lot-progress' ? 26 : options[kind]?.length || 0,
        },
      };
    });
  return {
    get,
    user: userEvent.setup(),
    ...renderWithProviders(<ReportsPage />),
  };
}
it('uses reports-only option endpoints and combines dependent filters', async () => {
  const { get, user } = setup();
  await screen.findByText('LOT-001');
  await user.click(screen.getByRole('combobox', { name: 'Style' }));
  await user.click(await screen.findByRole('option', { name: 'STYLE-01' }));
  await user.click(screen.getByRole('combobox', { name: 'Lot Number' }));
  await user.click(
    await screen.findByRole('option', { name: 'LOT-STYLE01-001 / STYLE-01' }),
  );
  expect(get).toHaveBeenCalledWith(
    'reports/filter-options/lots',
    expect.objectContaining({
      params: { page: 0, size: 100, search: '', styleId: 's1' },
    }),
  );
  await user.click(screen.getByRole('combobox', { name: 'Station' }));
  await user.click(await screen.findByRole('option', { name: 'Washing' }));
  await user.click(screen.getByRole('combobox', { name: 'Process' }));
  await user.click(await screen.findByRole('option', { name: 'Wash' }));
  await waitFor(() =>
    expect(get).toHaveBeenLastCalledWith(
      'reports/lot-progress',
      expect.objectContaining({
        params: {
          page: 0,
          size: 10,
          search: '',
          styleId: 's1',
          lotId: 'lot-id',
          stationId: 'station-03',
          processId: 'process-id',
        },
      }),
    ),
  );
  expect(get).toHaveBeenCalledWith(
    'reports/filter-options/processes',
    expect.objectContaining({
      params: {
        page: 0,
        size: 100,
        search: '',
        styleId: 's1',
        lotId: 'lot-id',
        stationId: 'station-03',
      },
    }),
  );
  expect(
    get.mock.calls.every(([url]) => String(url).startsWith('reports/')),
  ).toBe(true);
  await user.click(screen.getByRole('combobox', { name: 'Style' }));
  await screen.findByRole('option', { name: 'STYLE-02' });
  expect(get).toHaveBeenLastCalledWith(
    'reports/filter-options/styles',
    expect.objectContaining({
      params: expect.not.objectContaining({ styleId: 's1' }),
    }),
  );
  await user.click(screen.getByRole('option', { name: 'STYLE-02' }));
  await waitFor(() =>
    expect(get).toHaveBeenLastCalledWith(
      'reports/lot-progress',
      expect.objectContaining({
        params: {
          page: 0,
          size: 10,
          search: '',
          styleId: 's2',
        },
      }),
    ),
  );
  expect(screen.getByRole('combobox', { name: 'Station' })).toHaveValue('');
  expect(screen.getByRole('combobox', { name: 'Lot Number' })).toHaveValue('');
});
it('resets pagination when a filter changes and clears selected filters', async () => {
  const { get, user } = setup();
  await screen.findByText('LOT-001');
  await user.click(screen.getByRole('button', { name: /next page/i }));
  await waitFor(() =>
    expect(get).toHaveBeenLastCalledWith(
      'reports/lot-progress',
      expect.objectContaining({ params: { page: 1, size: 10, search: '' } }),
    ),
  );
  await user.click(screen.getByRole('combobox', { name: 'Style' }));
  await user.click(await screen.findByRole('option', { name: 'STYLE-01' }));
  await waitFor(() =>
    expect(get).toHaveBeenLastCalledWith(
      'reports/lot-progress',
      expect.objectContaining({
        params: { page: 0, size: 10, search: '', styleId: 's1' },
      }),
    ),
  );
  await user.click(screen.getByRole('button', { name: 'Clear Filters' }));
  await waitFor(() =>
    expect(get).toHaveBeenLastCalledWith(
      'reports/lot-progress',
      expect.objectContaining({ params: { page: 0, size: 10, search: '' } }),
    ),
  );
});
it('collects every options page and sends typed dropdown searches to the backend', async () => {
  const { get, user } = setup();
  get.mockImplementation(async (url, config) => {
    const query = config?.params as ProductionLotsQuery;
    const all = Array.from({ length: 101 }, (_, index) => ({
      id: `s-${index}`,
      style_number: `STYLE-${String(index).padStart(3, '0')}`,
    }));
    const rows = query.search
      ? all.slice(100)
      : all.slice(query.page * query.size, (query.page + 1) * query.size);
    return {
      status: 200,
      data: {
        items: url === 'reports/lot-progress' ? [] : rows,
        page: query.page,
        size: query.size,
        totalElements:
          url === 'reports/lot-progress' ? 0 : query.search ? 1 : 101,
      },
    };
  });
  await user.click(screen.getByRole('combobox', { name: 'Style' }));
  await screen.findByRole('option', { name: 'STYLE-100' });
  expect(get).toHaveBeenLastCalledWith(
    'reports/filter-options/styles',
    expect.objectContaining({ params: { page: 1, size: 100, search: '' } }),
  );
  await user.type(screen.getByRole('combobox', { name: 'Style' }), '100');
  await waitFor(() =>
    expect(get).toHaveBeenLastCalledWith(
      'reports/filter-options/styles',
      expect.objectContaining({
        params: { page: 0, size: 100, search: '100' },
      }),
    ),
  );
});
it('shows option failures with retry and disables an empty dropdown with a message', async () => {
  const { get, user } = setup();
  get.mockImplementation(async (url, config) =>
    url === 'reports/filter-options/styles'
      ? { status: 503, data: { detail: 'Options unavailable' } }
      : {
          status: 200,
          data: {
            items: [],
            page: (config?.params as ProductionLotsQuery)?.page ?? 0,
            size: (config?.params as ProductionLotsQuery)?.size ?? 10,
            totalElements: 0,
          },
        },
  );
  await user.click(screen.getByRole('combobox', { name: 'Style' }));
  expect(await screen.findByText('Options unavailable')).toBeVisible();
  get.mockImplementation(async (_, config) => ({
    status: 200,
    data: {
      items: [],
      page: (config?.params as ProductionLotsQuery)?.page ?? 0,
      size: (config?.params as ProductionLotsQuery)?.size ?? 10,
      totalElements: 0,
    },
  }));
  await user.click(screen.getByRole('button', { name: 'Try again' }));
  expect(
    await screen.findByText('No matching options available.'),
  ).toBeVisible();
  expect(screen.getByRole('combobox', { name: 'Style' })).toBeDisabled();
});
