import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@mui/material';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { InternalAxiosRequestConfig } from 'axios';
import { theme } from '../../app/theme';
import { apiClient } from '../../api/client';
import {
  loginResponse,
  meResponse,
  refreshTokenResponse,
} from '../../test/auth';
import { StartupGate } from './StartupGate';
import {
  initializeSession,
  readSession,
  retryStartup,
  SESSION_STORAGE_KEY,
  signIn,
  signOut,
} from './session';
import { getStartupStatus } from './startupState';

const originalAdapter = apiClient.defaults.adapter;
const response = (
  config: InternalAxiosRequestConfig,
  data: unknown,
  status = 200,
) => ({ config, data, status, statusText: '', headers: {} });
const healthy = async (config: InternalAxiosRequestConfig) =>
  response(
    config,
    config.url === 'auth/me'
      ? meResponse
      : config.url === 'auth/login' || config.url === 'auth/refresh'
        ? loginResponse
        : refreshTokenResponse,
  );
const adapter = vi.fn(healthy);
function saveSession(expired = false) {
  sessionStorage.setItem(
    SESSION_STORAGE_KEY,
    JSON.stringify({
      authentication: loginResponse,
      profile: meResponse,
      expiresAt: Date.now() + (expired ? -1000 : 900_000),
      refreshToken: refreshTokenResponse.refreshToken,
      refreshTokenExpiresAt: refreshTokenResponse.expiresAt,
    }),
  );
}
function showGate(onSignIn = vi.fn()) {
  return render(
    <ThemeProvider theme={theme}>
      <StartupGate onSignIn={onSignIn}>
        <h1>Workspace ready</h1>
      </StartupGate>
    </ThemeProvider>,
  );
}
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  signOut();
  vi.stubEnv('VITE_API_BASE_URL', 'http://backend.test');
  vi.stubEnv('VITE_API_VERSION', 'v1');
  adapter.mockReset().mockImplementation(healthy);
  apiClient.defaults.adapter = adapter;
});
afterEach(() => {
  apiClient.defaults.adapter = originalAdapter;
  vi.unstubAllEnvs();
});

