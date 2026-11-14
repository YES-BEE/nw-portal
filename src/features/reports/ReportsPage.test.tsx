import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { apiClient } from '../../api/client';
import { renderWithProviders } from '../../test/render';
import { dashboardLot } from '../../test/dashboard';
import { ReportsPage } from './ReportsPage';
import { styleProgress } from '../../test/reports';
import type { ListQuery } from '../../api/collections';

beforeEach(() => vi.restoreAllMocks());
it('switches to the style report and displays its server average rather than the completed-lot ratio', async () => {
  const get = vi
    .spyOn(apiClient, 'get')
    .mockImplementation(async (url, config) => ({
      status: 200,
      data: {
        items:
          url === 'reports/style-progress' ? [styleProgress] : [dashboardLot],
        ...(config?.params as ListQuery),
        totalElements: 1,
      },
    }));
  const user = userEvent.setup();
  renderWithProviders(<ReportsPage />);
  await screen.findByText('LOT-001');
  expect(get).not.toHaveBeenCalledWith(
    'reports/style-progress',
    expect.anything(),
  );
  await user.click(screen.getByRole('tab', { name: 'Style Progress' }));
  const row = (await screen.findByText('STYLE-REPORT-01')).closest('tr')!;
  expect(
    within(row).getByRole('progressbar', { name: 'Average Progress' }),
  ).toHaveAttribute('aria-valuenow', '61.11');
  expect(within(row).getByText('3')).toBeVisible();
  expect(within(row).getByText('1')).toBeVisible();
  expect(within(row).getAllByText(/13\/11\/2026/)).toHaveLength(2);
  expect(screen.getByRole('tab', { name: 'Style Progress' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  expect(
    get.mock.calls.every(
      ([url]) =>
        url === 'reports/style-progress' || url === 'reports/lot-progress',
    ),
  ).toBe(true);
});
it('searches and paginates style reports through the backend', async () => {
  const get = vi
    .spyOn(apiClient, 'get')
    .mockImplementation(async (url, config) => ({
      status: 200,
      data: {
        items: url === 'reports/style-progress' ? [styleProgress] : [],
        ...(config?.params as ListQuery),
        totalElements: url === 'reports/style-progress' ? 26 : 0,
      },
    }));
  const user = userEvent.setup();
  renderWithProviders(<ReportsPage />);
  await user.click(screen.getByRole('tab', { name: 'Style Progress' }));
  await screen.findByText('STYLE-REPORT-01');
  await user.click(screen.getByRole('button', { name: /next page/i }));
  await waitFor(() =>
    expect(get).toHaveBeenLastCalledWith(
      'reports/style-progress',
      expect.objectContaining({ params: { page: 1, size: 10, search: '' } }),
    ),
  );
  await user.click(
    await screen.findByRole('combobox', { name: /rows per page/i }),
  );
  await user.click(screen.getByRole('option', { name: '25' }));
  await waitFor(() =>
    expect(get).toHaveBeenLastCalledWith(
      'reports/style-progress',
      expect.objectContaining({ params: { page: 0, size: 25, search: '' } }),
    ),
  );
  await user.type(screen.getByRole('searchbox'), 'draft');
  await waitFor(() =>
    expect(get).toHaveBeenLastCalledWith(
      'reports/style-progress',
      expect.objectContaining({
        params: { page: 0, size: 25, search: 'draft' },
      }),
    ),
  );
});
it('handles empty style reports and server errors with retry', async () => {
  const get = vi.spyOn(apiClient, 'get').mockImplementation(async (url) =>
    url === 'reports/style-progress'
      ? { status: 503, data: { detail: 'Reports unavailable' } }
      : {
          status: 200,
          data: { items: [], page: 0, size: 10, totalElements: 0 },
        },
  );
  const user = userEvent.setup();
  renderWithProviders(<ReportsPage />);
  await user.click(screen.getByRole('tab', { name: 'Style Progress' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Reports unavailable',
  );
  get.mockResolvedValue({
    status: 200,
    data: { items: [], page: 0, size: 10, totalElements: 0 },
  });
  await user.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByText('No styles match this search.')).toBeVisible();
  expect(screen.queryByText('Rows per page:')).not.toBeInTheDocument();
});
it('loads all accessible lots without IDs or management API requests', async () => {
  const get = vi.spyOn(apiClient, 'get').mockResolvedValue({
    status: 200,
    data: { items: [dashboardLot], page: 0, size: 10, totalElements: 1 },
  });
  renderWithProviders(<ReportsPage />);
  const row = within(await screen.findByRole('table', { name: 'Lot Progress' }))
    .getByText('LOT-001')
    .closest('tr')!;
  expect(within(row).getByRole('progressbar')).toHaveAttribute(
    'aria-valuenow',
    '33.33',
  );
  expect(within(row).getByText('1/3')).toBeVisible();
  expect(
    screen.queryByRole('combobox', { name: 'Lot' }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole('tab', { name: 'Style Progress' })).toBeVisible();
  expect(get).toHaveBeenCalledExactlyOnceWith(
    'reports/lot-progress',
    expect.objectContaining({ params: { page: 0, size: 10, search: '' } }),
  );
});
it('handles empty pages without showing pagination', async () => {
  vi.spyOn(apiClient, 'get').mockResolvedValue({
    status: 200,
    data: { items: [], page: 0, size: 10, totalElements: 0 },
  });
  renderWithProviders(<ReportsPage />);
  expect(await screen.findByText('No lots match this search.')).toBeVisible();
  expect(screen.queryByText('Rows per page:')).not.toBeInTheDocument();
});
it('handles service failures, retries, and backend search', async () => {
  const get = vi
    .spyOn(apiClient, 'get')
    .mockResolvedValue({ status: 503, data: '' });
  const user = userEvent.setup();
  renderWithProviders(<ReportsPage />);
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'The report service is temporarily unavailable. Try again.',
  );
  expect(screen.getByRole('alert')).not.toHaveTextContent('503');
  get.mockResolvedValue({
    status: 200,
    data: { items: [], page: 0, size: 10, totalElements: 0 },
  });
  await user.click(screen.getByRole('button', { name: 'Try again' }));
  await screen.findByText('No lots match this search.');
  await user.type(
    screen.getByRole('searchbox', { name: 'Search report' }),
    'washing',
  );
  await waitFor(() =>
    expect(get).toHaveBeenLastCalledWith(
      'reports/lot-progress',
      expect.objectContaining({
        params: { page: 0, size: 10, search: 'washing' },
      }),
    ),
  );
});
it('uses backend pagination and resets the page when size changes', async () => {
  const get = vi
    .spyOn(apiClient, 'get')
    .mockImplementation(async (_, config) => {
      const query = config?.params as { page: number; size: number };
      return {
        status: 200,
        data: {
          items: [{ ...dashboardLot, id: `lot-${query.page}` }],
          page: query.page,
          size: query.size,
          totalElements: 26,
        },
      };
    });
  const user = userEvent.setup();
  renderWithProviders(<ReportsPage />);
  await screen.findByText('LOT-001');
  await user.click(screen.getByRole('button', { name: /next page/i }));
  await waitFor(() =>
    expect(get).toHaveBeenLastCalledWith(
      'reports/lot-progress',
      expect.objectContaining({ params: { page: 1, size: 10, search: '' } }),
    ),
  );
  await user.click(
    await screen.findByRole('combobox', { name: /rows per page/i }),
  );
  await user.click(screen.getByRole('option', { name: '25' }));
  await waitFor(() =>
    expect(get).toHaveBeenLastCalledWith(
      'reports/lot-progress',
      expect.objectContaining({ params: { page: 0, size: 25, search: '' } }),
    ),
  );
});
it('aborts an in-flight report on unmount', async () => {
  let signal: AbortSignal | undefined;
  vi.spyOn(apiClient, 'get').mockImplementation((_, config) => {
    signal = config?.signal as AbortSignal;
    return new Promise(() => {});
  });
  const { unmount } = renderWithProviders(<ReportsPage />);
  await waitFor(() => expect(signal).toBeDefined());
  unmount();
  expect(signal?.aborted).toBe(true);
});
