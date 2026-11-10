import { apiClient } from '../../api/client';
import { LoginError } from './loginApi';
import { parseLoginFailure } from './loginFailure';
import type { MeResponse } from './types';

export function isMeResponse(value: unknown): value is MeResponse {
  if (!value || typeof value !== 'object') return false;
  const profile = value as Record<string, unknown>;
  return (
    typeof profile.id === 'string' &&
    !!profile.id.trim() &&
    typeof profile.username === 'string' &&
    !!profile.username.trim() &&
    typeof profile.display_name === 'string' &&
    typeof profile.enabled === 'boolean' &&
    typeof profile.must_change_password === 'boolean' &&
    typeof profile.role === 'string' &&
    (profile.clientType === 'PC' || profile.clientType === 'PAD') &&
    Array.isArray(profile.permissions) &&
    profile.permissions.every((permission) => typeof permission === 'string') &&
    Array.isArray(profile.processAssignments) &&
    Array.isArray(profile.modules) &&
    profile.modules.every((value: unknown) => {
      if (!value || typeof value !== 'object') return false;
      const module = value as Record<string, unknown>;
      return (
        typeof module.key === 'string' &&
        !!module.key.trim() &&
        typeof module.name === 'string' &&
        typeof module.built_in === 'boolean'
      );
    })
  );
}

export async function getMe(signal?: AbortSignal): Promise<MeResponse> {
  const response = await apiClient.get<unknown>('auth/me', {
    signal,
    timeout: 10_000,
    validateStatus: () => true,
  });
  if (response.status < 200 || response.status >= 300) {
    throw new LoginError(
      parseLoginFailure(response.data, response.status, response.statusText),
    );
  }
  if (!isMeResponse(response.data) || !response.data.enabled)
    throw new LoginError('invalidResponse');
  return response.data;
}
