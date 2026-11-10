import axios from 'axios';
import type { LoginRequest, LoginResponse, LoginUiError } from './types';
import { parseLoginFailure } from './loginFailure';

export type LoginErrorCode = 'invalidResponse' | 'sessionUnavailable';

export class LoginError extends Error {
  readonly failure: LoginErrorCode | LoginUiError;

  constructor(failure: LoginErrorCode | LoginUiError) {
    super(typeof failure === 'string' ? failure : failure.message);
    this.failure = failure;
  }
}

export function isLoginResponse(value: unknown): value is LoginResponse {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.accessToken === 'string' &&
    !!record.accessToken.trim() &&
    record.tokenType === 'Bearer' &&
    typeof record.expiresIn === 'number' &&
    record.expiresIn > 0 &&
    Number.isSafeInteger(Date.now() + record.expiresIn * 1000) &&
    typeof record.username === 'string' &&
    !!record.username.trim() &&
    Array.isArray(record.roles) &&
    record.roles.every((role) => typeof role === 'string') &&
    Array.isArray(record.processAssignments) &&
    Array.isArray(record.modules) &&
    record.modules.every((module: unknown) => {
      if (!module || typeof module !== 'object') return false;
      const entry = module as Record<string, unknown>;
      return (
        typeof entry.key === 'string' &&
        !!entry.key.trim() &&
        typeof entry.name === 'string' &&
        typeof entry.built_in === 'boolean'
      );
    })
  );
}

export async function login(
  request: LoginRequest,
  signal?: AbortSignal,
): Promise<LoginResponse> {
  const baseUrl = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/+$/, '');
  const apiVersion = import.meta.env.VITE_API_VERSION?.trim();
  const endpoint = new URL(
    `${baseUrl ?? ''}/api/${apiVersion ?? ''}/auth/login`,
  ).toString();

  const response = await axios.post<unknown>(endpoint, request, {
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, application/problem+json',
      Authorization: null,
    },
    signal,
    validateStatus: () => true,
  });
  if (response.status < 200 || response.status >= 300) {
    throw new LoginError(
      parseLoginFailure(response.data, response.status, response.statusText),
    );
  }

  const value = response.data;
  if (!isLoginResponse(value)) throw new LoginError('invalidResponse');
  return value;
}
