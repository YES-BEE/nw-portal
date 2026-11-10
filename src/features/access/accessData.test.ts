import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ACCESS_STORAGE_KEY,
  canDeleteRole,
  getRoleNameError,
  getUserErrors,
  isAccessData,
  loadAccessData,
} from './accessData';
import type { AccessData } from './accessData';

const records: AccessData = {
  users: [
    { id: 'one', username: 'operator', role: 'Factory role', status: 'Active' },
  ],
  roles: [{ name: 'Factory role', modules: ['reports'] }],
};
beforeEach(() => localStorage.clear());

describe('access records without frontend defaults', () => {
  it('starts with no users, roles or assignments and does not write storage', () => {
    expect(loadAccessData()).toEqual({
      records: { users: [], roles: [] },
      unavailable: false,
    });
    expect(localStorage.length).toBe(0);
    expect(isAccessData({ users: [], roles: [] })).toBe(true);
  });
  it('ignores the previous demo namespace', () => {
    localStorage.setItem('nw-track-access-v1', JSON.stringify(records));
    expect(loadAccessData().records).toEqual({ users: [], roles: [] });
  });
  it('accepts arbitrary saved roles without requiring built-in roles', () => {
    localStorage.setItem(ACCESS_STORAGE_KEY, JSON.stringify(records));
    expect(loadAccessData()).toEqual({ records, unavailable: false });
    expect(
      isAccessData({
        ...records,
        users: [{ ...records.users[0], processIds: ['p1', 'p1'] }],
      }),
    ).toBe(false);
  });
  it.each(['{invalid', '{}', '{"users":[],"roles":[{}]}'])(
    'returns empty records and a warning for invalid data: %s',
    (raw) => {
      localStorage.setItem(ACCESS_STORAGE_KEY, raw);
      expect(loadAccessData()).toEqual({
        records: { users: [], roles: [] },
        unavailable: true,
      });
      expect(localStorage.getItem(ACCESS_STORAGE_KEY)).toBe(raw);
    },
  );
  it('returns empty records when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Unavailable');
    });
    expect(loadAccessData()).toEqual({
      records: { users: [], roles: [] },
      unavailable: true,
    });
  });
  it('rejects unknown roles, unknown modules and duplicate accounts', () => {
    expect(
      isAccessData({
        ...records,
        users: [{ ...records.users[0], role: 'Missing' }],
      }),
    ).toBe(false);
    expect(
      isAccessData({
        ...records,
        roles: [{ name: 'Factory role', modules: ['unknown'] }],
      }),
    ).toBe(false);
    expect(
      isAccessData({
        ...records,
        users: [
          ...records.users,
          { ...records.users[0], id: 'two', username: ' OPERATOR ' },
        ],
      }),
    ).toBe(false);
  });
  it('validates names and status without rules tied to role names', () => {
    expect(
      getUserErrors(
        { ...records.users[0], username: '', role: '', status: '' },
        records,
      ),
    ).toEqual({
      username: 'usernameRequired',
      role: 'roleRequired',
      status: 'statusRequired',
    });
    expect(
      getUserErrors(
        { ...records.users[0], id: 'two', username: ' OPERATOR ' },
        records,
      ),
    ).toEqual({ username: 'usernameDuplicate' });
    const data: AccessData = {
      users: [],
      roles: [{ name: 'Process Manager', modules: [] }],
    };
    expect(
      getUserErrors({ ...records.users[0], role: 'Process Manager' }, data),
    ).toEqual({});
    expect(getRoleNameError(' factory role ', records.roles, false)).toBe(
      'roleDuplicate',
    );
    expect(getRoleNameError('', records.roles, false)).toBe('roleNameRequired');
  });
  it('protects assigned roles and allows any unassigned role to be deleted', () => {
    expect(canDeleteRole('Factory role', records)).toBe(false);
    expect(
      canDeleteRole('NW', { users: [], roles: [{ name: 'NW', modules: [] }] }),
    ).toBe(true);
  });
});
