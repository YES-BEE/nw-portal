import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../api/client';
import { renderWithProviders } from '../../test/render';
import { accessRolesResponse } from '../../test/accessRoles';
import { userResponse } from '../../test/users';
import { readSession, setAuthenticatedSession } from '../auth/session';
import type { AccessRolesResponse } from './types';
import { UserRoleSelect } from './UserRoleSelect';
import { UserForm } from './UserForm';

beforeEach(() => {
  vi.spyOn(apiClient, 'get').mockResolvedValue({
    status: 200,
    data: accessRolesResponse,
  });
});

describe('backend user role dropdown', () => {
  it('loads role names from GET access-roles and returns the selected code', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<UserRoleSelect value="NW" onChange={onChange} />);
    const select = screen.getByRole('combobox', { name: /Role/ });
    await waitFor(() =>
      expect(select).not.toHaveAttribute('aria-disabled', 'true'),
    );
    expect(apiClient.get).toHaveBeenCalledWith(
      'access-roles',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    await user.click(select);
    await user.click(screen.getByRole('option', { name: 'IT Admin' }));
    expect(onChange).toHaveBeenCalledWith('ADMIN_IT');
  });

  it('disables selection while loading and then prefills the matching backend name', async () => {
    let resolve!: (response: {
      status: number;
      data: AccessRolesResponse;
    }) => void;
    vi.mocked(apiClient.get).mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    renderWithProviders(<UserRoleSelect value="ADMIN_IT" onChange={vi.fn()} />);
    expect(screen.getByRole('combobox', { name: /Role/ })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(screen.getByText('Loading roles...')).toBeVisible();
    await act(async () => resolve({ status: 200, data: accessRolesResponse }));
    expect(screen.getByRole('combobox', { name: /Role/ })).toHaveTextContent(
      'IT Admin',
    );
    expect(screen.getByRole('combobox', { name: /Role/ })).not.toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });

  it('keeps an unassigned role empty rather than choosing the first option', async () => {
    const change = vi.fn();
    renderWithProviders(<UserRoleSelect value={null} onChange={change} />);
    await waitFor(() =>
      expect(
        screen.getByRole('combobox', { name: /Role/ }),
      ).not.toHaveAttribute('aria-disabled', 'true'),
    );
    expect(screen.getByRole('combobox', { name: /Role/ })).toHaveTextContent(
      'Select a role',
    );
    expect(change).not.toHaveBeenCalled();
  });

  it('preserves an unavailable assigned code and disables inactive options', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      status: 200,
      data: [
        ...accessRolesResponse,
        {
          ...accessRolesResponse[0],
          code: 'INACTIVE',
          name: 'Inactive Role',
          active: false,
        },
      ],
    });
    const change = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <UserRoleSelect value="REMOVED_ROLE" onChange={change} />,
    );
    await waitFor(() =>
      expect(
        screen.getByRole('combobox', { name: /Role/ }),
      ).not.toHaveAttribute('aria-disabled', 'true'),
    );
    expect(screen.getByRole('combobox', { name: /Role/ })).toHaveTextContent(
      'REMOVED_ROLE (unavailable)',
    );
    await user.click(screen.getByRole('combobox', { name: /Role/ }));
    expect(
      screen.getByRole('option', { name: 'Inactive Role' }),
    ).toHaveAttribute('aria-disabled', 'true');
    expect(
      screen.getByRole('option', { name: 'REMOVED_ROLE (unavailable)' }),
    ).toHaveAttribute('aria-disabled', 'true');
    expect(change).not.toHaveBeenCalled();
  });

  it('handles an empty role list without offering fabricated options', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ status: 200, data: [] });
    renderWithProviders(<UserRoleSelect value={null} onChange={vi.fn()} />);
    expect(
      await screen.findByText('No roles are available for selection.'),
    ).toBeVisible();
    expect(screen.getByRole('combobox', { name: /Role/ })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows backend failure text and preserves user form edits when retrying role loading', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      status: 503,
      data: { detail: 'Role maintenance in progress' },
    });
    const user = userEvent.setup();
    renderWithProviders(<UserForm initial={userResponse} onClose={vi.fn()} />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Role maintenance in progress',
    );
    const username = screen.getByRole('textbox', { name: /Username/ });
    await user.clear(username);
    await user.type(username, 'Edited username');
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() =>
      expect(
        screen.getByRole('combobox', { name: /Role/ }),
      ).not.toHaveAttribute('aria-disabled', 'true'),
    );
    expect(username).toHaveValue('Edited username');
    expect(screen.getByRole('combobox', { name: /Role/ })).toHaveTextContent(
      'NW',
    );
    await user.click(screen.getByRole('combobox', { name: /Role/ }));
    await user.click(screen.getByRole('option', { name: 'IT Admin' }));
    expect(screen.getByRole('combobox', { name: /Role/ })).toHaveTextContent(
      'IT Admin',
    );
    expect(apiClient.get).toHaveBeenCalledTimes(2);
  });

  it('shows a permission denial without offering a repeated request', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      status: 403,
      data: { detail: 'Missing module access: roles', code: 'ACCESS_DENIED' },
    });
    renderWithProviders(<UserRoleSelect value="NW" onChange={vi.fn()} />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Missing module access: roles',
    );
    expect(screen.getByRole('combobox', { name: /Role/ })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(
      screen.queryByRole('button', { name: 'Try again' }),
    ).not.toBeInTheDocument();
  });

  it('offers sign-in again when role loading remains unauthorized', async () => {
    setAuthenticatedSession({
      user: { id: 'admin', username: 'admin', role: 'NW', status: 'Active' },
      modules: ['users'],
    });
    vi.mocked(apiClient.get).mockResolvedValue({ status: 401, data: '' });
    const user = userEvent.setup();
    renderWithProviders(<UserRoleSelect value="NW" onChange={vi.fn()} />);
    await screen.findByRole('alert');
    await user.click(screen.getByRole('button', { name: 'Back to sign in' }));
    expect(readSession()).toBeNull();
  });

  it.each([
    { status: 503, data: '<html>Proxy page</html>' },
    { status: 200, data: { malformed: true } },
  ])(
    'handles HTML or malformed role responses gracefully: %j',
    async (response) => {
      vi.mocked(apiClient.get).mockResolvedValue(response);
      renderWithProviders(<UserRoleSelect value="NW" onChange={vi.fn()} />);
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Unable to load roles',
      );
      expect(screen.getByRole('combobox', { name: /Role/ })).toHaveAttribute(
        'aria-disabled',
        'true',
      );
      expect(screen.queryByText('Proxy page')).not.toBeInTheDocument();
    },
  );

  it('aborts a role request when the user form closes', async () => {
    vi.mocked(apiClient.get).mockReturnValue(new Promise(() => {}));
    const view = renderWithProviders(
      <UserRoleSelect value="NW" onChange={vi.fn()} />,
    );
    const signal = vi.mocked(apiClient.get).mock.calls[0][1]?.signal;
    view.unmount();
    expect(signal?.aborted).toBe(true);
  });
});
