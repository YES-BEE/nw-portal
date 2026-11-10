import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../api/client';
import en from '../../i18n/locales/en.json';
import { renderWithProviders } from '../../test/render';
import { defaultRoles } from '../../test/fixtures';
import { readSession, setAuthenticatedSession } from '../auth/session';
import { ACCESS_STORAGE_KEY } from './accessData';
import { RoleManagementPage } from './RoleManagementPage';
import type { AccessRolesResponse } from './types';

const roles: AccessRolesResponse = defaultRoles.map((role) => ({
  code: role.name.toUpperCase().replaceAll(' ', '_'),
  name: role.name,
  description: role.name,
  built_in: true,
  active: true,
  pc_access: true,
  pad_access: true,
  permissions: ['READ'],
  modules: role.modules,
}));

beforeEach(() => {
  vi.spyOn(apiClient, 'get').mockResolvedValue({ status: 200, data: roles });
  vi.spyOn(apiClient, 'put').mockResolvedValue({ status: 204, data: null });
  vi.spyOn(apiClient, 'post').mockResolvedValue({
    status: 200,
    data: { code: 'CUSTOM_OPS' },
  });
});

describe('backend role management', () => {
  it('loads all roles and their exact module mappings without using local roles', async () => {
    const saved = JSON.stringify({
      users: [],
      roles: [{ name: 'Local only', modules: [] }],
    });
    localStorage.setItem(ACCESS_STORAGE_KEY, saved);
    renderWithProviders(<RoleManagementPage />);
    await screen.findByRole('rowheader', { name: 'IT Admin' });
    expect(apiClient.get).toHaveBeenCalledWith(
      'access-roles',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(screen.getAllByRole('rowheader')).toHaveLength(roles.length);
    for (const role of roles) {
      const row = screen
        .getByRole('rowheader', { name: role.name })
        .closest('tr')!;
      const cells = within(row).getAllByRole('cell');
      expect(
        Array.from(
          cells[0].querySelectorAll('.MuiChip-label'),
          (chip) => chip.textContent,
        ),
      ).toEqual(
        role.modules.map(
          (key) => en.access.modules[key as keyof typeof en.access.modules],
        ),
      );
      if (!role.modules.length)
        expect(within(row).getByText('No access')).toBeVisible();
    }
    const styleRow = screen
      .getByRole('rowheader', { name: 'Style Configurator' })
      .closest('tr')!;
    expect(within(styleRow).getByText('New Style')).toBeVisible();
    expect(screen.queryByText('Local only')).not.toBeInTheDocument();
    expect(localStorage.getItem(ACCESS_STORAGE_KEY)).toBe(saved);
    expect(
      screen.getByRole('button', { name: 'Create New Role' }),
    ).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Edit IT Admin' })).toBeEnabled();
    expect(
      screen.getByRole('button', { name: 'Delete IT Admin' }),
    ).toBeDisabled();
  });

  it('shows loading until the response arrives', async () => {
    let resolve!: (value: {
      status: number;
      data: AccessRolesResponse;
    }) => void;
    vi.mocked(apiClient.get).mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    renderWithProviders(<RoleManagementPage />);
    expect(screen.getByRole('progressbar')).toBeVisible();
    expect(screen.queryAllByRole('rowheader')).toHaveLength(0);
    await act(async () => resolve({ status: 200, data: roles }));
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.getAllByRole('rowheader')).toHaveLength(roles.length);
  });

  it('handles an empty list', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ status: 200, data: [] });
    renderWithProviders(<RoleManagementPage />);
    expect(await screen.findByText('No roles found.')).toBeVisible();
  });

  it('displays backend error detail and retries the request', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      status: 503,
      data: { detail: 'Role service unavailable' },
    });
    const user = userEvent.setup();
    renderWithProviders(<RoleManagementPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Role service unavailable',
    );
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByRole('rowheader', { name: 'NW' });
    expect(apiClient.get).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('handles rejected network requests', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error('Network Error'));
    renderWithProviders(<RoleManagementPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to connect',
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Check your connection',
    );
  });

  it.each([
    { unexpected: true },
    [{ ...roles[0], modules: null }],
    [{ ...roles[0], active: 'true' }],
    [roles[0], roles[0]],
  ])(
    'rejects malformed responses without rendering partial mappings: %j',
    async (data) => {
      vi.mocked(apiClient.get).mockResolvedValue({ status: 200, data });
      renderWithProviders(<RoleManagementPage />);
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Unable to read roles',
      );
      expect(screen.queryAllByRole('rowheader')).toHaveLength(0);
    },
  );

  it('keeps unknown module keys visible and includes inactive roles', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      status: 200,
      data: [{ ...roles[0], active: false, modules: ['future-module'] }],
    });
    renderWithProviders(<RoleManagementPage />);
    expect(await screen.findByText('future-module')).toBeVisible();
  });

  it('shows an access-denied reason without offering a futile retry', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      status: 403,
      data: {
        type: 'about:blank',
        title: 'Forbidden',
        status: 403,
        code: 'ACCESS_DENIED',
        detail: 'Missing module access: roles',
      },
    });
    renderWithProviders(<RoleManagementPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Missing module access: roles',
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Access denied');
    expect(
      screen.queryByRole('button', { name: 'Try again' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Back to sign in' }),
    ).not.toBeInTheDocument();
  });

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
    'offers sign-in again when credentials must be renewed: %j',
    async (response) => {
      setAuthenticatedSession({
        user: { id: 'admin', username: 'admin', role: 'NW', status: 'Active' },
        modules: ['roles'],
      });
      vi.mocked(apiClient.get).mockResolvedValue(response);
      const user = userEvent.setup();
      renderWithProviders(<RoleManagementPage />);
      await screen.findByRole('alert');
      expect(
        screen.queryByRole('button', { name: 'Try again' }),
      ).not.toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Back to sign in' }));
      expect(readSession()).toBeNull();
    },
  );

  it.each([500, 502, 503, 504])(
    'handles HTML/empty service failures without exposing proxy content: %s',
    async (status) => {
      vi.mocked(apiClient.get).mockResolvedValue({
        status,
        data: '<html><body>Internal proxy error</body></html>',
      });
      renderWithProviders(<RoleManagementPage />);
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Roles are temporarily unavailable',
      );
      expect(screen.getByRole('alert')).toHaveTextContent(`HTTP ${status}`);
      expect(
        screen.queryByText(/Internal proxy error/),
      ).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Try again' })).toBeVisible();
    },
  );

  it('cancels the request when leaving the page and fetches again on return', async () => {
    vi.mocked(apiClient.get).mockReturnValueOnce(new Promise(() => {}));
    const { unmount } = renderWithProviders(<RoleManagementPage />);
    const signal = vi.mocked(apiClient.get).mock.calls[0][1]?.signal;
    unmount();
    expect(signal?.aborted).toBe(true);
    renderWithProviders(<RoleManagementPage />);
    await waitFor(() =>
      expect(screen.getAllByRole('rowheader')).toHaveLength(roles.length),
    );
    expect(apiClient.get).toHaveBeenCalledTimes(2);
  });

  it('creates a named role through POST and reloads the authoritative backend list', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RoleManagementPage />);
    await screen.findByRole('rowheader', { name: 'NW' });
    await user.click(screen.getByRole('button', { name: 'Create New Role' }));
    await user.type(
      screen.getByRole('textbox', { name: /Role Name/ }),
      ' Custom Operations ',
    );
    expect(
      screen.queryByRole('textbox', { name: /Role Code/ }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: 'Dashboard' }));
    await user.click(
      screen.getByRole('checkbox', { name: 'Reports/Analysis' }),
    );
    await user.click(screen.getByRole('checkbox', { name: 'PAD access' }));
    vi.mocked(apiClient.get).mockResolvedValue({
      status: 200,
      data: [
        ...roles,
        {
          ...roles[0],
          code: 'CUSTOM_OPS',
          name: 'Custom Operations',
          modules: ['dashboard', 'reports'],
          pad_access: false,
        },
      ],
    });
    await user.click(screen.getByRole('button', { name: 'Save Role' }));
    expect(apiClient.post).toHaveBeenCalledWith(
      'access-roles',
      {
        name: 'Custom Operations',
        modules: ['dashboard', 'reports'],
        pcAccess: true,
        padAccess: false,
      },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(apiClient.put).not.toHaveBeenCalled();
    expect(
      await screen.findByRole('rowheader', { name: 'Custom Operations' }),
    ).toBeVisible();
    expect(
      screen.queryByRole('textbox', { name: /Role Name/ }),
    ).not.toBeInTheDocument();
    expect(apiClient.get).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Changes saved successfully.')).toBeVisible();
  });

  it('displays the role name while editing by backend code and preserving unknown mappings', async () => {
    const record = {
      ...roles[0],
      code: 'ADMIN_IT',
      name: 'IT Admin',
      modules: ['dashboard', 'future-module'],
      pc_access: false,
      pad_access: true,
    };
    vi.mocked(apiClient.get).mockResolvedValue({ status: 200, data: [record] });
    const user = userEvent.setup();
    renderWithProviders(<RoleManagementPage />);
    await screen.findByRole('rowheader', { name: 'IT Admin' });
    await user.click(screen.getByRole('button', { name: 'Edit IT Admin' }));
    expect(screen.getByRole('textbox', { name: /Role Name/ })).toHaveValue(
      'IT Admin',
    );
    expect(screen.getByRole('textbox', { name: /Role Name/ })).toHaveAttribute(
      'readonly',
    );
    expect(
      screen.queryByRole('textbox', { name: /Role Code/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('checkbox', { name: 'PC access' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'PAD access' })).toBeChecked();
    expect(
      screen.getByRole('checkbox', { name: 'future-module' }),
    ).toBeChecked();
    await user.click(screen.getByRole('checkbox', { name: 'Dashboard' }));
    await user.click(screen.getByRole('button', { name: 'Save Role' }));
    await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(2));
    expect(apiClient.put).toHaveBeenCalledWith(
      'access-roles/ADMIN_IT',
      {
        modules: ['future-module'],
        pcAccess: true,
        padAccess: true,
      },
      expect.anything(),
    );
  });

  it('disables PC access when the last module is removed while preserving PAD access', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      status: 200,
      data: [
        {
          ...roles[0],
          name: 'PC Role',
          code: 'PC_ROLE',
          modules: ['dashboard'],
          pc_access: true,
          pad_access: true,
        },
      ],
    });
    const user = userEvent.setup();
    renderWithProviders(<RoleManagementPage />);
    await screen.findByRole('rowheader', { name: 'PC Role' });
    await user.click(screen.getByRole('button', { name: 'Edit PC Role' }));
    await user.click(screen.getByRole('checkbox', { name: 'Dashboard' }));
    expect(screen.getByRole('checkbox', { name: 'PAD access' })).toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Save Role' }));
    await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(2));
    expect(apiClient.put).toHaveBeenCalledWith(
      'access-roles/PC_ROLE',
      { modules: [], pcAccess: false, padAccess: true },
      expect.anything(),
    );
  });

  it('validates blank and duplicate role names against the API list', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RoleManagementPage />);
    await screen.findByRole('rowheader', { name: 'NW' });
    await user.click(screen.getByRole('button', { name: 'Create New Role' }));
    await user.click(screen.getByRole('button', { name: 'Save Role' }));
    const name = screen.getByRole('textbox', { name: /Role Name/ });
    expect(name).toHaveAccessibleDescription('Enter a role name.');
    await user.type(name, ' nw ');
    await user.click(screen.getByRole('button', { name: 'Save Role' }));
    expect(name).toHaveAccessibleDescription('This role already exists.');
    expect(apiClient.put).not.toHaveBeenCalled();
    expect(apiClient.post).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(
      screen.queryByRole('textbox', { name: /Role Name/ }),
    ).not.toBeInTheDocument();
  });

  it('retains the new role name after a failed POST and permits manual resubmission', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      status: 400,
      data: { detail: 'Role creation rejected' },
    });
    const user = userEvent.setup();
    renderWithProviders(<RoleManagementPage />);
    await screen.findByRole('rowheader', { name: 'NW' });
    await user.click(screen.getByRole('button', { name: 'Create New Role' }));
    await user.type(
      screen.getByRole('textbox', { name: /Role Name/ }),
      'Factory Operator',
    );
    await user.click(screen.getByRole('button', { name: 'Save Role' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Role creation rejected',
    );
    expect(screen.getByRole('textbox', { name: /Role Name/ })).toHaveValue(
      'Factory Operator',
    );
    expect(apiClient.get).toHaveBeenCalledTimes(1);
    expect(apiClient.post).toHaveBeenCalledTimes(1);
    expect(apiClient.put).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Save Role' }));
    await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(2));
    expect(apiClient.post).toHaveBeenCalledTimes(2);
  });

  it('keeps the draft and backend reason on failure, then permits resubmission', async () => {
    vi.mocked(apiClient.put).mockResolvedValueOnce({
      status: 400,
      data: { detail: 'Unknown module assignment' },
    });
    const user = userEvent.setup();
    renderWithProviders(<RoleManagementPage />);
    await screen.findByRole('rowheader', { name: 'NW' });
    await user.click(screen.getByRole('button', { name: 'Edit NW' }));
    await user.click(screen.getByRole('button', { name: 'Save Role' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unknown module assignment',
    );
    expect(screen.getByRole('textbox', { name: /Role Name/ })).toHaveValue(
      'NW',
    );
    expect(apiClient.get).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByText('Changes saved successfully.'),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save Role' }));
    await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(2));
    expect(apiClient.put).toHaveBeenCalledTimes(2);
  });

  it('shows POST validation reasons beside the controls and clears them as fields change', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      status: 400,
      data: {
        code: 'VALIDATION_FAILED',
        detail: 'Request validation failed',
        fieldErrors: {
          name: 'Name rejected by server',
          modules: 'Module selection rejected',
          pcAccess: 'PC settings rejected',
          padAccess: 'PAD settings rejected',
          ignored: 'Do not display',
        },
      },
    });
    const user = userEvent.setup();
    renderWithProviders(<RoleManagementPage />);
    await screen.findByRole('rowheader', { name: 'NW' });
    await user.click(screen.getByRole('button', { name: 'Create New Role' }));
    await user.type(
      screen.getByRole('textbox', { name: /Role Name/ }),
      'Factory Operator',
    );
    await user.click(screen.getByRole('button', { name: 'Save Role' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to create role',
    );
    expect(
      screen.getByRole('textbox', { name: /Role Name/ }),
    ).toHaveAccessibleDescription('Name rejected by server');
    expect(
      screen.getByText('Module selection rejected PC settings rejected'),
    ).toBeVisible();
    expect(screen.getByText('PAD settings rejected')).toBeVisible();
    expect(screen.queryByText('Do not display')).not.toBeInTheDocument();
    await user.type(
      screen.getByRole('textbox', { name: /Role Name/ }),
      ' updated',
    );
    await user.click(screen.getByRole('checkbox', { name: 'Dashboard' }));
    await user.click(screen.getByRole('checkbox', { name: 'PAD access' }));
    expect(
      screen.queryByText('Name rejected by server'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('Module selection rejected PC settings rejected'),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('PAD settings rejected')).not.toBeInTheDocument();
    expect(apiClient.get).toHaveBeenCalledTimes(1);
  });

  it('keeps a missing role draft until the user explicitly reloads the roles', async () => {
    vi.mocked(apiClient.put).mockResolvedValue({
      status: 404,
      data: { code: 'NOT_FOUND', detail: 'Requested resource was not found' },
    });
    const user = userEvent.setup();
    renderWithProviders(<RoleManagementPage />);
    await screen.findByRole('rowheader', { name: 'NW' });
    await user.click(screen.getByRole('button', { name: 'Edit NW' }));
    await user.click(screen.getByRole('button', { name: 'Save Role' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to update role',
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Requested resource was not found',
    );
    expect(screen.getByRole('textbox', { name: /Role Name/ })).toHaveValue(
      'NW',
    );
    expect(apiClient.get).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Reload roles' }));
    await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(2));
    expect(
      screen.queryByRole('textbox', { name: /Role Name/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('Changes saved successfully.'),
    ).not.toBeInTheDocument();
  });

  it.each([400, 409, 503])(
    'retains the PUT draft and renders safe fallback text for HTTP %s',
    async (status) => {
      vi.mocked(apiClient.put).mockResolvedValue({
        status,
        data: '<html>Proxy page</html>',
      });
      const user = userEvent.setup();
      renderWithProviders(<RoleManagementPage />);
      await screen.findByRole('rowheader', { name: 'NW' });
      await user.click(screen.getByRole('button', { name: 'Edit NW' }));
      await user.click(screen.getByRole('button', { name: 'Save Role' }));
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Unable to update role',
      );
      expect(screen.getByRole('alert')).toHaveTextContent(`HTTP ${status}`);
      expect(screen.getByRole('textbox', { name: /Role Name/ })).toHaveValue(
        'NW',
      );
      expect(screen.getByRole('button', { name: 'Save Role' })).toBeEnabled();
      expect(screen.queryByText('Proxy page')).not.toBeInTheDocument();
      expect(apiClient.put).toHaveBeenCalledTimes(1);
      expect(apiClient.get).toHaveBeenCalledTimes(1);
    },
  );

  it('prevents duplicate submissions and cancels a pending save when unmounted', async () => {
    vi.mocked(apiClient.put).mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    const { unmount } = renderWithProviders(<RoleManagementPage />);
    await screen.findByRole('rowheader', { name: 'NW' });
    await user.click(screen.getByRole('button', { name: 'Edit NW' }));
    await user.click(screen.getByRole('button', { name: 'Save Role' }));
    expect(screen.getByRole('button', { name: 'Saving...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    fireEvent.submit(
      screen.getByRole('button', { name: 'Saving...' }).closest('form')!,
    );
    expect(apiClient.put).toHaveBeenCalledTimes(1);
    const signal = vi.mocked(apiClient.put).mock.calls[0][2]?.signal;
    unmount();
    expect(signal?.aborted).toBe(true);
  });
});
