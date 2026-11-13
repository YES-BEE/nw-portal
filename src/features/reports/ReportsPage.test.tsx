import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { apiClient } from '../../api/client';
import { renderWithProviders } from '../../test/render';
import { dashboardLot } from '../../test/dashboard';
import { ReportsPage } from './ReportsPage';
import { useSession } from '../auth/useSession';
import type { AuthSession } from '../auth/session';

vi.mock('../auth/useSession', () => ({ useSession: vi.fn() }));
const lotId = '3831c086-af15-4106-a0bc-dfe4d9d1a0c1';
const session: AuthSession = {
  user: {
    id: 'report-user',
    username: 'report-user',
    role: 'REPORT_VIEWER',
    status: 'Active',
  },
  modules: ['reports'],
};
beforeEach(() => {
  vi.restoreAllMocks();
  vi.mocked(useSession).mockReturnValue(session);
});
it('validates IDs before requesting a report and hides pagination for empty results', async () => {
  const get = vi.spyOn(apiClient, 'get').mockResolvedValue({
    status: 200,
    data: { items: [], page: 0, size: 10, totalElements: 0 },
  });
  const user = userEvent.setup();
  renderWithProviders(<ReportsPage />);
  await user.click(screen.getByRole('button', { name: 'View Report' }));
  expect(
    screen.getByText('Select a record or enter a valid record ID.'),
  ).toBeVisible();
  expect(get).not.toHaveBeenCalled();
  await user.type(screen.getByRole('combobox', { name: 'Lot' }), lotId);
  await user.click(screen.getByRole('button', { name: 'View Report' }));
  expect(
    await screen.findByText('No history found for this lot and search.'),
  ).toBeVisible();
  expect(screen.queryByText('Rows per page:')).not.toBeInTheDocument();
});
it('shows safe fallback errors without HTTP codes, retries, and searches on the backend', async () => {
  const get = vi
    .spyOn(apiClient, 'get')
    .mockResolvedValue({ status: 503, data: '' });
  const user = userEvent.setup();
  renderWithProviders(<ReportsPage />);
  await user.type(screen.getByRole('combobox', { name: 'Lot' }), lotId);
  await user.click(screen.getByRole('button', { name: 'View Report' }));
  expect(await screen.findByRole('alert')).not.toHaveTextContent('503');
  get.mockResolvedValue({
    status: 200,
    data: { items: [], page: 0, size: 10, totalElements: 0 },
  });
  await user.click(screen.getByRole('button', { name: 'Try again' }));
  await screen.findByRole('table', { name: 'Lot History' });
  await user.type(
    screen.getByRole('searchbox', { name: 'Search report' }),
    'storage',
  );
  await waitFor(() =>
    expect(get).toHaveBeenLastCalledWith(
      'reports/lot-history',
      expect.objectContaining({
        params: { page: 0, size: 10, search: 'storage', lotId },
      }),
    ),
  );
});
it('sends page and page-size changes to the report endpoint', async () => {
  const get = vi
    .spyOn(apiClient, 'get')
    .mockImplementation(async (_, config) => {
      const query = config?.params as { page: number; size: number };
      return {
        status: 200,
        data: {
          items: Array.from(
            { length: Math.min(query.size, 26 - query.page * query.size) },
            (_, index) => ({
              id: `event-${query.page * query.size + index}`,
              location_type: 'TROLLEY',
              location_id: null,
              actor_id: null,
              occurred_at: dashboardLot.created_at,
              detail: {},
            }),
          ),
          page: query.page,
          size: query.size,
          totalElements: 26,
        },
      };
    });
  const user = userEvent.setup();
  renderWithProviders(<ReportsPage />);
  await user.type(screen.getByRole('combobox', { name: 'Lot' }), lotId);
  await user.click(screen.getByRole('button', { name: 'View Report' }));
  await screen.findByRole('table', { name: 'Lot History' });
  await user.click(screen.getByRole('button', { name: /next page/i }));
  await waitFor(() =>
    expect(get).toHaveBeenLastCalledWith(
      'reports/lot-history',
      expect.objectContaining({
        params: { page: 1, size: 10, search: '', lotId },
      }),
    ),
  );
  await user.click(
    await screen.findByRole('combobox', { name: /rows per page/i }),
  );
  await user.click(screen.getByRole('option', { name: '25' }));
  await waitFor(() =>
    expect(get).toHaveBeenLastCalledWith(
      'reports/lot-history',
      expect.objectContaining({
        params: { page: 0, size: 25, search: '', lotId },
      }),
    ),
  );
});

it('aborts an in-flight report when leaving the screen', async () => {
  let signal: AbortSignal | undefined;
  vi.spyOn(apiClient, 'get').mockImplementation((_, config) => {
    signal = config?.signal as AbortSignal;
    return new Promise(() => {});
  });
  const user = userEvent.setup();
  const { unmount } = renderWithProviders(<ReportsPage />);
  await user.type(screen.getByRole('combobox', { name: 'Lot' }), lotId);
  await user.click(screen.getByRole('button', { name: 'View Report' }));
  await waitFor(() => expect(signal).toBeDefined());
  unmount();
  expect(signal?.aborted).toBe(true);
});
