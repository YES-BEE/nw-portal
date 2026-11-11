import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { apiClient } from '../../api/client';
import {
  loginResponse,
  meResponse,
  refreshTokenResponse,
} from '../../test/auth';
import { renderWithProviders } from '../../test/render';
import { ChangePasswordPage } from './ChangePasswordPage';
import { ProtectedRoute } from './ProtectedRoute';
import {
  readSession,
  SESSION_STORAGE_KEY,
  setAuthenticatedSession,
  signOut,
} from './session';

beforeEach(() => {
  setAuthenticatedSession({
    user: {
      id: meResponse.id,
      username: 'admin',
      role: 'NW',
      status: 'Active',
    },
    modules: ['reports'],
    authentication: loginResponse,
    expiresAt: Date.now() + 600_000,
    refreshToken: 'old-refresh-token',
    refreshTokenExpiresAt: refreshTokenResponse.expiresAt,
    profile: { ...meResponse, must_change_password: true },
  });
  vi.spyOn(apiClient, 'post').mockImplementation(async (url) => ({
    status: 200,
    data:
      url === 'auth/change-password'
        ? { changed: true }
        : {
            ...refreshTokenResponse,
            refreshToken: 'replacement-refresh-token',
          },
  }));
  vi.spyOn(apiClient, 'get').mockResolvedValue({
    status: 200,
    data: { ...meResponse, must_change_password: false },
  });
});

function page(path = '/reports', landingLoader?: () => Promise<null>) {
  const router = createMemoryRouter(
    [
      { path: '/login', element: <h1>Sign in</h1> },
      {
        element: <ProtectedRoute />,
        children: [
          {
            path: '/change-password',
            handle: { authenticatedOnly: true, passwordChange: true },
            element: <ChangePasswordPage />,
          },
          {
            path: '/reports',
            loader: landingLoader,
            handle: { requiredModule: 'reports' },
            element: <h1>Reports</h1>,
          },
          {
            path: '/workspace',
            handle: { authenticatedOnly: true },
            element: <h1>No modules available</h1>,
          },
        ],
      },
    ],
    { initialEntries: [path] },
  );
  const view = renderWithProviders(<RouterProvider router={router} />);
  return {
    router,
    dispose: () => {
      view.unmount();
      router.dispose();
    },
  };
}

