import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import { readSession, setAuthenticatedSession, signOut } from './session';
import { seedTestData, signIn } from '../../test/fixtures';
import { renderWithProviders } from '../../test/render';

beforeEach(() => {
  seedTestData();
  signIn('nw.admin');
});

function protectedRouter(handle: unknown) {
  return createMemoryRouter(
    [
      { path: '/login', element: <h1>Sign in</h1> },
      {
        element: <ProtectedRoute />,
        children: [
          { path: '/private', handle, element: <h1>Private content</h1> },
          {
            path: '/access-denied',
            handle: { authenticatedOnly: true },
            element: <h1>Access denied</h1>,
          },
        ],
      },
    ],
    { initialEntries: ['/private'] },
  );
}

describe('route access policies', () => {
  it.each([
    undefined,
    null,
    {},
    { requiredModule: 'unknown' },
    { requiredModule: null },
    { requiredModule: 'unknown', authenticatedOnly: true },
    { authenticatedOnly: 'true' },
  ])('denies missing or invalid policies: %j', async (handle) => {
    const router = protectedRouter(handle);
    const view = renderWithProviders(<RouterProvider router={router} />);
    try {
      expect(
        await screen.findByRole('heading', { name: 'Access denied' }),
      ).toBeVisible();
      expect(screen.queryByText('Private content')).not.toBeInTheDocument();
    } finally {
      view.unmount();
      router.dispose();
    }
  });

  it('requires login even for an explicitly authentication-only page', async () => {
    signOut();
    const router = protectedRouter({ authenticatedOnly: true });
    const view = renderWithProviders(<RouterProvider router={router} />);
    try {
      expect(
        await screen.findByRole('heading', { name: 'Sign in' }),
      ).toBeVisible();
    } finally {
      view.unmount();
      router.dispose();
    }
  });

  it('allows explicitly authentication-only pages for users with no modules', async () => {
    setAuthenticatedSession({ ...readSession()!, modules: [] });
    const router = protectedRouter({ authenticatedOnly: true });
    const view = renderWithProviders(<RouterProvider router={router} />);
    try {
      expect(
        await screen.findByRole('heading', { name: 'Private content' }),
      ).toBeVisible();
    } finally {
      view.unmount();
      router.dispose();
    }
  });

  it('blocks expired sessions that cannot renew their access token', async () => {
    setAuthenticatedSession({
      ...readSession()!,
      expiresAt: Date.now() - 1,
      refreshToken: undefined,
      refreshTokenExpiresAt: undefined,
    });
    const router = protectedRouter({ requiredModule: 'roles' });
    const view = renderWithProviders(<RouterProvider router={router} />);
    try {
      expect(
        await screen.findByRole('heading', { name: 'Sign in' }),
      ).toBeVisible();
    } finally {
      view.unmount();
      router.dispose();
    }
  });
});
