import axios from 'axios';
import type { AxiosResponse } from 'axios';
import { apiClient } from '../../api/client';
import type {
  UserProcessAssignment,
  UserResponse,
  UsersResponse,
  UsersOperation,
  CreateUserRequest,
  UpdateUserRequest,
} from './types';
import type { ProcessLookupResponse } from '../processes/types';
import { parseUsersFailure, UsersError } from './usersFailure';

function isAssignment(value: unknown): value is UserProcessAssignment {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const assignment = value as Record<string, unknown>;
  return (
    ['processId', 'processName', 'stationId', 'stationNumber'].every(
      (key) => typeof assignment[key] === 'string',
    ) &&
    ['activeOnShift', 'processActive', 'stationActive'].every(
      (key) => typeof assignment[key] === 'boolean',
    )
  );
}

function isUser(value: unknown): value is UserResponse {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const user = value as Record<string, unknown>;
  return (
    typeof user.id === 'string' &&
    !!user.id.trim() &&
    typeof user.username === 'string' &&
    !!user.username.trim() &&
    typeof user.display_name === 'string' &&
    typeof user.enabled === 'boolean' &&
    typeof user.must_change_password === 'boolean' &&
    typeof user.created_at === 'string' &&
    Number.isFinite(Date.parse(user.created_at)) &&
    (user.role === null || typeof user.role === 'string') &&
    Array.isArray(user.processAssignments) &&
    user.processAssignments.every(isAssignment)
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

export async function getUsers(signal?: AbortSignal): Promise<UsersResponse> {
  const data = await requestUsers(() =>
    apiClient.get<unknown>('users', {
      signal,
      timeout: 10000,
      validateStatus: () => true,
    }),
  );
  if (
    !Array.isArray(data) ||
    !data.every(isUser) ||
    new Set(data.map((user) => user.id)).size !== data.length
  ) {
    throw new UsersError({ kind: 'invalidResponse', action: 'retry' });
  }
  return data;
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
  return requestUsers(
    () =>
      apiClient.post<UserResponse>(
        'users',
        {
          username: body.username,
          displayName: body.displayName,
          initialPassword: body.initialPassword,
          role: body.role,
          processAssignments: body.processAssignments,
        },
        { signal, timeout: 10000, validateStatus: () => true },
      ),
    'create',
  );
}

export async function deleteUser(
  userId: string,
  signal?: AbortSignal,
): Promise<UserResponse> {
  return requestUsers(
    () =>
      apiClient.delete<UserResponse>(`users/${encodeURIComponent(userId)}`, {
        signal,
        timeout: 10000,
        validateStatus: () => true,
      }),
    'delete',
  );
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
  const data = await requestUsers(() =>
    apiClient.get<unknown>('ui/lookups', {
      signal,
      timeout: 10000,
      validateStatus: () => true,
    }),
  );
  const processes =
    data && typeof data === 'object' && !Array.isArray(data)
      ? (data as Record<string, unknown>).processes
      : undefined;
  const isOption = (value: unknown): value is ProcessLookupResponse => {
    if (!value || typeof value !== 'object' || Array.isArray(value))
      return false;
    const option = value as Record<string, unknown>;
    return ['id', 'name', 'station_id', 'stationNumber'].every(
      (key) => typeof option[key] === 'string' && !!option[key].trim(),
    );
  };
  if (
    !Array.isArray(processes) ||
    !processes.every(isOption) ||
    new Set(processes.map((option) => option.id)).size !== processes.length
  )
    throw new UsersError({ kind: 'invalidResponse', action: 'retry' });
  return processes;
}
