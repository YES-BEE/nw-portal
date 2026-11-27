import { apiPage } from '../test/apiPage';
import {
  styleResponse,
  styleRouteResponse,
  styleProcessOptions,
} from '../test/styles';
import {
  storageAreaResponse,
  storageUnitResponse,
  storageTags,
} from '../test/storages';
import {
  lotResponse,
  lotEvent,
  lotStyleOption,
  lotBatchResponse,
} from '../test/lots';
import {
  emptyDashboard,
  dashboardResponse,
  dashboardLot,
} from '../test/dashboard';
import { apiClient } from '../api/client';
import { processResponse } from '../test/processes';
import { userResponse, usersResponse } from '../test/users';
import { seedTestData, signIn } from '../test/fixtures';
import { sampleStyles } from '../test/fixtures';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { renderWithProviders } from '../test/render';
import { router } from './router';
import {
  readSession,
  setAuthenticatedSession,
  signOut,
} from '../features/auth/session';
import { ACCESS_STORAGE_KEY, loadAccessData } from '../test/accessData';
import { STYLE_STORAGE_KEY } from '../test/fixtures';

afterAll(() => {
  router.dispose();
});

beforeEach(() => {
  vi.spyOn(apiClient, 'get').mockImplementation(async (url, config) => ({
    status: 200,
    data:
      url === 'reports/catalog'
        ? []
        : url === 'dashboard'
          ? emptyDashboard
          : url === 'ui/lookups'
            ? {
                tags: apiPage(storageTags, undefined, 20),
                processes: apiPage(styleProcessOptions, undefined, 20),
              }
            : url === 'styles'
              ? apiPage([styleResponse], undefined, 10)
              : url.startsWith('styles/') && url.endsWith('/derived-route')
                ? styleRouteResponse
                : url.startsWith('styles/')
                  ? { ...styleResponse, id: url.slice('styles/'.length) }
                  : url === 'storage-areas'
                    ? apiPage([storageAreaResponse], config?.params, 100)
                    : url.startsWith('storage-locations/')
                      ? {
                          ...storageUnitResponse,
                          id: url.slice('storage-locations/'.length),
                        }
                      : url.startsWith('processes/')
                        ? {
                            ...processResponse,
                            id: url.slice('processes/'.length),
                          }
                        : apiPage([], undefined, 10),
  }));
  vi.spyOn(apiClient, 'post').mockResolvedValue({ status: 204, data: null });
  seedTestData();
  sessionStorage.clear();
  signIn('nw.admin', 'NW@2026demo');
});

