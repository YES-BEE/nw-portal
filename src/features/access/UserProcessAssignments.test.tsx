import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../api/client';
import { renderWithProviders } from '../../test/render';
import { userResponse } from '../../test/users';
import { getAccessRoleOptions } from './accessRolesApi';
import { createUser } from './usersApi';
import { UserForm } from './UserForm';
import { UserEditor } from './UserEditor';
import { UserDeleteDialog } from './UserDeleteDialog';

vi.mock('./accessRolesApi', () => ({ getAccessRoleOptions: vi.fn() }));
const processes = [
  { id: 'wash', name: 'Washing', station_id: 'station-3', stationNumber: '03' },
  { id: 'dry', name: 'Drying', station_id: 'station-4', stationNumber: '04' },
];
const manager = {
  ...userResponse,
  role: 'PROCESS_MANAGER',
  processAssignments: processes.map((process, index) => ({
    processId: process.id,
    processName: process.name,
    stationId: process.station_id,
    stationNumber: process.stationNumber,
    activeOnShift: index === 1,
    processActive: true,
    stationActive: true,
  })),
};
beforeEach(() => {
  vi.mocked(getAccessRoleOptions).mockResolvedValue([
    { code: 'PROCESS_MANAGER', name: 'Process Manager' },
    { code: 'NW', name: 'NW' },
  ]);
  vi.spyOn(apiClient, 'get').mockImplementation(async (url) => ({
    status: 200,
    data: url === 'ui/lookups' ? { processes } : manager,
  }));
  vi.spyOn(apiClient, 'post').mockResolvedValue({ status: 200, data: manager });
  vi.spyOn(apiClient, 'put').mockResolvedValue({ status: 200, data: manager });
  vi.spyOn(apiClient, 'delete').mockResolvedValue({
    status: 200,
    data: { ...manager, enabled: false },
  });
});
async function chooseRole(
  user: ReturnType<typeof userEvent.setup>,
  name: string,
) {
  const role = screen.getByRole('combobox', { name: /Role/ });
  await waitFor(() =>
    expect(role).not.toHaveAttribute('aria-disabled', 'true'),
  );
  await user.click(role);
  await user.click(screen.getByRole('option', { name }));
}
async function createManager() {
  const user = userEvent.setup();
  const view = renderWithProviders(
    <UserForm onClose={vi.fn()} onCreate={createUser} />,
  );
  await user.type(screen.getByRole('textbox', { name: /Username/ }), 'manager');
  await user.type(
    screen.getByRole('textbox', { name: /Display Name/ }),
    'Manager',
  );
  await user.type(screen.getByLabelText(/Initial Password/), 'Password123!');
  await chooseRole(user, 'Process Manager');
  await waitFor(() =>
    expect(
      screen.getByRole('combobox', { name: 'Assigned Processes' }),
    ).not.toHaveAttribute('aria-disabled', 'true'),
  );
  return { user, ...view };
}
async function selectProcesses(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    screen.getByRole('combobox', { name: 'Assigned Processes' }),
  );
  await user.click(
    screen.getByRole('option', { name: 'Washing (Station 03)' }),
  );
  await user.click(screen.getByRole('option', { name: 'Drying (Station 04)' }));
  await user.keyboard('{Escape}');
}
describe('user process assignments', () => {
  it('creates a Process Manager with multiple selected processes and chip labels', async () => {
    const { user } = await createManager();
    await selectProcesses(user);
    expect(
      screen.getByRole('button', { name: 'Washing (Station 03)' }),
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Drying (Station 04)' }),
    ).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Save User' }));
    expect(apiClient.post).toHaveBeenCalledWith(
      'users',
      expect.objectContaining({
        role: 'PROCESS_MANAGER',
        processAssignments: [
          { processId: 'wash', activeOnShift: true },
          { processId: 'dry', activeOnShift: true },
        ],
      }),
      expect.anything(),
    );
  });

  it('clears hidden assignments when changing to a different role', async () => {
    const { user } = await createManager();
    await selectProcesses(user);
    await chooseRole(user, 'NW');
    expect(
      screen.queryByRole('combobox', { name: 'Assigned Processes' }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save User' }));
    expect(apiClient.post).toHaveBeenCalledWith(
      'users',
      expect.objectContaining({ role: 'NW', processAssignments: [] }),
      expect.anything(),
    );
  });

  it('prefills assignments, removes one chip, preserves shift flags, and saves through the editor', async () => {
    const user = userEvent.setup(),
      updated = vi.fn();
    renderWithProviders(
      <UserEditor
        userId={manager.id}
        onClose={vi.fn()}
        onReload={vi.fn()}
        onUpdated={updated}
      />,
    );
    await screen.findByRole('button', { name: 'Drying (Station 04)' });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Save User' })).toBeEnabled(),
    );
    const chip = screen.getByRole('button', { name: 'Drying (Station 04)' });
    await user.click(within(chip).getByTestId('CancelIcon'));
    expect(
      screen.queryByRole('button', { name: 'Drying (Station 04)' }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save User' }));
    expect(apiClient.put).toHaveBeenCalledWith(
      `users/${manager.id}`,
      {
        username: manager.username,
        displayName: manager.display_name,
        status: manager.enabled ? 'ACTIVE' : 'INACTIVE',
        role: 'PROCESS_MANAGER',
        processAssignments: [{ processId: 'wash', activeOnShift: false }],
      },
      expect.anything(),
    );
    expect(updated).toHaveBeenCalledTimes(1);
  });

  it('keeps selected processes and shows a backend update error without its HTTP code', async () => {
    vi.mocked(apiClient.put).mockResolvedValue({
      status: 409,
      data: { code: 'DATA_CONFLICT', detail: 'Assignment is no longer valid' },
    });
    const user = userEvent.setup(),
      updated = vi.fn();
    renderWithProviders(
      <UserEditor
        userId={manager.id}
        onClose={vi.fn()}
        onReload={vi.fn()}
        onUpdated={updated}
      />,
    );
    await screen.findByRole('button', { name: 'Washing (Station 03)' });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Save User' })).toBeEnabled(),
    );
    await user.click(screen.getByRole('button', { name: 'Save User' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Assignment is no longer valid',
    );
    expect(screen.getByRole('alert')).not.toHaveTextContent('HTTP 409');
    expect(
      screen.getByRole('button', { name: 'Washing (Station 03)' }),
    ).toBeVisible();
    expect(updated).not.toHaveBeenCalled();
  });

  it('supports removing assignments for processes that are no longer available', async () => {
    vi.mocked(apiClient.get).mockImplementation(async (url) => ({
      status: 200,
      data: url === 'ui/lookups' ? { processes: [] } : manager,
    }));
    const user = userEvent.setup();
    renderWithProviders(
      <UserEditor userId={manager.id} onClose={vi.fn()} onReload={vi.fn()} />,
    );
    await screen.findByText(
      'Some assigned processes are no longer available. Remove them before saving.',
    );
    for (const name of ['Washing (Station 03)', 'Drying (Station 04)'])
      await user.click(
        within(screen.getByRole('button', { name })).getByTestId('CancelIcon'),
      );
    await user.click(screen.getByRole('button', { name: 'Save User' }));
    expect(apiClient.put).toHaveBeenCalledWith(
      `users/${manager.id}`,
      expect.objectContaining({ processAssignments: [] }),
      expect.anything(),
    );
  });

  it('blocks save when process lookup fails and permits a manual retry', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      status: 503,
      data: { detail: 'Process lookup unavailable' },
    });
    const user = userEvent.setup();
    renderWithProviders(
      <UserForm initial={manager} onUpdate={vi.fn()} onClose={vi.fn()} />,
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Process lookup unavailable',
    );
    expect(screen.getByRole('button', { name: 'Save User' })).toBeDisabled();
    expect(screen.getByRole('alert')).not.toHaveTextContent('HTTP 503');
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Save User' })).toBeEnabled(),
    );
  });

  it('deletes a Process Manager by disabling the account without clearing assignments', async () => {
    const user = userEvent.setup(),
      deleted = vi.fn();
    renderWithProviders(
      <UserDeleteDialog
        user={manager}
        onClose={vi.fn()}
        onReload={vi.fn()}
        onDeleted={deleted}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(apiClient.delete).toHaveBeenCalledWith(
      `users/${manager.id}`,
      expect.anything(),
    );
    expect(apiClient.put).not.toHaveBeenCalled();
    expect(deleted).toHaveBeenCalledTimes(1);
  });
});
