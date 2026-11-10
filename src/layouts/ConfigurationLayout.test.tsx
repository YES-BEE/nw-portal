import { apiClient } from '../api/client';
import { loginResponse, refreshTokenResponse } from '../test/auth';
import { signIn as backendSignIn } from '../features/auth/session';
import { seedTestData, signIn } from '../test/fixtures';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../test/render';
import { ConfigurationLayout } from './ConfigurationLayout';
import {
  ACCESS_STORAGE_KEY,
  loadAccessData,
} from '../features/access/accessData';

beforeEach(() => {
  vi.spyOn(apiClient, 'post').mockResolvedValue({ status: 204, data: null });
  seedTestData();
  sessionStorage.clear();
  signIn('nw.admin', 'NW@2026demo');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('persistent desktop navigation', () => {
  it('maps login response module names to sidebar links using their keys', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'http://backend.test');
    vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
      status: 200,
      data: {
        ...loginResponse,
        modules: [
          { key: 'reports', name: 'Factory Analytics', built_in: false },
          { key: 'process', name: 'Wash Workflow', built_in: true },
          { key: 'reports', name: 'Factory Analytics', built_in: false },
          { key: 'future-module', name: 'Future Tools', built_in: false },
        ],
      },
    });
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      status: 200,
      data: refreshTokenResponse,
    });
    expect(await backendSignIn('admin', 'password')).toBeNull();
    const user = userEvent.setup();
    renderWithProviders(
      <MemoryRouter initialEntries={['/configurations/processes/one']}>
        <ConfigurationLayout />
      </MemoryRouter>,
    );
    await user.click(
      screen.getByRole('button', { name: 'Open navigation menu' }),
    );
    const navigation = within(
      screen.getByRole('navigation', { name: 'Main navigation' }),
    );
    expect(
      navigation.getByRole('link', { name: 'Factory Analytics' }),
    ).toHaveAttribute('href', '/reports');
    const processLink = navigation.getByRole('link', { name: 'Wash Workflow' });
    expect(processLink).toHaveAttribute('href', '/configurations/processes');
    expect(processLink).toHaveAttribute('aria-current', 'page');
    expect(navigation.getAllByRole('link')).toHaveLength(2);
    expect(navigation.queryByText('Reports/Analysis')).not.toBeInTheDocument();
    expect(
      navigation.queryByText('Process Configurations'),
    ).not.toBeInTheDocument();
    expect(navigation.queryByText('Future Tools')).not.toBeInTheDocument();
    expect(
      navigation.queryByRole('link', { name: 'Dashboard' }),
    ).not.toBeInTheDocument();
  });

  it('shows no module links or configuration group for an empty modules response', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'http://backend.test');
    vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
      status: 200,
      data: { ...loginResponse, modules: [] },
    });
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      status: 200,
      data: refreshTokenResponse,
    });
    expect(await backendSignIn('admin', 'password')).toBeNull();
    const user = userEvent.setup();
    renderWithProviders(
      <MemoryRouter>
        <ConfigurationLayout />
      </MemoryRouter>,
    );
    await user.click(
      screen.getByRole('button', { name: 'Open navigation menu' }),
    );
    const navigation = within(
      screen.getByRole('navigation', { name: 'Main navigation' }),
    );
    expect(navigation.queryAllByRole('link')).toHaveLength(0);
    expect(
      navigation.queryByRole('button', { name: 'Configurations' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Logout' })).toBeVisible();
  });

  it.each([
    { path: '/dashboard', active: false },
    { path: '/reports', active: false },
    { path: '/styles', active: true },
    { path: '/styles/sty-1', active: true },
    { path: '/configurations/processes/demo-1', active: true },
  ])(
    'highlights Configurations only for its child routes at $path',
    async ({ path, active }) => {
      const user = userEvent.setup();
      renderWithProviders(
        <MemoryRouter initialEntries={[path]}>
          <ConfigurationLayout />
        </MemoryRouter>,
      );
      await user.click(
        screen.getByRole('button', { name: 'Open navigation menu' }),
      );
      const group = screen.getByRole('button', { name: 'Configurations' });
      expect(group.classList.contains('Mui-selected')).toBe(active);
      if (active)
        expect(group).toHaveStyle({ boxShadow: 'inset 3px 0 0 #73a7ff' });
      const selectedLinks = screen
        .getAllByRole('link')
        .filter((link) => link.classList.contains('Mui-selected'));
      for (const link of selectedLinks)
        expect(link).toHaveStyle({ boxShadow: 'inset 3px 0 0 #73a7ff' });
      const submenu = screen.getByLabelText('Configurations submenu');
      const styleLink = within(submenu).getByRole('link', {
        name: 'Style Management',
      });
      expect(
        screen.getAllByRole('link', { name: 'Style Management' }),
      ).toHaveLength(1);
      expect(styleLink.classList.contains('Mui-selected')).toBe(
        path.startsWith('/styles'),
      );
      if (path.startsWith('/styles'))
        expect(styleLink).toHaveAttribute('aria-current', 'page');
    },
  );

  it('shows Configurations for a user with only Style Management permission', async () => {
    const records = loadAccessData().records;
    records.roles.find((role) => role.name === 'Supervisor')!.modules = [
      'styles',
    ];
    localStorage.setItem(ACCESS_STORAGE_KEY, JSON.stringify(records));
    signIn('supervisor', 'Super@2026demo');
    const user = userEvent.setup();
    renderWithProviders(
      <MemoryRouter initialEntries={['/styles']}>
        <ConfigurationLayout />
      </MemoryRouter>,
    );
    await user.click(
      screen.getByRole('button', { name: 'Open navigation menu' }),
    );
    expect(
      screen.getByRole('button', { name: 'Configurations' }),
    ).toBeVisible();
    const submenu = screen.getByLabelText('Configurations submenu');
    expect(
      within(submenu).getByRole('link', { name: 'Style Management' }),
    ).toBeVisible();
    expect(within(submenu).getAllByRole('link')).toHaveLength(1);
  });

  it.each([
    { username: 'nw.admin', password: 'NW@2026demo', role: 'NW' },
    {
      username: 'production.manager',
      password: 'Prod@2026demo',
      role: 'Production Manager',
    },
  ])(
    'shows $username and their role in the AppBar',
    ({ username, password, role }) => {
      signIn(username, password);
      renderWithProviders(
        <MemoryRouter>
          <ConfigurationLayout />
        </MemoryRouter>,
      );
      const identity = within(screen.getByRole('banner')).getByRole('group', {
        name: 'Signed-in user',
      });
      expect(within(identity).getByLabelText(username)).toBeVisible();
      expect(within(identity).getByText(role)).toBeVisible();
    },
  );

  it('keeps Logout in the sidebar when the configuration submenu is collapsed', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <MemoryRouter>
        <ConfigurationLayout />
      </MemoryRouter>,
    );
    await user.click(
      screen.getByRole('button', { name: 'Open navigation menu' }),
    );
    const sidebar = document.getElementById('configuration-navigation')!;
    expect(
      within(sidebar).getByRole('button', { name: 'Logout' }),
    ).toBeVisible();
    await user.click(
      within(sidebar).getByRole('button', { name: 'Configurations' }),
    );
    expect(
      within(sidebar).getByRole('button', { name: 'Logout' }),
    ).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Account menu' }),
    ).not.toBeInTheDocument();
  });

  it('opens by default and releases workspace space when closed, then reopens', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('min-width:900px'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    const user = userEvent.setup();
    renderWithProviders(
      <MemoryRouter initialEntries={['/configurations/processes']}>
        <ConfigurationLayout />
      </MemoryRouter>,
    );

    const main = screen.getByRole('main');
    const header = screen.getByRole('banner');
    expect(
      within(header).getByText('Process Control & Production Intelligence'),
    ).toBeVisible();
    const drawer = document.getElementById('configuration-navigation')!;
    expect(drawer).toHaveStyle({
      position: 'fixed',
      top: '0px',
      height: '100%',
    });
    const drawerToolbar = drawer?.querySelector('.MuiToolbar-root');
    const appBarToolbar = header.querySelector('.MuiToolbar-root');
    expect(drawerToolbar).toHaveStyle({ minHeight: '68px', flexShrink: '0' });
    expect(appBarToolbar).toHaveStyle({ minHeight: '68px' });
    expect(header).toHaveStyle({
      width: 'calc(100% - 242px)',
      marginLeft: '242px',
    });
    const toggle = within(drawer).getByRole('button', {
      name: 'Close navigation menu',
    });
    expect(
      within(header).queryByRole('button', { name: 'Close navigation menu' }),
    ).not.toBeInTheDocument();
    expect(
      within(header).queryByRole('button', { name: 'Open navigation menu' }),
    ).not.toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(
      screen.getByRole('navigation', { name: 'Main navigation' }),
    ).toBeVisible();
    expect(main).toHaveStyle({ marginLeft: '0px' });

    await user.click(toggle);

    expect(
      screen.getByRole('button', { name: 'Open navigation menu' }),
    ).toHaveAttribute('aria-expanded', 'false');
    expect(main).toHaveStyle({ marginLeft: '-242px' });
    expect(header).toHaveStyle({ width: '100%', marginLeft: '0px' });
    expect(
      within(header).getByRole('button', { name: 'Open navigation menu' }),
    ).toHaveFocus();
    await waitFor(() =>
      expect(
        screen.queryByRole('navigation', { name: 'Main navigation' }),
      ).not.toBeInTheDocument(),
    );

    await user.click(
      screen.getByRole('button', { name: 'Open navigation menu' }),
    );
    expect(
      screen.getByRole('button', { name: 'Close navigation menu' }),
    ).toHaveAttribute('aria-expanded', 'true');
    expect(
      await screen.findByRole('navigation', { name: 'Main navigation' }),
    ).toBeVisible();
    expect(main).toHaveStyle({ marginLeft: '0px' });
    expect(header).toHaveStyle({
      width: 'calc(100% - 242px)',
      marginLeft: '242px',
    });
  });

  it('closes the mobile drawer using the chevron inside its toolbar', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <MemoryRouter>
        <ConfigurationLayout />
      </MemoryRouter>,
    );
    await user.click(
      screen.getByRole('button', { name: 'Open navigation menu' }),
    );
    const drawer = document.getElementById('configuration-navigation')!;
    await user.click(
      within(drawer).getByRole('button', { name: 'Close navigation menu' }),
    );

    await waitFor(() =>
      expect(
        screen.queryByRole('navigation', { name: 'Main navigation' }),
      ).not.toBeInTheDocument(),
    );
    expect(
      screen.getByRole('button', { name: 'Open navigation menu' }),
    ).toBeVisible();
  });
});
