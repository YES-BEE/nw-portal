import { apiClient } from '../../api/client';
import { isLoginResponse, LoginError } from './loginApi';
import { parseLoginFailure } from './loginFailure';
import type {
  RefreshTokenResponse,
  RefreshAccessTokenRequest,
  RefreshAccessTokenResponse,
} from './types';

export function isRefreshTokenResponse(
  value: unknown,
): value is RefreshTokenResponse {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.refreshToken === 'string' &&
    !!record.refreshToken.trim() &&
    typeof record.expiresAt === 'string' &&
    /^\d{4}-\d{2}-\d{2}T/.test(record.expiresAt) &&
    Number.isFinite(Date.parse(record.expiresAt)) &&
    Date.parse(record.expiresAt) > Date.now()
  );
}

export async function issueRefreshToken(
  signal?: AbortSignal,
): Promise<RefreshTokenResponse> {
  const response = await apiClient.post<unknown>(
    'auth/refresh-tokens',
    undefined,
    {
      signal,
      timeout: 10_000,
      validateStatus: () => true,
    },
  );
  if (response.status < 200 || response.status >= 300) {
    throw new LoginError(
      parseLoginFailure(response.data, response.status, response.statusText),
    );
  }
  if (!isRefreshTokenResponse(response.data))
    throw new LoginError('invalidResponse');
  return response.data;
}

export async function exchangeRefreshToken(
  request: RefreshAccessTokenRequest,
): Promise<RefreshAccessTokenResponse> {
  const response = await apiClient.post<unknown>('auth/refresh', request, {
    timeout: 10_000,
    validateStatus: () => true,
  });
  if (response.status < 200 || response.status >= 300) {
    throw new LoginError(
      parseLoginFailure(response.data, response.status, response.statusText),
    );
  }
  if (!isLoginResponse(response.data)) throw new LoginError('invalidResponse');
  return response.data;
}
