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
  'lots',
] as const;
export type ModuleKey = (typeof moduleKeys)[number];

export interface AccessUser {
  id: string;
  username: string;
  role: string;
  status: 'Active' | 'Inactive';
  processIds?: string[];
}
