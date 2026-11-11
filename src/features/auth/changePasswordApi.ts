import axios from 'axios';
import { apiClient } from '../../api/client';
import { readProblemDetails, safeApiText } from '../../api/problemDetails';
import type {
  ChangePasswordRequest,
  ChangePasswordResponse,
  PasswordChangeFailure,
} from './types';

export class PasswordChangeError extends Error {
  readonly failure: PasswordChangeFailure;
  constructor(failure: PasswordChangeFailure) {
    super(failure.message);
    this.name = 'PasswordChangeError';
    this.failure = failure;
  }
}

export function parsePasswordChangeFailure(
  body: unknown,
  status: number,
): PasswordChangeFailure {
  const { problem, message } = readProblemDetails(body);
  const fieldErrors: Partial<Record<keyof ChangePasswordRequest, string>> = {};
  const fields = problem?.fieldErrors;
  if (
    status === 400 &&
    problem?.code === 'VALIDATION_FAILED' &&
    fields &&
    typeof fields === 'object' &&
    !Array.isArray(fields)
  ) {
    for (const field of ['currentPassword', 'newPassword'] as const) {
      const text = safeApiText((fields as Record<string, unknown>)[field]);
      if (text) fieldErrors[field] = text;
    }
  }
  return {
    kind:
      status === 401 && problem?.code === 'AUTHENTICATION_FAILED'
        ? 'credentials'
        : Object.keys(fieldErrors).length
          ? 'validation'
          : status === 403
            ? 'access'
            : 'http',
    status,
    message,
    code: safeApiText(problem?.code),
    ...(Object.keys(fieldErrors).length ? { fieldErrors } : {}),
  };
}

export async function postChangePassword(
  body: ChangePasswordRequest,
  signal?: AbortSignal,
): Promise<ChangePasswordResponse> {
  let response;
  try {
    response = await apiClient.post<unknown>('auth/change-password', body, {
      signal,
      timeout: 10000,
      validateStatus: () => true,
    });
  } catch (error: unknown) {
    if (axios.isCancel(error)) throw error;
    if (axios.isAxiosError(error) && error.response)
      throw new PasswordChangeError(
        parsePasswordChangeFailure(error.response.data, error.response.status),
      );
    throw new PasswordChangeError({ kind: 'network' });
  }
  if (response.status < 200 || response.status >= 300)
    throw new PasswordChangeError(
      parsePasswordChangeFailure(response.data, response.status),
    );
  const data = response.data;
  if (
    !data ||
    typeof data !== 'object' ||
    !('changed' in data) ||
    typeof data.changed !== 'boolean'
  )
    throw new PasswordChangeError({ kind: 'invalidResponse' });
  if (!data.changed)
    throw new PasswordChangeError({
      kind: 'unchanged',
      message: readProblemDetails(data).message,
    });
  return { changed: data.changed };
}
