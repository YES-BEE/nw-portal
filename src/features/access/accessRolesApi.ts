import { readApiPage } from '../../api/collections';
import type { ApiPage, ListQuery } from '../../api/collections';
import type { ApiCollection } from '../../api/collections';
import { collectApiItems } from '../../api/collections';
import { apiClient } from '../../api/client';
import axios from 'axios';
import type { AxiosResponse } from 'axios';
import {
  AccessRolesError,
  parseAccessRolesFailure,
} from './accessRolesFailure';
import type {
  AccessRoleResponse,
  DeleteAccessRoleResponse,
  ModuleResponse,
  ModulesResponse,
  AccessRoleOptionResponse,
  AccessRoleOptionsResponse,
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
  return collectApiItems(
    (params) =>
      request(() =>
        apiClient.get<unknown>('access-roles', {
          ...(params ? { params } : {}),
          signal,
          timeout: 10000,
          validateStatus: () => true,
        }),
      ),
    isRole,
    (item) => item.code,
    () => {
      throw new AccessRolesError({ kind: 'invalidResponse', action: 'retry' });
    },
  );
}
export async function getAccessRoleOptions(
  signal?: AbortSignal,
): Promise<AccessRoleOptionsResponse> {
  const isOption = (value: unknown): value is AccessRoleOptionResponse => {
    if (!value || typeof value !== 'object' || Array.isArray(value))
      return false;
    const option = value as Record<string, unknown>;
    return (
      typeof option.code === 'string' &&
      !!option.code.trim() &&
      typeof option.name === 'string' &&
      !!option.name.trim()
    );
  };
  return collectApiItems(
    (params) =>
      request(() =>
        apiClient.get<unknown>('access-roles/options', {
          ...(params ? { params } : {}),
          signal,
          timeout: 10000,
          validateStatus: () => true,
        }),
      ),
    isOption,
    (item) => item.code,
    () => {
      throw new AccessRolesError({ kind: 'invalidResponse', action: 'retry' });
    },
  );
}
export async function getModules(
  signal?: AbortSignal,
): Promise<ModulesResponse> {
  const isModule = (value: unknown): value is ModuleResponse => {
    if (!value || typeof value !== 'object' || Array.isArray(value))
      return false;
    const module = value as Record<string, unknown>;
    return (
      typeof module.key === 'string' &&
      !!module.key.trim() &&
      typeof module.name === 'string' &&
      !!module.name.trim() &&
      typeof module.built_in === 'boolean' &&
      typeof module.active === 'boolean'
    );
  };
  return collectApiItems(
    (params) =>
      request(() =>
        apiClient.get<unknown>('modules', {
          ...(params ? { params } : {}),
          signal,
          timeout: 10000,
          validateStatus: () => true,
        }),
      ),
    isModule,
    (item) => item.key,
    () => {
      throw new AccessRolesError({ kind: 'invalidResponse', action: 'retry' });
    },
  );
}
export async function saveAccessRole(
  roleCode: string,
  body: SaveAccessRoleRequest,
  signal?: AbortSignal,
): Promise<ApiCollection<AccessRoleResponse>> {
  return request(
    () =>
      apiClient.put<ApiCollection<AccessRoleResponse>>(
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

export async function deleteAccessRole(
  roleCode: string,
  signal?: AbortSignal,
): Promise<DeleteAccessRoleResponse> {
  return request(
    () =>
      apiClient.delete<DeleteAccessRoleResponse>(
        `access-roles/${encodeURIComponent(roleCode)}`,
        { signal, timeout: 10000, validateStatus: () => true },
      ),
    'delete',
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

export async function getAccessRolesPage(
  query: ListQuery,
  signal?: AbortSignal,
): Promise<ApiPage<AccessRoleResponse>> {
  const data = await request(() =>
    apiClient.get<unknown>('access-roles', {
      params: query,
      signal,
      timeout: 10000,
      validateStatus: () => true,
    }),
  );
  return readApiPage(
    data,
    query,
    isRole,
    (item) => item.code,
    () => {
      throw new AccessRolesError({ kind: 'invalidResponse', action: 'retry' });
    },
  );
}
