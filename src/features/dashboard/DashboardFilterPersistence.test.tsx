import type { ListQuery } from '../../api/collections';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { apiClient } from '../../api/client';
import { renderWithProviders } from '../../test/render';
import { loginResponse, refreshTokenResponse } from '../../test/auth';
import { dashboardLot } from '../../test/dashboard';
import { setAuthenticatedSession } from '../auth/session';
import { DashboardLotsTable } from './DashboardLotsTable';
import {
  readDashboardFilters,
  saveDashboardFilters,
} from './dashboardFilterStorage';
import { emptyProductionFilters } from '../lots/productionFilterSelection';

beforeEach(() => {
  sessionStorage.clear();
  setAuthenticatedSession({
    user: {
      id: 'dashboard-user',
      username: 'dashboard-user',
      role: 'NW',
      status: 'Active',
    },
    modules: ['dashboard'],
    authentication: loginResponse,
    refreshToken: refreshTokenResponse.refreshToken,
    refreshTokenExpiresAt: refreshTokenResponse.expiresAt,
  });
  vi.spyOn(apiClient, 'get').mockImplementation(async (_url, config) => ({
    status: 200,
    data: {
      items: [dashboardLot],
      page: (config?.params as ListQuery).page,
      size: (config?.params as ListQuery).size,
      totalElements: 60,
    },
  }));
});
const setup = () =>
  renderWithProviders(
    <DashboardLotsTable
      statuses={['IN_PROCESS']}
      stations={[]}
      pollIntervalMs={0}
      onHealthChange={() => {}}
    />,
  );
it('restores all filters and the query on remount and sends them in the first request', async () => {
  saveDashboardFilters('dashboard-user', {
    selection: {
      ...emptyProductionFilters,
      styles: { id: 's1', label: 'STYLE-01' },
      lots: { id: 'l1', label: 'LOT-01' },
      stations: { id: 'st1', label: 'Washing' },
      processes: { id: 'p1', label: 'Wash' },
      status: 'IN_PROCESS',
    },
    query: { page: 1, size: 25, search: 'denim' },
  });
  const first = setup();
  await screen.findByText(dashboardLot.lot_number);
  for (const [label, value] of [
    ['Style', 'STYLE-01'],
    ['Lot Number', 'LOT-01'],
    ['Station', 'Washing'],
    ['Process', 'Wash'],
  ]) {
    expect(screen.getByRole('combobox', { name: label })).toHaveValue(value);
  }
  const expected = {
    page: 1,
    size: 25,
    search: 'denim',
    styleId: 's1',
    lotId: 'l1',
    stationId: 'st1',
    processId: 'p1',
    status: 'IN_PROCESS',
  };
  expect(apiClient.get).toHaveBeenLastCalledWith(
    'dashboard/lots',
    expect.objectContaining({ params: expected }),
  );
  fireEvent.change(screen.getByRole('searchbox'), {
    target: { value: 'cotton' },
  });
  first.unmount();
  setup();
  await waitFor(() =>
    expect(apiClient.get).toHaveBeenLastCalledWith(
      'dashboard/lots',
      expect.objectContaining({
        params: { ...expected, page: 0, search: 'cotton' },
      }),
    ),
  );
  expect(screen.getByRole('searchbox')).toHaveValue('cotton');
  expect(
    screen.queryByRole('combobox', { name: 'Route Matching' }),
  ).not.toBeInTheDocument();
});
it('persists clearing the structured filters when leaving and returning', async () => {
  saveDashboardFilters('dashboard-user', {
    selection: {
      ...emptyProductionFilters,
      status: 'IN_PROCESS',
    },
    query: { page: 0, size: 10, search: '' },
  });
  const first = setup();
  await userEvent.click(screen.getByRole('button', { name: 'Clear Filters' }));
  expect(readDashboardFilters('dashboard-user').selection).toEqual(
    emptyProductionFilters,
  );
  first.unmount();
  setup();
  await waitFor(() =>
    expect(apiClient.get).toHaveBeenLastCalledWith(
      'dashboard/lots',
      expect.objectContaining({ params: { page: 0, size: 10, search: '' } }),
    ),
  );
});

it('preserves all other filters when status changes and persists the combined request', async () => {
  const selection = {
    ...emptyProductionFilters,
    styles: { id: 's1', label: 'STYLE-01' },
    lots: { id: 'l1', label: 'LOT-01' },
    stations: { id: 'st1', label: 'Washing' },
    processes: { id: 'p1', label: 'Wash' },
  };
  saveDashboardFilters('dashboard-user', {
    selection,
    query: { page: 1, size: 25, search: 'denim' },
  });
  setup();
  await screen.findByText(dashboardLot.lot_number);
  const user = userEvent.setup();
  await user.click(screen.getByRole('combobox', { name: 'Status' }));
  await user.click(screen.getByRole('option', { name: 'In Process' }));
  await waitFor(() =>
    expect(apiClient.get).toHaveBeenLastCalledWith(
      'dashboard/lots',
      expect.objectContaining({
        params: {
          page: 0,
          size: 25,
          search: 'denim',
          styleId: 's1',
          lotId: 'l1',
          stationId: 'st1',
          processId: 'p1',

          status: 'IN_PROCESS',
        },
      }),
    ),
  );
  expect(readDashboardFilters('dashboard-user').selection).toEqual({
    ...selection,
    status: 'IN_PROCESS',
  });
  await user.click(screen.getByRole('combobox', { name: 'Status' }));
  await user.click(screen.getByRole('option', { name: 'All statuses' }));
  await waitFor(() =>
    expect(readDashboardFilters('dashboard-user').selection).toEqual(selection),
  );
});
