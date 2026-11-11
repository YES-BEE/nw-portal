import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { InternalAxiosRequestConfig } from 'axios';
import { apiClient } from '../../api/client';
import {
  loginResponse,
  meResponse,
  refreshTokenResponse,
} from '../../test/auth';
import {
  changeSessionPassword,
  completePasswordChange,
  getLandingPath,
  initializeSession,
  readSession,
  SESSION_STORAGE_KEY,
  signIn,
  signOut,
} from './session';
import { getStartupStatus } from './startupState';

const originalAdapter = apiClient.defaults.adapter;
let initialPassword: boolean;
const initialProfile = {
  ...meResponse,
  must_change_password: true,
  initial_password_expires_at: '2099-11-17T15:11:45Z',
};
const response = (
  config: InternalAxiosRequestConfig,
  data: unknown,
  status = 200,
) => ({ config, data, status, statusText: '', headers: {} });
const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => {
  if (config.url === 'auth/login') return response(config, loginResponse);
  if (config.url === 'auth/me')
    return response(
      config,
      initialPassword
        ? initialProfile
        : { ...meResponse, initial_password_expires_at: null },
    );
  if (config.url === 'auth/refresh-tokens')
    return initialPassword
      ? response(
          config,
          {
            code: 'ACCESS_DENIED',
            detail: 'Change the initial password before using the application',
          },
          403,
        )
      : response(config, refreshTokenResponse);
  if (config.url === 'auth/change-password') {
    initialPassword = false;
    return response(config, { changed: true });
  }
  throw new Error(`Unexpected request: ${config.url}`);
});
beforeEach(() => {
  signOut();
  sessionStorage.clear();
  initialPassword = true;
  adapter.mockClear();
  vi.stubEnv('VITE_API_BASE_URL', 'http://backend.test');
  vi.stubEnv('VITE_API_VERSION', 'v1');
  apiClient.defaults.adapter = adapter;
});
afterEach(() => {
  signOut();
  apiClient.defaults.adapter = originalAdapter;
  vi.unstubAllEnvs();
});

describe('initial-password startup', () => {
  it('loads /me first and enters the password-change flow without calling the blocked refresh endpoint', async () => {
    await expect(signIn('admin', 'initial password')).resolves.toBeNull();
    expect(adapter.mock.calls.map(([config]) => config.url)).toEqual([
      'auth/login',
      'auth/me',
    ]);
    expect(getStartupStatus()).toBe('ready');
    expect(getLandingPath(readSession()!)).toBe('/change-password');
    expect(readSession()?.refreshToken).toBeUndefined();
    expect(
      JSON.parse(sessionStorage.getItem(SESSION_STORAGE_KEY)!).refreshToken,
    ).toBeUndefined();
    await changeSessionPassword({
      currentPassword: 'initial password',
      newPassword: 'new password',
    });
    await completePasswordChange();
    expect(adapter.mock.calls.map(([config]) => config.url)).toEqual([
      'auth/login',
      'auth/me',
      'auth/change-password',
      'auth/refresh-tokens',
      'auth/me',
    ]);
    expect(readSession()?.refreshToken).toBe(refreshTokenResponse.refreshToken);
    expect(getLandingPath(readSession()!)).toBe('/reports');
  });
  it('restores the limited password-change session without issuing a refresh token', async () => {
    await signIn('admin', 'initial password');
    const saved = sessionStorage.getItem(SESSION_STORAGE_KEY)!;
    signOut();
    sessionStorage.setItem(SESSION_STORAGE_KEY, saved);
    adapter.mockClear();
    await initializeSession();
    expect(adapter.mock.calls.map(([config]) => config.url)).toEqual([
      'auth/me',
    ]);
    expect(getLandingPath(readSession()!)).toBe('/change-password');
    expect(getStartupStatus()).toBe('ready');
  });
  it('uses the backend initial-password restriction even when the password-change flag is false', async () => {
    adapter
      .mockImplementationOnce(async (config) => response(config, loginResponse))
      .mockImplementationOnce(async (config) =>
        response(config, { ...initialProfile, must_change_password: false }),
      );
    await expect(signIn('admin', 'initial password')).resolves.toBeNull();
    expect(adapter).toHaveBeenCalledTimes(2);
    expect(getLandingPath(readSession()!)).toBe('/change-password');
  });
  it('does not issue refresh tokens before a successful /me response', async () => {
    adapter
      .mockImplementationOnce(async (config) => response(config, loginResponse))
      .mockImplementationOnce(async (config) =>
        response(config, { detail: 'Profile unavailable' }, 503),
      );
    await expect(signIn('admin', 'password')).resolves.toMatchObject({
      message: 'Profile unavailable',
    });
    expect(adapter.mock.calls.map(([config]) => config.url)).toEqual([
      'auth/login',
      'auth/me',
    ]);
    expect(readSession()).toBeNull();
  });
});
