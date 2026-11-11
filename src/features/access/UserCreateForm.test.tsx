import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../api/client';
import { renderWithProviders } from '../../test/render';
import { accessRoleOptionsResponse } from '../../test/accessRoles';
import { userResponse } from '../../test/users';
import { readSession, setAuthenticatedSession } from '../auth/session';
import * as accessRolesApi from './accessRolesApi';
import { createUser } from './usersApi';
import { UserForm } from './UserForm';

beforeEach(() => {
  vi.spyOn(accessRolesApi, 'getAccessRoleOptions').mockResolvedValue(
    accessRoleOptionsResponse,
  );
  vi.spyOn(apiClient, 'post').mockResolvedValue({
    status: 200,
    data: userResponse,
  });
});

async function fillForm() {
  const user = userEvent.setup();
  const view = renderWithProviders(
    <UserForm onClose={vi.fn()} onCreate={createUser} />,
  );
  await user.type(
    screen.getByRole('textbox', { name: /Username/ }),
    'new.manager',
  );
  await user.type(
    screen.getByRole('textbox', { name: /Display Name/ }),
    'New Manager',
  );
  await user.type(
    screen.getByLabelText(/Initial Password/),
    ' secret password ',
  );
  const role = screen.getByRole('combobox', { name: /Role/ });
  await waitFor(() =>
    expect(role).not.toHaveAttribute('aria-disabled', 'true'),
  );
  await user.click(role);
  await user.click(screen.getByRole('option', { name: 'IT Admin' }));
  return { user, view };
}

describe('user creation failures', () => {
  it('renders backend validation beside every corresponding field and clears stale field errors on edits', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      status: 400,
      data: {
        code: 'VALIDATION_FAILED',
        detail: 'Request validation failed',
        fieldErrors: {
          username: 'Username rejected',
          displayName: 'Display name rejected',
          initialPassword: 'Password rejected',
          role: 'Role rejected',
          extra: 'Do not show',
        },
      },
    });
    const { user } = await fillForm();
    await user.click(screen.getByRole('button', { name: 'Save User' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Request validation failed',
    );
    expect(
      screen.getByRole('textbox', { name: /Username/ }),
    ).toHaveAccessibleDescription('Username rejected');
    expect(
      screen.getByRole('textbox', { name: /Display Name/ }),
    ).toHaveAccessibleDescription('Display name rejected');
    expect(
      screen.getByLabelText(/Initial Password/),
    ).toHaveAccessibleDescription('Password rejected');
    expect(
      screen.getByRole('combobox', { name: /Role/ }),
    ).toHaveAccessibleDescription('Role rejected');
    expect(screen.queryByText('Do not show')).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Initial Password/)).toHaveValue(
      ' secret password ',
    );
    await user.type(
      screen.getByRole('textbox', { name: /Username/ }),
      '.updated',
    );
    expect(screen.queryByText('Username rejected')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save User' }));
    await waitFor(() => expect(apiClient.post).toHaveBeenCalledTimes(2));
    expect(vi.mocked(apiClient.post).mock.calls[1][1]).toMatchObject({
      username: 'new.manager.updated',
      initialPassword: ' secret password ',
      role: 'ADMIN_IT',
      processAssignments: [],
    });
  });

  it.each([
    {
      status: 400,
      data: { code: 'INVALID_ARGUMENT', detail: 'Invalid user settings' },
      reason: 'Invalid user settings',
    },
    {
      status: 403,
      data: { code: 'ACCESS_DENIED', detail: 'Missing module access: users' },
      reason: 'Missing module access: users',
    },
    {
      status: 404,
      data: { code: 'NOT_FOUND', detail: 'Requested resource was not found' },
      reason: 'Requested resource was not found',
    },
    {
      status: 409,
      data: {
        code: 'DATA_CONFLICT',
        detail:
          'The operation violates a uniqueness, reference, or state constraint',
      },
      reason:
        'The operation violates a uniqueness, reference, or state constraint',
    },
    {
      status: 500,
      data: '',
      reason: 'The user service could not complete the request',
    },
    {
      status: 502,
      data: '<html>Proxy diagnostic</html>',
      reason: 'The user service could not complete the request',
    },
    {
      status: 503,
      data: '{broken',
      reason: 'The user service could not complete the request',
    },
    {
      status: 504,
      data: { unexpected: true },
      reason: 'The user service could not complete the request',
    },
  ])(
    'preserves the draft and backend reason without automatic resubmission: HTTP $status',
    async ({ status, data, reason }) => {
      vi.mocked(apiClient.post).mockResolvedValue({ status, data });
      const { user } = await fillForm();
      await user.click(screen.getByRole('button', { name: 'Save User' }));
      expect(await screen.findByRole('alert')).toHaveTextContent(reason);
      expect(screen.getByRole('alert')).toHaveTextContent(`HTTP ${status}`);
      expect(screen.getByRole('textbox', { name: /Username/ })).toHaveValue(
        'new.manager',
      );
      expect(screen.getByLabelText(/Initial Password/)).toHaveValue(
        ' secret password ',
      );
      expect(apiClient.post).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('button', { name: 'Save User' })).toBeEnabled();
      expect(screen.queryByText('Proxy diagnostic')).not.toBeInTheDocument();
    },
  );

  it('handles a rejected network request and permits manual resubmission', async () => {
    vi.mocked(apiClient.post).mockRejectedValueOnce(new Error('Network Error'));
    const { user } = await fillForm();
    await user.click(screen.getByRole('button', { name: 'Save User' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Check your connection',
    );
    await user.click(screen.getByRole('button', { name: 'Save User' }));
    await waitFor(() => expect(apiClient.post).toHaveBeenCalledTimes(2));
  });

  it.each([
    { status: 401, data: '' },
    {
      status: 403,
      data: {
        type: 'about:blank',
        title: 'Forbidden',
        status: 403,
        detail: 'Role changed; log in again',
        code: 'ACCESS_DENIED',
      },
    },
  ])('offers sign-in for authentication failures: %j', async (response) => {
    setAuthenticatedSession({
      user: { id: 'admin', username: 'admin', role: 'NW', status: 'Active' },
      modules: ['users'],
    });
    vi.mocked(apiClient.post).mockResolvedValue(response);
    const { user } = await fillForm();
    await user.click(screen.getByRole('button', { name: 'Save User' }));
    await screen.findByRole('alert');
    await user.click(screen.getByRole('button', { name: 'Back to sign in' }));
    expect(readSession()).toBeNull();
  });

  it('prevents duplicate submissions and aborts a pending create when leaving', async () => {
    vi.mocked(apiClient.post).mockReturnValue(new Promise(() => {}));
    const { user, view } = await fillForm();
    await user.click(screen.getByRole('button', { name: 'Save User' }));
    const submit = screen.getByRole('button', { name: 'Creating...' });
    expect(submit).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: /Role/ })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    fireEvent.submit(submit.closest('form')!);
    expect(apiClient.post).toHaveBeenCalledTimes(1);
    const signal = vi.mocked(apiClient.post).mock.calls[0][2]?.signal;
    view.unmount();
    expect(signal?.aborted).toBe(true);
  });
});
