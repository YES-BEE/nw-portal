import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../test/render';
import { ACCESS_STORAGE_KEY, loadAccessData } from './accessData';
import { UserManagementPage } from './UserManagementPage';

beforeEach(() => localStorage.clear());

describe('user management', () => {
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
    await user.click(screen.getByRole('button', { name: 'Save User' }));
    expect(
      screen.getByRole('textbox', { name: /Username/ }),
    ).toHaveAccessibleDescription('Enter a username.');
    expect(
      screen.getByRole('combobox', { name: /Role/ }),
    ).toHaveAccessibleDescription('Select a valid role.');
    await user.type(
      screen.getByRole('textbox', { name: /Username/ }),
      ' factory.audit ',
    );
    await user.click(screen.getByRole('combobox', { name: /Role/ }));
    await user.click(screen.getByRole('option', { name: 'Supervisor' }));
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
    expect(localStorage.getItem(ACCESS_STORAGE_KEY)).toBeNull();
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
    expect(localStorage.getItem(ACCESS_STORAGE_KEY)).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Delete supervisor' }));
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Cancel',
      }),
    );
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(localStorage.getItem(ACCESS_STORAGE_KEY)).toBeNull();
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
