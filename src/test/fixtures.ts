import type { AccessRole } from './accessData';
// Test-only records. Never imported by application code.

import type { ProcessConfiguration } from '../features/processes/types';

interface RegisteredTag {
  id: string;
  name: string;
  actual: string;
}
export const TAG_STORAGE_KEY = 'nw-track-tags-v2';

import type { StyleRecord } from '../features/styles/styleData';

import type { AccessUser, ModuleKey } from '../features/access/accessData';

export const sampleProcesses: ProcessConfiguration[] = [
  {
    id: 'demo-1',
    name: 'Lot Preparation',
    description: 'Preparation and sorting of garments',
    station: '01',
    mode: 'process',
    processTag: 'NFC-PROC-001',
    devices: [],
  },
  {
    id: 'demo-2',
    name: 'Washing',
    description: 'Industrial washing process',
    station: '03',
    mode: 'devices',
    processTag: '',
    devices: [
      {
        id: 'washer-1',
        name: 'Washer 01',
        description: 'Main washing machine',
        tag: 'NFC-DEV-001',
      },
      {
        id: 'washer-2',
        name: 'Washer 02',
        description: 'Secondary washing machine',
        tag: 'NFC-DEV-002',
      },
    ],
  },
];

export const defaultTags: RegisteredTag[] = [
  { name: 'Lot Preparation Tag', actual: 'NFC-PROC-001' },
  { name: 'Washer 01 Tag', actual: 'NFC-DEV-001' },
  { name: 'Washer 02 Tag', actual: 'NFC-DEV-002' },
  { name: 'Storage Bay A Tag', actual: 'NFC-STORE-001' },
  { name: 'Storage Bay B Tag', actual: 'NFC-STORE-002' },
  { name: 'Storage Bay C Tag', actual: 'NFC-STORE-003' },
  { name: 'Finishing Line Tag', actual: 'NFC-PROC-002' },
  { name: 'Finisher 01 Tag', actual: 'NFC-DEV-003' },
  { name: 'Finisher 02 Tag', actual: 'NFC-DEV-004' },
].map((tag, index) => ({ ...tag, id: `tag-${index + 1}` }));

export const sampleStyles: StyleRecord[] = [
  {
    id: 'sty-1',
    number: 'STY-1001',
    created: '2026-11-01',
    description: 'Denim wash style',
    client: 'Fabric Client A',
    garments: 2000,
    lots: 20,
    weight: 100,
    avg: 1,
    delivery: '2026-11-30',
    steps: ['demo-1', 'demo-2'],
  },
];

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

import { ACCESS_STORAGE_KEY, loadAccessData } from './accessData';
import { PROCESS_STORAGE_KEY } from '../features/processes/processData';
import { STYLE_STORAGE_KEY } from '../features/styles/styleData';
import { setAuthenticatedSession } from '../features/auth/session';
import { orderedNavigationItems } from '../app/navigation';
import i18n from '../i18n';
import { loginResponse, refreshTokenResponse, meResponse } from './auth';

export function seedTestData() {
  localStorage.clear();
  localStorage.setItem(
    ACCESS_STORAGE_KEY,
    JSON.stringify({ users: defaultUsers, roles: defaultRoles }),
  );
  localStorage.setItem(PROCESS_STORAGE_KEY, JSON.stringify(sampleProcesses));
  localStorage.setItem(STYLE_STORAGE_KEY, JSON.stringify(sampleStyles));
}

// Establish an identity for UI tests without using the application's login flow.
export function signIn(username: string, _password?: string) {
  void _password;
  const records = loadAccessData().records;
  const user = records.users.find((record) => record.username === username);
  if (!user) throw new Error('Unknown test user');
  const role = records.roles.find((record) => record.name === user.role);
  const modules = role?.modules ?? [];
  setAuthenticatedSession({
    user,
    modules,
    profile: {
      ...meResponse,
      id: user.id,
      username: user.username,
      role: user.role,
      modules: orderedNavigationItems
        .filter((item) => modules.includes(item.permission))
        .map((item) => ({
          key: item.permission,
          name: i18n.t(`navigation.${item.key}`),
          built_in: true,
        })),
    },
    refreshToken: refreshTokenResponse.refreshToken,
    refreshTokenExpiresAt: refreshTokenResponse.expiresAt,
    authentication: {
      ...loginResponse,
      username: user.username,
      roles: [user.role],
      modules: orderedNavigationItems
        .filter((item) => modules.includes(item.permission))
        .map((item) => ({
          key: item.permission,
          name: i18n.t(`navigation.${item.key}`),
          built_in: true,
        })),
    },
  });
}
