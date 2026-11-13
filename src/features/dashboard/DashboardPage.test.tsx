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
it('renders server summary metrics, station WIP, and live lot data', async () => {
  setup();
  await screen.findByRole('region', { name: 'Total Lots' });
  for (const [label, value] of [
    ['Total Lots', '9'],
    ['Open Lots', '6'],
    ['Completed Lots', '2'],
    ['Styles', '3'],
    ['Stored Lots', '1'],
    ['Available Trolleys', '5'],
  ]) {
    expect(
      within(screen.getByRole('region', { name: label })).getByText(value),
    ).toBeVisible();
  }
  expect(
    screen.queryByRole('region', { name: 'Lots by Status' }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('region', { name: 'Styles by Status' }),
  ).not.toBeInTheDocument();
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
it('shows backend snapshot time without location columns or dashboard lot actions', async () => {
  seedTestData();
  signIn('nw.admin');
  setAuthenticatedSession({ ...readSession()!, modules: ['dashboard'] });
  vi.stubEnv('VITE_FACTORY_TIME_ZONE', 'Asia/Kolkata');
  setup();
  expect(await screen.findByText('Updated 13/11/2026, 13:30:00')).toBeVisible();
  const table = screen.getByRole('table', { name: 'Production Lots' });
  expect(within(table).queryByText('In progress')).not.toBeInTheDocument();
  expect(within(table).getAllByText('Washing')).toHaveLength(2);
  expect(within(table).queryByRole('columnheader', { name: 'Location' })).not.toBeInTheDocument();
  expect(
    within(table).queryByRole('button', { name: 'View lot LOT-001' }),
  ).not.toBeInTheDocument();
  expect(
    within(table).queryByRole('columnheader', { name: 'Actions' }),
  ).not.toBeInTheDocument();
});
it.each(['summary', 'lots'])(
  'retains previous values and timestamp and marks live updates stale after a %s refresh failure',
  async (target) => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const { unmount } = setup();
    await screen.findByText('Live updates');
    const timestamp = screen.getByText(/^Updated /).textContent;
    const original = vi.mocked(apiClient.get).getMockImplementation()!;
    vi.mocked(apiClient.get).mockImplementation((url, config) =>
      (target === 'summary' ? url === 'dashboard' : url === 'dashboard/lots')
        ? Promise.resolve({
            status: 503,
            data: { detail: 'Refresh unavailable' },
          })
        : original(url, config),
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(
      screen.getByText('Updates unavailable · showing last data'),
    ).toBeVisible();
    expect(screen.getByText(/^Updated /).textContent).toBe(timestamp);
    expect(
      within(screen.getByRole('region', { name: 'Total Lots' })).getByText('9'),
    ).toBeVisible();
    expect(screen.getByRole('rowheader', { name: 'LOT-001' })).toBeVisible();
    vi.mocked(apiClient.get).mockImplementation(original);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(screen.getByText('Live updates')).toBeVisible();
    unmount();
  },
);
it('filters lots through the status dropdown and the backend status query', async () => {
  const { user } = setup();
  await user.click(await screen.findByRole('combobox', { name: 'Status' }));
  await user.click(screen.getByRole('option', { name: 'In Process' }));
  await waitFor(() =>
    expect(apiClient.get).toHaveBeenCalledWith(
      'dashboard/lots',
      expect.objectContaining({
        params: { page: 0, size: 10, search: '', status: 'IN_PROCESS' },
      }),
    ),
  );
  await user.click(screen.getByRole('combobox', { name: 'Status' }));
  await user.click(screen.getByRole('option', { name: 'All statuses' }));
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
it('polls both APIs using only the backend interval', async () => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  seedTestData();
  signIn('nw.admin');
  setAuthenticatedSession({
    ...readSession()!,
    modules: ['dashboard', 'lots'],
  });
  const { unmount } = setup();
  expect(
    await screen.findByRole('rowheader', { name: 'LOT-001' }),
  ).toBeVisible();
  await screen.findByRole('region', { name: 'Total Lots' });
  const before = vi.mocked(apiClient.get).mock.calls.length;
  expect(
    screen.queryByRole('button', { name: 'Refresh' }),
  ).not.toBeInTheDocument();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(4999);
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
it('retains search filters while polling and uses the response interval', async () => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
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
  expect(
    vi
      .mocked(apiClient.get)
      .mock.calls.filter(([url]) => url === 'dashboard/lots')
      .at(-1),
  ).toEqual([
    'dashboard/lots',
    expect.objectContaining({ params: { page: 0, size: 10, search: 'LOT' } }),
  ]);
});
it('does not start polling until the response provides an interval', async () => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  vi.mocked(apiClient.get).mockReturnValue(new Promise(() => {}));
  setup();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(30000);
  });
  expect(apiClient.get).toHaveBeenCalledTimes(2);
});
it('reschedules summary and lot polling when the response interval changes', async () => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  const original = vi.mocked(apiClient.get).getMockImplementation()!;
  let seconds = 5;
  vi.mocked(apiClient.get).mockImplementation(async (url, config) =>
    url === 'dashboard'
      ? {
          status: 200,
          data: { ...dashboardResponse, refreshIntervalSeconds: seconds },
        }
      : original(url, config),
  );
  setup();
  await screen.findByText('Live updates');
  const before = vi.mocked(apiClient.get).mock.calls.length;
  seconds = 2;
  await act(async () => {
    await vi.advanceTimersByTimeAsync(5000);
  });
  expect(apiClient.get).toHaveBeenCalledTimes(before + 2);
  expect(
    screen.queryByText(/Updates every \d+ seconds/),
  ).not.toBeInTheDocument();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1999);
  });
  expect(apiClient.get).toHaveBeenCalledTimes(before + 2);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1);
  });
  expect(apiClient.get).toHaveBeenCalledTimes(before + 4);
});
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
