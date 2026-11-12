import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { apiClient } from '../../api/client';
import { renderWithProviders } from '../../test/render';
import { styleHistoryItem } from '../../test/styles';
import { StyleRevisionHistory } from './StyleRevisionHistory';

beforeEach(() => {
  vi.spyOn(apiClient, 'get').mockImplementation(async (_url, config) => ({
    status: 200,
    data: {
      items: [styleHistoryItem],
      ...(config?.params as { page: number; size: number; search: string }),
      totalElements: 11,
    },
  }));
});
it('shows revision metadata, raw role codes and formatted dates without UUIDs', async () => {
  renderWithProviders(<StyleRevisionHistory styleId="style-id" />);
  expect(await screen.findByText(styleHistoryItem.reason)).toBeVisible();
  expect(screen.getByText('production_manager')).toBeVisible();
  expect(screen.getByText(/12\/11\/2026/)).toBeVisible();
  expect(screen.queryByText(styleHistoryItem.actor_id)).not.toBeInTheDocument();
  expect(screen.queryByText(styleHistoryItem.id)).not.toBeInTheDocument();
});
it('sends search, page and size changes to the revision endpoint', async () => {
  const user = userEvent.setup();
  renderWithProviders(<StyleRevisionHistory styleId="style-id" />);
  await screen.findByText(styleHistoryItem.reason);
  await user.click(screen.getByRole('button', { name: 'Go to next page' }));
  await waitFor(() =>
    expect(apiClient.get).toHaveBeenCalledWith(
      'styles/style-id/revisions',
      expect.objectContaining({ params: { page: 1, size: 10, search: '' } }),
    ),
  );
  await user.click(
    await screen.findByRole('combobox', { name: 'Rows per page:' }),
  );
  await user.click(screen.getByRole('option', { name: '25' }));
  await waitFor(() =>
    expect(apiClient.get).toHaveBeenCalledWith(
      'styles/style-id/revisions',
      expect.objectContaining({ params: { page: 0, size: 25, search: '' } }),
    ),
  );
  await user.type(screen.getByRole('searchbox'), 'Improve');
  await waitFor(() =>
    expect(apiClient.get).toHaveBeenCalledWith(
      'styles/style-id/revisions',
      expect.objectContaining({
        params: { page: 0, size: 25, search: 'Improve' },
      }),
    ),
  );
});
it('handles an empty successful response without pagination', async () => {
  vi.mocked(apiClient.get).mockResolvedValue({ status: 200, data: [] });
  renderWithProviders(<StyleRevisionHistory styleId="style-id" />);
  expect(await screen.findByText('No revisions recorded.')).toBeVisible();
  expect(screen.queryByText('Rows per page:')).not.toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
it('preserves backend errors and retries history independently', async () => {
  vi.mocked(apiClient.get).mockResolvedValueOnce({
    status: 503,
    data: { detail: 'History temporarily unavailable' },
  });
  const user = userEvent.setup();
  renderWithProviders(<StyleRevisionHistory styleId="style-id" />);
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'History temporarily unavailable',
  );
  expect(screen.getByRole('alert')).not.toHaveTextContent('503');
  await user.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByText(styleHistoryItem.reason)).toBeVisible();
});
