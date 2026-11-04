import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  defaultTags,
  TAG_STORAGE_KEY,
} from '../features/configurations/tagRegistry';
import App from '../App';
import { renderWithProviders } from '../test/render';
import { router } from './router';
import {
  notifySessionChange,
  readSession,
  signIn,
  signOut,
} from '../features/auth/session';
import {
  ACCESS_STORAGE_KEY,
  loadAccessData,
} from '../features/access/accessData';
import { sampleStyles, STYLE_STORAGE_KEY } from '../features/styles/styleData';

afterAll(() => {
  router.dispose();
});

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  signIn('nw.admin', 'NW@2026demo');
});

describe('application routing', () => {
  it('opens Style Management and its shared detail screen with the active sidebar item', async () => {
    const user = userEvent.setup();
    await router.navigate('/styles');
    renderWithProviders(<App />);
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Style Management',
      }),
    ).toBeVisible();
    await user.click(screen.getByRole('link', { name: 'View STY-1001' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'STY-1001' }),
    ).toBeVisible();
    await user.click(
      screen.getByRole('button', { name: 'Open navigation menu' }),
    );
    expect(
      within(
        screen.getByRole('navigation', { name: 'Main navigation' }),
      ).getByRole('link', { name: 'Style Management' }),
    ).toHaveAttribute('aria-current', 'page');
  });

  it('restricts New Style to owned records and blocks its users from Style Management', async () => {
    signIn('style.configurator', 'Style@2026demo');
    localStorage.setItem(
      STYLE_STORAGE_KEY,
      JSON.stringify([
        ...sampleStyles,
        {
          ...sampleStyles[0],
          id: 'owned-style',
          number: 'OWN-100',
          createdById: 'user-7',
          createdBy: 'style.configurator',
        },
      ]),
    );
    const user = userEvent.setup();
    await router.navigate('/new-style');
    renderWithProviders(<App />);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'New Style' }),
    ).toBeVisible();
    expect(screen.getByRole('rowheader', { name: 'OWN-100' })).toBeVisible();
    expect(screen.queryByText('STY-1001')).not.toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'View OWN-100' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'OWN-100' }),
    ).toBeVisible();
    await act(() => router.navigate('/new-style/sty-1'));
    expect(
      await screen.findByText(
        'This style was not found or is not available to your account.',
      ),
    ).toBeVisible();
    expect(screen.queryByText('STY-1001')).not.toBeInTheDocument();
    await act(() => router.navigate('/styles'));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Access denied' }),
    ).toBeVisible();
  });

  it('does not allow management roles to use New Style unless that permission is assigned', async () => {
    await router.navigate('/new-style');
    renderWithProviders(<App />);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Access denied' }),
    ).toBeVisible();
  });

  it.each([
    '/dashboard',
    '/reports',
    '/users',
    '/roles',
    '/styles',
    '/styles/sty-1',
    '/new-style',
    '/new-style/sty-1',
    '/configurations',
    '/configurations/processes',
    '/configurations/processes/demo-1',
    '/configurations/storages',
    '/configurations/storages/storage-demo-1',
    '/configurations/tags',
    '/workspace',
    '/access-denied',
  ])('requires login when opening %s without a session', async (path) => {
    signOut();
    await router.navigate(path);
    renderWithProviders(<App />);
    expect(
      await screen.findByRole('heading', { name: 'Sign In', level: 2 }),
    ).toBeVisible();
    expect(window.location.pathname).toBe('/login');
    expect(screen.queryByRole('banner')).not.toBeInTheDocument();
  });

  it.each([
    { username: 'nw.admin', password: 'NW@2026demo', title: 'Dashboard' },
    { username: 'it.admin', password: 'IT@2026demo', title: 'Dashboard' },
    { username: 'top.manager', password: 'Top@2026demo', title: 'Dashboard' },
    {
      username: 'production.manager',
      password: 'Prod@2026demo',
      title: 'Dashboard',
    },
    { username: 'supervisor', password: 'Super@2026demo', title: 'Dashboard' },
    {
      username: 'process.manager',
      password: 'Process@2026demo',
      title: 'No modules available',
    },
    {
      username: 'style.configurator',
      password: 'Style@2026demo',
      title: 'New Style',
    },
  ])(
    'signs in $username and opens the first available module',
    async ({ username, password, title }) => {
      signOut();
      const user = userEvent.setup();
      await router.navigate('/login');
      renderWithProviders(<App />);
      await user.type(
        screen.getByRole('textbox', { name: 'Username' }),
        username,
      );
      await user.type(
        screen.getByLabelText('Password', { exact: true }),
        password,
      );
      await user.click(screen.getByRole('button', { name: 'Sign In' }));
      expect(
        await screen.findByRole('heading', { level: 1, name: title }),
      ).toBeVisible();
      expect(readSession()?.user.username).toBe(username);
      expect(router.state.historyAction).toBe('REPLACE');
      await user.click(
        screen.getByRole('button', { name: 'Open navigation menu' }),
      );
      const links = within(
        screen.getByRole('navigation', { name: 'Main navigation' }),
      ).queryAllByRole('link');
      if (links.length) {
        expect(links[0]).toHaveAttribute('aria-current', 'page');
        expect(links[0]).toHaveClass('Mui-selected');
      } else expect(window.location.pathname).toBe('/workspace');
    },
  );

  it('opens the first menu after login even when sign-in started from an authorized deep link', async () => {
    signOut();
    const user = userEvent.setup();
    await router.navigate('/configurations/processes/demo-2?tab=devices#list');
    const view = renderWithProviders(<App />);
    await screen.findByRole('heading', { level: 2, name: 'Sign In' });
    await user.type(
      screen.getByRole('textbox', { name: 'Username' }),
      'nw.admin',
    );
    await user.type(
      screen.getByLabelText('Password', { exact: true }),
      'NW@2026demo',
    );
    await user.click(screen.getByRole('button', { name: 'Sign In' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Dashboard' }),
    ).toBeVisible();
    expect(
      window.location.pathname + window.location.search + window.location.hash,
    ).toBe('/dashboard');
    view.unmount();
    renderWithProviders(<App />);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Dashboard' }),
    ).toBeVisible();
  });

  it.each([
    {
      modules: ['styles', 'roles', 'newstyle'] as const,
      path: '/new-style',
      title: 'New Style',
    },
    {
      modules: ['styles', 'tags'] as const,
      path: '/configurations/tags',
      title: 'Tag Management',
    },
    {
      modules: ['styles'] as const,
      path: '/styles',
      title: 'Style Management',
    },
  ])(
    'keeps the first visible menu selected for customized permissions at $path',
    async ({ modules, path, title }) => {
      const records = loadAccessData().records;
      records.roles.find((role) => role.name === 'Supervisor')!.modules = [
        ...modules,
      ];
      localStorage.setItem(ACCESS_STORAGE_KEY, JSON.stringify(records));
      signIn('supervisor', 'Super@2026demo');
      const user = userEvent.setup();
      await router.navigate('/login');
      renderWithProviders(<App />);
      expect(
        await screen.findByRole('heading', { level: 1, name: title }),
      ).toBeVisible();
      expect(window.location.pathname).toBe(path);
      await user.click(
        screen.getByRole('button', { name: 'Open navigation menu' }),
      );
      const links = within(
        screen.getByRole('navigation', { name: 'Main navigation' }),
      ).getAllByRole('link');
      expect(links[0]).toHaveAttribute('href', path);
      expect(links[0]).toHaveAttribute('aria-current', 'page');
      expect(links[0]).toHaveClass('Mui-selected');
    },
  );

  it('denies direct unauthorized URLs and hides inaccessible sidebar items', async () => {
    signIn('supervisor', 'Super@2026demo');
    const user = userEvent.setup();
    await router.navigate('/users');
    renderWithProviders(<App />);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Access denied' }),
    ).toBeVisible();
    expect(
      screen.queryByRole('table', { name: 'Existing Users' }),
    ).not.toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: 'Open navigation menu' }),
    );
    const nav = screen.getByRole('navigation', { name: 'Main navigation' });
    expect(within(nav).getByRole('link', { name: 'Reports' })).toBeVisible();
    expect(
      within(nav).queryByRole('link', { name: 'User Management' }),
    ).not.toBeInTheDocument();
    expect(
      within(nav).queryByRole('link', { name: 'Role Management' }),
    ).not.toBeInTheDocument();
    expect(
      within(nav).queryByRole('button', { name: 'Configurations' }),
    ).not.toBeInTheDocument();
  });

  it('uses the allowed landing page when a login return URL requires another role', async () => {
    signOut();
    const user = userEvent.setup();
    await router.navigate('/roles');
    renderWithProviders(<App />);
    await screen.findByRole('heading', { name: 'Sign In', level: 2 });
    await user.type(
      screen.getByRole('textbox', { name: 'Username' }),
      'supervisor',
    );
    await user.type(
      screen.getByLabelText('Password', { exact: true }),
      'Super@2026demo',
    );
    await user.click(screen.getByRole('button', { name: 'Sign In' }));
    expect(
      await screen.findByRole('heading', { name: 'Dashboard', level: 1 }),
    ).toBeVisible();
    expect(window.location.pathname).toBe('/dashboard');
  });

  it('revokes an open module when permissions change and ends a session when the user is disabled', async () => {
    signIn('supervisor', 'Super@2026demo');
    await router.navigate('/reports');
    renderWithProviders(<App />);
    await screen.findByRole('heading', { name: 'Reports', level: 1 });
    const records = loadAccessData().records;
    records.roles.find((role) => role.name === 'Supervisor')!.modules = [];
    act(() => {
      localStorage.setItem(ACCESS_STORAGE_KEY, JSON.stringify(records));
      notifySessionChange();
    });
    expect(
      await screen.findByRole('heading', { name: 'Access denied', level: 1 }),
    ).toBeVisible();
    records.users.find((record) => record.username === 'supervisor')!.status =
      'Inactive';
    act(() => {
      localStorage.setItem(ACCESS_STORAGE_KEY, JSON.stringify(records));
      notifySessionChange();
    });
    expect(
      await screen.findByRole('heading', { name: 'Sign In', level: 2 }),
    ).toBeVisible();
    expect(readSession()).toBeNull();
    records.users.find((record) => record.username === 'supervisor')!.status =
      'Active';
    act(() => {
      localStorage.setItem(ACCESS_STORAGE_KEY, JSON.stringify(records));
      notifySessionChange();
    });
    expect(
      screen.getByRole('heading', { name: 'Sign In', level: 2 }),
    ).toBeVisible();
    expect(readSession()).toBeNull();
  });

  it('redirects an already authenticated visitor away from the login page', async () => {
    await router.navigate('/login');
    renderWithProviders(<App />);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Dashboard' }),
    ).toBeVisible();
  });
  it.each([
    { path: '/dashboard', title: 'Dashboard' },
    { path: '/reports', title: 'Reports' },
    { path: '/users', title: 'User Management' },
    { path: '/roles', title: 'Role Management' },
  ])(
    'opens $path directly and highlights its sidebar link',
    async ({ path, title }) => {
      const user = userEvent.setup();
      await router.navigate(path);
      renderWithProviders(<App />);
      expect(
        await screen.findByRole('heading', { level: 1, name: title }),
      ).toBeVisible();
      await user.click(
        screen.getByRole('button', { name: 'Open navigation menu' }),
      );
      expect(
        within(
          screen.getByRole('navigation', { name: 'Main navigation' }),
        ).getByRole('link', { name: title }),
      ).toHaveAttribute('aria-current', 'page');
    },
  );

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
    expect(readSession()).toBeNull();
    await act(() => router.navigate('/configurations/processes'));
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Sign In' }),
    ).toBeVisible();
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
    signOut();
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
      signOut();
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
