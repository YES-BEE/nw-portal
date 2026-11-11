import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../api/client';
import { renderWithProviders } from '../../test/render';
import { TAG_STORAGE_KEY } from '../configurations/tagRegistry';
import { readSession, setAuthenticatedSession } from '../auth/session';
import { TagManagementPage } from './TagManagementPage';
import { tagsResponse } from '../../test/tags';

beforeEach(() => {
  vi.spyOn(apiClient, 'post').mockResolvedValue({
    status: 200,
    data: tagsResponse[1],
  });
  localStorage.clear();
  vi.spyOn(apiClient, 'get').mockResolvedValue({
    status: 200,
    data: tagsResponse.slice(0, 2),
  });
});

describe('backend tag listing', () => {
  it('creates a tag through POST and refreshes the active list without browser storage', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TagManagementPage />);
    await screen.findByRole('rowheader', { name: 'Washing Tag' });
    await user.type(screen.getByRole('searchbox'), 'washing');
    await user.click(screen.getByRole('button', { name: 'Add New Tag' }));
    await user.type(
      screen.getByRole('textbox', { name: /Tag Name/ }),
      ' New Factory Tag ',
    );
    await user.type(
      screen.getByRole('textbox', { name: /Actual NFC Tag ID/ }),
      ' 04:aa:ee ',
    );
    vi.mocked(apiClient.get).mockResolvedValue({
      status: 200,
      data: [
        ...tagsResponse.slice(0, 2),
        {
          ...tagsResponse[1],
          id: 'new-tag',
          name: 'New Factory Tag',
          uid: '04:AA:EE',
        },
      ],
    });
    await user.click(screen.getByRole('button', { name: 'Save Tag' }));
    expect(apiClient.post).toHaveBeenCalledWith(
      'nfc-tags',
      { name: 'New Factory Tag', uid: '04:aa:ee' },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(
      await screen.findByRole('rowheader', { name: 'New Factory Tag' }),
    ).toBeVisible();
    expect(apiClient.get).toHaveBeenCalledTimes(2);
    expect(
      screen.queryByRole('button', { name: 'Save Tag' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Tag saved successfully.')).toBeVisible();
    expect(localStorage.getItem(TAG_STORAGE_KEY)).toBeNull();
  });
  it('lists backend names, UIDs, and assignment state without reading or writing local records', async () => {
    const local = JSON.stringify([
      { id: 'local', name: 'Local only', actual: 'LOCAL-UID' },
    ]);
    localStorage.setItem(TAG_STORAGE_KEY, local);
    renderWithProviders(<TagManagementPage />);
    await screen.findByRole('rowheader', { name: 'Washing Tag' });
    expect(apiClient.get).toHaveBeenCalledWith(
      'nfc-tags',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    const row = screen
      .getByRole('rowheader', { name: 'Washing Tag' })
      .closest('tr')!;
    expect(within(row).getByText('04:AA:BB')).toBeVisible();
    expect(screen.getByRole('columnheader', { name: 'Status' })).toBeVisible();
    expect(
      screen.getByRole('columnheader', { name: 'Assigned' }),
    ).toBeVisible();
    expect(
      screen.queryByRole('columnheader', { name: 'Assigned To' }),
    ).not.toBeInTheDocument();
    expect(within(row).getByText('Active')).toBeVisible();
    expect(within(row).getByText('Yes')).toBeVisible();
    const availableRow = screen
      .getByRole('rowheader', { name: 'Available Tag' })
      .closest('tr')!;
    expect(within(availableRow).getByText('Active')).toBeVisible();
    expect(within(availableRow).getByText('No')).toBeVisible();
    expect(screen.queryByText('Deleted Tag')).not.toBeInTheDocument();
    expect(screen.queryByText('Local only')).not.toBeInTheDocument();
    expect(screen.getAllByRole('rowheader')).toHaveLength(2);
    expect(screen.getByText('2 tags')).toBeVisible();
    expect(localStorage.getItem(TAG_STORAGE_KEY)).toBe(local);
    expect(screen.getByRole('button', { name: 'Add New Tag' })).toBeEnabled();
    expect(
      screen.getByRole('button', { name: 'Edit tag Washing Tag' }),
    ).toBeEnabled();
    expect(
      screen.getByRole('button', { name: 'Delete tag Washing Tag' }),
    ).toBeEnabled();
  });

  it('shows a loader until the request resolves without an empty state', async () => {
    let resolve!: (value: { status: number; data: unknown }) => void;
    vi.mocked(apiClient.get).mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    renderWithProviders(<TagManagementPage />);
    expect(screen.getByRole('progressbar')).toBeVisible();
    expect(screen.getByRole('searchbox')).toBeDisabled();
    expect(
      screen.queryByText('No NFC tags registered.'),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await act(async () =>
      resolve({ status: 200, data: tagsResponse.slice(0, 2) }),
    );
    expect(screen.getAllByRole('rowheader')).toHaveLength(2);
  });

  it('paginates and searches by name and UID without case sensitivity', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      status: 200,
      data: Array.from({ length: 30 }, (_, i) => ({
        ...tagsResponse[0],
        id: 'tag-' + i,
        name: 'Factory Tag ' + (i + 1),
        uid: 'UID-' + i,
      })),
    });
    const user = userEvent.setup();
    renderWithProviders(<TagManagementPage />);
    await screen.findByRole('rowheader', { name: 'Factory Tag 1' });
    expect(screen.getAllByRole('rowheader')).toHaveLength(10);
    await user.click(screen.getByRole('button', { name: 'Go to next page' }));
    expect(
      screen.getByRole('rowheader', { name: 'Factory Tag 11' }),
    ).toBeVisible();
    const search = screen.getByRole('searchbox');
    await user.type(search, ' factory tag 30 ');
    expect(
      screen.getByRole('rowheader', { name: 'Factory Tag 30' }),
    ).toBeVisible();
    await user.clear(search);
    await user.type(search, 'uid-29');
    expect(
      screen.getByRole('rowheader', { name: 'Factory Tag 30' }),
    ).toBeVisible();
    await user.clear(search);
    await user.type(search, 'no match');
    expect(screen.getByText('No tags match your search.')).toBeVisible();
  });

  it.each([{ data: [] }])(
    'shows an empty list when no active tags exist: %j',
    async ({ data }) => {
      vi.mocked(apiClient.get).mockResolvedValue({ status: 200, data });
      renderWithProviders(<TagManagementPage />);
      expect(await screen.findByText('No NFC tags registered.')).toBeVisible();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    },
  );

  it('preserves a backend service reason and retries only on request', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      status: 503,
      data: { detail: 'Maintenance in progress' },
    });
    const user = userEvent.setup();
    renderWithProviders(<TagManagementPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Maintenance in progress',
    );
    expect(screen.getByRole('alert')).not.toHaveTextContent('HTTP 503');
    expect(apiClient.get).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByRole('rowheader', { name: 'Washing Tag' });
    expect(apiClient.get).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it.each([403, 406])(
    'does not offer a futile retry for HTTP %s',
    async (status) => {
      vi.mocked(apiClient.get).mockResolvedValue({
        status,
        data: { detail: 'Backend reason' },
      });
      renderWithProviders(<TagManagementPage />);
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Backend reason',
      );
      expect(
        screen.queryByRole('button', { name: 'Try again' }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText('No NFC tags registered.'),
      ).not.toBeInTheDocument();
    },
  );

  it.each([
    { status: 401, data: '' },
    {
      status: 403,
      data: {
        type: 'about:blank',
        status: 403,
        title: 'Forbidden',
        code: 'ACCESS_DENIED',
        detail: 'Role changed; log in again',
      },
    },
  ])(
    'offers sign-in when authentication must be renewed: %j',
    async (response) => {
      setAuthenticatedSession({
        user: { id: 'admin', username: 'admin', role: 'NW', status: 'Active' },
        modules: ['tags'],
      });
      vi.mocked(apiClient.get).mockResolvedValue(response);
      const user = userEvent.setup();
      renderWithProviders(<TagManagementPage />);
      await user.click(
        await screen.findByRole('button', { name: 'Back to sign in' }),
      );
      expect(readSession()).toBeNull();
    },
  );

  it('uses safe fallback text for an HTML service error', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      status: 502,
      data: '<html>Proxy diagnostics</html>',
    });
    renderWithProviders(<TagManagementPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Tags are temporarily unavailable',
    );
    expect(screen.queryByText('Proxy diagnostics')).not.toBeInTheDocument();
  });

  it('shows connectivity guidance on network failure', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error('Network Error'));
    renderWithProviders(<TagManagementPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Check your connection',
    );
  });

  it.each([
    {},
    [tagsResponse[0], tagsResponse[0]],
    [{ ...tagsResponse[0], assigned: 'true' }],
    [{ ...tagsResponse[0], uid: undefined }],
  ])('rejects an invalid response: %j', async (data) => {
    vi.mocked(apiClient.get).mockResolvedValue({ status: 200, data });
    renderWithProviders(<TagManagementPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to read tags',
    );
    expect(screen.queryAllByRole('rowheader')).toHaveLength(0);
  });

  it('cancels on unmount and fetches again on return', async () => {
    vi.mocked(apiClient.get).mockReturnValueOnce(new Promise(() => {}));
    const { unmount } = renderWithProviders(<TagManagementPage />);
    const signal = vi.mocked(apiClient.get).mock.calls[0][1]?.signal;
    unmount();
    expect(signal?.aborted).toBe(true);
    renderWithProviders(<TagManagementPage />);
    await waitFor(() =>
      expect(screen.getAllByRole('rowheader')).toHaveLength(2),
    );
    expect(apiClient.get).toHaveBeenCalledTimes(2);
  });
});
