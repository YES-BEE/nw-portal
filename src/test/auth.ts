import type {
  LoginResponse,
  RefreshTokenResponse,
  MeResponse,
} from '../features/auth/types';

export const loginResponse: LoginResponse = {
  accessToken: 'test-access-token',
  tokenType: 'Bearer',
  expiresIn: 900,
  username: 'admin',
  roles: ['NW', 'FACTOR_PASSWORD'],
  processAssignments: [],
  modules: [{ key: 'reports', name: 'Reports/Analysis', built_in: true }],
};

export const refreshTokenResponse: RefreshTokenResponse = {
  refreshToken: 'test-refresh-token',
  expiresAt: '2099-11-17T15:11:45.292723843Z',
};

export const meResponse: MeResponse = {
  id: 'backend-admin-id',
  username: 'admin',
  display_name: 'Bootstrap NW',
  enabled: true,
  must_change_password: true,
  role: 'NW',
  clientType: 'PC',
  permissions: ['READ'],
  processAssignments: [],
  modules: loginResponse.modules,
};
