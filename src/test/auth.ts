import type {
  LoginResponse,
  RefreshTokenResponse,
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