describe('graceful startup failures', () => {
  it('never renders the error card during a successful startup', async () => {
    saveSession();
    const { container } = showGate();
    let resolve!: (value: ReturnType<typeof response>) => void;
    adapter.mockImplementation((config) =>
      config.url === 'auth/me'
        ? new Promise((done) => {
            resolve = done;
          })
        : healthy(config),
    );
    let startup!: Promise<void>;
    act(() => {
      startup = initializeSession();
    });
    expect(screen.getByRole('status')).toHaveAccessibleName(
      'Getting your workspace ready...',
    );
    expect(container.querySelector('.MuiPaper-root')).toBeNull();
    expect(
      screen.queryByRole('heading', { name: 'Something went wrong' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    await vi.waitFor(() =>
      expect(
        adapter.mock.calls.some(([config]) => config.url === 'auth/me'),
      ).toBe(true),
    );
    const config = adapter.mock.calls.find(
      ([config]) => config.url === 'auth/me',
    )![0];
    await act(async () => {
      resolve(response(config, meResponse));
      await startup;
    });
    expect(
      screen.getByRole('heading', { name: 'Workspace ready' }),
    ).toBeVisible();
    expect(container.querySelector('.MuiPaper-root')).toBeNull();
    expect(
      screen.queryByRole('heading', { name: 'Something went wrong' }),
    ).not.toBeInTheDocument();
  });

  it.each(['auth/me', 'auth/refresh-tokens'])(
    'shows the error screen when %s fails after login',
    async (endpoint) => {
      showGate();
      adapter.mockImplementation(async (config) =>
        config.url === endpoint
          ? response(config, { detail: 'Internal server details' }, 503)
          : healthy(config),
      );
      await act(async () => {
        await signIn('admin', 'password');
      });
      expect(
        screen.getByRole('heading', { name: 'Something went wrong' }),
      ).toHaveFocus();
      expect(screen.getByRole('button', { name: 'Try again' })).toBeVisible();
      expect(
        screen.getByRole('button', { name: 'Back to sign in' }),
      ).toBeVisible();
      expect(screen.queryByText('Workspace ready')).not.toBeInTheDocument();
      expect(
        screen.queryByText('Internal server details'),
      ).not.toBeInTheDocument();
      expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
    },
  );
  it.each(['auth/me', 'auth/refresh-tokens'])(
    'handles a startup network failure from %s',
    async (endpoint) => {
      saveSession();
      showGate();
      adapter.mockImplementation(async (config) => {
        if (config.url === endpoint) throw new Error('Network error');
        return healthy(config);
      });
      await act(async () => {
        await initializeSession();
      });
      expect(
        screen.getByRole('heading', { name: 'Something went wrong' }),
      ).toBeVisible();
      expect(readSession()).toBeNull();
    },
  );
  it('handles access renewal failing during startup', async () => {
    saveSession(true);
    showGate();
    adapter.mockImplementation(async (config) =>
      response(config, '<html>Unavailable</html>', 503),
    );
    await act(async () => {
      await initializeSession();
    });
    expect(
      screen.getByRole('heading', { name: 'Something went wrong' }),
    ).toBeVisible();
    expect(readSession()).toBeNull();
  });
  it('handles a malformed successful startup response', async () => {
    saveSession();
    showGate();
    adapter.mockImplementation(async (config) =>
      config.url === 'auth/me' ? response(config, {}) : healthy(config),
    );
    await act(async () => {
      await initializeSession();
    });
    expect(
      screen.getByRole('heading', { name: 'Something went wrong' }),
    ).toBeVisible();
  });
  it('retries workspace setup without resubmitting the login password', async () => {
    const user = userEvent.setup();
    showGate();
    adapter.mockImplementation(async (config) =>
      config.url === 'auth/me' ? response(config, {}, 503) : healthy(config),
    );
    await act(async () => {
      await signIn('admin', 'password');
    });
    adapter.mockImplementation(healthy);
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(
      await screen.findByRole('heading', { name: 'Workspace ready' }),
    ).toBeVisible();
    expect(
      adapter.mock.calls.filter(([config]) => config.url === 'auth/login'),
    ).toHaveLength(1);
    expect(
      adapter.mock.calls.filter(([config]) => config.url === 'auth/me'),
    ).toHaveLength(2);
    expect(readSession()?.profile).toEqual(meResponse);
  });
  it('offers a loading state and prevents duplicate retries', async () => {
    const user = userEvent.setup();
    saveSession();
    showGate();
    adapter.mockImplementation(async (config) =>
      config.url === 'auth/me' ? response(config, {}, 503) : healthy(config),
    );
    await act(async () => {
      await initializeSession();
    });
    let resolve!: (value: ReturnType<typeof response>) => void;
    adapter.mockImplementation((config) =>
      config.url === 'auth/refresh-tokens'
        ? new Promise((done) => {
            resolve = done;
          })
        : healthy(config),
    );
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.getByRole('status')).toHaveAccessibleName(
      'Getting your workspace ready...',
    );
    await act(async () => {
      await retryStartup();
    });
    expect(
      adapter.mock.calls.filter(
        ([config]) => config.url === 'auth/refresh-tokens',
      ),
    ).toHaveLength(2);
    const config = adapter.mock.calls.filter(
      ([config]) => config.url === 'auth/refresh-tokens',
    )[1][0];
    await act(async () => {
      resolve(response(config, refreshTokenResponse));
    });
    expect(
      await screen.findByRole('heading', { name: 'Workspace ready' }),
    ).toBeVisible();
  });
  it('clears the retry state and session when returning to sign in', async () => {
    const user = userEvent.setup();
    const onSignIn = vi.fn();
    saveSession();
    showGate(onSignIn);
    adapter.mockRejectedValue(new Error('Network error'));
    await act(async () => {
      await initializeSession();
    });
    await user.click(screen.getByRole('button', { name: 'Back to sign in' }));
    expect(onSignIn).toHaveBeenCalledOnce();
    expect(readSession()).toBeNull();
    expect(getStartupStatus()).toBe('ready');
    const count = adapter.mock.calls.length;
    await retryStartup();
    expect(adapter).toHaveBeenCalledTimes(count);
  });
  it('keeps an ordinary login rejection on the login error path', async () => {
    adapter.mockImplementation(async (config) =>
      response(config, { detail: 'Bad credentials' }, 401),
    );
    expect(await signIn('admin', 'password')).toMatchObject({
      message: 'Bad credentials',
    });
    expect(getStartupStatus()).toBe('ready');
  });
});
