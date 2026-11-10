import type { ModuleKey } from '../features/access/accessData';
import type { LoginModule } from '../features/auth/types';

export const mainNavigationItems = [
  { key: 'dashboard', permission: 'dashboard', path: '/dashboard' },
  { key: 'reports', permission: 'reports', path: '/reports' },
  { key: 'users', permission: 'users', path: '/users' },
  { key: 'newstyle', permission: 'newstyle', path: '/new-style' },
  { key: 'roles', permission: 'roles', path: '/roles' },
] as const;

export const configurationNavigationItems = [
  {
    key: 'processes',
    permission: 'process',
    path: '/configurations/processes',
  },
  { key: 'storage', permission: 'storage', path: '/configurations/storages' },
  { key: 'tags', permission: 'tags', path: '/configurations/tags' },
  { key: 'styles', permission: 'styles', path: '/styles' },
] as const;

export const orderedNavigationItems = [
  ...mainNavigationItems,
  ...configurationNavigationItems,
];

// Route paths and icons belong to the app; availability and names come from login.
export function mapNavigationModules<T extends { permission: ModuleKey }>(
  items: readonly T[],
  modules: readonly LoginModule[],
  permissions: readonly ModuleKey[],
): (T & { name: string })[] {
  const byKey = new Map(modules.map((module) => [module.key, module]));
  return items.flatMap((item) => {
    const module = byKey.get(item.permission);
    return module && permissions.includes(item.permission)
      ? [{ ...item, name: module.name }]
      : [];
  });
}
