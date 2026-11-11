import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../api/client';
import { renderWithProviders } from '../../test/render';
import { processResponse, processesResponse } from '../../test/processes';
import { ProcessConfigurationsPage } from './ProcessConfigurationsPage';

const deleted = {
  ...processResponse,
  active: false,
  nfcUid: null,
  nfc_uid: null,
  version: 1,
};
beforeEach(() => {
  vi.spyOn(apiClient, 'get').mockResolvedValue({
    status: 200,
    data: processesResponse,
  });
  vi.spyOn(apiClient, 'delete').mockResolvedValue({
    status: 200,
    data: deleted,
  });
});
async function openDelete() {
  const user = userEvent.setup();
  const view = renderWithProviders(
    <MemoryRouter>
      <ProcessConfigurationsPage />
    </MemoryRouter>,
  );
  await user.click(
    await screen.findByRole('button', { name: 'Delete Washing' }),
  );
  return { user, ...view };
}

describe('backend process deletion', () => {
  it('requires confirmation and permits cancel without sending DELETE', async () => {
    const { user } = await openDelete();
    expect(screen.getByRole('dialog')).toHaveTextContent('Washing');
    expect(apiClient.delete).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(apiClient.delete).not.toHaveBeenCalled();
  });

  it('blocks repeated submissions and hides the deleted process after reloading', async () => {
    let resolve!: (value: { status: number; data: unknown }) => void;
    vi.mocked(apiClient.delete).mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const { user } = await openDelete();
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Delete',
      }),
    );
    expect(apiClient.delete).toHaveBeenCalledWith(
      'processes/' + processResponse.id,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(screen.getByRole('button', { name: 'Deleting...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(apiClient.get).toHaveBeenCalledTimes(1);
    vi.mocked(apiClient.get).mockResolvedValue({
      status: 200,
      data: [deleted],
    });
    await act(async () => resolve({ status: 200, data: deleted }));
    expect(await screen.findByText('No processes configured.')).toBeVisible();
    expect(
      screen.queryByRole('rowheader', { name: /Washing/ }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('Process deleted.')).toBeVisible();
    expect(apiClient.get).toHaveBeenCalledTimes(2);
    expect(apiClient.delete).toHaveBeenCalledTimes(1);
  });

  it.each([
    [400, 'INVALID_ARGUMENT', 'Process has unfinished production', null],
    [403, 'ACCESS_DENIED', 'Missing module access: process', null],
    [409, 'NOT_FOUND', 'Requested resource was not found', 'Reload processes'],
    [503, undefined, 'Maintenance in progress', 'Try again'],
    [401, undefined, 'Authentication failed', 'Back to sign in'],
  ])(
    'retains the process and displays the backend reason on HTTP %s',
    async (status, code, detail, action) => {
      vi.mocked(apiClient.delete).mockResolvedValue({
        status,
        data: { code, detail },
      });
      const { user } = await openDelete();
      await user.click(
        within(screen.getByRole('dialog')).getByRole('button', {
          name: 'Delete',
        }),
      );
      expect(await screen.findByRole('alert')).toHaveTextContent(detail);
      expect(screen.getByRole('alert')).not.toHaveTextContent('HTTP ' + status);
      const row = screen
        .getByRole('rowheader', { name: /Washing/, hidden: true })
        .closest('tr')!;
      expect(within(row).getByText('Active')).toBeInTheDocument();
      expect(apiClient.get).toHaveBeenCalledTimes(1);
      expect(apiClient.delete).toHaveBeenCalledTimes(1);
      if (action) {
        expect(screen.getByRole('button', { name: action })).toBeEnabled();
        if (action === 'Reload processes') {
          await user.click(screen.getByRole('button', { name: action }));
          await screen.findByRole('rowheader', { name: /Washing/ });
          expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        }
      } else
        expect(
          screen.queryByRole('button', { name: 'Try again' }),
        ).not.toBeInTheDocument();
    },
  );

  it('permits a manual retry after a network failure', async () => {
    vi.mocked(apiClient.delete).mockRejectedValueOnce(
      new Error('Network Error'),
    );
    const { user } = await openDelete();
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Delete',
      }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Check your connection',
    );
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(apiClient.delete).toHaveBeenCalledTimes(2);
  });

  it('aborts an outstanding DELETE on unmount', async () => {
    vi.mocked(apiClient.delete).mockReturnValue(new Promise(() => {}));
    const { user, unmount } = await openDelete();
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Delete',
      }),
    );
    const signal = vi.mocked(apiClient.delete).mock.calls[0][1]?.signal;
    unmount();
    expect(signal?.aborted).toBe(true);
  });
});
