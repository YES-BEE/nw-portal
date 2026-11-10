import { apiClient } from '../../api/client';
import type { MockInstance } from 'vitest';
import {
  loginResponse,
  refreshTokenResponse,
  meResponse,
} from '../../test/auth';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ACCESS_STORAGE_KEY } from '../access/accessData';
import {
  SESSION_STORAGE_KEY,
  initializeSession,
  getLandingPath,
  readSession,
  setAuthenticatedSession,
  signIn,
  signOut,
} from './session';
import type { AuthSession } from './session';

let postMock: MockInstance<typeof apiClient.post>;

function mockSuccessfulLogin(data = loginResponse) {
  postMock.mockImplementation(async (url) => ({
    status: 200,
    data: url === 'auth/refresh-tokens' ? refreshTokenResponse : data,
  }));
}

const identity: AuthSession = {
  user: {
    id: 'backend-user',
    username: 'operator',
    role: 'Backend role',
    status: 'Active',
  },
  modules: ['reports'],
};
beforeEach(() => {
  vi.spyOn(apiClient, 'get').mockResolvedValue({
    status: 200,
    data: meResponse,
  });
  postMock = vi.spyOn(apiClient, 'post');
  localStorage.clear();
  sessionStorage.clear();
  signOut();
  vi.stubEnv('VITE_API_BASE_URL', 'http://backend.test/');
  vi.stubEnv('VITE_AUTH_CLIENT_TYPE', 'PC');
  vi.stubEnv('VITE_API_VERSION', 'v1');
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('backend session preparation', () => {
  it('posts typed credentials through the shared client and starts a session', async () => {
    mockSuccessfulLogin();
    expect(await signIn(' admin ', ' exact password ')).toBeNull();
    expect(postMock).toHaveBeenCalledWith(
      'auth/login',
      { username: 'admin', password: ' exact password ', clientType: 'PC' },
      expect.objectContaining({
        validateStatus: expect.any(Function),
      }),
    );
    expect(readSession()).toMatchObject({
      user: { id: meResponse.id, username: 'admin', role: 'NW' },
      modules: ['reports'],
      authentication: loginResponse,
    });
    expect(getLandingPath(readSession()!)).toBe('/reports');
    const saved = JSON.parse(sessionStorage.getItem(SESSION_STORAGE_KEY)!);
    expect(saved.authentication).toEqual(loginResponse);
    expect(saved.expiresAt).toBe(readSession()?.expiresAt);
    expect(JSON.stringify(saved)).not.toContain('exact password');
    expect(sessionStorage.length).toBe(1);
    expect(localStorage.length).toBe(0);
  });
  it('uses the configured client type and preserves unknown module metadata without granting routes', async () => {
    vi.stubEnv('VITE_AUTH_CLIENT_TYPE', 'PAD');
    const response = {
      ...loginResponse,
      processAssignments: [{ processId: 'backend-process' }],
      modules: [
        ...loginResponse.modules,
        ...loginResponse.modules,
        { key: 'future', name: 'Future', built_in: false },
      ],
    };
    mockSuccessfulLogin(response);
    await signIn('admin', 'password');
    expect(postMock.mock.calls[0][1]).toMatchObject({ clientType: 'PAD' });
    expect(readSession()?.modules).toEqual(['reports']);
    expect(readSession()?.authentication).toEqual(response);
  });
  it('lets the backend validate the configured client type and returns its field error', async () => {
    vi.stubEnv('VITE_AUTH_CLIENT_TYPE', 'TABLET');
    postMock.mockResolvedValue({
      status: 400,
      data: {
        detail: 'Request validation failed',
        fieldErrors: { clientType: 'must match "PC|PAD"' },
      },
    });
    expect(await signIn('admin', 'password')).toMatchObject({
      status: 400,
      fieldErrors: { clientType: 'must match "PC|PAD"' },
    });
    expect(postMock.mock.calls[0][1]).toMatchObject({ clientType: 'TABLET' });
    expect(readSession()).toBeNull();
  });
  it.each([401, 403, 500])(
    'handles HTTP %s without creating a session',
    async (status) => {
      postMock.mockResolvedValue({ status, data: null });
      expect(await signIn('admin', 'password')).toMatchObject({
        status,
        message: String(status),
      });
      expect(readSession()).toBeNull();
    },
  );
  it('clears a previous token and session when a subsequent login fails', async () => {
    postMock
      .mockResolvedValueOnce({ status: 200, data: loginResponse })
      .mockResolvedValueOnce({ status: 200, data: refreshTokenResponse });
    await signIn('admin', 'password');
    expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).not.toBeNull();
    postMock.mockResolvedValueOnce({
      status: 403,
      data: {
        type: 'about:blank',
        title: 'Forbidden',
        status: 403,
        detail: 'Role does not allow this application channel',
        code: 'ACCESS_DENIED',
      },
    });
    expect(await signIn('admin', 'password')).toMatchObject({
      kind: 'access',
      code: 'ACCESS_DENIED',
    });
    expect(readSession()).toBeNull();
    expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });
  it('reports transport failures', async () => {
    postMock.mockRejectedValue(new Error('Network error'));
    expect(await signIn('admin', 'password')).toMatchObject({
      kind: 'network',
      message: 'Network error',
    });
    expect(postMock).toHaveBeenCalledTimes(1);
  });
  it.each([
    {},
    { ...loginResponse, accessToken: '' },
    { ...loginResponse, expiresIn: 0 },
    { ...loginResponse, expiresIn: Infinity },
    { ...loginResponse, tokenType: 'unexpected' },
    { ...loginResponse, modules: [{ key: 'reports', name: 'Reports' }] },
    { ...loginResponse, roles: 'NW' },
    { ...loginResponse, processAssignments: null },
  ])('rejects malformed successful responses', async (response) => {
    postMock.mockResolvedValue({ status: 200, data: response });
    expect(await signIn('admin', 'password')).toBe('invalidResponse');
    expect(readSession()).toBeNull();
  });
  it('rejects a non-JSON response', async () => {
    postMock.mockResolvedValue({ status: 200, data: '<html>Error</html>' });
    expect(await signIn('admin', 'password')).toBe('invalidResponse');
  });
  it('renews an expired access token and clears tokens on logout', async () => {
    vi.useFakeTimers();
    mockSuccessfulLogin();
    await signIn('admin', 'password');
    expect(readSession()?.authentication?.accessToken).toBe(
      'test-access-token',
    );
    await vi.advanceTimersByTimeAsync(900_000);
    expect(readSession()?.expiresAt).toBeGreaterThan(Date.now());
    expect(postMock).toHaveBeenCalledWith(
      'auth/refresh',
      { refreshToken: refreshTokenResponse.refreshToken },
      expect.any(Object),
    );
    await signIn('admin', 'password');
    signOut();
    expect(readSession()).toBeNull();
    expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('does not create a session after logout or cancellation while login is pending', async () => {
    let resolve!: (value: { status: number; data: unknown }) => void;
    postMock.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const pending = signIn('admin', 'password');
    signOut();
    resolve({ status: 200, data: loginResponse });
    await pending;
    expect(readSession()).toBeNull();
    const controller = new AbortController();
    const cancelled = signIn('admin', 'password', controller.signal);
    controller.abort();
    resolve({ status: 200, data: loginResponse });
    await cancelled;
    expect(readSession()).toBeNull();
  });
  it('restores the token and sidebar metadata after reload without extending the original expiry', async () => {
    postMock.mockImplementation(async (url) => ({
      status: 200,
      data: url === 'auth/refresh' ? loginResponse : refreshTokenResponse,
    }));
    vi.useFakeTimers();
    const expiresAt = Date.now() + 60_000;
    sessionStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({
        authentication: loginResponse,
        expiresAt,
        modules: ['users'],
      }),
    );
    localStorage.setItem(
      ACCESS_STORAGE_KEY,
      JSON.stringify({
        users: [],
        roles: [{ name: 'NW', modules: ['users'] }],
      }),
    );
    await initializeSession();
    expect(readSession()).toMatchObject({
      authentication: loginResponse,
      modules: ['reports'],
      expiresAt,
    });
    expect(getLandingPath(readSession()!)).toBe('/reports');
    await vi.advanceTimersByTimeAsync(60_000);
    expect(readSession()?.expiresAt).toBeGreaterThan(Date.now());
  });
  it.each([
    '{invalid',
    '{}',
    JSON.stringify({ authentication: loginResponse, expiresAt: 1 }),
    JSON.stringify({
      authentication: { ...loginResponse, accessToken: '' },
      expiresAt: 9_999_999_999_999,
    }),
  ])('discards malformed or expired saved sessions: %s', async (raw) => {
    sessionStorage.setItem(SESSION_STORAGE_KEY, raw);
    await initializeSession();
    expect(readSession()).toBeNull();
    expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });
  it('reports unavailable browser storage without starting an unpersisted login', async () => {
    mockSuccessfulLogin();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Blocked');
    });
    expect(await signIn('admin', 'password')).toBe('sessionUnavailable');
    expect(readSession()).toBeNull();
  });
  it('ends the in-memory session even if removing browser storage fails', async () => {
    mockSuccessfulLogin();
    await signIn('admin', 'password');
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('Blocked');
    });
    expect(() => signOut()).not.toThrow();
    expect(readSession()).toBeNull();
  });
  it('ignores legacy sessions and locally assigned roles', () => {
    sessionStorage.setItem(
      'nw-track-session-v1',
      JSON.stringify({ userId: 'user-1' }),
    );
    localStorage.setItem(
      ACCESS_STORAGE_KEY,
      JSON.stringify({
        users: [identity.user],
        roles: [{ name: identity.user.role, modules: ['users'] }],
      }),
    );
    expect(readSession()).toBeNull();
    setAuthenticatedSession(identity);
    expect(readSession()?.modules).toEqual(['reports']);
    expect(getLandingPath(readSession()!)).toBe('/reports');
  });
  it('accepts effective permissions without looking up a role registry and clears them on logout', () => {
    setAuthenticatedSession(identity);
    expect(readSession()).toEqual(identity);
    const copy = readSession()!;
    copy.modules.push('users');
    expect(readSession()?.modules).toEqual(['reports']);
    signOut();
    expect(readSession()).toBeNull();
  });
  it('rejects inactive identities and unknown module permissions', () => {
    expect(() =>
      setAuthenticatedSession({
        ...identity,
        user: { ...identity.user, status: 'Inactive' },
      }),
    ).toThrow();
    expect(() =>
      setAuthenticatedSession({
        ...identity,
        modules: ['unknown'] as unknown as AuthSession['modules'],
      }),
    ).toThrow();
    expect(readSession()).toBeNull();
  });
});

describe('permission-aware destinations', () => {
  it('uses effective permissions in sidebar order with an empty-permissions landing page', () => {
    expect(getLandingPath(identity)).toBe('/reports');
    expect(
      getLandingPath({ ...identity, modules: ['styles', 'roles', 'newstyle'] }),
    ).toBe('/new-style');
    expect(
      getLandingPath({ ...identity, modules: ['styles', 'process'] }),
    ).toBe('/configurations/processes');
    expect(getLandingPath({ ...identity, modules: [] })).toBe('/workspace');
  });
});
