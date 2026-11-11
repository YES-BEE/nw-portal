import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../api/client';
import { renderWithProviders } from '../../test/render';
import { userResponse, usersResponse } from '../../test/users';
import { accessRoleOptionsResponse } from '../../test/accessRoles';
import * as accessRolesApi from './accessRolesApi';
import { readSession, setAuthenticatedSession } from '../auth/session';
import { UserEditor } from './UserEditor';
import type { UserResponse } from './types';

beforeEach(() => {
  vi.spyOn(accessRolesApi, 'getAccessRoleOptions').mockResolvedValue(
    accessRoleOptionsResponse,
  );
  vi.spyOn(apiClient, 'get').mockResolvedValue({
    status: 200,
    data: userResponse,
  });
});

describe('user detail prefill', () => {
  it('waits for the detail response before rendering inputs', async () => {
    let resolve!: (response: { status: number; data: UserResponse }) => void;
    vi.mocked(apiClient.get).mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    renderWithProviders(
      <UserEditor
        userId={userResponse.id}
        onClose={vi.fn()}
        onReload={vi.fn()}
      />,
    );
    expect(
      screen.getByRole('status', { name: 'Loading user details...' }),
    ).toBeVisible();
    expect(
      screen.queryByRole('textbox', { name: /Username/ }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await act(async () => resolve({ status: 200, data: userResponse }));
    expect(screen.getByRole('textbox', { name: /Username/ })).toHaveValue(
      'admin',
    );
  });

  it('prefills null roles and inactive accounts', async () => {
    const record = usersResponse[1];
    vi.mocked(apiClient.get).mockResolvedValue({ status: 200, data: record });
    renderWithProviders(
      <UserEditor userId={record.id} onClose={vi.fn()} onReload={vi.fn()} />,
    );
    expect(
      await screen.findByRole('textbox', { name: /Username/ }),
    ).toHaveValue('operator');
    expect(screen.getByRole('combobox', { name: /Role/ })).toHaveTextContent(
      'Select a role',
    );
    expect(
      screen.queryByRole('combobox', { name: 'Status' }),
    ).not.toBeInTheDocument();
  });

  it('displays the backend reason and retries a transient error when requested', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      status: 503,
      data: { detail: 'Maintenance in progress' },
    });
    const user = userEvent.setup();
    renderWithProviders(
      <UserEditor
        userId={userResponse.id}
        onClose={vi.fn()}
        onReload={vi.fn()}
      />,
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Maintenance in progress',
    );
    expect(
      screen.queryByRole('textbox', { name: /Username/ }),
    ).not.toBeInTheDocument();
    expect(apiClient.get).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(
      await screen.findByRole('textbox', { name: /Username/ }),
    ).toHaveValue('admin');
    expect(apiClient.get).toHaveBeenCalledTimes(2);
  });

  it('preserves permission failures without offering repeated requests', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      status: 403,
      data: { code: 'ACCESS_DENIED', detail: 'Missing module access: users' },
    });
    renderWithProviders(
      <UserEditor
        userId={userResponse.id}
        onClose={vi.fn()}
        onReload={vi.fn()}
      />,
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Missing module access: users',
    );
    expect(
      screen.queryByRole('button', { name: 'Try again' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('textbox', { name: /Username/ }),
    ).not.toBeInTheDocument();
  });

  it.each([400, 404])(
    'offers reload for invalid or missing user identifiers: HTTP %s',
    async (status) => {
      const reload = vi.fn();
      vi.mocked(apiClient.get).mockResolvedValue({ status, data: {} });
      const user = userEvent.setup();
      renderWithProviders(
        <UserEditor
          userId={userResponse.id}
          onClose={vi.fn()}
          onReload={reload}
        />,
      );
      expect(await screen.findByRole('alert')).toHaveTextContent(
        `HTTP ${status}`,
      );
      await user.click(screen.getByRole('button', { name: 'Reload users' }));
      expect(reload).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    { status: 401, data: '' },
    {
      status: 403,
      data: {
        type: 'about:blank',
        title: 'Forbidden',
        status: 403,
        code: 'ACCESS_DENIED',
        detail: 'Role changed; log in again',
      },
    },
  ])(
    'offers sign-in again for authentication failures: %j',
    async (response) => {
      setAuthenticatedSession({
        user: { id: 'admin', username: 'admin', role: 'NW', status: 'Active' },
        modules: ['users'],
      });
      vi.mocked(apiClient.get).mockResolvedValue(response);
      const user = userEvent.setup();
      renderWithProviders(
        <UserEditor
          userId={userResponse.id}
          onClose={vi.fn()}
          onReload={vi.fn()}
        />,
      );
      await screen.findByRole('alert');
      await user.click(screen.getByRole('button', { name: 'Back to sign in' }));
      expect(readSession()).toBeNull();
    },
  );

  it.each([500, 502, 503, 504])(
    'handles HTML service errors without exposing proxy content: HTTP %s',
    async (status) => {
      vi.mocked(apiClient.get).mockResolvedValue({
        status,
        data: '<html>Proxy diagnostics</html>',
      });
      renderWithProviders(
        <UserEditor
          userId={userResponse.id}
          onClose={vi.fn()}
          onReload={vi.fn()}
        />,
      );
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Unable to load user details',
      );
      expect(screen.queryByText('Proxy diagnostics')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Try again' })).toBeVisible();
    },
  );

  it('handles a network rejection without rendering a partial form', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error('Network Error'));
    renderWithProviders(
      <UserEditor
        userId={userResponse.id}
        onClose={vi.fn()}
        onReload={vi.fn()}
      />,
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Check your connection',
    );
    expect(
      screen.queryByRole('textbox', { name: /Username/ }),
    ).not.toBeInTheDocument();
  });

  it.each([
    {},
    [],
    { ...userResponse, id: 'different-user-id' },
    { ...userResponse, processAssignments: null },
  ])('rejects malformed or mismatched detail responses: %j', async (data) => {
    vi.mocked(apiClient.get).mockResolvedValue({ status: 200, data });
    renderWithProviders(
      <UserEditor
        userId={userResponse.id}
        onClose={vi.fn()}
        onReload={vi.fn()}
      />,
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The service returned an unexpected response',
    );
    expect(
      screen.queryByRole('textbox', { name: /Username/ }),
    ).not.toBeInTheDocument();
  });

  it('cancels an in-flight detail request on close and ignores its late response', async () => {
    let resolve!: (response: { status: number; data: UserResponse }) => void;
    vi.mocked(apiClient.get).mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const close = vi.fn();
    const user = userEvent.setup();
    const view = renderWithProviders(
      <UserEditor
        userId={userResponse.id}
        onClose={close}
        onReload={vi.fn()}
      />,
    );
    const signal = vi.mocked(apiClient.get).mock.calls[0][1]?.signal;
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(close).toHaveBeenCalledTimes(1);
    view.unmount();
    expect(signal?.aborted).toBe(true);
    await act(async () => resolve({ status: 200, data: userResponse }));
    expect(
      screen.queryByRole('textbox', { name: /Username/ }),
    ).not.toBeInTheDocument();
  });
});
