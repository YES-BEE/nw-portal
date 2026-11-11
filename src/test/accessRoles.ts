import type {
  AccessRoleOptionsResponse,
  AccessRoleResponse,
} from '../features/access/types';

export const accessRoleOptionsResponse: AccessRoleOptionsResponse = [
  { code: 'NW', name: 'NW' },
  { code: 'ADMIN_IT', name: 'IT Admin' },
];

export const accessRolesResponse: AccessRoleResponse[] = [
  {
    code: 'NW',
    name: 'NW',
    description: 'NW',
    built_in: true,
    active: true,
    pc_access: true,
    pad_access: true,
    permissions: ['READ'],
    modules: ['users', 'roles'],
  },
  {
    code: 'ADMIN_IT',
    name: 'IT Admin',
    description: 'Admin (IT)',
    built_in: true,
    active: true,
    pc_access: true,
    pad_access: true,
    permissions: ['READ'],
    modules: ['users', 'roles'],
  },
];
