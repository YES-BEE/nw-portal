import { apiPage } from '../../test/apiPage';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../api/client';
import { renderWithProviders } from '../../test/render';
import { accessRolesResponse } from '../../test/accessRoles';
import { RoleManagementPage } from './RoleManagementPage';

const customRole = {
  ...accessRolesResponse[0],
  code: 'CUSTOM_OPS',
  name: 'Factory Operator',
  built_in: false,
};
beforeEach(() => {
  vi.spyOn(apiClient, 'get').mockResolvedValue({
    status: 200,
    data: apiPage([...accessRolesResponse, customRole], undefined, 10),
  });
  vi.spyOn(apiClient, 'delete').mockResolvedValue({
    status: 200,
    data: { code: customRole.code, active: false },
  });
});

async function openDelete() {
  const user = userEvent.setup();
  const view = renderWithProviders(<RoleManagementPage />);
  await screen.findByRole('rowheader', { name: customRole.name });
  await user.click(
    screen.getByRole('button', { name: 'Delete Factory Operator' }),
  );
  return { user, ...view };
}

describe('role deletion', () => {
  it('enables built-in deletion and cancels custom deletion without a request', async () => {
    const { user } = await openDelete();
    expect(screen.getByRole('dialog')).toHaveTextContent(
      'The role will become inactive.',
    );
    expect(apiClient.delete).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete NW' })).toBeEnabled();
    expect(
      screen.getByRole('button', { name: 'Delete Factory Operator' }),
    ).toBeEnabled();
  });

  it('sends built-in deletion to the backend and displays its rejection', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue({
      status: 409,
      data: {
        code: 'BUILT_IN_ROLE',
        detail: 'Built-in roles cannot be deleted',
      },
    });
    const user = userEvent.setup();
    renderWithProviders(<RoleManagementPage />);
    await user.click(await screen.findByRole('button', { name: 'Delete NW' }));
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Delete',
      }),
    );
    expect(apiClient.delete).toHaveBeenCalledWith(
      'access-roles/NW',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Built-in roles cannot be deleted',
    );
    expect(screen.getByRole('alert')).not.toHaveTextContent('HTTP 409');
    expect(apiClient.get).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('rowheader', { name: 'NW' })).toBeVisible();
  });

  it('confirms deletion, blocks duplicate submissions, and refreshes after success', async () => {
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
      'access-roles/CUSTOM_OPS',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(screen.getByRole('button', { name: 'Deleting...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(apiClient.get).toHaveBeenCalledTimes(1);
    vi.mocked(apiClient.get).mockResolvedValue({
      status: 200,
      data: apiPage(accessRolesResponse, undefined, 10),
    });
    await act(async () =>
      resolve({ status: 200, data: { code: customRole.code, active: false } }),
    );
    await screen.findByRole('rowheader', { name: 'NW' });
    expect(
      screen.queryByRole('rowheader', { name: customRole.name }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('Role deleted.')).toBeVisible();
    expect(apiClient.get).toHaveBeenCalledTimes(2);
    expect(apiClient.delete).toHaveBeenCalledTimes(1);
  });

  it.each([
    [409, 'ROLE_IN_USE', 'Reassign every user before deleting this role', null],
    [409, 'BUILT_IN_ROLE', 'Built-in roles cannot be deleted', null],
    [403, 'ACCESS_DENIED', 'Missing module access: roles', null],
    [404, 'NOT_FOUND', 'Requested resource was not found', 'Reload roles'],
    [503, undefined, 'Maintenance in progress', 'Try again'],
    [401, undefined, 'Authentication failed', 'Back to sign in'],
  ])(
    'retains the role on HTTP %s / %s and shows the appropriate action',
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
        screen.getByRole('rowheader', { name: customRole.name, hidden: true }),
      ).toBeInTheDocument();
      expect(apiClient.get).toHaveBeenCalledTimes(1);
      expect(apiClient.delete).toHaveBeenCalledTimes(1);
      if (action) {
        expect(screen.getByRole('button', { name: action })).toBeEnabled();
        if (action === 'Reload roles') {
          await user.click(screen.getByRole('button', { name: action }));
          await screen.findByRole('rowheader', { name: customRole.name });
          expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
          expect(apiClient.get).toHaveBeenCalledTimes(2);
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

  it('permits manual retry after a network failure', async () => {
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
    vi.mocked(apiClient.get).mockResolvedValue({
      status: 200,
      data: apiPage(accessRolesResponse, undefined, 10),
    });
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(apiClient.delete).toHaveBeenCalledTimes(2);
  });

  it('aborts a pending deletion on unmount', async () => {
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
