import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../api/client';
import { renderWithProviders } from '../../test/render';
import { createTagResponse, tagsResponse } from '../../test/tags';
import { TagManagementPage } from './TagManagementPage';

const deleted = {
  ...createTagResponse,
  id: tagsResponse[0].id,
  status: 'DELETED',
  assigned: false,
  version: 1,
};
beforeEach(() => {
  vi.spyOn(apiClient, 'get').mockResolvedValue({
    status: 200,
    data: tagsResponse.slice(0, 2),
  });
  vi.spyOn(apiClient, 'delete').mockResolvedValue({
    status: 200,
    data: deleted,
  });
});
async function openDelete() {
  const user = userEvent.setup();
  const view = renderWithProviders(<TagManagementPage />);
  await user.click(
    await screen.findByRole('button', { name: 'Delete tag Washing Tag' }),
  );
  return { user, ...view };
}

describe('backend tag deletion', () => {
  it('confirms before sending and can cancel without mutation', async () => {
    const { user } = await openDelete();
    expect(screen.getByRole('dialog')).toHaveTextContent('Washing Tag');
    expect(apiClient.delete).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(apiClient.delete).not.toHaveBeenCalled();
  });

  it('blocks duplicate clicks and refreshes the active list only after success', async () => {
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
      'nfc-tags/' + deleted.id,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(screen.getByRole('button', { name: 'Deleting...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(apiClient.get).toHaveBeenCalledTimes(1);
    vi.mocked(apiClient.get).mockResolvedValue({
      status: 200,
      data: [tagsResponse[1]],
    });
    await act(async () => resolve({ status: 200, data: deleted }));
    await screen.findByRole('rowheader', { name: 'Available Tag' });
    expect(
      screen.queryByRole('rowheader', { name: 'Washing Tag' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('Tag deleted.')).toBeVisible();
    expect(apiClient.get).toHaveBeenCalledTimes(2);
    expect(apiClient.delete).toHaveBeenCalledTimes(1);
  });

  it.each([
    [409, 'NFC_STILL_ASSIGNED', 'Unassign the tag before deleting it', null],
    [403, 'ACCESS_DENIED', 'Missing module access: tags', null],
    [404, 'NOT_FOUND', 'Requested resource was not found', 'Reload tags'],
    [503, undefined, 'Maintenance in progress', 'Try again'],
    [401, undefined, 'Authentication failed', 'Back to sign in'],
  ])(
    'keeps the tag on HTTP %s / %s and displays the backend reason',
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
      expect(
        screen.getByRole('rowheader', { name: 'Washing Tag', hidden: true }),
      ).toBeInTheDocument();
      expect(apiClient.get).toHaveBeenCalledTimes(1);
      expect(apiClient.delete).toHaveBeenCalledTimes(1);
      if (action) {
        expect(screen.getByRole('button', { name: action })).toBeEnabled();
        if (action === 'Reload tags') {
          await user.click(screen.getByRole('button', { name: action }));
          await screen.findByRole('rowheader', { name: 'Washing Tag' });
          expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        }
      } else
        expect(
          screen.queryByRole('button', { name: 'Try again' }),
        ).not.toBeInTheDocument();
    },
  );

  it('retries manually after a network failure', async () => {
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

  it('aborts the request on unmount', async () => {
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
