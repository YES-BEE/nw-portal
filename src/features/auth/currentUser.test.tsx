import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { InternalAxiosRequestConfig } from 'axios';
import { apiClient } from '../../api/client';
import {
  loginResponse,
  refreshTokenResponse,
  meResponse,
} from '../../test/auth';
import { renderWithProviders } from '../../test/render';
import { ConfigurationLayout } from '../../layouts/ConfigurationLayout';
import { useCurrentUser } from './currentUserContext';
import {
  initializeSession,
  readSession,
  refreshAccessToken,
  SESSION_STORAGE_KEY,
  signIn,
  signOut,
} from './session';
import type { MeResponse } from './types';

const profile: MeResponse = {
  ...meResponse,
  id: '6864cd44-c699-4f03-b39c-f1ee4315f839',
  display_name: 'Bootstrap NW',
  permissions: ['CONFIGURE', 'READ', 'USERS'],
  modules: [{ key: 'users', name: 'People from /me', built_in: true }],
};
const originalAdapter = apiClient.defaults.adapter;
const response = (
  config: InternalAxiosRequestConfig,
  data: unknown,
  status = 200,
) => ({ config, data, status, statusText: '', headers: {} });
const adapter = vi.fn(async (config: InternalAxiosRequestConfig) =>
  response(
    config,
    config.url === 'auth/login' || config.url === 'auth/refresh'
      ? loginResponse
      : config.url === 'auth/me'
        ? profile
        : refreshTokenResponse,
  ),
);
function Consumer() {
  const currentUser = useCurrentUser();
  return (
    <output data-testid="current-user">
      {currentUser ? JSON.stringify(currentUser) : 'anonymous'}
    </output>
  );
}
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  signOut();
  vi.stubEnv('VITE_API_BASE_URL', 'http://backend.test');
  vi.stubEnv('VITE_API_VERSION', 'v1');
  adapter
    .mockReset()
    .mockImplementation(async (config) =>
      response(
        config,
        config.url === 'auth/login' || config.url === 'auth/refresh'
          ? loginResponse
          : config.url === 'auth/me'
            ? profile
            : refreshTokenResponse,
      ),
    );
  apiClient.defaults.adapter = adapter;
});
afterEach(() => {
  apiClient.defaults.adapter = originalAdapter;
  vi.unstubAllEnvs();
});

describe('current-user context and /me permissions', () => {
  it('loads /me after login, exposes the full profile in context and uses only its modules in the sidebar', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <MemoryRouter>
        <Consumer />
        <ConfigurationLayout />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('current-user')).toHaveTextContent('anonymous');
    await act(async () => {
      expect(await signIn('admin', 'password')).toBeNull();
    });
    expect(JSON.parse(screen.getByTestId('current-user').textContent!)).toEqual(
      profile,
    );
    const meRequest = adapter.mock.calls.find(
      ([config]) => config.url === 'auth/me',
    )![0];
    expect(meRequest.method).toBe('get');
    expect(apiClient.getUri(meRequest)).toBe(
      'http://backend.test/api/v1/auth/me',
    );
    expect(meRequest.headers.get('Authorization')).toBe(
      'Bearer test-access-token',
    );
    expect(readSession()?.user.id).toBe(profile.id);
    expect(readSession()?.modules).toEqual(['users']);
    await user.click(
      screen.getByRole('button', { name: 'Open navigation menu' }),
    );
    const navigation = within(
      screen.getByRole('navigation', { name: 'Main navigation' }),
    );
    expect(
      navigation.getByRole('link', { name: 'People from /me' }),
    ).toHaveAttribute('href', '/users');
    expect(
      navigation.queryByRole('link', { name: 'Reports/Analysis' }),
    ).not.toBeInTheDocument();
    expect(
      JSON.parse(sessionStorage.getItem(SESSION_STORAGE_KEY)!).profile,
    ).toEqual(profile);
    act(() => signOut());
    expect(screen.getByTestId('current-user')).toHaveTextContent('anonymous');
  });
  it('fetches a fresh profile at startup and updates context rather than using cached or login modules', async () => {
    sessionStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({
        authentication: loginResponse,
        expiresAt: Date.now() + 900_000,
        refreshToken: refreshTokenResponse.refreshToken,
        refreshTokenExpiresAt: refreshTokenResponse.expiresAt,
        profile: { ...profile, modules: [] },
      }),
    );
    renderWithProviders(<Consumer />);
    await act(async () => {
      await initializeSession();
    });
    expect(adapter.mock.calls.map(([config]) => config.url)).toEqual([
      'auth/refresh-tokens',
      'auth/me',
    ]);
    expect(JSON.parse(screen.getByTestId('current-user').textContent!)).toEqual(
      profile,
    );
    expect(readSession()?.modules).toEqual(['users']);
  });
  it('keeps /me as the profile source when access renewal returns different modules', async () => {
    await signIn('admin', 'password');
    await refreshAccessToken();
    expect(readSession()?.authentication?.modules).toEqual(
      loginResponse.modules,
    );
    expect(readSession()?.profile).toEqual(profile);
    expect(readSession()?.modules).toEqual(['users']);
  });
  it.each([
    {},
    { ...profile, enabled: false },
    { ...profile, permissions: [42] },
    { ...profile, must_change_password: 'true' },
  ])(
    'does not authenticate a malformed or disabled /me profile: %j',
    async (data) => {
      adapter.mockImplementation(async (config) =>
        response(
          config,
          config.url === 'auth/login'
            ? loginResponse
            : config.url === 'auth/me'
              ? data
              : refreshTokenResponse,
        ),
      );
      expect(await signIn('admin', 'password')).toBe('invalidResponse');
      expect(readSession()).toBeNull();
      expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
    },
  );
  it('passes a backend /me failure back to the login form and clears credentials', async () => {
    adapter.mockImplementation(async (config) =>
      config.url === 'auth/me'
        ? response(config, { detail: 'Profile access denied' }, 403)
        : response(
            config,
            config.url === 'auth/login' ? loginResponse : refreshTokenResponse,
          ),
    );
    expect(await signIn('admin', 'password')).toMatchObject({
      message: 'Profile access denied',
      status: 403,
    });
    expect(readSession()).toBeNull();
  });
  it('ignores a late /me response after logout', async () => {
    let resolve!: (value: ReturnType<typeof response>) => void;
    adapter.mockImplementation(async (config) =>
      config.url === 'auth/me'
        ? new Promise((done) => {
            resolve = done;
          })
        : response(
            config,
            config.url === 'auth/login' ? loginResponse : refreshTokenResponse,
          ),
    );
    const pending = signIn('admin', 'password');
    await vi.waitFor(() =>
      expect(
        adapter.mock.calls.some(([config]) => config.url === 'auth/me'),
      ).toBe(true),
    );
    signOut();
    resolve(
      response(
        adapter.mock.calls.find(([config]) => config.url === 'auth/me')![0],
        profile,
      ),
    );
    await pending;
    expect(readSession()).toBeNull();
    expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });
});
