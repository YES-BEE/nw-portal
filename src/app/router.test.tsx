import { screen } from '@testing-library/react';
import { afterAll, describe, expect, it } from 'vitest';
import App from '../App';
import { renderWithProviders } from '../test/render';
import { router } from './router';

afterAll(() => {
  router.dispose();
});

describe('application routing', () => {
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
