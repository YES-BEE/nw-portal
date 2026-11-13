import { apiPage } from '../../test/apiPage';
import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../api/client';
import { renderWithProviders } from '../../test/render';
import { createTagResponse, tagsResponse } from '../../test/tags';
import { TagManagementPage } from './TagManagementPage';

const detail = {
  ...createTagResponse,
  id: tagsResponse[0].id,
  name: 'Fresh tag name',
  uid: 'FRESH-UID',
};
beforeEach(() => {
  vi.spyOn(apiClient, 'get').mockImplementation(async (url) => ({
    status: 200,
    data:
      url === 'nfc-tags'
        ? apiPage(tagsResponse.slice(0, 2), undefined, 10)
        : detail,
  }));
  vi.spyOn(apiClient, 'put').mockResolvedValue({ status: 200, data: detail });
});
async function openEditor() {
  const user = userEvent.setup();
  const view = renderWithProviders(<TagManagementPage />);
  await user.click(
    await screen.findByRole('button', { name: 'Edit tag Washing Tag' }),
  );
  await screen.findByRole('textbox', { name: /Tag Name/ });
  return { user, ...view };
}

describe('backend tag editing', () => {
  it('fetches fresh details, sends normalized PUT fields, and refreshes after success', async () => {
    const { user } = await openEditor();
    expect(apiClient.get).toHaveBeenCalledWith(
      'nfc-tags/' + detail.id,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    const name = screen.getByRole('textbox', { name: /Tag Name/ });
    const uid = screen.getByRole('textbox', { name: /Actual NFC Tag ID/ });
    expect(name).toHaveValue('Fresh tag name');
    expect(uid).toHaveValue('FRESH-UID');
    await user.clear(name);
    await user.type(name, ' Tag 1 ');
    await user.clear(uid);
    await user.type(uid, ' ABC123 ');
    const updated = { ...detail, name: 'Tag 1', uid: 'ABC123', version: 1 };
    vi.mocked(apiClient.put).mockResolvedValue({ status: 200, data: updated });
    vi.mocked(apiClient.get).mockResolvedValue({
      status: 200,
      data: apiPage([updated, tagsResponse[1]], undefined, 10),
    });
    await user.click(screen.getByRole('button', { name: 'Save Tag' }));
    expect(apiClient.put).toHaveBeenCalledWith(
      'nfc-tags/' + detail.id,
      { name: 'Tag 1', uid: 'ABC123' },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(
      await screen.findByRole('rowheader', { name: 'Tag 1' }),
    ).toBeVisible();
    expect(
      screen.queryByRole('textbox', { name: /Tag Name/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Tag saved successfully.')).toBeVisible();
  });

  it('keeps the draft when backend history rules reject changing the physical UID', async () => {
    vi.mocked(apiClient.put).mockResolvedValue({
      status: 400,
      data: {
        code: 'INVALID_ARGUMENT',
        detail: 'A tag with assignment history cannot change its physical UID',
      },
    });
    const { user } = await openEditor();
    const uid = screen.getByRole('textbox', { name: /Actual NFC Tag ID/ });
    await user.clear(uid);
    await user.type(uid, 'CHANGED');
    await user.click(screen.getByRole('button', { name: 'Save Tag' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'A tag with assignment history cannot change its physical UID',
    );
    expect(screen.getByRole('alert')).not.toHaveTextContent('HTTP 400');
    expect(uid).toHaveValue('CHANGED');
    expect(screen.getByRole('button', { name: 'Save Tag' })).toBeEnabled();
    expect(apiClient.put).toHaveBeenCalledTimes(1);
  });

  it('reloads the list if a tag disappears during an update', async () => {
    vi.mocked(apiClient.put).mockResolvedValue({
      status: 404,
      data: { code: 'NOT_FOUND', detail: 'Requested resource was not found' },
    });
    const { user } = await openEditor();
    await user.click(screen.getByRole('button', { name: 'Save Tag' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Requested resource was not found',
    );
    expect(screen.getByRole('button', { name: 'Save Tag' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Reload tags' }));
    await screen.findByRole('rowheader', { name: 'Washing Tag' });
    expect(
      screen.queryByRole('textbox', { name: /Tag Name/ }),
    ).not.toBeInTheDocument();
  });

  it('cancels without an update and aborts a pending detail request when closed', async () => {
    const { user, unmount } = await openEditor();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(apiClient.put).not.toHaveBeenCalled();
    vi.mocked(apiClient.get).mockReturnValueOnce(new Promise(() => {}));
    await user.click(
      screen.getByRole('button', { name: 'Edit tag Washing Tag' }),
    );
    const signal = vi.mocked(apiClient.get).mock.calls.at(-1)?.[1]?.signal;
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(signal?.aborted).toBe(true);
    unmount();
  });

  it('blocks repeated updates while saving', async () => {
    let resolve!: (value: { status: number; data: unknown }) => void;
    vi.mocked(apiClient.put).mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const { user } = await openEditor();
    await user.click(screen.getByRole('button', { name: 'Save Tag' }));
    expect(screen.getByRole('button', { name: 'Saving...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    await act(async () => resolve({ status: 200, data: detail }));
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'Save Tag' }),
      ).not.toBeInTheDocument(),
    );
    expect(apiClient.put).toHaveBeenCalledTimes(1);
  });
});
