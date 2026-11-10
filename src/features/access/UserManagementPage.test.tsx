import { defaultRoles, defaultUsers, seedTestData } from '../../test/fixtures';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../test/render';
import { ACCESS_STORAGE_KEY, loadAccessData } from './accessData';
import { UserManagementPage } from './UserManagementPage';

beforeEach(() => seedTestData());

describe('user management', () => {
  it('positions the user form without animation and keeps the role menu open until selection', async () => {
    const scrollIntoView = vi.fn();
    const previousScroll = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = scrollIntoView;
    try {
      const user = userEvent.setup();
      renderWithProviders(<UserManagementPage />);
      await user.click(screen.getByRole('button', { name: 'Add User' }));
      expect(scrollIntoView).toHaveBeenCalledWith({
        behavior: 'instant',
        block: 'start',
      });
      const role = screen.getByRole('combobox', { name: /Role/ });
      await user.click(role);
      expect(role).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByRole('listbox')).toBeVisible();
      await user.click(screen.getByRole('option', { name: 'Process Manager' }));
      expect(role).toHaveTextContent('Process Manager');
      expect(role).toHaveAttribute('aria-expanded', 'false');
    } finally {
      HTMLElement.prototype.scrollIntoView = previousScroll;
    }
  });

  it('saves optional process associations and preserves them when a user changes roles', async () => {
    const user = userEvent.setup();
    renderWithProviders(<UserManagementPage />);
    await user.click(screen.getByRole('button', { name: 'Add User' }));
    expect(
      screen.getByRole('combobox', { name: 'Associated Processes' }),
    ).toBeVisible();
    await user.type(
      screen.getByRole('textbox', { name: /Username/ }),
      'new.manager',
    );
    await user.click(screen.getByRole('combobox', { name: /Role/ }));
    await user.click(screen.getByRole('option', { name: 'Process Manager' }));
    await user.click(screen.getByRole('combobox', { name: /Status/ }));
    await user.click(screen.getByRole('option', { name: 'Active' }));
    const selector = screen.getByRole('combobox', {
      name: /Associated Processes/,
    });
    await user.click(selector);
    await user.click(screen.getByRole('option', { name: /Lot Preparation/ }));
    await user.click(screen.getByRole('option', { name: /Washing/ }));
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'Save User' }));
    const savedUser = () =>
      loadAccessData().records.users.find(
        (record) => record.username === 'new.manager',
      );
    expect(savedUser()?.processIds).toEqual(['demo-1', 'demo-2']);
    await user.click(screen.getByRole('button', { name: 'Edit new.manager' }));
    const form = screen.getByRole('region', { name: 'Edit User' });
    expect(within(form).getByText(/Lot Preparation/)).toBeVisible();
    expect(within(form).getByText(/Washing/)).toBeVisible();
    const washingChip = within(form)
      .getByText(/Washing/)
      .closest('.MuiChip-root');
    expect(washingChip).not.toBeNull();
    await user.click(
      within(washingChip as HTMLElement).getByTestId('CancelIcon'),
    );
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(within(form).queryByText(/Washing/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save User' }));
    expect(savedUser()?.processIds).toEqual(['demo-1']);
    await user.click(screen.getByRole('button', { name: 'Edit new.manager' }));
    await user.click(screen.getByRole('combobox', { name: /Role/ }));
    await user.click(screen.getByRole('option', { name: 'Supervisor' }));
    expect(
      screen.getByRole('combobox', { name: 'Associated Processes' }),
    ).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Save User' }));
    expect(savedUser()?.processIds).toEqual(['demo-1']);
  }, 15000);

  it('shows the reference accounts and searches usernames and roles without case sensitivity', async () => {
    const user = userEvent.setup();
    renderWithProviders(<UserManagementPage />);
    const table = screen.getByRole('table', { name: 'Existing Users' });
    expect(within(table).getAllByRole('rowheader')).toHaveLength(7);
    const search = screen.getByRole('searchbox', { name: 'Search users' });
    await user.type(search, ' PRODUCTION ');
    expect(within(table).getAllByRole('rowheader')).toHaveLength(1);
    expect(
      within(table).getByRole('rowheader', { name: 'production.manager' }),
    ).toBeVisible();
    await user.clear(search);
    await user.type(search, 'nobody');
    expect(screen.getByText('No users match your search.')).toBeVisible();
    await user.clear(search);
    expect(within(table).getAllByRole('rowheader')).toHaveLength(7);
  });

  it('shows field errors, then creates a normalized user with a selected role', async () => {
    const user = userEvent.setup();
    renderWithProviders(<UserManagementPage />);
    await user.click(screen.getByRole('button', { name: 'Add User' }));
    expect(screen.getByRole('combobox', { name: /Role/ })).toHaveTextContent(
      'Select a role',
    );
    expect(screen.getByRole('combobox', { name: /Status/ })).toHaveTextContent(
      'Select a status',
    );
    await user.click(screen.getByRole('button', { name: 'Save User' }));
    expect(
      screen.getByRole('textbox', { name: /Username/ }),
    ).toHaveAccessibleDescription('Enter a username.');
    expect(
      screen.getByRole('combobox', { name: /Role/ }),
    ).toHaveAccessibleDescription('Select a valid role.');
    expect(
      screen.getByRole('combobox', { name: /Status/ }),
    ).toHaveAccessibleDescription('Select a status.');
    await user.type(
      screen.getByRole('textbox', { name: /Username/ }),
      ' factory.audit ',
    );
    await user.click(screen.getByRole('combobox', { name: /Role/ }));
    await user.click(screen.getByRole('option', { name: 'Supervisor' }));
    await user.click(screen.getByRole('combobox', { name: /Status/ }));
    await user.click(screen.getByRole('option', { name: 'Active' }));
    await user.click(screen.getByRole('button', { name: 'Save User' }));
    expect(
      screen.getByRole('rowheader', { name: 'factory.audit' }),
    ).toBeVisible();
    expect(
      loadAccessData().records.users.find(
        (record) => record.username === 'factory.audit',
      ),
    ).toMatchObject({ role: 'Supervisor', status: 'Active' });
    expect(
      screen.queryByRole('textbox', { name: /Username/ }),
    ).not.toBeInTheDocument();
  });

  it('rejects duplicate usernames and saves status edits without changing other users', async () => {
    const user = userEvent.setup();
    renderWithProviders(<UserManagementPage />);
    await user.click(screen.getByRole('button', { name: 'Edit supervisor' }));
    const name = screen.getByRole('textbox', { name: /Username/ });
    await user.clear(name);
    await user.type(name, 'NW.ADMIN');
    await user.click(screen.getByRole('button', { name: 'Save User' }));
    expect(name).toHaveAccessibleDescription('This username already exists.');
    expect(localStorage.getItem(ACCESS_STORAGE_KEY)).toBe(
      JSON.stringify({ users: defaultUsers, roles: defaultRoles }),
    );
    await user.clear(name);
    await user.type(name, 'supervisor');
    await user.click(screen.getByRole('combobox', { name: /Status/ }));
    await user.click(screen.getByRole('option', { name: 'Inactive' }));
    await user.click(screen.getByRole('button', { name: 'Save User' }));
    expect(
      loadAccessData().records.users.find(
        (record) => record.username === 'supervisor',
      )?.status,
    ).toBe('Inactive');
    expect(
      loadAccessData().records.users.find(
        (record) => record.username === 'nw.admin',
      )?.status,
    ).toBe('Active');
  });

  it('does not write cancelled edits or deletions and removes a user only after confirmation', async () => {
    const user = userEvent.setup();
    renderWithProviders(<UserManagementPage />);
    await user.click(screen.getByRole('button', { name: 'Edit supervisor' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(localStorage.getItem(ACCESS_STORAGE_KEY)).toBe(
      JSON.stringify({ users: defaultUsers, roles: defaultRoles }),
    );
    await user.click(screen.getByRole('button', { name: 'Delete supervisor' }));
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Cancel',
      }),
    );
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(localStorage.getItem(ACCESS_STORAGE_KEY)).toBe(
      JSON.stringify({ users: defaultUsers, roles: defaultRoles }),
    );
    await user.click(screen.getByRole('button', { name: 'Delete supervisor' }));
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Delete',
      }),
    );
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(
      screen.queryByRole('rowheader', { name: 'supervisor' }),
    ).not.toBeInTheDocument();
    expect(loadAccessData().records.users).toHaveLength(6);
  });

  it('keeps the editor and existing records when a write fails', async () => {
    const user = userEvent.setup();
    renderWithProviders(<UserManagementPage />);
    await user.click(screen.getByRole('button', { name: 'Edit supervisor' }));
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Quota');
    });
    await user.click(screen.getByRole('button', { name: 'Save User' }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Changes could not be saved',
    );
    expect(screen.getByRole('textbox', { name: /Username/ })).toHaveValue(
      'supervisor',
    );
    expect(screen.getAllByRole('rowheader')).toHaveLength(7);
  });
});
