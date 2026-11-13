import { isUserProcessAssignment } from './userAssignments';
import { readApiPage } from '../../api/collections';
import type { ApiPage, ListQuery } from '../../api/collections';
import { collectApiItems } from '../../api/collections';
import axios from 'axios';
import type { AxiosResponse } from 'axios';
import { apiClient } from '../../api/client';
import type {
  UserResponse,
  UsersOperation,
  CreateUserRequest,
  UpdateUserRequest,
} from './types';
import type { ProcessLookupResponse } from '../processes/types';
import { parseUsersFailure, UsersError } from './usersFailure';

function isUser(value: unknown): value is UserResponse {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const user = value as Record<string, unknown>;
  return (
    typeof user.id === 'string' &&
    !!user.id.trim() &&
    typeof user.username === 'string' &&
    !!user.username.trim() &&
    typeof user.display_name === 'string' &&
    (user.status === 'ACTIVE' || user.status === 'INACTIVE') &&
    (user.initial_password_expires_at === null ||
      (typeof user.initial_password_expires_at === 'string' &&
        Number.isFinite(Date.parse(user.initial_password_expires_at)))) &&
    typeof user.enabled === 'boolean' &&
    typeof user.must_change_password === 'boolean' &&
    typeof user.created_at === 'string' &&
    Number.isFinite(Date.parse(user.created_at)) &&
    (user.role === null || typeof user.role === 'string') &&
    Array.isArray(user.processAssignments) &&
    user.processAssignments.every(isUserProcessAssignment)
  );
}

async function requestUsers<T = unknown>(
  send: () => Promise<AxiosResponse<T>>,
  operation: UsersOperation = 'list',
): Promise<T> {
  let response;
  try {
    response = await send();
  } catch (error: unknown) {
    if (axios.isCancel(error)) throw error;
    if (axios.isAxiosError(error) && error.response)
      throw new UsersError(
        parseUsersFailure(
          error.response.data,
          error.response.status,
          operation,
        ),
      );
    throw new UsersError({ kind: 'network', action: 'retry' });
  }
  if (response.status < 200 || response.status >= 300)
    throw new UsersError(
      parseUsersFailure(response.data, response.status, operation),
    );
  return response.data;
}

export async function getUser(
  userId: string,
  signal?: AbortSignal,
): Promise<UserResponse> {
  const data = await requestUsers(
    () =>
      apiClient.get<unknown>(`users/${encodeURIComponent(userId)}`, {
        signal,
        timeout: 10000,
        validateStatus: () => true,
      }),
    'detail',
  );
  if (!isUser(data) || data.id.toLowerCase() !== userId.toLowerCase()) {
    throw new UsersError({ kind: 'invalidResponse', action: 'retry' });
  }
  return data;
}

export async function createUser(
  body: CreateUserRequest,
  signal?: AbortSignal,
): Promise<UserResponse> {
  const data = await requestUsers(
    () =>
      apiClient.post<UserResponse>(
        'users',
        {
          username: body.username,
          displayName: body.displayName,
          initialPassword: body.initialPassword,
          role: body.role,
          processAssignments: body.processAssignments,
          ...(body.status !== undefined ? { status: body.status } : {}),
        },
        { signal, timeout: 10000, validateStatus: () => true },
      ),
    'create',
  );
  if (!isUser(data))
    throw new UsersError({ kind: 'invalidResponse', action: 'retry' });
  return data;
}

export async function deleteUser(
  userId: string,
  signal?: AbortSignal,
): Promise<UserResponse> {
  const data = await requestUsers(
    () =>
      apiClient.delete<UserResponse>(`users/${encodeURIComponent(userId)}`, {
        signal,
        timeout: 10000,
        validateStatus: () => true,
      }),
    'delete',
  );
  if (
    !isUser(data) ||
    data.id.toLowerCase() !== userId.toLowerCase() ||
    data.enabled !== false
  )
    throw new UsersError({ kind: 'invalidResponse', action: 'retry' });
  return data;
}

export async function updateUser(
  userId: string,
  body: UpdateUserRequest,
  signal?: AbortSignal,
): Promise<UserResponse> {
  const data = await requestUsers(
    () =>
      apiClient.put<unknown>(`users/${encodeURIComponent(userId)}`, body, {
        signal,
        timeout: 10000,
        validateStatus: () => true,
      }),
    'update',
  );
  if (!isUser(data) || data.id.toLowerCase() !== userId.toLowerCase())
    throw new UsersError({ kind: 'invalidResponse', action: 'retry' });
  return data;
}

// UiLookupController returns only processes whose process and station are active.
export async function getUserProcessOptions(
  signal?: AbortSignal,
): Promise<ProcessLookupResponse[]> {
  const isOption = (value: unknown): value is ProcessLookupResponse => {
    if (!value || typeof value !== 'object' || Array.isArray(value))
      return false;
    const option = value as Record<string, unknown>;
    return ['id', 'name', 'station_id', 'stationNumber'].every(
      (key) => typeof option[key] === 'string' && !!option[key].trim(),
    );
  };
  return collectApiItems(
    async (params) => {
      const data = await requestUsers(() =>
        apiClient.get<unknown>('ui/lookups', {
          ...(params ? { params } : {}),
          signal,
          timeout: 10000,
          validateStatus: () => true,
        }),
      );
      return data && typeof data === 'object' && !Array.isArray(data)
        ? (data as Record<string, unknown>).processes
        : undefined;
    },
    isOption,
    (item) => item.id,
    () => {
      throw new UsersError({ kind: 'invalidResponse', action: 'retry' });
    },
  );
}

export async function getUsersPage(
  query: ListQuery,
  signal?: AbortSignal,
): Promise<ApiPage<UserResponse>> {
  const data = await requestUsers(() =>
    apiClient.get<unknown>('users', {
      params: query,
      signal,
      timeout: 10000,
      validateStatus: () => true,
    }),
  );
  return readApiPage(
    data,
    query,
    isUser,
    (item) => item.id,
    () => {
      throw new UsersError({ kind: 'invalidResponse', action: 'retry' });
    },
  );
}
