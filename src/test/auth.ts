import type { LoginResponse } from '../features/auth/types';

export const loginResponse: LoginResponse = {
  accessToken: 'test-access-token',
  tokenType: 'Bearer',
  expiresIn: 900,
  username: 'admin',
  roles: ['NW', 'FACTOR_PASSWORD'],
  processAssignments: [],
  modules: [{ key: 'reports', name: 'Reports/Analysis', built_in: true }],
};
