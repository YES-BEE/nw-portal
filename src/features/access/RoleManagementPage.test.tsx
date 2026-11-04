import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../test/render';
import { ACCESS_STORAGE_KEY, loadAccessData } from './accessData';
import { RoleManagementPage } from './RoleManagementPage';

beforeEach(() => localStorage.clear());

describe('role management', () => {
  it('shows the reference permissions, protects built-in roles, and preserves New Style access on edit', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RoleManagementPage />);
    expect(screen.getAllByRole('rowheader')).toHaveLength(7);
    expect(screen.getByText('No access')).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Delete NW' }),
    ).not.toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: 'Edit Style Configurator' }),
    );
    expect(screen.getByRole('textbox', { name: /Role Name/ })).toHaveAttribute(
      'readonly',
    );
    expect(screen.getByRole('checkbox', { name: 'New Style' })).toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Save Role' }));
    expect(
      loadAccessData().records.roles.find(
        (role) => role.name === 'Style Configurator',
      )?.modules,
    ).toEqual(['newstyle']);
  });

  it('validates blank and duplicate names, then creates and persists a role with selected permissions', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RoleManagementPage />);
    await user.click(screen.getByRole('button', { name: 'Create New Role' }));
    const name = screen.getByRole('textbox', { name: /Role Name/ });
    await user.click(screen.getByRole('button', { name: 'Save Role' }));
    expect(name).toHaveAccessibleDescription('Enter a role name.');
    await user.type(name, ' nw ');
    await user.click(screen.getByRole('button', { name: 'Save Role' }));
    expect(name).toHaveAccessibleDescription('This role already exists.');
    await user.clear(name);
    await user.type(name, ' Auditor ');
    await user.click(
      screen.getByRole('checkbox', { name: 'Reports/Analysis' }),
    );
    await user.click(screen.getByRole('button', { name: 'Save Role' }));
    expect(
      loadAccessData().records.roles.find((role) => role.name === 'Auditor'),
    ).toEqual({ name: 'Auditor', modules: ['reports'] });
    expect(screen.getByRole('rowheader', { name: 'Auditor' })).toBeVisible();
  });

  it('discards cancelled permission changes and supports roles with no access', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RoleManagementPage />);
    await user.click(
      screen.getByRole('button', { name: 'Edit Process Manager' }),
    );
    await user.click(screen.getByRole('checkbox', { name: 'Dashboard' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(localStorage.getItem(ACCESS_STORAGE_KEY)).toBeNull();
    await user.click(
      screen.getByRole('button', { name: 'Edit Process Manager' }),
    );
    expect(
      screen.getByRole('checkbox', { name: 'Dashboard' }),
    ).not.toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Save Role' }));
    expect(
      loadAccessData().records.roles.find(
        (role) => role.name === 'Process Manager',
      )?.modules,
    ).toEqual([]);
  });

  it('blocks assigned custom-role deletion and deletes unassigned custom roles after confirmation', async () => {
    const records = loadAccessData().records;
    records.roles.push(
      { name: 'Auditor', modules: ['reports'] },
      { name: 'Unused', modules: [] },
    );
    records.users.push({
      id: 'audit',
      username: 'audit',
      role: 'Auditor',
      status: 'Active',
    });
    localStorage.setItem(ACCESS_STORAGE_KEY, JSON.stringify(records));
    const user = userEvent.setup();
    renderWithProviders(<RoleManagementPage />);
    expect(
      screen.getByRole('button', { name: 'Delete Auditor' }),
    ).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Delete Unused' }));
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Delete',
      }),
    );
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(
      screen.queryByRole('rowheader', { name: 'Unused' }),
    ).not.toBeInTheDocument();
    expect(
      loadAccessData().records.roles.some((role) => role.name === 'Auditor'),
    ).toBe(true);
  });

  it('rechecks assignments before deletion if records changed while the confirmation was open', async () => {
    const records = loadAccessData().records;
    records.roles.push({ name: 'Auditor', modules: [] });
    localStorage.setItem(ACCESS_STORAGE_KEY, JSON.stringify(records));
    const user = userEvent.setup();
    renderWithProviders(<RoleManagementPage />);
    await user.click(screen.getByRole('button', { name: 'Delete Auditor' }));
    records.users.push({
      id: 'audit',
      username: 'audit',
      role: 'Auditor',
      status: 'Active',
    });
    localStorage.setItem(ACCESS_STORAGE_KEY, JSON.stringify(records));
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Delete',
      }),
    );
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'The records have changed',
    );
    expect(
      loadAccessData().records.roles.some((role) => role.name === 'Auditor'),
    ).toBe(true);
  });

  it('preserves the editor after a failed role write', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RoleManagementPage />);
    await user.click(screen.getByRole('button', { name: 'Edit Supervisor' }));
    await user.click(screen.getByRole('checkbox', { name: 'Tag Management' }));
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Quota');
    });
    await user.click(screen.getByRole('button', { name: 'Save Role' }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Changes could not be saved',
    );
    expect(
      screen.getByRole('checkbox', { name: 'Tag Management' }),
    ).toBeChecked();
    expect(
      loadAccessData().records.roles.find((role) => role.name === 'Supervisor')
        ?.modules,
    ).toEqual(['dashboard', 'reports']);
  });
});
