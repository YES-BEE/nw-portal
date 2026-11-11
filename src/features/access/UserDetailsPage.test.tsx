import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../api/client';
import { renderWithProviders } from '../../test/render';
import { userResponse, usersResponse } from '../../test/users';
import { readSession, setAuthenticatedSession } from '../auth/session';
import { UserDetailsPage } from './UserDetailsPage';
import { UserManagementPage } from './UserManagementPage';

const detail = {
  ...userResponse,
  display_name: 'Fresh Manager',
  role: 'PROCESS_MANAGER',
  processAssignments: [
    {
      ...usersResponse[1].processAssignments[0],
      activeOnShift: false,
      processActive: false,
    },
    {
      ...usersResponse[1].processAssignments[0],
      processId: 'second-process',
      processName: 'Drying',
      stationNumber: '04',
      stationActive: false,
    },
  ],
};
beforeEach(() => {
  vi.spyOn(apiClient, 'get').mockImplementation(async (url) => ({
    status: 200,
    data: url === 'users' ? usersResponse : detail,
  }));
});
function setup(path = `/users/${userResponse.id}`) {
  return {
    user: userEvent.setup(),
    ...renderWithProviders(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/users" element={<UserManagementPage />} />
          <Route path="/users/:userId" element={<UserDetailsPage />} />
          <Route path="/missing-id" element={<UserDetailsPage />} />
        </Routes>
      </MemoryRouter>,
    ),
  };
}

describe('backend user details', () => {
  it('opens View from the users table, fetches fresh details, and returns to Users', async () => {
    const { user } = setup('/users');
    const view = await screen.findByRole('link', { name: 'View admin' });
    expect(view).toHaveAttribute('href', `/users/${userResponse.id}`);
    await user.click(view);
    expect(await screen.findByText('Fresh Manager')).toBeVisible();
    expect(
      screen.getByRole('heading', { level: 1, name: 'admin' }),
    ).toHaveFocus();
    expect(apiClient.get).toHaveBeenCalledWith(
      `users/${userResponse.id}`,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(screen.getByText('Process Manager')).toBeVisible();
    expect(screen.getByText('Password Change Required')).toBeVisible();
    expect(screen.getByText('Created At')).toBeVisible();
    expect(screen.queryByText(userResponse.id)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Save User' }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Back to Users' }));
    expect(
      await screen.findByRole('rowheader', { name: 'admin' }),
    ).toBeVisible();
  });

  it('shows every assignment and process and station statuses without a shift column', async () => {
    setup();
    const table = await screen.findByRole('table', {
      name: 'Assigned Processes',
    });
    const washing = within(table)
      .getByRole('rowheader', { name: 'Washing' })
      .closest('tr')!;
    expect(within(washing).getByText('03')).toBeVisible();
    expect(
      within(table).queryByRole('columnheader', { name: 'Active on Shift' }),
    ).not.toBeInTheDocument();
    expect(
      within(washing)
        .getAllByRole('cell')
        .map((cell) => cell.textContent),
    ).toEqual(['03', 'Inactive', 'Active']);
    const drying = within(table)
      .getByRole('rowheader', { name: 'Drying' })
      .closest('tr')!;
    expect(
      within(drying)
        .getAllByRole('cell')
        .map((cell) => cell.textContent),
    ).toEqual(['04', 'Active', 'Inactive']);
    expect(screen.queryByText('second-process')).not.toBeInTheDocument();
    expect(screen.queryByText('station-id')).not.toBeInTheDocument();
  });

  it('shows an empty assignment state and nullable role for an inactive user', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      status: 200,
      data: {
        ...userResponse,
        role: null,
        enabled: false,
        display_name: '',
        must_change_password: false,
      },
    });
    setup();
    expect(await screen.findByText('No processes assigned.')).toBeVisible();
    expect(screen.getByText('No role assigned')).toBeVisible();
    expect(screen.getByText('Not provided')).toBeVisible();
    expect(screen.getByText('Inactive')).toBeVisible();
  });

  it('waits for the API response before showing user details or assignments', async () => {
    let resolve!: (value: { status: number; data: unknown }) => void;
    vi.mocked(apiClient.get).mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    setup();
    expect(
      screen.getByRole('status', { name: 'Loading user details...' }),
    ).toBeVisible();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(
      screen.queryByText('No processes assigned.'),
    ).not.toBeInTheDocument();
    await act(async () => resolve({ status: 200, data: detail }));
    expect(
      screen.getByRole('table', { name: 'Assigned Processes' }),
    ).toBeVisible();
  });

  it.each([400, 404])(
    'returns to the users list for an invalid or missing user: HTTP %s',
    async (status) => {
      vi.mocked(apiClient.get).mockImplementation(async (url) =>
        url === 'users'
          ? { status: 200, data: usersResponse }
          : { status, data: { detail: 'Requested resource was not found' } },
      );
      const { user } = setup();
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Requested resource was not found',
      );
      expect(screen.getByRole('alert')).not.toHaveTextContent(`HTTP ${status}`);
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'Try again' }),
      ).not.toBeInTheDocument();
      await user.click(screen.getByRole('link', { name: 'Reload users' }));
      expect(
        await screen.findByRole('rowheader', { name: 'admin' }),
      ).toBeVisible();
    },
  );

  it('retries a service failure on request and preserves its backend message', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      status: 503,
      data: { detail: 'Maintenance in progress' },
    });
    const { user } = setup();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Maintenance in progress',
    );
    expect(screen.getByRole('alert')).not.toHaveTextContent('HTTP 503');
    expect(apiClient.get).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Fresh Manager')).toBeVisible();
    expect(apiClient.get).toHaveBeenCalledTimes(2);
  });

  it('shows permission failures without retrying', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      status: 403,
      data: { code: 'ACCESS_DENIED', detail: 'Missing module access: users' },
    });
    setup();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Missing module access: users',
    );
    expect(
      screen.queryByRole('button', { name: 'Try again' }),
    ).not.toBeInTheDocument();
  });

  it('offers sign-in when authentication expires', async () => {
    setAuthenticatedSession({
      user: { id: 'admin', username: 'admin', role: 'NW', status: 'Active' },
      modules: ['users'],
    });
    vi.mocked(apiClient.get).mockResolvedValue({
      status: 401,
      data: { detail: 'Authentication failed' },
    });
    const { user } = setup();
    await user.click(
      await screen.findByRole('button', { name: 'Back to sign in' }),
    );
    expect(readSession()).toBeNull();
  });

  it.each([
    {},
    { ...detail, id: 'wrong-user' },
    { ...detail, processAssignments: [{}] },
  ])('rejects malformed user details: %j', async (data) => {
    vi.mocked(apiClient.get).mockResolvedValue({ status: 200, data });
    setup();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The service returned an unexpected response',
    );
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('handles network failure and cancels pending requests on exit', async () => {
    vi.mocked(apiClient.get).mockRejectedValueOnce(new Error('Network Error'));
    const { user, unmount } = setup();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Check your connection',
    );
    vi.mocked(apiClient.get).mockReturnValue(new Promise(() => {}));
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    const signal = vi.mocked(apiClient.get).mock.calls.at(-1)![1]?.signal;
    unmount();
    expect(signal?.aborted).toBe(true);
  });

  it('avoids calling the API without a user identifier', async () => {
    setup('/missing-id');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to load user details',
    );
    expect(apiClient.get).not.toHaveBeenCalled();
  });
});
