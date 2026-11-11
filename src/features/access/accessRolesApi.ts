import { apiClient } from '../../api/client';
import axios from 'axios';
import type { AxiosResponse } from 'axios';
import {
  AccessRolesError,
  parseAccessRolesFailure,
} from './accessRolesFailure';
import type {
  AccessRoleResponse,
  AccessRolesResponse,
  AccessRolesOperation,
  CreateAccessRoleRequest,
  SaveAccessRoleRequest,
} from './types';

function isRole(value: unknown): value is AccessRoleResponse {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const role = value as Record<string, unknown>;
  return (
    typeof role.code === 'string' &&
    !!role.code.trim() &&
    typeof role.name === 'string' &&
    !!role.name.trim() &&
    typeof role.description === 'string' &&
    ['built_in', 'active', 'pc_access', 'pad_access'].every(
      (key) => typeof role[key] === 'boolean',
    ) &&
    ['permissions', 'modules'].every(
      (key) =>
        Array.isArray(role[key]) &&
        role[key].every((entry: unknown) => typeof entry === 'string'),
    )
  );
}

async function request<T = unknown>(
  operation: () => Promise<AxiosResponse<T>>,
  kind: AccessRolesOperation = 'list',
): Promise<T> {
  let response;
  try {
    response = await operation();
  } catch (error: unknown) {
    if (axios.isCancel(error)) throw error;
    if (axios.isAxiosError(error) && error.response) {
      throw new AccessRolesError(
        parseAccessRolesFailure(
          error.response.data,
          error.response.status,
          kind,
        ),
      );
    }
    throw new AccessRolesError({ kind: 'network', action: 'retry' });
  }
  if (response.status < 200 || response.status >= 300) {
    throw new AccessRolesError(
      parseAccessRolesFailure(response.data, response.status, kind),
    );
  }
  return response.data;
}

export async function getAccessRoles(
  signal?: AbortSignal,
): Promise<AccessRolesResponse> {
  const data = await request(() =>
    apiClient.get<unknown>('access-roles', {
      signal,
      timeout: 10000,
      validateStatus: () => true,
    }),
  );
  if (
    !Array.isArray(data) ||
    !data.every(isRole) ||
    new Set(data.map((role) => role.code)).size !== data.length
  )
    throw new AccessRolesError({ kind: 'invalidResponse', action: 'retry' });
  return data;
}

export async function saveAccessRole(
  roleCode: string,
  body: SaveAccessRoleRequest,
  signal?: AbortSignal,
): Promise<AccessRolesResponse> {
  return request(
    () =>
      apiClient.put<AccessRolesResponse>(
        `access-roles/${encodeURIComponent(roleCode)}`,
        {
          modules: body.modules,
          pcAccess: body.pcAccess,
          padAccess: body.padAccess,
        },
        { signal, timeout: 10000, validateStatus: () => true },
      ),
    'update',
  );
}

export async function createAccessRole(
  body: CreateAccessRoleRequest,
  signal?: AbortSignal,
): Promise<AccessRoleResponse> {
  return request(
    () =>
      apiClient.post<AccessRoleResponse>(
        'access-roles',
        {
          name: body.name,
          modules: body.modules,
          pcAccess: body.pcAccess,
          padAccess: body.padAccess,
        },
        { signal, timeout: 10000, validateStatus: () => true },
      ),
    'create',
  );
}
