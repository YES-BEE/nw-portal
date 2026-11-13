import { act, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { apiClient } from '../../api/client';
import { renderWithProviders } from '../../test/render';
import { dashboardLot } from '../../test/dashboard';
import { DashboardLotDetailsDialog } from './DashboardLotDetailsDialog';

beforeEach(() => {
  vi.spyOn(apiClient, 'get').mockResolvedValue({
    status: 200,
    data: dashboardLot,
  });
});
afterEach(() => vi.useRealTimers());
it('shows a backend permission failure without exposing details or management actions', async () => {
  vi.mocked(apiClient.get).mockResolvedValue({
    status: 403,
    data: { detail: 'This lot is outside your access' },
  });
  renderWithProviders(
    <DashboardLotDetailsDialog
      id="lot-id"
      stations={[]}
      pollIntervalMs={5000}
      onClose={vi.fn()}
    />,
  );
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'This lot is outside your access',
  );
  expect(screen.getByRole('alert')).not.toHaveTextContent('403');
  expect(screen.queryByText('STY-001')).not.toBeInTheDocument();
  expect(screen.getAllByRole('button')).toHaveLength(1);
  expect(screen.getByRole('button', { name: 'Close' })).toBeEnabled();
});
it('polls the read-only detail endpoint and stops requests when closed', async () => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  const { unmount } = renderWithProviders(
    <DashboardLotDetailsDialog
      id="lot-id"
      stations={[]}
      pollIntervalMs={5000}
      onClose={vi.fn()}
    />,
  );
  await screen.findByText('STY-001');
  await act(async () => {
    await vi.advanceTimersByTimeAsync(5000);
  });
  expect(apiClient.get).toHaveBeenCalledTimes(2);
  const signal = vi.mocked(apiClient.get).mock.calls[1][1]?.signal;
  unmount();
  expect(signal?.aborted).toBe(true);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(5000);
  });
  expect(apiClient.get).toHaveBeenCalledTimes(2);
});