describe('secured password change page', () => {
  it('keeps cleared password inputs hidden while the successful landing navigation is pending', async () => {
    let finishLanding!: (value: null) => void;
    const landing = new Promise<null>((resolve) => {
      finishLanding = resolve;
    });
    const user = userEvent.setup();
    const view = page('/change-password', () => landing);
    try {
      await screen.findByRole('heading', { name: 'Change password' });
      await user.type(
        screen.getByLabelText(/Current password/),
        'current-password',
      );
      await user.type(screen.getByLabelText(/New password/), 'new-password');
      await user.click(screen.getByRole('button', { name: 'Change password' }));
      await waitFor(() =>
        expect(view.router.state.navigation.state).toBe('loading'),
      );
      expect(readSession()?.profile?.must_change_password).toBe(false);
      expect(readSession()?.passwordChangePending).toBeUndefined();
      expect(
        screen.queryByLabelText(/Current password/),
      ).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/New password/)).not.toBeInTheDocument();
      expect(
        screen.queryByText('Enter your current password.'),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText('Enter a new password.'),
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Please wait...' }),
      ).toBeDisabled();
      await act(async () => finishLanding(null));
      expect(
        await screen.findByRole('heading', { name: 'Reports' }),
      ).toBeVisible();
    } finally {
      finishLanding(null);
      view.dispose();
    }
  });
  it('requires login for the password route', async () => {
    signOut();
    const view = page('/change-password');
    try {
      expect(
        await screen.findByRole('heading', { name: 'Sign in' }),
      ).toBeVisible();
    } finally {
      view.dispose();
    }
  });

  it('allows mandatory password changes even when no modules are assigned', async () => {
    setAuthenticatedSession({
      ...readSession()!,
      modules: [],
      profile: { ...meResponse, must_change_password: true, modules: [] },
    });
    const view = page('/workspace');
    try {
      expect(
        await screen.findByRole('heading', { name: 'Change password' }),
      ).toBeVisible();
      expect(
        screen.queryByText('No modules available'),
      ).not.toBeInTheDocument();
    } finally {
      view.dispose();
    }
  });

  it('validates required fields then changes the password, stores a refresh token, and enters the allowed landing route', async () => {
    const user = userEvent.setup();
    const view = page();
    try {
      await screen.findByRole('heading', { name: 'Change password' });
      await user.click(screen.getByRole('button', { name: 'Change password' }));
      expect(
        screen.getByLabelText(/Current password/),
      ).toHaveAccessibleDescription('Enter your current password.');
      expect(apiClient.post).not.toHaveBeenCalled();
      await user.type(
        screen.getByLabelText(/Current password/),
        ' initial password ',
      );
      await user.type(screen.getByLabelText(/New password/), ' new password ');
      await user.click(screen.getByRole('button', { name: 'Change password' }));
      expect(
        await screen.findByRole('heading', { name: 'Reports' }),
      ).toBeVisible();
      expect(apiClient.post).toHaveBeenNthCalledWith(
        1,
        'auth/change-password',
        {
          currentPassword: ' initial password ',
          newPassword: ' new password ',
        },
        expect.any(Object),
      );
      expect(apiClient.post).toHaveBeenNthCalledWith(
        2,
        'auth/refresh-tokens',
        undefined,
        expect.any(Object),
      );
      expect(readSession()?.refreshToken).toBe('replacement-refresh-token');
      expect(readSession()?.profile?.must_change_password).toBe(false);
      const stored = sessionStorage.getItem(SESSION_STORAGE_KEY)!;
      expect(stored).not.toContain(' initial password ');
      expect(stored).not.toContain(' new password ');
    } finally {
      view.dispose();
    }
  });

  it('shows backend current-password failures while keeping the session and form available', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      status: 401,
      data: {
        code: 'AUTHENTICATION_FAILED',
        detail: 'Current password is incorrect',
      },
    });
    const user = userEvent.setup();
    const view = page();
    try {
      await screen.findByRole('heading', { name: 'Change password' });
      await user.type(screen.getByLabelText(/Current password/), 'wrong');
      await user.type(screen.getByLabelText(/New password/), 'new-password');
      await user.click(screen.getByRole('button', { name: 'Change password' }));
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Current password is incorrect',
      );
      expect(
        screen.getByLabelText(/Current password/),
      ).toHaveAccessibleDescription('Current password is incorrect');
      expect(apiClient.post).toHaveBeenCalledTimes(1);
      expect(apiClient.get).not.toHaveBeenCalled();
      expect(readSession()?.refreshToken).toBe('old-refresh-token');
    } finally {
      view.dispose();
    }
  });

  it('retries session completion without displaying or submitting passwords again', async () => {
    let failed = false;
    vi.mocked(apiClient.post).mockImplementation(async (url) => {
      if (url === 'auth/refresh-tokens' && !failed) {
        failed = true;
        return { status: 503, data: { detail: 'Session service unavailable' } };
      }
      return {
        status: 200,
        data:
          url === 'auth/change-password'
            ? { changed: true }
            : refreshTokenResponse,
      };
    });
    const user = userEvent.setup();
    const view = page();
    try {
      await screen.findByRole('heading', { name: 'Change password' });
      await user.type(
        screen.getByLabelText(/Current password/),
        'initial-password',
      );
      await user.type(screen.getByLabelText(/New password/), 'new-password');
      await user.click(screen.getByRole('button', { name: 'Change password' }));
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Session service unavailable',
      );
      expect(
        screen.queryByLabelText(/Current password/),
      ).not.toBeInTheDocument();
      expect(readSession()?.passwordChangePending).toBe(true);
      await user.click(
        screen.getByRole('button', { name: 'Finish session setup' }),
      );
      expect(
        await screen.findByRole('heading', { name: 'Reports' }),
      ).toBeVisible();
      expect(
        vi
          .mocked(apiClient.post)
          .mock.calls.filter(([url]) => url === 'auth/change-password'),
      ).toHaveLength(1);
    } finally {
      view.dispose();
    }
  });

  it('blocks duplicate submissions while a password request is pending', async () => {
    vi.mocked(apiClient.post).mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    const view = page();
    try {
      await screen.findByRole('heading', { name: 'Change password' });
      await user.type(
        screen.getByLabelText(/Current password/),
        'initial-password',
      );
      await user.type(screen.getByLabelText(/New password/), 'new-password');
      await user.click(screen.getByRole('button', { name: 'Change password' }));
      const button = screen.getByRole('button', { name: 'Please wait...' });
      expect(button).toBeDisabled();
      fireEvent.submit(button.closest('form')!);
      expect(apiClient.post).toHaveBeenCalledTimes(1);
    } finally {
      view.dispose();
    }
  });
});
