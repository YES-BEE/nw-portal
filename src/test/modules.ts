import type { ModulesResponse } from '../features/access/types';

export const modulesResponse: ModulesResponse = [
  { key: 'dashboard', name: 'Dashboard', built_in: true, active: true },
  { key: 'reports', name: 'Reports/Analysis', built_in: true, active: true },
  {
    key: 'process',
    name: 'Process Configurations',
    built_in: true,
    active: true,
  },
  {
    key: 'storage',
    name: 'Storage Configurations',
    built_in: true,
    active: true,
  },
  { key: 'tags', name: 'Tag Management', built_in: true, active: true },
  { key: 'styles', name: 'Style Management', built_in: true, active: true },
  { key: 'users', name: 'User Management', built_in: true, active: true },
  { key: 'roles', name: 'Role Management', built_in: true, active: true },
  { key: 'newstyle', name: 'New Style', built_in: true, active: true },
];
