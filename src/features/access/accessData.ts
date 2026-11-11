export const ACCESS_STORAGE_KEY = 'nw-track-access-v2';

export const moduleKeys = [
  'dashboard',
  'reports',
  'process',
  'storage',
  'trolleys',
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

const folded = (value: string) => value.trim().toLowerCase();
const unique = (values: string[]) =>
  new Set(values.map(folded)).size === values.length;

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
  if (!unique(roles.map((role) => role.name))) return false;
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
      records: { users: [], roles: [] },
      unavailable: false,
    };
  } catch {
    return {
      records: { users: [], roles: [] },
      unavailable: true,
    };
  }
}