describe('application routing', () => {
  it('loads dashboard metrics with only dashboard access and does not require other modules', async () => {
    const session = readSession()!;
    setAuthenticatedSession({
      ...session,
      modules: ['dashboard'],
      profile: {
        ...session.profile!,
        modules: [{ key: 'dashboard', name: 'Dashboard', built_in: true }],
      },
    });
    vi.mocked(apiClient.get).mockImplementation(async (url) => ({
      status: 200,
      data:
        url === 'dashboard'
          ? dashboardResponse
          : apiPage([dashboardLot], undefined, 10),
    }));
    vi.mocked(apiClient.post).mockResolvedValue({
      status: 200,
      data: apiPage([dashboardLot], undefined, 10),
    });
    await router.navigate('/dashboard');
    renderWithProviders(<App />);
    expect(
      await screen.findByRole('region', { name: 'Total Lots' }),
    ).toBeVisible();
    expect(
      await screen.findByRole('rowheader', { name: 'LOT-001' }),
    ).toBeVisible();
    expect(
      screen.queryByRole('link', { name: 'View lot LOT-001' }),
    ).not.toBeInTheDocument();
    expect(
      vi.mocked(apiClient.get).mock.calls.every(([url]) => url === 'dashboard'),
    ).toBe(true);
  });

  it('shows shared style/lot menus and only backend-supported style actions for configurators', async () => {
    signIn('style.configurator', 'Style@2026demo');
    const session = readSession()!;
    setAuthenticatedSession({
      ...session,
      modules: ['newstyle', 'lots'],
      profile: {
        ...session.profile!,
        modules: [
          { key: 'newstyle', name: 'New Style', built_in: true },
          { key: 'lots', name: 'Lot Management', built_in: true },
        ],
      },
    });
    await router.navigate('/styles');
    renderWithProviders(<App />);
    await screen.findByRole('rowheader', { name: 'STY-1001' });
    expect(
      screen.queryByRole('button', { name: 'Edit STY-1001' }),
    ).not.toBeInTheDocument();
    const user = userEvent.setup();
    expect(
      screen.queryByRole('button', { name: 'Release style STY-1001' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create Style' })).toBeEnabled();
    expect(screen.getByRole('link', { name: 'View STY-1001' })).toBeVisible();
    expect(apiClient.post).not.toHaveBeenCalled();
    await user.click(
      screen.getByRole('button', { name: 'Open navigation menu' }),
    );
    const menu = screen.getByRole('navigation', { name: 'Main navigation' });
    expect(
      within(menu).getByRole('link', { name: 'New Style' }),
    ).toHaveAttribute('href', '/styles');
    expect(
      within(menu).getByRole('link', { name: 'Lot Management' }),
    ).toHaveAttribute('href', '/lots');
    expect(
      screen.queryByLabelText('Configurations submenu'),
    ).not.toBeInTheDocument();
  });

  it('lets a configurator create a lot associated with a released style through Lot Management', async () => {
    signIn('style.configurator', 'Style@2026demo');
    const session = readSession()!;
    setAuthenticatedSession({
      ...session,
      modules: ['newstyle', 'lots'],
      profile: {
        ...session.profile!,
        modules: [
          ...session.profile!.modules,
          { key: 'lots', name: 'Lot Management', built_in: true },
        ],
      },
    });
    vi.mocked(apiClient.get).mockImplementation(async (url) => ({
      status: url.endsWith('/qc') ? 404 : 200,
      data:
        url === 'ui/lookups'
          ? { styles: apiPage([lotStyleOption], undefined, 20) }
          : url === 'lots' || url.endsWith('/timeline')
            ? apiPage([], undefined, 10)
            : url.endsWith('/qc')
              ? { code: 'NOT_FOUND' }
              : lotResponse,
    }));
    vi.mocked(apiClient.post).mockResolvedValue({
      status: 200,
      data: lotBatchResponse,
    });
    await router.navigate('/lots');
    renderWithProviders(<App />);
    await screen.findByText('No lots found.');
    const user = userEvent.setup();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Add Lots' })).toBeEnabled(),
    );
    await user.click(screen.getByRole('button', { name: 'Add Lots' }));
    const form = screen.getByRole('form', { name: 'Create Production Lots' });
    await user.click(within(form).getByRole('combobox', { name: /Style/ }));
    await user.click(
      screen.getByRole('option', { name: lotStyleOption.style_number }),
    );
    await user.type(
      within(form).getByRole('spinbutton', { name: /Quantity/ }),
      '200',
    );
    await user.click(within(form).getByRole('button', { name: 'Create Lots' }));
    expect(
      await screen.findByRole('heading', { name: 'LOT-001', level: 1 }),
    ).toBeVisible();
    expect(apiClient.post).toHaveBeenCalledWith(
      `styles/${lotStyleOption.id}/lots`,
      { lotCount: 1, quantity: 200 },
      expect.anything(),
    );
  });

  it('does not grant shared Style Management to other roles with only newstyle access', async () => {
    setAuthenticatedSession({ ...readSession()!, modules: ['newstyle'] });
    await router.navigate('/styles');
    renderWithProviders(<App />);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Access denied' }),
    ).toBeVisible();
    expect(apiClient.get).not.toHaveBeenCalled();
  });

  it('keeps lot details and history available when QC access is denied', async () => {
    setAuthenticatedSession({ ...readSession()!, modules: ['lots'] });
    vi.mocked(apiClient.get).mockImplementation(async (url) => ({
      status: url.endsWith('/qc') ? 403 : 200,
      data: url.endsWith('/qc')
        ? {
            code: 'ACCESS_DENIED',
            detail: 'QC results are outside the granted desktop modules',
          }
        : url.endsWith('/timeline')
          ? apiPage([lotEvent], undefined, 10)
          : lotResponse,
    }));
    await router.navigate('/lots/lot-id');
    renderWithProviders(<App />);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'LOT-001' }),
    ).toBeVisible();
    expect(await screen.findByText('PASS')).toBeVisible();
    await waitFor(() =>
      expect(
        screen.queryByRole('region', { name: 'QC Results' }),
      ).not.toBeInTheDocument(),
    );
    expect(
      screen.queryByText('QC results are outside the granted desktop modules'),
    ).not.toBeInTheDocument();
  });

  it('allows Lot Management with only the lots module grant and shows its navigation entry', async () => {
    const session = readSession()!;
    setAuthenticatedSession({
      ...session,
      modules: ['lots'],
      profile: {
        ...session.profile!,
        modules: [{ key: 'lots', name: 'Lot Management', built_in: true }],
      },
    });
    vi.mocked(apiClient.get).mockImplementation(async (url) => ({
      status: 200,
      data:
        url === 'ui/lookups'
          ? { styles: apiPage([], undefined, 20) }
          : apiPage([], undefined, 10),
    }));
    await router.navigate('/lots');
    renderWithProviders(<App />);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Lot Management' }),
    ).toBeVisible();
    expect(await screen.findByText('No lots found.')).toBeVisible();
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Open navigation menu' }));
    expect(
      screen.getByRole('link', { name: 'Lot Management' }),
    ).toHaveAttribute('href', '/lots');
    expect(
      screen.queryByRole('link', { name: 'Style Management' }),
    ).not.toBeInTheDocument();
  });

  it('hides Lot Management without its module grant even when the profile lists it', async () => {
    const session = readSession()!;
    setAuthenticatedSession({
      ...session,
      modules: ['users'],
      profile: {
        ...session.profile!,
        modules: [
          ...session.profile!.modules,
          { key: 'lots', name: 'Lot Management', built_in: true },
        ],
      },
    });
    await router.navigate('/users');
    renderWithProviders(<App />);
    await screen.findByRole('heading', { level: 1, name: 'User Management' });
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Open navigation menu' }));
    expect(
      screen.queryByRole('link', { name: 'Lot Management' }),
    ).not.toBeInTheDocument();
  });

  it('shows Trolley Configurations next to Storage only when its backend module is granted', async () => {
    const session = readSession()!;
    setAuthenticatedSession({
      ...session,
      modules: [...session.modules, 'trolleys'],
      profile: {
        ...session.profile!,
        modules: [
          ...session.profile!.modules,
          { key: 'trolleys', name: 'Trolley Configurations', built_in: true },
        ],
      },
    });
    vi.mocked(apiClient.get).mockResolvedValue({
      status: 200,
      data: { items: [], page: 0, size: 10, totalElements: 0 },
    });
    await router.navigate('/configurations/trolleys');
    renderWithProviders(<App />);
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Trolley Configurations',
      }),
    ).toBeVisible();
    expect(await screen.findByText('No trolleys found.')).toBeVisible();
    const user = userEvent.setup();
    await user.click(
      screen.getByRole('button', { name: 'Open navigation menu' }),
    );
    const submenu = screen.getByLabelText('Configurations submenu');
    const links = within(submenu).getAllByRole('link');
    const storageIndex = links.findIndex(
      (link) => link.textContent === 'Storage Configurations',
    );
    expect(links[storageIndex + 1]).toHaveTextContent('Trolley Configurations');
    expect(links[storageIndex + 1]).toHaveAttribute('aria-current', 'page');
  });

  it('hides the trolley navigation entry when trolleys access is absent even if the profile lists it', async () => {
    const session = readSession()!;
    setAuthenticatedSession({
      ...session,
      modules: ['storage'],
      profile: {
        ...session.profile!,
        modules: [
          ...session.profile!.modules,
          { key: 'trolleys', name: 'Trolley Configurations', built_in: true },
        ],
      },
    });
    await router.navigate('/configurations/storages');
    renderWithProviders(<App />);
    await screen.findByRole('heading', {
      level: 1,
      name: 'Storage Configurations',
    });
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Open navigation menu' }));
    expect(
      screen.queryByRole('link', { name: 'Trolley Configurations' }),
    ).not.toBeInTheDocument();
  });
  it('opens user details from the list and retains users navigation access', async () => {
    vi.mocked(apiClient.get).mockImplementation(async (url) => ({
      status: 200,
      data:
        url === 'users' ? apiPage(usersResponse, undefined, 10) : userResponse,
    }));
    const user = userEvent.setup();
    await router.navigate('/users');
    renderWithProviders(<App />);
    await user.click(await screen.findByRole('link', { name: 'View admin' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'admin' }),
    ).toBeVisible();
    expect(window.location.pathname).toBe(`/users/${userResponse.id}`);
    expect(screen.getByText('Bootstrap NW')).toBeVisible();
    await user.click(
      screen.getByRole('button', { name: 'Open navigation menu' }),
    );
    expect(
      within(
        screen.getByRole('navigation', { name: 'Main navigation' }),
      ).getByRole('link', { name: 'User Management' }),
    ).toHaveAttribute('aria-current', 'page');
  });

  it.each([
    '/dashboard',
    '/lots',
    '/lots/lot-id',
    '/LOTS/lot-id',
    '/%6cots/lot-id',
    '/users',
    '/users/user-id',
    '/roles',
    '/workspace',
    '/access-denied',
    '/change-password',
    '/%63hange-password',
  ])('forces a required password change before opening %s', async (path) => {
    const session = readSession()!;
    setAuthenticatedSession({
      ...session,
      profile: { ...session.profile!, must_change_password: true },
    });
    await router.navigate(path);
    renderWithProviders(<App />);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Change password' }),
    ).toBeVisible();
    expect(screen.queryByRole('banner')).not.toBeInTheDocument();
    expect(apiClient.get).not.toHaveBeenCalled();
  });
  it.each([
    '/dashboard',
    '/reports',
    '/users',
    '/users/user-id',
    '/%75sers/user-id',
    '/roles',
    '/styles',
    '/styles/sty-1',
    '/new-style',
    '/new-style/sty-1',
    '/configurations',
    '/configurations/',
    '/configurations/trolleys',
    '/CONFIGURATIONS/TROLLEYS',
    '/configurations/%74rolleys',
    '/configurations/processes',
    '/configurations/processes/demo-1',
    '/configurations/storages',
    '/configurations/storages/storage-demo-1',
    '/configurations/tags',
    '/ROLES',
    '/%72oles',
    '/UsErS',
    '/%75sers',
    '/STYLES/sty-1',
    '/%73tyles/sty-1',
    '/NEW-STYLE/sty-1',
    '/CONFIGURATIONS/PROCESSES/demo-1',
    '/configurations/%73torages/storage-demo-1',
    '/configurations/%74ags?tab=settings#list',
  ])('blocks direct module access without permission at %s', async (path) => {
    setAuthenticatedSession({ ...readSession()!, modules: [] });
    await router.navigate(path);
    renderWithProviders(<App />);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Access denied' }),
    ).toBeVisible();
    expect(window.location.pathname).toBe('/access-denied');
    expect(apiClient.get).not.toHaveBeenCalled();
  });

  it.each(['/ROLES', '/%72oles'])(
    'allows alternate URL spellings only with the matching module: %s',
    async (path) => {
      setAuthenticatedSession({ ...readSession()!, modules: ['roles'] });
      await router.navigate(path);
      renderWithProviders(<App />);
      expect(
        await screen.findByRole('heading', {
          level: 1,
          name: 'Role Management',
        }),
      ).toBeVisible();
      await screen.findByText('No roles found.');
      expect(apiClient.get).toHaveBeenCalledTimes(1);
    },
  );

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

  it('uses shared Style Management for configurators while retaining backend ownership checks', async () => {
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
    const originalGet = vi.mocked(apiClient.get).getMockImplementation()!;
    vi.mocked(apiClient.get).mockImplementation(async (url, config) => {
      if (url === 'styles')
        return {
          status: 200,
          data: apiPage(
            [
              {
                ...styleResponse,
                id: 'owned-style',
                style_number: 'OWN-100',
                created_by: 'user-7',
              },
            ],
            config?.params,
            10,
          ),
        };
      if (url === 'styles/owned-style')
        return {
          status: 200,
          data: {
            ...styleResponse,
            id: 'owned-style',
            style_number: 'OWN-100',
            created_by: 'user-7',
          },
        };
      if (url === 'styles/sty-1')
        return {
          status: 403,
          data: {
            code: 'ACCESS_DENIED',
            detail: 'Style is outside your access',
          },
        };
      return originalGet(url, config);
    });
    const user = userEvent.setup();
    await router.navigate('/new-style');
    renderWithProviders(<App />);
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Style Management',
      }),
    ).toBeVisible();
    expect(
      await screen.findByRole('rowheader', { name: 'OWN-100' }),
    ).toBeVisible();
    expect(screen.queryByText('STY-1001')).not.toBeInTheDocument();
    expect(window.location.pathname).toBe('/styles');
    expect(screen.getByRole('button', { name: 'Edit OWN-100' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Create Style' })).toBeEnabled();
    expect(
      screen.getByRole('button', { name: 'Release style OWN-100' }),
    ).toBeEnabled();
    await user.click(screen.getByRole('link', { name: 'View OWN-100' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'OWN-100' }),
    ).toBeVisible();
    expect(
      screen.queryByRole('heading', { name: 'Revision History' }),
    ).not.toBeInTheDocument();
    expect(apiClient.get).not.toHaveBeenCalledWith(
      expect.stringContaining('/revisions'),
      expect.anything(),
    );
    await act(() => router.navigate('/new-style/sty-1'));
    expect(
      await screen.findByText('Style is outside your access'),
    ).toBeVisible();
    expect(screen.queryByText('STY-1001')).not.toBeInTheDocument();
    await act(() => router.navigate('/styles'));
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Style Management',
      }),
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
    '/lots',
    '/lots/lot-id',
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
      title: 'Style Management',
    },
  ])(
    'signs in $username and opens the first available module',
    async ({ username, password, title }) => {
      signOut();
      const user = userEvent.setup();
      await router.navigate('/login');
      renderWithProviders(<App />);
      act(() => signIn(username, password));
      expect(
        await screen.findByRole('heading', {
          level: 1,
          name: title,
        }),
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
    await router.navigate('/configurations/processes/demo-2?tab=devices#list');
    const view = renderWithProviders(<App />);
    await screen.findByRole('heading', { level: 2, name: 'Sign In' });
    act(() => signIn('nw.admin'));
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
        await screen.findByRole('heading', {
          level: 1,
          name: path === '/reports' ? 'Reports and Analysis' : title,
        }),
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
    expect(
      within(nav).getByRole('link', { name: 'Reports/Analysis' }),
    ).toBeVisible();
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
    await router.navigate('/roles');
    renderWithProviders(<App />);
    await screen.findByRole('heading', { name: 'Sign In', level: 2 });
    act(() => signIn('supervisor'));
    expect(
      await screen.findByRole('heading', { name: 'Dashboard', level: 1 }),
    ).toBeVisible();
    expect(window.location.pathname).toBe('/dashboard');
  });

  it('revokes an open module when backend permissions change and ends a revoked session', async () => {
    signIn('supervisor', 'Super@2026demo');
    await router.navigate('/reports');
    renderWithProviders(<App />);
    await screen.findByRole('heading', {
      name: 'Reports and Analysis',
      level: 1,
    });
    const records = loadAccessData().records;
    records.roles.find((role) => role.name === 'Supervisor')!.modules = [];
    act(() => {
      localStorage.setItem(ACCESS_STORAGE_KEY, JSON.stringify(records));
      setAuthenticatedSession({ ...readSession()!, modules: [] });
    });
    expect(
      await screen.findByRole('heading', { name: 'Access denied', level: 1 }),
    ).toBeVisible();
    records.users.find((record) => record.username === 'supervisor')!.status =
      'Inactive';
    act(() => {
      localStorage.setItem(ACCESS_STORAGE_KEY, JSON.stringify(records));
      setAuthenticatedSession(null);
    });
    expect(
      await screen.findByRole('heading', { name: 'Sign In', level: 2 }),
    ).toBeVisible();
    expect(readSession()).toBeNull();
    records.users.find((record) => record.username === 'supervisor')!.status =
      'Active';
    act(() => {
      localStorage.setItem(ACCESS_STORAGE_KEY, JSON.stringify(records));
      window.dispatchEvent(new Event('storage'));
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
    { path: '/reports', title: 'Reports/Analysis' },
    { path: '/users', title: 'User Management' },
    { path: '/roles', title: 'Role Management' },
  ])(
    'opens $path directly and highlights its sidebar link',
    async ({ path, title }) => {
      const user = userEvent.setup();
      await router.navigate(path);
      renderWithProviders(<App />);
      expect(
        await screen.findByRole('heading', {
          level: 1,
          name: path === '/reports' ? 'Reports and Analysis' : title,
        }),
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
      path: '/configurations/storages',
      action: 'Add Storage Unit',
      label: /NFC Tag/,
    },
  ])(
    'offers newly registered tags in $path',
    async ({ path, action, label }) => {
      const originalGet = vi.mocked(apiClient.get).getMockImplementation()!;
      vi.mocked(apiClient.get).mockImplementation(async (url, config) =>
        url === 'ui/lookups'
          ? {
              status: 200,
              data: {
                tags: apiPage(
                  [
                    ...storageTags,
                    {
                      id: 'new-tag',
                      name: 'New Factory Tag',
                      uid: '04:AA:BB:CC',
                      status: 'ACTIVE',
                      assigned: false,
                    },
                  ],
                  config?.params,
                  20,
                ),
              },
            }
          : originalGet(url, config),
      );
      const user = userEvent.setup();
      await router.navigate(path);
      renderWithProviders(<App />);
      await user.click(screen.getByRole('button', { name: action }));
      await user.click(await screen.findByRole('combobox', { name: label }));
      expect(
        screen.getByRole('option', { name: 'New Factory Tag' }),
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
        await screen.findByRole('heading', {
          level: 1,
          name: path === '/reports' ? 'Reports and Analysis' : title,
        }),
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
    expect(apiClient.post).toHaveBeenCalledWith(
      'auth/logout',
      { refreshToken: 'test-refresh-token' },
      {
        timeout: 10_000,
      },
    );
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
