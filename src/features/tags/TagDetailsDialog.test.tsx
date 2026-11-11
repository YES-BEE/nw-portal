import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../api/client';
import { renderWithProviders } from '../../test/render';
import { createTagResponse, tagsResponse } from '../../test/tags';
import { TagManagementPage } from './TagManagementPage';
import { TagDetailsDialog } from './TagDetailsDialog';

beforeEach(() => {
  vi.spyOn(apiClient, 'get').mockResolvedValue({
    status: 200,
    data: createTagResponse,
  });
});

describe('tag details', () => {
  it('opens View using the row UUID and shows fresh details including assignment references', async () => {
    const detail = {
      ...createTagResponse,
      id: tagsResponse[0].id,
      name: 'Fresh backend name',
      assigned: true,
      asset_type: 'MACHINE',
      machine_id: 'machine-uuid',
      process_id: 'process-uuid',
      version: 3,
    };
    vi.mocked(apiClient.get).mockImplementation(async (url) => ({
      status: 200,
      data: url === 'nfc-tags' ? tagsResponse.slice(0, 2) : detail,
    }));
    const user = userEvent.setup();
    renderWithProviders(<TagManagementPage />);
    await user.click(
      await screen.findByRole('button', { name: 'View tag Washing Tag' }),
    );
    const dialog = within(screen.getByRole('dialog', { name: 'Tag Details' }));
    expect(await dialog.findByText('Fresh backend name')).toBeVisible();
    expect(apiClient.get).toHaveBeenCalledWith(
      'nfc-tags/' + tagsResponse[0].id,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(dialog.getByText('Machine / Device')).toBeVisible();
    expect(dialog.getByText('machine-uuid')).toBeVisible();
    expect(dialog.getByText('process-uuid')).toBeVisible();
    expect(dialog.getByText('Yes')).toBeVisible();
    expect(dialog.getByText('Active')).toBeVisible();
    expect(dialog.getByText('3')).toBeVisible();
    expect(dialog.getAllByRole('definition')).toHaveLength(13);
    await user.click(dialog.getByRole('button', { name: 'Close' }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
  });

  it('shows loading until details arrive and displays unassigned tags with empty references', async () => {
    let resolve!: (value: { status: number; data: unknown }) => void;
    vi.mocked(apiClient.get).mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    renderWithProviders(
      <TagDetailsDialog
        tagId={createTagResponse.id}
        onClose={vi.fn()}
        onReload={vi.fn()}
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      'Loading tag details...',
    );
    expect(screen.queryByText('None')).not.toBeInTheDocument();
    await act(async () => resolve({ status: 200, data: createTagResponse }));
    expect(screen.getByText('No')).toBeVisible();
    expect(screen.getAllByText('None')).toHaveLength(7);
  });

  it('offers reload for the backend 409 NOT_FOUND response and hides the HTTP code', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      status: 409,
      data: { code: 'NOT_FOUND', detail: 'Requested resource was not found' },
    });
    const user = userEvent.setup();
    const reload = vi.fn();
    renderWithProviders(
      <TagDetailsDialog
        tagId={createTagResponse.id}
        onClose={vi.fn()}
        onReload={reload}
      />,
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Requested resource was not found',
    );
    expect(screen.getByRole('alert')).not.toHaveTextContent('HTTP 409');
    await user.click(screen.getByRole('button', { name: 'Reload tags' }));
    expect(reload).toHaveBeenCalledOnce();
  });

  it('retries a service failure without closing the dialog', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      status: 503,
      data: { detail: 'Maintenance in progress' },
    });
    const user = userEvent.setup();
    renderWithProviders(
      <TagDetailsDialog
        tagId={createTagResponse.id}
        onClose={vi.fn()}
        onReload={vi.fn()}
      />,
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Maintenance in progress',
    );
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText(createTagResponse.name)).toBeVisible();
    expect(apiClient.get).toHaveBeenCalledTimes(2);
  });

  it('shows access failures without a retry and cancels pending detail requests on unmount', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      status: 403,
      data: { detail: 'Missing module access: tags' },
    });
    const first = renderWithProviders(
      <TagDetailsDialog
        tagId={createTagResponse.id}
        onClose={vi.fn()}
        onReload={vi.fn()}
      />,
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Missing module access: tags',
    );
    expect(
      screen.queryByRole('button', { name: 'Try again' }),
    ).not.toBeInTheDocument();
    first.unmount();
    vi.mocked(apiClient.get).mockReturnValueOnce(new Promise(() => {}));
    const view = renderWithProviders(
      <TagDetailsDialog
        tagId={createTagResponse.id}
        onClose={vi.fn()}
        onReload={vi.fn()}
      />,
    );
    const signal = vi.mocked(apiClient.get).mock.calls.at(-1)?.[1]?.signal;
    view.unmount();
    expect(signal?.aborted).toBe(true);
  });
});
