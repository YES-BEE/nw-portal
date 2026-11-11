import axios, { type AxiosResponse } from 'axios';
import { apiClient } from '../../api/client';
import {
  collectApiItems,
  readApiPage,
  type ApiPage,
  type ListQuery,
} from '../../api/collections';
import { readProblemDetails, safeApiText } from '../../api/problemDetails';
import type {
  StorageAreaResponse,
  StorageAreaRequest,
  StorageAreaStatusRequest,
  CreateStorageAreaResponse,
  UpdateStorageAreaResponse,
  DeleteStorageAreaResponse,
  StorageFailure,
  StorageTagOptionResponse,
} from './types';

export class StorageError extends Error {
  readonly failure: StorageFailure;
  constructor(failure: StorageFailure) {
    super(failure.message);
    this.name = 'StorageError';
    this.failure = failure;
  }
}
export function storageFailure(error: unknown): StorageFailure {
  return error instanceof StorageError
    ? error.failure
    : { kind: 'network', action: 'retry' };
}
export function parseStorageFailure(
  data: unknown,
  status: number,
): StorageFailure {
  const { problem, message } = readProblemDetails(data);
  const code = safeApiText(problem?.code);
  const fieldErrors: StorageFailure['fieldErrors'] = {};
  const fields = problem?.fieldErrors;
  if (fields && typeof fields === 'object' && !Array.isArray(fields)) {
    for (const field of [
      'storageNumber',
      'stationNumber',
      'stationId',
      'name',
      'description',
      'nfcUid',
      'tagId',
      'nfcUids',
    ] as const) {
      const text = safeApiText((fields as Record<string, unknown>)[field]);
      if (text) fieldErrors[field] = text;
    }
  }
  if (code === 'STORAGE_NUMBER_EXISTS' && message)
    fieldErrors.storageNumber = message;
  const kind: StorageFailure['kind'] =
    status === 401
      ? 'authentication'
      : status === 403
        ? code === 'ACCESS_DENIED' &&
          problem?.detail === 'Role changed; log in again'
          ? 'roleChanged'
          : 'access'
        : status === 404 || (status === 409 && code === 'NOT_FOUND')
          ? 'notFound'
          : status === 400
            ? code === 'VALIDATION_FAILED'
              ? 'validation'
              : 'invalidRequest'
            : status === 409
              ? 'conflict'
              : status >= 500 && status <= 599
                ? 'service'
                : 'http';
  return {
    kind,
    message,
    status,
    code,
    fieldErrors,
    action:
      kind === 'authentication' || kind === 'roleChanged'
        ? 'signIn'
        : kind === 'notFound'
          ? 'reload'
          : kind === 'service' || kind === 'http'
            ? 'retry'
            : 'none',
  };
}
async function request(
  send: () => Promise<AxiosResponse<unknown>>,
): Promise<unknown> {
  let response;
  try {
    response = await send();
  } catch (error: unknown) {
    if (axios.isCancel(error)) throw error;
    if (axios.isAxiosError(error) && error.response)
      throw new StorageError(
        parseStorageFailure(error.response.data, error.response.status),
      );
    throw new StorageError({ kind: 'network', action: 'retry' });
  }
  if (response.status < 200 || response.status >= 300)
    throw new StorageError(parseStorageFailure(response.data, response.status));
  return response.data;
}
export function isStorageArea(value: unknown): value is StorageAreaResponse {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return (
    [
      'id',
      'station_id',
      'station_code',
      'code',
      'name',
      'storage_number',
      'station_number',
      'storageNumber',
      'stationNumber',
    ].every((key) => typeof row[key] === 'string' && !!row[key].trim()) &&
    (row.description === null || typeof row.description === 'string') &&
    [row.nfc_uid, row.nfcUid].every(
      (uid) => uid === null || (typeof uid === 'string' && !!uid.trim()),
    ) &&
    typeof row.active === 'boolean' &&
    typeof row.version === 'number' &&
    Number.isSafeInteger(row.version) &&
    row.version >= 0 &&
    row.storageNumber === row.code &&
    row.storage_number === row.code &&
    row.stationNumber === row.station_code &&
    row.station_number === row.station_code &&
    row.nfcUid === row.nfc_uid
  );
}
function invalid(): never {
  throw new StorageError({ kind: 'invalidResponse', action: 'retry' });
}
const options = (signal?: AbortSignal) => ({
  signal,
  timeout: 10000,
  validateStatus: () => true,
});
function single(data: unknown, id?: string): StorageAreaResponse {
  if (
    !isStorageArea(data) ||
    (id && data.id.toLowerCase() !== id.toLowerCase())
  )
    return invalid();
  return data;
}
export async function getStorageAreas(
  query: ListQuery,
  signal?: AbortSignal,
): Promise<ApiPage<StorageAreaResponse>> {
  return readApiPage(
    await request(() =>
      apiClient.get<unknown>('storage-areas', {
        ...options(signal),
        params: query,
      }),
    ),
    query,
    isStorageArea,
    (row) => row.id,
    invalid,
  );
}
export async function getStorageArea(
  id: string,
  signal?: AbortSignal,
): Promise<StorageAreaResponse> {
  return single(
    await request(() =>
      apiClient.get<unknown>(
        `storage-areas/${encodeURIComponent(id)}`,
        options(signal),
      ),
    ),
    id,
  );
}
export async function createStorageArea(
  body: StorageAreaRequest,
  signal?: AbortSignal,
): Promise<CreateStorageAreaResponse> {
  return single(
    await request(() =>
      apiClient.post<unknown>('storage-areas', body, options(signal)),
    ),
  );
}
export async function updateStorageArea(
  id: string,
  body: StorageAreaRequest,
  signal?: AbortSignal,
): Promise<UpdateStorageAreaResponse> {
  return single(
    await request(() =>
      apiClient.put<unknown>(
        `storage-areas/${encodeURIComponent(id)}`,
        body,
        options(signal),
      ),
    ),
    id,
  );
}
export async function deleteStorageArea(
  id: string,
  signal?: AbortSignal,
): Promise<DeleteStorageAreaResponse> {
  const row = single(
    await request(() =>
      apiClient.delete<unknown>(
        `storage-areas/${encodeURIComponent(id)}`,
        options(signal),
      ),
    ),
    id,
  );
  if (row.active !== false) return invalid();
  return { ...row, active: false };
}
export async function setStorageAreaStatus(
  id: string,
  body: StorageAreaStatusRequest,
  signal?: AbortSignal,
): Promise<StorageAreaResponse> {
  const row = single(
    await request(() =>
      apiClient.patch<unknown>(
        `storage-areas/${encodeURIComponent(id)}/status`,
        body,
        options(signal),
      ),
    ),
    id,
  );
  if (row.active !== body.active) return invalid();
  return row;
}
export async function getStorageTags(
  signal?: AbortSignal,
): Promise<StorageTagOptionResponse[]> {
  return collectApiItems(
    async (page) => {
      const data = await request(() =>
        apiClient.get<unknown>('ui/lookups', {
          ...options(signal),
          ...(page ? { params: page } : {}),
        }),
      );
      if (!data || typeof data !== 'object' || Array.isArray(data))
        return invalid();
      return (data as Record<string, unknown>).tags;
    },
    (value): value is StorageTagOptionResponse => {
      if (!value || typeof value !== 'object' || Array.isArray(value))
        return false;
      const tag = value as Record<string, unknown>;
      return (
        ['id', 'name', 'uid'].every(
          (key) => typeof tag[key] === 'string' && !!tag[key].trim(),
        ) &&
        (tag.status === 'ACTIVE' || tag.status === 'DELETED') &&
        typeof tag.assigned === 'boolean'
      );
    },
    (tag) => tag.id,
    invalid,
  );
}
