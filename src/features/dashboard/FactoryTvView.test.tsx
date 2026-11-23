import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { apiClient } from '../../api/client';
import type { ListQuery } from '../../api/collections';
import { renderWithProviders } from '../../test/render';
import { dashboardLot, dashboardResponse } from '../../test/dashboard';
import { DashboardPage } from './DashboardPage';
import { FactoryTvView } from './FactoryTvView';
import { getDisplayLots } from './dashboardApi';

beforeEach(() => {
  vi.spyOn(apiClient, 'get').mockImplementation(async (url, config) => {
    if (url === 'dashboard' || url === 'displays/factory-summary')
      return { status: 200, data: dashboardResponse };
    const query = config?.params as ListQuery;
    return {
      status: 200,
      data: {
        items: [
          {
            ...dashboardLot,
            id: `lot-${query.page}`,
            lot_number: `TV-LOT-${query.page}`,
          },
        ],
        page: query.page,
        size: query.size,
        totalElements: 7,
      },
    };
  });
  vi.spyOn(apiClient, 'post').mockImplementation((url, body, config) =>
    vi.mocked(apiClient.get).getMockImplementation()!(url, {
      ...config,
      params: body,
    }),
  );
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it('switches the dashboard to display APIs and exits back to the dashboard', async () => {
  const user = userEvent.setup();
  renderWithProviders(<DashboardPage />);
  await user.click(screen.getByRole('button', { name: 'TV view' }));
  await screen.findByRole('heading', { name: 'Factory production · TV' });
  await screen.findByText('TV-LOT-0');
  expect(apiClient.get).toHaveBeenCalledWith(
    'displays/factory-summary',
    expect.anything(),
  );
  expect(apiClient.get).toHaveBeenCalledWith(
    'displays/lots',
    expect.objectContaining({ params: { page: 0, size: 6, search: '' } }),
  );
  await user.click(screen.getByRole('button', { name: 'Exit TV view' }));
  expect(screen.getByRole('button', { name: 'TV view' })).toBeVisible();
  expect(
    screen.queryByRole('heading', { name: 'Factory production · TV' }),
  ).not.toBeInTheDocument();
});

it('refreshes at the backend interval, rotates lot pages, and retains stale data on errors', async () => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  const { unmount } = renderWithProviders(<FactoryTvView onExit={vi.fn()} />);
  await screen.findByText('TV-LOT-0');
  await act(async () => {
    vi.advanceTimersByTime(15000);
  });
  await screen.findByText('TV-LOT-1');
  expect(apiClient.get).toHaveBeenCalledWith(
    'displays/lots',
    expect.objectContaining({ params: { page: 1, size: 6, search: '' } }),
  );
  vi.mocked(apiClient.get).mockResolvedValue({
    status: 503,
    data: { detail: 'Display temporarily unavailable' },
  });
  await act(async () => {
    vi.advanceTimersByTime(5000);
  });
  await screen.findByText('Updates interrupted');
  expect(screen.getByText('TV-LOT-1')).toBeVisible();
  unmount();
  const calls = vi.mocked(apiClient.get).mock.calls.length;
  await act(async () => {
    vi.advanceTimersByTime(30000);
  });
  expect(apiClient.get).toHaveBeenCalledTimes(calls);
});

it('aborts display requests when TV view closes', async () => {
  const signals: AbortSignal[] = [];
  vi.mocked(apiClient.get).mockImplementation((_, config) => {
    signals.push(config?.signal as AbortSignal);
    return new Promise(() => {});
  });
  const { unmount } = renderWithProviders(<FactoryTvView onExit={vi.fn()} />);
  await waitFor(() => expect(signals).toHaveLength(2));
  unmount();
  expect(signals.every((signal) => signal.aborted)).toBe(true);
});

it('rejects malformed display lot responses', async () => {
  vi.mocked(apiClient.get).mockResolvedValue({
    status: 200,
    data: {
      items: [{ ...dashboardLot, progress_percent: 101 }],
      page: 0,
      size: 6,
      totalElements: 1,
    },
  });
  await expect(
    getDisplayLots({ page: 0, size: 6, search: '' }),
  ).rejects.toMatchObject({ failure: { kind: 'invalidResponse' } });
});
