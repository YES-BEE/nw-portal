import {
  act,
  screen,
  waitForElementToBeRemoved,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { apiClient } from '../../api/client';
import { renderWithProviders } from '../../test/render';
import { lotQcResponse } from '../../test/lots';
import { LotQcResults } from './LotQcResults';

beforeEach(() => {
  vi.spyOn(apiClient, 'get').mockResolvedValue({
    status: 200,
    data: lotQcResponse,
  });
  vi.spyOn(apiClient, 'post');
});
it('displays read-only quantities, outcome, remarks and date without UUIDs', async () => {
  renderWithProviders(<LotQcResults lotId="lot-id" />);
  const section = screen.getByRole('region', { name: 'QC Results' });
  expect(await within(section).findByText('Partially Rejected')).toBeVisible();
  for (const value of ['200', '198', '2', 'Two damaged pieces'])
    expect(within(section).getByText(value)).toBeVisible();
  expect(within(section).getByText(/12\/11\/2026/)).toBeVisible();
  expect(screen.queryByText(lotQcResponse.id)).not.toBeInTheDocument();
  expect(
    screen.queryByText(lotQcResponse.operator_id!),
  ).not.toBeInTheDocument();
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
  expect(apiClient.post).not.toHaveBeenCalled();
});
it('shows a neutral message when the backend has no inspection', async () => {
  vi.mocked(apiClient.get).mockResolvedValue({
    status: 404,
    data: { code: 'NOT_FOUND', detail: 'Requested resource was not found' },
  });
  renderWithProviders(<LotQcResults lotId="lot-id" />);
  expect(
    await screen.findByText('No QC results recorded for this lot.'),
  ).toBeVisible();
  expect(screen.getByRole('alert')).not.toHaveTextContent('Unable to complete');
  expect(screen.getByRole('alert')).not.toHaveTextContent('404');
});
it('hides the entire QC section when access is denied', async () => {
  vi.mocked(apiClient.get).mockResolvedValue({
    status: 403,
    data: {
      detail: 'This endpoint is outside the granted desktop modules',
      code: 'ACCESS_DENIED',
    },
  });
  renderWithProviders(<LotQcResults lotId="lot-id" />);
  await waitForElementToBeRemoved(
    screen.getByRole('region', { name: 'QC Results' }),
  );
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(
    screen.queryByText('No QC results recorded for this lot.'),
  ).not.toBeInTheDocument();
});
it('retries QC service failures independently', async () => {
  vi.mocked(apiClient.get).mockResolvedValueOnce({
    status: 503,
    data: { detail: 'QC service temporarily unavailable' },
  });
  renderWithProviders(<LotQcResults lotId="lot-id" />);
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'QC service temporarily unavailable',
  );
  await userEvent
    .setup()
    .click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByText('Two damaged pieces')).toBeVisible();
});
it('aborts the request when the section unmounts', async () => {
  let resolve!: (value: { status: number; data: unknown }) => void;
  vi.mocked(apiClient.get).mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  const { unmount } = renderWithProviders(<LotQcResults lotId="lot-id" />);
  expect(
    screen.getByRole('progressbar', { name: 'Loading QC results' }),
  ).toBeVisible();
  const signal = vi.mocked(apiClient.get).mock.calls[0][1]?.signal;
  unmount();
  expect(signal?.aborted).toBe(true);
  await act(async () => resolve({ status: 200, data: lotQcResponse }));
  expect(screen.queryByText('Two damaged pieces')).not.toBeInTheDocument();
});
