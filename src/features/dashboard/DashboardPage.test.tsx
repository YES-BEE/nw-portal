import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { apiClient } from '../../api/client';
import { renderWithProviders } from '../../test/render';
import {
  dashboardLot,
  dashboardResponse,
  emptyDashboard,
} from '../../test/dashboard';
import { seedTestData, signIn } from '../../test/fixtures';
import { readSession, setAuthenticatedSession } from '../auth/session';
import type { ListQuery } from '../../api/collections';
import { DashboardPage } from './DashboardPage';
import { getDashboardPollIntervalMs } from './dashboardConfig';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

beforeEach(() => {
  vi.spyOn(apiClient, 'get').mockImplementation(async (url, config) => {
    if (url === 'dashboard') return { status: 200, data: dashboardResponse };
    const query = config?.params as ListQuery & { status?: string };
    return {
      status: 200,
      data: {
        items:
          query.status && query.status !== dashboardLot.status
            ? []
            : [dashboardLot],
        page: query.page,
        size: query.size,
        totalElements:
          query.status && query.status !== dashboardLot.status ? 0 : 1,
      },
    };
  });
});
function setup() {
  return {
    user: userEvent.setup(),
    ...renderWithProviders(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    ),
  };
}
it('renders server summary metrics, status charts, station WIP, and live lot data', async () => {
  setup();
  await screen.findByRole('region', { name: 'Total Lots' });
  for (const [label, value] of [
    ['Total Lots', '9'],
    ['Open Lots', '6'],
    ['Completed Lots', '2'],
    ['Styles with Lots', '3'],
    ['Stored Lots', '1'],
    ['Available Trolleys', '5'],
  ]) {
    expect(
      within(screen.getByRole('region', { name: label })).getByText(value),
    ).toBeVisible();
  }
  expect(screen.getByRole('region', { name: 'Lots by Status' })).toBeVisible();
  expect(
    within(
      screen.getByRole('region', { name: 'Station Work in Progress' }),
    ).getByText('Washing'),
  ).toBeVisible();
  expect(screen.queryByText('03 — Washing')).not.toBeInTheDocument();
  const table = screen.getByRole('table', { name: 'Production Lots' });
  expect(
    await within(table).findByRole('rowheader', { name: 'LOT-001' }),
  ).toBeVisible();
  expect(within(table).getAllByText('Washing')).toHaveLength(2);
  expect(within(table).queryByText('03')).not.toBeInTheDocument();
  expect(within(table).getByText(/12\/11\/2026/)).toBeVisible();
  expect(screen.queryByText('lot-id')).not.toBeInTheDocument();
  expect(screen.queryByText('station-03')).not.toBeInTheDocument();
  expect(
    screen.queryByRole('link', { name: 'View lot LOT-001' }),
  ).not.toBeInTheDocument();
});
it('filters lots through clickable status counts and the backend status query', async () => {
  const { user } = setup();
  await user.click(
    await screen.findByRole('button', { name: 'In Process: 1' }),
  );
  await waitFor(() =>
    expect(apiClient.get).toHaveBeenCalledWith(
      'dashboard/lots',
      expect.objectContaining({
        params: { page: 0, size: 10, search: '', status: 'IN_PROCESS' },
      }),
    ),
  );
  expect(screen.getByRole('button', { name: 'In Process: 1' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await user.click(screen.getByRole('button', { name: 'In Process: 1' }));
  await waitFor(() =>
    expect(apiClient.get).toHaveBeenLastCalledWith(
      'dashboard/lots',
      expect.objectContaining({ params: { page: 0, size: 10, search: '' } }),
    ),
  );
});
it('sends search, page size and page changes to the backend', async () => {
  const get = vi.mocked(apiClient.get).getMockImplementation()!;
  vi.mocked(apiClient.get).mockImplementation(async (url, config) =>
    url === 'dashboard'
      ? get(url, config)
      : {
          status: 200,
          data: {
            items: [dashboardLot],
            ...(config?.params as ListQuery),
            totalElements: 31,
          },
        },
  );
  const { user } = setup();
  await screen.findByRole('rowheader', { name: 'LOT-001' });
  await user.click(screen.getByRole('button', { name: 'Go to next page' }));
  await waitFor(() =>
    expect(apiClient.get).toHaveBeenCalledWith(
      'dashboard/lots',
      expect.objectContaining({ params: { page: 1, size: 10, search: '' } }),
    ),
  );
  await user.click(
    await screen.findByRole('combobox', { name: 'Rows per page:' }),
  );
  await user.click(screen.getByRole('option', { name: '25' }));
  await waitFor(() =>
    expect(apiClient.get).toHaveBeenCalledWith(
      'dashboard/lots',
      expect.objectContaining({ params: { page: 0, size: 25, search: '' } }),
    ),
  );
  await user.type(screen.getByRole('searchbox'), 'Washing');
  await waitFor(() =>
    expect(apiClient.get).toHaveBeenCalledWith(
      'dashboard/lots',
      expect.objectContaining({
        params: { page: 0, size: 25, search: 'Washing' },
      }),
    ),
  );
});
it('handles empty successful data with zero metrics and no table pagination', async () => {
  vi.mocked(apiClient.get).mockImplementation(async (url) => ({
    status: 200,
    data: url === 'dashboard' ? emptyDashboard : [],
  }));
  setup();
  await screen.findByRole('region', { name: 'Total Lots' });
  expect(
    within(screen.getByRole('region', { name: 'Total Lots' })).getByText('0'),
  ).toBeVisible();
  expect(
    await within(screen.getByRole('table')).findByText('No lots found.'),
  ).toBeVisible();
  expect(screen.queryByText('Rows per page:')).not.toBeInTheDocument();
  expect(
    screen.getByText('No stations available to your account.'),
  ).toBeVisible();
  expect(screen.queryByText(/unexpected response/)).not.toBeInTheDocument();
});
it('keeps lots available when summary fails and supports a summary retry', async () => {
  const get = vi.mocked(apiClient.get).getMockImplementation()!;
  let failed = true;
  vi.mocked(apiClient.get).mockImplementation(async (url, config) =>
    url === 'dashboard' && failed
      ? { status: 503, data: { detail: 'Summary temporarily unavailable' } }
      : get(url, config),
  );
  const { user } = setup();
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Summary temporarily unavailable',
  );
  expect(screen.getByRole('alert')).not.toHaveTextContent('503');
  expect(
    await screen.findByRole('rowheader', { name: 'LOT-001' }),
  ).toBeVisible();
  failed = false;
  await user.click(screen.getByRole('button', { name: 'Try again' }));
  expect(
    await screen.findByRole('region', { name: 'Total Lots' }),
  ).toBeVisible();
});
it('keeps summary metrics visible when the lot request is forbidden', async () => {
  vi.mocked(apiClient.get).mockImplementation(async (url) => ({
    status: url === 'dashboard' ? 200 : 403,
    data:
      url === 'dashboard'
        ? dashboardResponse
        : { detail: 'Lot listing unavailable to this account' },
  }));
  setup();
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Lot listing unavailable to this account',
  );
  expect(
    await screen.findByRole('region', { name: 'Total Lots' }),
  ).toBeVisible();
});
it('shows lot details with the lots module and polls both APIs at the configured interval', async () => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  vi.stubEnv('VITE_DASHBOARD_POLL_INTERVAL_SECONDS', '10');
  seedTestData();
  signIn('nw.admin');
  setAuthenticatedSession({
    ...readSession()!,
    modules: ['dashboard', 'lots'],
  });
  const { unmount } = setup();
  expect(
    await screen.findByRole('link', { name: 'View lot LOT-001' }),
  ).toHaveAttribute('href', '/lots/lot-id');
  await screen.findByRole('region', { name: 'Total Lots' });
  const before = vi.mocked(apiClient.get).mock.calls.length;
  expect(
    screen.queryByRole('button', { name: 'Refresh' }),
  ).not.toBeInTheDocument();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(9999);
  });
  expect(apiClient.get).toHaveBeenCalledTimes(before);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1);
  });
  expect(apiClient.get).toHaveBeenCalledTimes(before + 2);
  expect(screen.getByRole('rowheader', { name: 'LOT-001' })).toBeVisible();
  unmount();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(10000);
  });
  expect(apiClient.get).toHaveBeenCalledTimes(before + 2);
});
it('retains search filters while polling and respects a different configured interval', async () => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  vi.stubEnv('VITE_DASHBOARD_POLL_INTERVAL_SECONDS', '5');
  const { user } = setup();
  await screen.findByRole('rowheader', { name: 'LOT-001' });
  await user.type(screen.getByRole('searchbox'), 'LOT');
  await waitFor(() =>
    expect(apiClient.get).toHaveBeenCalledWith(
      'dashboard/lots',
      expect.objectContaining({ params: { page: 0, size: 10, search: 'LOT' } }),
    ),
  );
  const before = vi.mocked(apiClient.get).mock.calls.length;
  await act(async () => {
    await vi.advanceTimersByTimeAsync(5000);
  });
  expect(apiClient.get).toHaveBeenCalledTimes(before + 2);
  expect(screen.getByRole('searchbox')).toHaveValue('LOT');
  expect(apiClient.get).toHaveBeenLastCalledWith(
    'dashboard/lots',
    expect.objectContaining({ params: { page: 0, size: 10, search: 'LOT' } }),
  );
});
it('does not overlap requests if an earlier poll is still pending', async () => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  vi.stubEnv('VITE_DASHBOARD_POLL_INTERVAL_SECONDS', '10');
  vi.mocked(apiClient.get).mockReturnValue(new Promise(() => {}));
  setup();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(30000);
  });
  expect(apiClient.get).toHaveBeenCalledTimes(2);
});
it.each([undefined, '', '0', '-1', 'bad', 'Infinity'])(
  'falls back to ten seconds for invalid polling config %s',
  (value) => {
    vi.stubEnv('VITE_DASHBOARD_POLL_INTERVAL_SECONDS', value);
    expect(getDashboardPollIntervalMs()).toBe(10000);
  },
);
it('aborts summary and lot requests on unmount', () => {
  vi.mocked(apiClient.get).mockReturnValue(new Promise(() => {}));
  const { unmount } = setup();
  const signals = vi
    .mocked(apiClient.get)
    .mock.calls.map((call) => call[1]?.signal);
  unmount();
  expect(signals).toHaveLength(2);
  expect(signals.every((signal) => signal?.aborted)).toBe(true);
});
