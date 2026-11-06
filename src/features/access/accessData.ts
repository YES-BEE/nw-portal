export const ACCESS_STORAGE_KEY = 'nw-track-access-v1';

export const moduleKeys = [
  'dashboard',
  'reports',
  'process',
  'storage',
  'tags',
  'styles',
  'users',
  'roles',
  'newstyle',
] as const;
export type ModuleKey = (typeof moduleKeys)[number];
export interface AccessRole {
  name: string;
  modules: ModuleKey[];
}
export interface AccessUser {
  id: string;
  username: string;
  role: string;
  status: 'Active' | 'Inactive';
  processIds?: string[];
}
export interface AccessData {
  users: AccessUser[];
  roles: AccessRole[];
}
export type UserDraft = Omit<AccessUser, 'status'> & {
  status: AccessUser['status'] | '';
};

const fullModules: ModuleKey[] = [
  'dashboard',
  'reports',
  'process',
  'storage',
  'tags',
  'styles',
  'users',
  'roles',
];
export const defaultRoles: AccessRole[] = [
  { name: 'NW', modules: [...fullModules] },
  { name: 'IT Admin', modules: [...fullModules] },
  { name: 'Top Manager', modules: ['dashboard', 'reports'] },
  {
    name: 'Production Manager',
    modules: ['dashboard', 'reports', 'process', 'storage', 'tags', 'styles'],
  },
  { name: 'Supervisor', modules: ['dashboard', 'reports'] },
  { name: 'Process Manager', modules: [] },
  { name: 'Style Configurator', modules: ['newstyle'] },
];
export const defaultUsers: AccessUser[] = [
  ['nw.admin', 'NW'],
  ['it.admin', 'IT Admin'],
  ['top.manager', 'Top Manager'],
  ['production.manager', 'Production Manager'],
  ['supervisor', 'Supervisor'],
  ['process.manager', 'Process Manager'],
  ['style.configurator', 'Style Configurator'],
].map(([username, role], index) => ({
  id: `user-${index + 1}`,
  username,
  role,
  status: 'Active',
}));

const folded = (value: string) => value.trim().toLowerCase();
const unique = (values: string[]) =>
  new Set(values.map(folded)).size === values.length;
export function isBuiltInRole(name: string) {
  return defaultRoles.some((role) => role.name === name);
}

export function isAccessData(value: unknown): value is AccessData {
  if (!value || typeof value !== 'object') return false;
  const { users, roles } = value as AccessData;
  if (!Array.isArray(users) || !Array.isArray(roles)) return false;
  if (
    !roles.every(
      (role) =>
        role &&
        typeof role.name === 'string' &&
        role.name.trim() &&
        role.name.length <= 80 &&
        Array.isArray(role.modules) &&
        role.modules.every((key: unknown) =>
          moduleKeys.includes(key as ModuleKey),
        ) &&
        new Set(role.modules).size === role.modules.length,
    )
  )
    return false;
  if (
    !unique(roles.map((role) => role.name)) ||
    !defaultRoles.every((role) =>
      roles.some((saved) => saved.name === role.name),
    )
  )
    return false;
  return (
    users.every(
      (user) =>
        user &&
        typeof user.id === 'string' &&
        user.id &&
        typeof user.username === 'string' &&
        user.username.trim() &&
        user.username.length <= 80 &&
        roles.some((role) => role.name === user.role) &&
        ['Active', 'Inactive'].includes(user.status) &&
        (user.processIds === undefined ||
          (Array.isArray(user.processIds) &&
            user.processIds.every(
              (id: unknown) => typeof id === 'string' && id.trim(),
            ) &&
            new Set(user.processIds).size === user.processIds.length)),
    ) &&
    unique(users.map((user) => user.username)) &&
    unique(users.map((user) => user.id))
  );
}

export function loadAccessData(): {
  records: AccessData;
  unavailable: boolean;
} {
  try {
    const raw = localStorage.getItem(ACCESS_STORAGE_KEY);
    if (raw !== null) {
      const records: unknown = JSON.parse(raw);
      if (!isAccessData(records)) throw new Error('Invalid access records');
      return { records, unavailable: false };
    }
    return {
      records: structuredClone({ users: defaultUsers, roles: defaultRoles }),
      unavailable: false,
    };
  } catch {
    return {
      records: structuredClone({ users: defaultUsers, roles: defaultRoles }),
      unavailable: true,
    };
  }
}

export function getUserErrors(user: UserDraft, data: AccessData) {
  const errors: Partial<
    Record<
      'username' | 'role' | 'status' | 'processIds',
      | 'usernameRequired'
      | 'usernameDuplicate'
      | 'roleRequired'
      | 'statusRequired'
      | 'processesRequired'
    >
  > = {};
  if (!user.username.trim()) errors.username = 'usernameRequired';
  else if (
    data.users.some(
      (saved) =>
        saved.id !== user.id &&
        folded(saved.username) === folded(user.username),
    )
  )
    errors.username = 'usernameDuplicate';
  if (!data.roles.some((role) => role.name === user.role))
    errors.role = 'roleRequired';
  if (!['Active', 'Inactive'].includes(user.status))
    errors.status = 'statusRequired';
  if (user.role === 'Process Manager' && !user.processIds?.length)
    errors.processIds = 'processesRequired';
  return errors;
}

export function getRoleNameError(
  name: string,
  roles: AccessRole[],
  editing: boolean,
) {
  if (!name.trim()) return 'roleNameRequired' as const;
  if (!editing && roles.some((role) => folded(role.name) === folded(name)))
    return 'roleDuplicate' as const;
}

export function canDeleteRole(name: string, data: AccessData) {
  return !isBuiltInRole(name) && !data.users.some((user) => user.role === name);
}
