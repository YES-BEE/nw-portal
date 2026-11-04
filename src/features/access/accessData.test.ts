import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ACCESS_STORAGE_KEY,
  canDeleteRole,
  defaultRoles,
  defaultUsers,
  getRoleNameError,
  getUserErrors,
  isAccessData,
  loadAccessData,
} from './accessData';

beforeEach(() => localStorage.clear());

describe('reference users and roles', () => {
  it('loads seven active accounts with the exact reference role assignments without writing storage', () => {
    const { records, unavailable } = loadAccessData();
    expect(unavailable).toBe(false);
    expect(
      records.users.map((user) => [user.username, user.role, user.status]),
    ).toEqual([
      ['nw.admin', 'NW', 'Active'],
      ['it.admin', 'IT Admin', 'Active'],
      ['top.manager', 'Top Manager', 'Active'],
      ['production.manager', 'Production Manager', 'Active'],
      ['supervisor', 'Supervisor', 'Active'],
      ['process.manager', 'Process Manager', 'Active'],
      ['style.configurator', 'Style Configurator', 'Active'],
    ]);
    expect(records.roles).toHaveLength(7);
    expect(
      records.roles.find((role) => role.name === 'Process Manager')?.modules,
    ).toEqual([]);
    expect(
      records.roles.find((role) => role.name === 'Style Configurator')?.modules,
    ).toEqual(['newstyle']);
    expect(localStorage.length).toBe(0);
    records.roles[0].modules.length = 0;
    expect(defaultRoles[0].modules).toHaveLength(8);
  });

  it('preserves a deliberately empty user list and valid saved role changes', () => {
    const records = loadAccessData().records;
    records.users = [];
    records.roles[0].modules = ['reports'];
    localStorage.setItem(ACCESS_STORAGE_KEY, JSON.stringify(records));
    expect(loadAccessData()).toEqual({ records, unavailable: false });
  });

  it.each(['{invalid', '{}', JSON.stringify({ users: [], roles: [] })])(
    'recovers malformed records with a warning: %s',
    (value) => {
      localStorage.setItem(ACCESS_STORAGE_KEY, value);
      expect(loadAccessData()).toEqual({
        records: { users: defaultUsers, roles: defaultRoles },
        unavailable: true,
      });
      expect(localStorage.getItem(ACCESS_STORAGE_KEY)).toBe(value);
    },
  );

  it('recovers when browser storage cannot be read', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Unavailable');
    });
    expect(loadAccessData().unavailable).toBe(true);
  });

  it('rejects dangling role assignments, invalid modules, and duplicate usernames or IDs', () => {
    const data = loadAccessData().records;
    expect(
      isAccessData({ ...data, users: [{ ...data.users[0], role: 'Missing' }] }),
    ).toBe(false);
    expect(
      isAccessData({
        ...data,
        users: [
          ...data.users,
          { ...data.users[0], id: 'extra', username: ' NW.ADMIN ' },
        ],
      }),
    ).toBe(false);
    expect(
      isAccessData({
        ...data,
        users: [...data.users, { ...data.users[0], username: 'different' }],
      }),
    ).toBe(false);
    expect(
      isAccessData({
        ...data,
        roles: [...data.roles, { name: 'Custom', modules: ['unknown'] }],
      }),
    ).toBe(false);
  });

  it('validates required fields and case-insensitive uniqueness while permitting unchanged edits', () => {
    const data = loadAccessData().records;
    expect(
      getUserErrors(
        { ...defaultUsers[0], id: 'new', username: ' NW.ADMIN ' },
        data,
      ),
    ).toEqual({ username: 'usernameDuplicate' });
    expect(
      getUserErrors({ ...defaultUsers[0], username: '  ', role: '' }, data),
    ).toEqual({ username: 'usernameRequired', role: 'roleRequired' });
    expect(getUserErrors(defaultUsers[0], data)).toEqual({});
    expect(getRoleNameError(' ', data.roles, false)).toBe('roleNameRequired');
    expect(getRoleNameError(' it admin ', data.roles, false)).toBe(
      'roleDuplicate',
    );
    expect(getRoleNameError('IT Admin', data.roles, true)).toBeUndefined();
  });

  it('protects built-in and assigned custom roles but allows deletion after unassigning', () => {
    const data = loadAccessData().records;
    data.roles.push({ name: 'Auditor', modules: ['reports'] });
    expect(canDeleteRole('NW', data)).toBe(false);
    expect(canDeleteRole('Auditor', data)).toBe(true);
    data.users.push({
      id: 'auditor',
      username: 'audit',
      role: 'Auditor',
      status: 'Inactive',
    });
    expect(canDeleteRole('Auditor', data)).toBe(false);
  });
});
