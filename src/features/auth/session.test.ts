import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ACCESS_STORAGE_KEY, loadAccessData } from '../access/accessData';
import {
  demoAccounts,
  getLandingPath,
  getModuleForPath,
  readSession,
  SESSION_STORAGE_KEY,
  signIn,
  signOut,
} from './session';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  signIn('nw.admin', 'NW@2026demo');
});

describe('demo authentication', () => {
  it.each(demoAccounts)(
    'authenticates $username with its saved role and stores only its user ID',
    (account) => {
      expect(signIn(account.username, account.password)).toBeNull();
      const session = readSession();
      expect(session?.user.username).toBe(account.username);
      expect(session?.modules).toEqual(
        loadAccessData().records.roles.find(
          (role) => role.name === session?.user.role,
        )?.modules,
      );
      expect(JSON.parse(sessionStorage.getItem(SESSION_STORAGE_KEY)!)).toEqual({
        userId: account.userId,
      });
      expect(localStorage.length).toBe(0);
    },
  );

  it('normalizes usernames but requires an exact password', () => {
    expect(signIn(' NW.ADMIN ', 'NW@2026demo')).toBeNull();
    signOut();
    expect(signIn('nw.admin', 'nw@2026demo')).toBe('invalidCredentials');
    expect(readSession()).toBeNull();
    expect(signIn('unknown', 'NW@2026demo')).toBe('invalidCredentials');
  });

  it('blocks inactive and deleted users and fails closed on invalid saved access data', () => {
    const records = loadAccessData().records;
    records.users[0].status = 'Inactive';
    localStorage.setItem(ACCESS_STORAGE_KEY, JSON.stringify(records));
    expect(readSession()).toBeNull();
    expect(signIn('nw.admin', 'NW@2026demo')).toBe('invalidCredentials');
    records.users.shift();
    localStorage.setItem(ACCESS_STORAGE_KEY, JSON.stringify(records));
    expect(signIn('nw.admin', 'NW@2026demo')).toBe('invalidCredentials');
    localStorage.setItem(ACCESS_STORAGE_KEY, '{invalid');
    expect(readSession()).toBeNull();
    expect(signIn('nw.admin', 'NW@2026demo')).toBe('recordsUnavailable');
  });

  it('honors renamed seed users, changed role assignments, and current permissions', () => {
    const records = loadAccessData().records;
    records.users[0].username = 'factory.admin';
    records.users[0].role = 'Supervisor';
    records.roles.find((role) => role.name === 'Supervisor')!.modules = [
      'reports',
    ];
    localStorage.setItem(ACCESS_STORAGE_KEY, JSON.stringify(records));
    expect(signIn('nw.admin', 'NW@2026demo')).toBe('invalidCredentials');
    expect(signIn('factory.admin', 'NW@2026demo')).toBeNull();
    expect(readSession()?.modules).toEqual(['reports']);
  });

  it.each(['{invalid', '{}', '{"userId":"unknown"}'])(
    'rejects an invalid stored session: %s',
    (raw) => {
      sessionStorage.setItem(SESSION_STORAGE_KEY, raw);
      expect(readSession()).toBeNull();
    },
  );

  it('requires working session storage to sign in and revokes access even when removal fails', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Unavailable');
    });
    expect(signIn('nw.admin', 'NW@2026demo')).toBe('sessionUnavailable');
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('Unavailable');
    });
    signOut();
    expect(readSession()).toBeNull();
  });

  it('clears the session on logout', () => {
    signOut();
    expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
    expect(readSession()).toBeNull();
  });
});

describe('permission-aware destinations', () => {
  it('maps configuration detail URLs and index paths to the required module', () => {
    expect(getModuleForPath('/configurations/processes/demo-1')).toBe(
      'process',
    );
    expect(getModuleForPath('/configurations/storages/storage-demo-1')).toBe(
      'storage',
    );
    expect(getModuleForPath('/configurations')).toBe('process');
    expect(getModuleForPath('/users-other')).toBeNull();
  });

  it('uses the first permitted sidebar destination, with a fallback for roles without modules', () => {
    const session = readSession()!;
    expect(getLandingPath(session)).toBe('/dashboard');
    expect(getLandingPath({ ...session, modules: ['reports'] })).toBe(
      '/reports',
    );
    expect(
      getLandingPath({ ...session, modules: ['styles', 'roles', 'newstyle'] }),
    ).toBe('/new-style');
    expect(getLandingPath({ ...session, modules: ['styles', 'process'] })).toBe(
      '/configurations/processes',
    );
    expect(getLandingPath({ ...session, modules: ['styles', 'tags'] })).toBe(
      '/configurations/tags',
    );
    expect(getLandingPath({ ...session, modules: [] })).toBe('/workspace');
    expect(getLandingPath({ ...session, modules: ['newstyle'] })).toBe(
      '/new-style',
    );
  });
});
