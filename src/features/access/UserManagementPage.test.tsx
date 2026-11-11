import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../api/client';
import { renderWithProviders } from '../../test/render';
import { userResponse, usersResponse } from '../../test/users';
import { accessRolesResponse } from '../../test/accessRoles';
import * as accessRolesApi from './accessRolesApi';
import { readSession, setAuthenticatedSession } from '../auth/session';
import { ACCESS_STORAGE_KEY } from './accessData';
import { UserManagementPage } from './UserManagementPage';
import type { UsersResponse } from './types';

beforeEach(() => {
  vi.spyOn(apiClient, 'delete').mockResolvedValue({
    status: 200,
    data: { ...userResponse, enabled: false },
  });
  vi.spyOn(apiClient, 'post').mockResolvedValue({
    status: 200,
    data: userResponse,
  });
  vi.spyOn(accessRolesApi, 'getAccessRoles').mockResolvedValue(
    accessRolesResponse,
  );
  localStorage.clear();
  vi.spyOn(apiClient, 'get').mockResolvedValue({
    status: 200,
    data: usersResponse,
  });
});

describe('backend user listing', () => {
  it('confirms deletion, blocks duplicate submissions, and reloads the disabled account', async () => {
    let resolve!: (value: { status: number; data: unknown }) => void;
    vi.mocked(apiClient.delete).mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<UserManagementPage />);
    await screen.findByRole('rowheader', { name: 'admin' });
    await user.click(screen.getByRole('button', { name: 'Delete admin' }));
    expect(screen.getByRole('dialog')).toHaveTextContent(
      "admin's status will be changed to Inactive.",
    );
    expect(apiClient.delete).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete admin' }));
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Delete',
      }),
    );
    expect(apiClient.delete).toHaveBeenCalledWith(
      `users/${userResponse.id}`,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(screen.getByRole('button', { name: 'Deleting...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(apiClient.get).toHaveBeenCalledTimes(1);
    vi.mocked(apiClient.get).mockResolvedValue({
      status: 200,
      data: usersResponse.map((record) => ({ ...record, enabled: false })),
    });
    await act(async () =>
      resolve({ status: 200, data: { ...userResponse, enabled: false } }),
    );
    await screen.findByRole('rowheader', { name: 'admin' });
    expect(
      within(
        screen.getByRole('rowheader', { name: 'admin' }).closest('tr')!,
      ).getByText('Inactive'),
    ).toBeVisible();
    expect(screen.getByText('User account disabled.')).toBeVisible();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(apiClient.delete).toHaveBeenCalledTimes(1);
    expect(apiClient.get).toHaveBeenCalledTimes(2);
  });

  it.each([
    [400, 'Invalid UUID string', 'Reload users'],
    [404, 'Requested resource was not found', 'Reload users'],
    [
      409,
      'The operation violates a uniqueness, reference, or state constraint',
      'Reload users',
    ],
    [403, 'Missing module access: users', null],
    [503, 'Maintenance in progress', 'Try again'],
    [401, 'Authentication failed', 'Back to sign in'],
  ])(
    'keeps the row and shows the backend delete failure for HTTP %s',
    async (status, detail, action) => {
      vi.mocked(apiClient.delete).mockResolvedValue({
        status,
        data: { detail },
      });
      const user = userEvent.setup();
      renderWithProviders(<UserManagementPage />);
      await screen.findByRole('rowheader', { name: 'admin' });
      await user.click(screen.getByRole('button', { name: 'Delete admin' }));
      await user.click(
        within(screen.getByRole('dialog')).getByRole('button', {
          name: 'Delete',
        }),
      );
      expect(await screen.findByRole('alert')).toHaveTextContent(detail);
      expect(screen.getByRole('alert')).toHaveTextContent(`HTTP ${status}`);
      expect(
        within(
          screen
            .getByRole('rowheader', { name: 'admin', hidden: true })
            .closest('tr')!,
        ).getByText('Active'),
      ).toBeVisible();
      expect(apiClient.delete).toHaveBeenCalledTimes(1);
      expect(apiClient.get).toHaveBeenCalledTimes(1);
      if (action) {
        expect(screen.getByRole('button', { name: action })).toBeEnabled();
        if (action === 'Reload users') {
          await user.click(screen.getByRole('button', { name: action }));
          await screen.findByRole('rowheader', { name: 'admin' });
          expect(apiClient.get).toHaveBeenCalledTimes(2);
          expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        }
      } else {
        expect(
          screen.queryByRole('button', { name: 'Try again' }),
        ).not.toBeInTheDocument();
        expect(
          within(screen.getByRole('dialog')).queryByRole('button', {
            name: 'Delete',
          }),
        ).not.toBeInTheDocument();
      }
    },
  );

  it('allows a manual retry after a connection failure', async () => {
    vi.mocked(apiClient.delete).mockRejectedValueOnce(
      new Error('Network Error'),
    );
    const user = userEvent.setup();
    renderWithProviders(<UserManagementPage />);
    await screen.findByRole('rowheader', { name: 'admin' });
    await user.click(screen.getByRole('button', { name: 'Delete admin' }));
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

  it('creates a user with a backend role code, empty assignments, and an unchanged password', async () => {
    const user = userEvent.setup();
    renderWithProviders(<UserManagementPage />);
    await screen.findByRole('rowheader', { name: 'admin' });
    await user.click(screen.getByRole('button', { name: 'Add User' }));
    await user.type(
      screen.getByRole('textbox', { name: /Username/ }),
      ' new.manager ',
    );
    await user.type(
      screen.getByRole('textbox', { name: /Display Name/ }),
      ' Process Manager ',
    );
    await user.type(
      screen.getByLabelText(/Initial Password/),
      ' password with spaces ',
    );
    const role = screen.getByRole('combobox', { name: /Role/ });
    await waitFor(() =>
      expect(role).not.toHaveAttribute('aria-disabled', 'true'),
    );
    await user.click(role);
    await user.click(screen.getByRole('option', { name: 'IT Admin' }));
    expect(
      screen.queryByRole('combobox', { name: 'Status' }),
    ).not.toBeInTheDocument();
    vi.mocked(apiClient.get).mockResolvedValue({
      status: 200,
      data: [
        ...usersResponse,
        {
          ...userResponse,
          id: 'new-user-uuid',
          username: 'new.manager',
          display_name: 'Process Manager',
          role: 'ADMIN_IT',
        },
      ],
    });
    await user.click(screen.getByRole('button', { name: 'Save User' }));
    expect(apiClient.post).toHaveBeenCalledWith(
      'users',
      {
        username: 'new.manager',
        displayName: 'Process Manager',
        initialPassword: ' password with spaces ',
        role: 'ADMIN_IT',
        processAssignments: [],
      },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(
      await screen.findByRole('rowheader', { name: 'new.manager' }),
    ).toBeVisible();
    expect(apiClient.get).toHaveBeenCalledTimes(2);
    expect(screen.queryByLabelText(/Initial Password/)).not.toBeInTheDocument();
    expect(screen.getByText('Changes saved successfully.')).toBeVisible();
    expect(localStorage.length).toBe(0);
  });

  it('validates required create fields before sending a POST', async () => {
    const user = userEvent.setup();
    renderWithProviders(<UserManagementPage />);
    await screen.findByRole('rowheader', { name: 'admin' });
    await user.click(screen.getByRole('button', { name: 'Add User' }));
    await user.click(screen.getByRole('button', { name: 'Save User' }));
    expect(
      screen.getByRole('textbox', { name: /Username/ }),
    ).toHaveAccessibleDescription('Enter a username.');
    expect(
      screen.getByRole('textbox', { name: /Display Name/ }),
    ).toHaveAccessibleDescription('Enter a display name.');
    expect(
      screen.getByLabelText(/Initial Password/),
    ).toHaveAccessibleDescription('Enter an initial password.');
    expect(screen.getByText('Select a role.')).toBeVisible();
    expect(apiClient.post).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByLabelText(/Initial Password/)).not.toBeInTheDocument();
  });

  it('opens Edit using the row UUID and prefills fresh backend details rather than the list row', async () => {
    const fresh = {
      ...userResponse,
      username: 'updated-admin',
      display_name: 'Updated display name',
      enabled: false,
      role: 'ADMIN_IT',
      processAssignments: usersResponse[1].processAssignments,
    };
    vi.mocked(apiClient.get).mockImplementation(async (url) => ({
      status: 200,
      data: url === 'users' ? usersResponse : fresh,
    }));
    const user = userEvent.setup();
    renderWithProviders(<UserManagementPage />);
    await screen.findByRole('rowheader', { name: 'admin' });
    await user.click(screen.getByRole('button', { name: 'Edit admin' }));
    expect(apiClient.get).toHaveBeenCalledWith(
      `users/${userResponse.id}`,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(
      await screen.findByRole('textbox', { name: /Username/ }),
    ).toHaveValue('updated-admin');
    expect(screen.getByRole('textbox', { name: /Display Name/ })).toHaveValue(
      'Updated display name',
    );
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: /Role/ })).toHaveTextContent(
        'IT Admin',
      ),
    );
    expect(screen.getByRole('combobox', { name: 'Status' })).toHaveTextContent(
      'Inactive',
    );
    expect(
      screen.queryByRole('checkbox', { name: 'Must change password' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('textbox', { name: 'Created at' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Associated Processes')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save User' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(
      screen.queryByRole('textbox', { name: /Username/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit admin' })).toBeEnabled();
  });

  it('reloads the list when the selected user no longer exists', async () => {
    vi.mocked(apiClient.get).mockImplementation(async (url) =>
      url === 'users'
        ? { status: 200, data: usersResponse }
        : {
            status: 404,
            data: {
              code: 'NOT_FOUND',
              detail: 'Requested resource was not found',
            },
          },
    );
    const user = userEvent.setup();
    renderWithProviders(<UserManagementPage />);
    await screen.findByRole('rowheader', { name: 'admin' });
    await user.click(screen.getByRole('button', { name: 'Edit admin' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Requested resource was not found',
    );
    expect(
      screen.queryByRole('textbox', { name: /Username/ }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reload users' }));
    await screen.findByRole('rowheader', { name: 'admin' });
    expect(apiClient.get).toHaveBeenCalledTimes(3);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('lists backend identities and statuses without using or changing local user records', async () => {
    const local = JSON.stringify({
      users: [
        { id: 'local', username: 'Local only', role: 'NW', status: 'Active' },
      ],
      roles: [],
    });
    localStorage.setItem(ACCESS_STORAGE_KEY, local);
    renderWithProviders(<UserManagementPage />);
    await screen.findByRole('rowheader', { name: 'admin' });
    expect(apiClient.get).toHaveBeenCalledWith(
      'users',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(screen.getAllByRole('rowheader')).toHaveLength(2);
    const admin = screen
      .getByRole('rowheader', { name: 'admin' })
      .closest('tr')!;
    expect(within(admin).getByText('Bootstrap NW')).toBeVisible();
    expect(within(admin).getByText('NW')).toBeVisible();
    expect(within(admin).getByText('Active')).toBeVisible();
    const operator = screen
      .getByRole('rowheader', { name: 'operator' })
      .closest('tr')!;
    expect(within(operator).getByText('Inactive')).toBeVisible();
    expect(within(operator).getByText('No role assigned')).toBeVisible();
    expect(screen.queryByText('Local only')).not.toBeInTheDocument();
    expect(localStorage.getItem(ACCESS_STORAGE_KEY)).toBe(local);
    expect(screen.getByRole('button', { name: 'Add User' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Edit admin' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Delete admin' })).toBeEnabled();
    expect(
      screen.getByRole('button', { name: 'Delete operator' }),
    ).toBeDisabled();
  });

  it('shows a loader until the request completes, with no false empty or error state', async () => {
    let resolve!: (response: { status: number; data: UsersResponse }) => void;
    vi.mocked(apiClient.get).mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    renderWithProviders(<UserManagementPage />);
    expect(screen.getByRole('progressbar')).toBeVisible();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText('No users found.')).not.toBeInTheDocument();
    expect(screen.getByRole('searchbox')).toBeDisabled();
    await act(async () => resolve({ status: 200, data: usersResponse }));
    expect(screen.getAllByRole('rowheader')).toHaveLength(2);
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('searches username, display name, and role without case sensitivity', async () => {
    const user = userEvent.setup();
    renderWithProviders(<UserManagementPage />);
    await screen.findByRole('rowheader', { name: 'admin' });
    const search = screen.getByRole('searchbox', { name: 'Search users' });
    for (const value of [' ADMIN ', ' bootstrap ', ' nw ']) {
      await user.clear(search);
      await user.type(search, value);
      expect(screen.getAllByRole('rowheader')).toHaveLength(1);
      expect(screen.getByRole('rowheader', { name: 'admin' })).toBeVisible();
    }
    await user.clear(search);
    await user.type(search, 'nobody');
    expect(screen.getByText('No users match your search.')).toBeVisible();
    await user.clear(search);
    expect(screen.getAllByRole('rowheader')).toHaveLength(2);
  });

  it('paginates fetched users and resets the page when searching', async () => {
    const records = Array.from({ length: 12 }, (_, i) => ({
      ...userResponse,
      id: `id-${i}`,
      username: `account-${i}`,
    }));
    vi.mocked(apiClient.get).mockResolvedValue({ status: 200, data: records });
    const user = userEvent.setup();
    renderWithProviders(<UserManagementPage />);
    await screen.findByRole('rowheader', { name: 'account-0' });
    expect(screen.getAllByRole('rowheader')).toHaveLength(10);
    await user.click(screen.getByRole('button', { name: /next page/i }));
    expect(screen.getAllByRole('rowheader')).toHaveLength(2);
    expect(screen.getByRole('rowheader', { name: 'account-11' })).toBeVisible();
    await user.type(screen.getByRole('searchbox'), 'account-0');
    expect(screen.getByRole('rowheader', { name: 'account-0' })).toBeVisible();
    expect(
      screen.getByRole('button', { name: /previous page/i }),
    ).toBeDisabled();
  });

  it('treats an empty response as an empty list', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ status: 200, data: [] });
    renderWithProviders(<UserManagementPage />);
    expect(await screen.findByText('No users found.')).toBeVisible();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('displays a backend service reason and retries only when requested', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      status: 503,
      data: { detail: 'Maintenance in progress' },
    });
    const user = userEvent.setup();
    renderWithProviders(<UserManagementPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Maintenance in progress',
    );
    expect(apiClient.get).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByRole('rowheader', { name: 'admin' });
    expect(apiClient.get).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('preserves access-denied reasons without offering a futile retry', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      status: 403,
      data: { detail: 'Missing module access: users', code: 'ACCESS_DENIED' },
    });
    renderWithProviders(<UserManagementPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Missing module access: users',
    );
    expect(
      screen.queryByRole('button', { name: 'Try again' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('No users found.')).not.toBeInTheDocument();
  });

  it.each([
    { status: 401, data: '' },
    {
      status: 403,
      data: {
        status: 403,
        type: 'about:blank',
        title: 'Forbidden',
        code: 'ACCESS_DENIED',
        detail: 'Role changed; log in again',
      },
    },
  ])(
    'offers sign-in again when authentication is required: %j',
    async (response) => {
      setAuthenticatedSession({
        user: { id: 'admin', username: 'admin', role: 'NW', status: 'Active' },
        modules: ['users'],
      });
      vi.mocked(apiClient.get).mockResolvedValue(response);
      const user = userEvent.setup();
      renderWithProviders(<UserManagementPage />);
      await screen.findByRole('alert');
      await user.click(screen.getByRole('button', { name: 'Back to sign in' }));
      expect(readSession()).toBeNull();
    },
  );

  it.each([500, 502, 503, 504])(
    'handles HTML or empty service failures gracefully: HTTP %s',
    async (status) => {
      vi.mocked(apiClient.get).mockResolvedValue({
        status,
        data: status === 500 ? '' : '<html>Internal proxy diagnostics</html>',
      });
      renderWithProviders(<UserManagementPage />);
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Users are temporarily unavailable',
      );
      expect(screen.getByRole('alert')).toHaveTextContent(`HTTP ${status}`);
      expect(
        screen.queryByText('Internal proxy diagnostics'),
      ).not.toBeInTheDocument();
      expect(screen.queryByText(/rate limit/i)).not.toBeInTheDocument();
    },
  );

  it('shows connectivity guidance when no response is available', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error('Network Error'));
    renderWithProviders(<UserManagementPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Check your connection',
    );
  });

  it.each([
    {},
    [{ ...userResponse, enabled: 'true' }],
    [{ ...userResponse, role: undefined }],
    [{ ...userResponse, created_at: 'invalid' }],
    [{ ...userResponse, processAssignments: [{}] }],
    [userResponse, userResponse],
  ])('rejects malformed or duplicate user records: %j', async (data) => {
    vi.mocked(apiClient.get).mockResolvedValue({ status: 200, data });
    renderWithProviders(<UserManagementPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to read users',
    );
    expect(screen.queryAllByRole('rowheader')).toHaveLength(0);
  });

  it('cancels the request on exit and fetches again on return', async () => {
    vi.mocked(apiClient.get).mockReturnValueOnce(new Promise(() => {}));
    const { unmount } = renderWithProviders(<UserManagementPage />);
    const signal = vi.mocked(apiClient.get).mock.calls[0][1]?.signal;
    unmount();
    expect(signal?.aborted).toBe(true);
    renderWithProviders(<UserManagementPage />);
    await waitFor(() =>
      expect(screen.getAllByRole('rowheader')).toHaveLength(2),
    );
    expect(apiClient.get).toHaveBeenCalledTimes(2);
  });
});
