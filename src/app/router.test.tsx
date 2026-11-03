import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  defaultTags,
  TAG_STORAGE_KEY,
} from '../features/configurations/tagRegistry';
import App from '../App';
import { renderWithProviders } from '../test/render';
import { router } from './router';

afterAll(() => {
  router.dispose();
});

beforeEach(() => {
  localStorage.clear();
});

describe('application routing', () => {
  it.each([
    {
      path: '/configurations/processes',
      action: 'Create Process',
      label: /Process-level NFC Tag ID/,
    },
    {
      path: '/configurations/storages',
      action: 'Add New Storage',
      label: /NFC Tag ID/,
    },
  ])(
    'offers newly registered tags in $path',
    async ({ path, action, label }) => {
      localStorage.setItem(
        TAG_STORAGE_KEY,
        JSON.stringify([
          ...defaultTags,
          { id: 'new-tag', name: 'New Factory Tag', actual: '04:AA:BB:CC' },
        ]),
      );
      const user = userEvent.setup();
      await router.navigate(path);
      renderWithProviders(<App />);
      await user.click(screen.getByRole('button', { name: action }));
      await user.click(screen.getByRole('combobox', { name: label }));
      expect(
        screen.getByRole('option', { name: 'New Factory Tag (04:AA:BB:CC)' }),
      ).not.toHaveAttribute('aria-disabled', 'true');
    },
  );

  it.each([
    {
      path: '/configurations/processes/demo-2',
      title: 'Washing',
      menu: 'Process Configurations',
    },
    {
      path: '/configurations/storages/storage-demo-1',
      title: 'ST-001',
      menu: 'Storage Configurations',
    },
    {
      path: '/configurations/tags',
      title: 'Tag Management',
      menu: 'Tag Management',
    },
  ])(
    'opens the direct detail route $path and keeps its sidebar item active',
    async ({ path, title, menu }) => {
      const user = userEvent.setup();
      await router.navigate(path);
      renderWithProviders(<App />);
      expect(
        await screen.findByRole('heading', { level: 1, name: title }),
      ).toBeVisible();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      await user.click(
        screen.getByRole('button', { name: 'Open navigation menu' }),
      );
      const navigation = screen.getByRole('navigation', {
        name: 'Main navigation',
      });
      expect(
        within(navigation).getByRole('link', { name: menu }),
      ).toHaveAttribute('aria-current', 'page');
    },
  );

  it('opens storage configurations and navigates to processes through the sidebar', async () => {
    const user = userEvent.setup();
    await router.navigate('/configurations/storages');
    renderWithProviders(<App />);
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Storage Configurations',
      }),
    ).toBeVisible();
    await user.click(
      screen.getByRole('button', { name: 'Open navigation menu' }),
    );
    const navigation = screen.getByRole('navigation', {
      name: 'Main navigation',
    });
    expect(
      within(navigation).getByRole('link', { name: 'Storage Configurations' }),
    ).toHaveAttribute('aria-current', 'page');
    expect(
      within(navigation).getByRole('link', { name: 'Process Configurations' }),
    ).not.toHaveAttribute('aria-current');
    await user.click(
      within(navigation).getByRole('link', { name: 'Process Configurations' }),
    );
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Process Configurations',
      }),
    ).toBeVisible();
    expect(window.location.pathname).toBe('/configurations/processes');
  });

  it('returns to login through sidebar Logout using history replacement', async () => {
    const user = userEvent.setup();
    await router.navigate('/configurations/processes');
    renderWithProviders(<App />);
    expect(screen.queryByText('Admin User')).not.toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: 'Open navigation menu' }),
    );
    const sidebar = document.getElementById('configuration-navigation')!;
    const logout = within(sidebar).getByRole('button', { name: 'Logout' });
    expect(
      within(screen.getByRole('banner', { hidden: true })).queryByRole(
        'button',
        { name: 'Logout' },
      ),
    ).not.toBeInTheDocument();
    await user.click(logout);

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Sign In' }),
    ).toBeVisible();
    expect(window.location.pathname).toBe('/login');
    expect(router.state.historyAction).toBe('REPLACE');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('opens process configurations and expands/collapses the mobile navigation submenu', async () => {
    const user = userEvent.setup();
    await router.navigate('/configurations/processes');
    renderWithProviders(<App />);

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Process Configurations',
      }),
    ).toBeVisible();
    await user.click(
      screen.getByRole('button', { name: 'Open navigation menu' }),
    );
    const navigation = screen.getByRole('navigation', {
      name: 'Main navigation',
    });
    const group = within(navigation).getByRole('button', {
      name: 'Configurations',
    });
    expect(group).toHaveAttribute('aria-expanded', 'true');
    expect(
      within(navigation).getByRole('link', { name: 'Process Configurations' }),
    ).toHaveAttribute('aria-current', 'page');
    expect(
      within(navigation).getByRole('link', {
        name: 'Storage Configurations',
      }),
    ).toHaveAttribute('href', '/configurations/storages');
    expect(
      within(navigation).getByRole('link', { name: 'Tag Management' }),
    ).toHaveAttribute('href', '/configurations/tags');
    await user.click(group);
    await waitFor(() =>
      expect(
        within(navigation).queryByRole('link', {
          name: 'Process Configurations',
        }),
      ).not.toBeInTheDocument(),
    );
    expect(group).toHaveAttribute('aria-expanded', 'false');
    await user.click(group);
    expect(
      await within(navigation).findByRole('link', {
        name: 'Process Configurations',
      }),
    ).toBeVisible();
  });

  it('renders the login page when navigating directly to /login', async () => {
    await router.navigate('/login');
    renderWithProviders(<App />);

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Sign In' }),
    ).toBeVisible();
    expect(window.location.pathname).toBe('/login');
  });

  it.each(['/', '/unknown/deep/link'])(
    'redirects %s to /login using history replacement',
    async (path) => {
      await router.navigate(path);
      renderWithProviders(<App />);

      expect(
        await screen.findByRole('heading', { level: 2, name: 'Sign In' }),
      ).toBeVisible();
      expect(window.location.pathname).toBe('/login');
      expect(router.state.historyAction).toBe('REPLACE');
    },
  );
});
